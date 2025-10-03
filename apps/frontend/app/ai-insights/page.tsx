"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { ClusterEvent } from "@kube-suite/shared";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { MiniChart } from "./components/mini-chart";

interface AnomalyData {
  score: number;
  windowMinutes: number;
  totalEvents: number;
}

type SeverityFilter = "all" | "warning" | "error" | "normal";

type LegacyEventTimestamp = {
  eventTime?: string;
  lastTimestamp?: string;
  firstTimestamp?: string;
};

function resolveEventTimestamp(event: ClusterEvent): number {
  const legacy = event as ClusterEvent & LegacyEventTimestamp;
  const raw =
    event.timestamp ??
    legacy.eventTime ??
    legacy.lastTimestamp ??
    legacy.firstTimestamp ??
    Date.now();
  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
}

function formatRelativeFromNow(date: Date | null): string {
  if (!date) return "nog niet ververst";
  const diff = Date.now() - date.getTime();
  if (diff < 5_000) return "zojuist";
  if (diff < 60_000) return "minder dan 1 min";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} u geleden`;
  const days = Math.floor(hours / 24);
  return `${days} d geleden`;
}

function formatEventAge(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  if (diff < 60_000) {
    const seconds = Math.max(1, Math.floor(diff / 1_000));
    return `${seconds}s geleden`;
  }
  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000);
    return `${minutes}m geleden`;
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours}u geleden`;
  }
  const days = Math.floor(diff / 86_400_000);
  return `${days}d geleden`;
}

function formatTimeOfDay(timestampMs: number): string {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const severityTone: Record<ClusterEvent["type"], string> = {
  Normal: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  Warning: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  Error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

export default function AIInsightsPage() {
  const [anomaly, setAnomaly] = useState<AnomalyData | null>(null);
  const [events, setEvents] = useState<ClusterEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [logTrend, setLogTrend] = useState<Array<{ t: string; v: number }>>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e, lt] = await Promise.all([
        apiFetch<AnomalyData>("/cluster/ai/anomaly"),
        apiFetch<ClusterEvent[]>("/cluster/events"),
        apiFetch<Array<{ t: string; v: number }>>("/cluster/ai/log-trend"),
      ]);
      setAnomaly(a);
      setEvents(e);
      setLogTrend(lt);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const totalEvents = events.length;

  const buckets = useMemo(() => {
    const now = Date.now();
    const sizeMs = 60_000;
    const count = 15;
    const arr = Array.from({ length: count }, (_, index) => ({
      t: new Date(now - (count - 1 - index) * sizeMs),
      v: 0,
    }));
    for (const ev of events) {
      const ts = resolveEventTimestamp(ev);
      const idx = Math.floor((now - ts) / sizeMs);
      const bucketIndex = count - 1 - idx;
      if (bucketIndex >= 0 && bucketIndex < arr.length) {
        arr[bucketIndex].v += 1;
      }
    }
    return arr;
  }, [events]);

  const severityStats = useMemo(() => {
    const tally: Record<"normal" | "warning" | "error", number> = {
      normal: 0,
      warning: 0,
      error: 0,
    };
    for (const ev of events) {
      const key = (ev.type ?? "Normal").toLowerCase();
      if (key === "normal" || key === "warning" || key === "error") {
        tally[key] += 1;
      }
    }
    return { ...tally, total: events.length };
  }, [events]);

  const eventVelocity = useMemo(() => {
    if (buckets.length === 0) {
      return { current: 0, delta: 0 };
    }
    const values = buckets.map((bucket) => bucket.v);
    const windowSize = Math.min(5, values.length);
    const average = (slice: number[]) =>
      slice.length === 0 ? 0 : slice.reduce((sum, value) => sum + value, 0) / slice.length;
    const current = average(values.slice(-windowSize));
    const previousSlice = values.slice(-windowSize * 2, -windowSize);
    const previous = average(previousSlice.length ? previousSlice : values.slice(0, windowSize));
    const delta = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
    return { current, delta };
  }, [buckets]);

  const logVelocity = useMemo(() => {
    if (logTrend.length === 0) {
      return { current: 0, delta: 0 };
    }
    const values = logTrend.map((point) => point.v);
    const windowSize = Math.min(5, values.length);
    const average = (slice: number[]) =>
      slice.length === 0 ? 0 : slice.reduce((sum, value) => sum + value, 0) / slice.length;
    const current = average(values.slice(-windowSize));
    const previousSlice = values.slice(-windowSize * 2, -windowSize);
    const previous = average(previousSlice.length ? previousSlice : values.slice(0, windowSize));
    const delta = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
    return { current, delta };
  }, [logTrend]);

  const reasonBreakdown = useMemo(() => {
    if (events.length === 0) return [];
    const map = new Map<string, { count: number; type: ClusterEvent["type"] }>();
    for (const ev of events) {
      const reason = ev.reason || ev.type || "Onbekend";
      const current = map.get(reason);
      if (current) {
        current.count += 1;
        current.type = current.type ?? ev.type;
      } else {
        map.set(reason, { count: 1, type: ev.type ?? "Normal" });
      }
    }
    const total = events.length || 1;
    return Array.from(map.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        share: Math.round((data.count / total) * 100),
        type: data.type ?? "Normal",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [events]);

  const namespaceBreakdown = useMemo(() => {
    if (events.length === 0) return [];
    const map = new Map<string, number>();
    for (const ev of events) {
      const namespace = ev.involvedObject?.namespace ?? "cluster-breed";
      map.set(namespace, (map.get(namespace) ?? 0) + 1);
    }
    const total = events.length || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([namespace, count]) => ({
        namespace,
        count,
        share: Math.round((count / total) * 100),
      }));
  }, [events]);

  const objectBreakdown = useMemo(() => {
    if (events.length === 0) return [];
    const map = new Map<string, number>();
    for (const ev of events) {
      const kind = ev.involvedObject?.kind ?? "Resource";
      map.set(kind, (map.get(kind) ?? 0) + 1);
    }
    const total = events.length || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([kind, count]) => ({
        kind,
        count,
        share: Math.round((count / total) * 100),
      }));
  }, [events]);

  const severityChips = useMemo(
    () => [
      { id: "all" as SeverityFilter, label: "Alles", count: severityStats.total },
      { id: "warning" as SeverityFilter, label: "Warnings", count: severityStats.warning },
      { id: "error" as SeverityFilter, label: "Errors", count: severityStats.error },
      { id: "normal" as SeverityFilter, label: "Normals", count: severityStats.normal },
    ],
    [severityStats]
  );

  const filteredEvents = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => resolveEventTimestamp(b) - resolveEventTimestamp(a)
    );
    if (severityFilter === "all") {
      return sorted.slice(0, 8);
    }
    return sorted
      .filter((event) => event.type?.toLowerCase() === severityFilter)
      .slice(0, 8);
  }, [events, severityFilter]);

  const recommendations = useMemo(() => {
    const recs = new Set<string>();
    const reasons = new Set(events.map((event) => event.reason));
    if (reasons.has("FailedScheduling")) {
      recs.add(
        "FailedScheduling gedetecteerd: controleer node capacity, taints en HPA/PDB-afspraken."
      );
    }
    if (reasons.has("BackOff") || reasons.has("CrashLoopBackOff")) {
      recs.add(
        "CrashLoopBackOff: inspecteer containerlogs, overweeg een rollback of stel resource-limits bij."
      );
    }
    if (reasons.has("Unhealthy")) {
      recs.add(
        "Unhealthy probes: check liveness/readiness endpoints en koppel timeouts/hertuning."
      );
    }
    if (severityStats.error > 0) {
      recs.add(
        "Error-events aanwezig: run 'kubectl describe' op betrokken objecten om root cause vast te stellen."
      );
    }
    if (severityStats.warning > severityStats.normal) {
      recs.add(
        "Warnings domineren: prioriteer het oplossen van warnings voor ze doorsijpelen naar errors."
      );
    }
    if (eventVelocity.delta > 25) {
      recs.add(
        "Eventvolume stijgt krachtig: bekijk recente deployments of scaling-acties die dit veroorzaken."
      );
    }
    if (logVelocity.delta > 25) {
      recs.add(
        "Log-intensiteit neemt fors toe: zet gerichte logfilters aan of valideer of een component spam veroorzaakt."
      );
    }
    if (recs.size === 0) {
      recs.add("Geen duidelijke issues. Blijf events en metrics monitoren voor vroege signalen.");
    }
    return Array.from(recs);
  }, [
    events,
    severityStats.error,
    severityStats.warning,
    severityStats.normal,
    eventVelocity.delta,
    logVelocity.delta,
  ]);

  const anomalyScore = anomaly?.score ?? 0;
  const anomalyWindow = anomaly?.windowMinutes ?? 15;
  const anomalyTotal = anomaly?.totalEvents ?? totalEvents;
  const anomalyToneClass =
    anomalyScore > 70 ? "bg-rose-500" : anomalyScore > 40 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="space-y-10 px-8 pb-20">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.04] px-8 py-10 shadow-[0_40px_120px_rgba(15,23,42,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.28),transparent_60%)]" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-sky-500/20 blur-[110px]" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-white/60">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">AI Insights</span>
              <span
                className={`flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 ${
                  loading
                    ? "bg-amber-400/10 text-amber-200"
                    : autoRefresh
                    ? "bg-emerald-400/10 text-emerald-200"
                    : "bg-white/10 text-white/70"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    loading
                      ? "animate-pulse bg-amber-300"
                      : autoRefresh
                      ? "bg-emerald-300"
                      : "bg-white/40"
                  }`}
                />
                {loading ? "Bezig met verversen" : autoRefresh ? "Live" : "Gepauzeerd"}
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold text-white md:text-5xl">Realtime cluster intelligence</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-white/70">
                Een moderne cockpit voor je Kubernetes-omgeving. Zie anomalies, eventvolume en logintensiteit in een oogopslag en grijp direct in waar nodig.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAutoRefresh((prev) => !prev)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.32em] transition ${
                  autoRefresh
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100 hover:border-emerald-400"
                    : "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Auto-refresh {autoRefresh ? "aan" : "uit"}
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-white/70 transition hover:text-white disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />
                Vernieuwen
              </button>
            </div>
            <span className="text-xs uppercase tracking-[0.32em] text-white/50">
              Laatste update {formatRelativeFromNow(lastUpdated)}
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Anomaly score</p>
            <div className="mt-4 flex items-baseline gap-2 text-white">
              <span className="text-5xl font-semibold">{anomalyScore}</span>
              <span className="text-sm text-white/50">/ 100</span>
            </div>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${anomalyToneClass}`} style={{ width: `${Math.min(anomalyScore, 100)}%` }} />
            </div>
            <div className="mt-4 grid gap-1 text-xs text-white/50">
              <span>Window: laatste {anomalyWindow} min</span>
              <span>Totaal events: {anomalyTotal}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Event velocity</p>
            <div className="mt-4">
              <MiniChart data={buckets} height={90} />
            </div>
            <div className="mt-6 flex items-end justify-between text-white">
              <div>
                <p className="text-3xl font-semibold">{eventVelocity.current.toFixed(1)}</p>
                <p className="text-xs text-white/50">events/min</p>
              </div>
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${
                  eventVelocity.delta >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {eventVelocity.delta >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {Math.abs(eventVelocity.delta).toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Log intensiteit</p>
            <div className="mt-4">
              <MiniChart data={logTrend.map((point) => ({ t: new Date(point.t), v: point.v }))} height={90} />
            </div>
            <div className="mt-6 flex items-end justify-between text-white">
              <div>
                <p className="text-3xl font-semibold">{logVelocity.current.toFixed(0)}</p>
                <p className="text-xs text-white/50">regels/min</p>
              </div>
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${
                  logVelocity.delta >= 0 ? "text-cyan-200" : "text-rose-300"
                }`}
              >
                {logVelocity.delta >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {Math.abs(logVelocity.delta).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Event volume (15 min)</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Activity heatline</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                  Gem. {eventVelocity.current.toFixed(1)} / min
                </span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                  {totalEvents} events totaal
                </span>
              </div>
            </div>
            <div className="mt-6">
              <MiniChart data={buckets} height={120} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Live feed</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Laatste gebeurtenissen</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {severityChips.map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setSeverityFilter(chip.id)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.3em] transition ${
                      severityFilter === chip.id
                        ? "border-white/80 bg-white/20 text-white"
                        : "border-white/15 bg-white/5 text-white/60 hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {chip.label}
                    <span className="ml-2 text-white/40">{chip.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-6 space-y-4">
              {filteredEvents.length === 0 && (
                <li className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/60">
                  Geen events voor deze filter.
                </li>
              )}
              {filteredEvents.map((event) => {
                const ts = resolveEventTimestamp(event);
                return (
                  <li
                    key={`${event.id}-${ts}`}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 md:flex-row md:items-start md:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.35em] ${
                            severityTone[event.type ?? "Normal"] ?? "border-white/20 bg-white/10 text-white/60"
                          }`}
                        >
                          {event.type ?? "Onbekend"}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {event.reason || event.involvedObject?.kind || "Onbekende reden"}
                        </span>
                      </div>
                      <p className="text-sm text-white/70">{event.message}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
                        <span>
                          {event.involvedObject?.kind ?? "Resource"} - {event.involvedObject?.name ?? "n.v.t."}
                        </span>
                        {event.involvedObject?.namespace && (
                          <span>Namespace - {event.involvedObject.namespace}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end justify-end gap-2 text-right text-xs text-white/50">
                      <span>{formatTimeOfDay(ts)}</span>
                      <span className="rounded-full bg-white/5 px-2 py-1">{formatEventAge(ts)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Root causes</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Top drivers</h3>
            <div className="mt-6 space-y-4">
              {reasonBreakdown.map((item) => (
                <div key={item.reason} className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-white">
                    <span>{item.reason}</span>
                    <span className="text-white/50">{item.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full ${
                        severityTone[item.type] ?? "bg-white/40"
                      }`}
                      style={{ width: `${item.share}%` }}
                    />
                  </div>
                </div>
              ))}
              {reasonBreakdown.length === 0 && (
                <p className="text-sm text-white/50">Er zijn geen events gevonden in deze periode.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Impact radar</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Waar speelt het?</h3>
            <div className="mt-5 grid gap-5">
              <div>
                <h4 className="text-xs uppercase tracking-[0.3em] text-white/40">Namespaces</h4>
                <ul className="mt-3 space-y-3">
                  {namespaceBreakdown.map((item) => (
                    <li key={item.namespace} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-white">
                        <span>{item.namespace}</span>
                        <span className="text-white/50">{item.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-sky-400/70" style={{ width: `${item.share}%` }} />
                      </div>
                    </li>
                  ))}
                  {namespaceBreakdown.length === 0 && (
                    <li className="text-sm text-white/50">Geen namespaces met activity.</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-[0.3em] text-white/40">Resources</h4>
                <ul className="mt-3 space-y-3">
                  {objectBreakdown.map((item) => (
                    <li key={item.kind} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-white">
                        <span>{item.kind}</span>
                        <span className="text-white/50">{item.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-emerald-400/70" style={{ width: `${item.share}%` }} />
                      </div>
                    </li>
                  ))}
                  {objectBreakdown.length === 0 && (
                    <li className="text-sm text-white/50">Nog geen resource-impact in kaart.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-transparent p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">AI Quick wins</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Aanbevolen acties</h3>
            <ul className="mt-5 space-y-3 text-sm text-white/80">
              {recommendations.map((recommendation, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-emerald-300" />
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
              <a
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 transition hover:border-white/40 hover:text-white"
                href="/self-healing"
              >
                Self-healing
              </a>
              <a
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 transition hover:border-white/40 hover:text-white"
                href="/events"
              >
                Events
              </a>
              <a
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 transition hover:border-white/40 hover:text-white"
                href="/logs"
              >
                Logs
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
