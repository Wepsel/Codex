
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  ArrowUpRight,
  Clock,
  Download,
  FileBarChart,
  FileText,
  Info,
  KeyRound,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Video,
  X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ComplianceSummary, IncidentWarRoomData } from "@kube-suite/shared";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/components/session-context";

const toggles = [
  { label: "Auto-sync workloads", description: "Refresh workloads every 30s", enabled: true },
  { label: "Deploy preview protection", description: "Ask confirmation before apply", enabled: true },
  { label: "Email alerts", description: "Send critical alerts to email", enabled: false }
];

const statusLabels: Record<IncidentWarRoomData["status"], string> = {
  investigating: "Onderzoek",
  mitigated: "Mitigatie",
  resolved: "Opgelost"
};

const severityStyles: Record<IncidentWarRoomData["severity"], string> = {
  critical: "bg-danger/20 text-danger",
  high: "bg-warning/20 text-warning",
  medium: "bg-success/20 text-success"
};

const trendStyles: Record<IncidentWarRoomData["metrics"][number]["trend"], string> = {
  up: "text-danger",
  down: "text-success",
  flat: "text-white/60"
};

const trendLabels: Record<IncidentWarRoomData["metrics"][number]["trend"], string> = {
  up: "Stijgend",
  down: "Dalend",
  flat: "Stabiel"
};

function formatRelative(timestamp?: string) {
  if (!timestamp) {
    return "onbekend";
  }
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return timestamp;
  }
}

function formatTime(timestamp?: string) {
  if (!timestamp) {
    return "-";
  }
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return timestamp;
  }
}

function policySeverityClass(severity: "critical" | "high" | "medium" | "low") {
  switch (severity) {
    case "critical":
      return "bg-danger/20 text-danger";
    case "high":
      return "bg-warning/20 text-warning";
    case "medium":
      return "bg-primary-500/20 text-primary-200";
    default:
      return "bg-success/20 text-success";
  }
}
interface WarRoomOverlayProps {
  open: boolean;
  data: IncidentWarRoomData | null;
  loading: boolean;
  error: string | null;
  noteContent: string;
  onClose: () => void;
  onRefresh: () => void;
  onNoteChange: (value: string) => void;
  onSubmitNote: (event: React.FormEvent<HTMLFormElement>) => void;
}

function WarRoomOverlay({
  open,
  data,
  loading,
  error,
  noteContent,
  onClose,
  onRefresh,
  onNoteChange,
  onSubmitNote
}: WarRoomOverlayProps) {
  if (!open) {
    return null;
  }

  const metrics = data?.metrics ?? [];
  const videoRooms = data?.videoRooms ?? [];
  const notes = data?.notes ?? [];
  const timeline = data?.postmortemDraft.timeline ?? [];
  const actions = data?.postmortemDraft.actionItems ?? [];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative z-10 flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#060812] shadow-[0_0_45px_rgba(0,0,0,0.45)]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-white/5 px-8 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Incident war room</p>
            <h2 className="mt-2 flex items-center gap-3 text-2xl font-semibold text-white">
              <Activity className="h-6 w-6 text-danger" />
              {data?.title ?? "Live incident"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/40">
              <span>ID {data?.incidentId.slice(0, 8) ?? "-"}</span>
              <span>Commander {data?.commander ?? "-"}</span>
              <span>
                Gestart {data ? formatTime(data.startedAt) : "-"} ({data ? formatRelative(data.startedAt) : "..."})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span className={`rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] ${severityStyles[data.severity]}`}>
                {statusLabels[data.status]} - {data.severity.toUpperCase()}
              </span>
            )}
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/70 transition hover:text-white"
              aria-label="Sluit incident overlay"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        {loading && !data ? (
          <div className="flex flex-1 items-center justify-center text-sm text-white/60">Live incidentgegevens laden...</div>
        ) : (
          <div className="grid flex-1 gap-6 overflow-y-auto px-8 py-6 md:grid-cols-[280px,1fr]">
            <aside className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-white/70">
                <header className="flex items-center justify-between text-white">
                  <span>Bruggen</span>
                  <Video className="h-4 w-4 text-accent" />
                </header>
                <ul className="mt-4 space-y-3">
                  {videoRooms.length ? (
                    videoRooms.map(room => (
                      <li key={room.name} className="rounded-xl border border-white/10 bg-black/60 p-3">
                        <div className="flex items-center justify-between text-white">
                          <span>{room.name}</span>
                          <span className="text-xs uppercase tracking-[0.35em] text-white/40">{room.participants} mensen</span>
                        </div>
                        <a
                          href={room.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:text-white"
                        >
                          Join call <ArrowUpRight className="h-3 w-3" />
                        </a>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-white/40">Geen bridges actief</li>
                  )}
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-white/70">
                <header className="flex items-center justify-between text-white">
                  <span>Tijdlijn</span>
                  <Clock className="h-4 w-4 text-accent" />
                </header>
                <ul className="mt-4 space-y-3">
                  {timeline.length ? (
                    timeline.map(item => (
                      <li key={`${item.timestamp}-${item.description}`} className="rounded-xl border border-white/10 bg-black/60 p-3">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
                          <span>{formatTime(item.timestamp)}</span>
                          {item.owner && <span>{item.owner}</span>}
                        </div>
                        <p className="mt-2 text-white/80">{item.description}</p>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-white/40">Nog geen tijdlijn</li>
                  )}
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-white/70">
                <header className="flex items-center justify-between text-white">
                  <span>Actiepunten</span>
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </header>
                <ul className="mt-4 space-y-3">
                  {actions.length ? (
                    actions.map(item => (
                      <li key={item.id} className="rounded-xl border border-white/10 bg-black/60 p-3">
                        <p className="text-white">{item.description}</p>
                        <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
                          <span>Owner {item.owner}</span>
                          <span>Due {formatRelative(item.dueDate)}</span>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-white/40">Geen open acties</li>
                  )}
                </ul>
              </section>
            </aside>

            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-white/70">
                <header className="flex items-center justify-between text-white">
                  <span>Realtime metrics</span>
                  <button onClick={onRefresh} className="text-xs uppercase tracking-[0.35em] text-accent hover:text-white">
                    Refresh
                  </button>
                </header>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {metrics.length ? (
                    metrics.map(metric => {
                      const arrowClass = metric.trend === "down" ? "rotate-180" : metric.trend === "flat" ? "text-white/40" : "";
                      const barWidth = metric.unit === "%" ? Math.min(100, Math.max(8, metric.value)) : Math.min(100, Math.max(8, metric.value / 40));
                      return (
                        <div key={metric.id} className="rounded-xl border border-white/10 bg-black/60 p-4">
                          <div className="flex items-center justify-between text-white">
                            <span className="text-base font-semibold">{metric.label}</span>
                            <span className={`flex items-center gap-1 text-xs uppercase tracking-[0.35em] ${trendStyles[metric.trend]}`}>
                              {trendLabels[metric.trend]}
                              <ArrowUpRight className={`h-3 w-3 ${arrowClass}`} />
                            </span>
                          </div>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-semibold text-white">{metric.value}</span>
                            <span className="text-xs text-white/40">{metric.unit}</span>
                          </div>
                          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-danger via-primary-500 to-accent" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="col-span-full text-xs text-white/40">Geen metrics beschikbaar</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-white/70">
                <header className="flex items-center justify-between text-white">
                  <span>Notities</span>
                  <StickyNote className="h-4 w-4 text-accent" />
                </header>
                <form onSubmit={onSubmitNote} className="mt-4 space-y-3">
                  <textarea
                    value={noteContent}
                    onChange={event => onNoteChange(event.target.value)}
                    rows={3}
                    placeholder="Laat een update achter voor de war room..."
                    className="w-full rounded-xl border border-white/10 bg-black/60 p-3 text-sm text-white/80 focus:border-accent focus:outline-none"
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      type="submit"
                      disabled={!noteContent.trim()}
                      className="rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/20"
                    >
                      Noteer update
                    </button>
                  </div>
                </form>
                <ul className="mt-4 max-h-56 space-y-3 overflow-y-auto pr-1 text-sm text-white/80">
                  {notes.length ? (
                    notes.map(note => (
                      <li key={note.id} className="rounded-xl border border-white/10 bg-black/60 p-3">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
                          <span>{note.author}</span>
                          <span>{formatRelative(note.timestamp)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-white/80">{note.content}</p>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-white/40">Nog geen notities</li>
                  )}
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-white/70">
                <header className="flex items-center justify-between text-white">
                  <span>Postmortem concept</span>
                  <FileText className="h-4 w-4 text-accent" />
                </header>
                <p className="mt-4 text-sm text-white/80">{data?.postmortemDraft.summary ?? "Nog geen samenvatting beschikbaar."}</p>
              </section>
            </div>
          </div>
        )}
        {error && <div className="border-t border-danger/40 bg-danger/10 px-8 py-3 text-sm text-danger">{error}</div>}
      </div>
    </div>
  );
}
export default function SettingsPage() {
  const { user } = useSession();
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [caCert, setCaCert] = useState("");
  const [insecure, setInsecure] = useState(false);

  const [compliance, setCompliance] = useState<ComplianceSummary | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(true);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  const [warRoom, setWarRoom] = useState<IncidentWarRoomData | null>(null);
  const [warRoomLoading, setWarRoomLoading] = useState(true);
  const [warRoomError, setWarRoomError] = useState<string | null>(null);
  const [warRoomOpen, setWarRoomOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ id: string; name: string }[]>("/clusters").then(setList).catch(() => {});
  }, []);

  const loadCompliance = useCallback(async () => {
    try {
      const data = await apiFetch<ComplianceSummary>("/compliance/summary");
      setCompliance(data);
      setComplianceError(null);
    } catch (error) {
      setComplianceError(error instanceof Error ? error.message : "Kon compliance data niet laden");
    } finally {
      setComplianceLoading(false);
    }
  }, []);

  const loadWarRoom = useCallback(async (withSpinner = false) => {
    if (withSpinner) {
      setWarRoomLoading(true);
    }
    try {
      const data = await apiFetch<IncidentWarRoomData>("/compliance/war-room");
      setWarRoom(data);
      setWarRoomError(null);
    } catch (error) {
      setWarRoomError(error instanceof Error ? error.message : "Kon incidentdata niet laden");
    } finally {
      if (withSpinner) {
        setWarRoomLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setComplianceLoading(true);
    loadCompliance();
    const interval = setInterval(() => {
      loadCompliance();
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadCompliance]);

  useEffect(() => {
    loadWarRoom(true);
  }, [loadWarRoom]);

  useEffect(() => {
    if (!warRoomOpen) {
      return;
    }
    const interval = setInterval(() => {
      loadWarRoom();
    }, 15_000);
    return () => clearInterval(interval);
  }, [warRoomOpen, loadWarRoom]);

  const handleOpenWarRoom = useCallback(() => {
    setWarRoomOpen(true);
    loadWarRoom(true);
  }, [loadWarRoom]);

  const handleNoteSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = noteContent.trim();
      if (!trimmed) {
        return;
      }
      try {
        setWarRoomLoading(true);
        setWarRoomError(null);
        const data = await apiFetch<IncidentWarRoomData>("/compliance/war-room/notes", {
          method: "POST",
          body: JSON.stringify({
            content: trimmed,
            author: user?.name
          })
        });
        setWarRoom(data);
        setNoteContent("");
      } catch (error) {
        setWarRoomError(error instanceof Error ? error.message : "Kon notitie niet opslaan");
      } finally {
        setWarRoomLoading(false);
      }
    },
    [noteContent, user]
  );

  const handleExportReport = useCallback(async () => {
    try {
      setReportError(null);
      setReportLoading(true);
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5010/api";
      const response = await fetch(`${base}/compliance/report`, {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Kon compliance rapport niet downloaden");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const fallbackName = new Date().toISOString().split("T")[0] ?? "rapport";
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?([^";]+)"?/i);
      anchor.href = url;
      anchor.download = filenameMatch?.[1] ?? `nebula-compliance-${fallbackName}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Download mislukt");
    } finally {
      setReportLoading(false);
    }
  }, []);

  const earliestExpiring = useMemo(() => {
    if (!compliance || compliance.secrets.expiring.length === 0) {
      return null;
    }
    return [...compliance.secrets.expiring].sort((a, b) => a.daysRemaining - b.daysRemaining)[0];
  }, [compliance]);
  const isAdmin = useMemo(() => user?.company.role === "admin" && user.company.status === "active", [user]);


  const policySeverityCounts = useMemo(() => {
    if (!compliance) {
      return null;
    }
    return compliance.policies.failedPolicies.reduce<Record<string, number>>((acc, policy) => {
      acc[policy.severity] = (acc[policy.severity] ?? 0) + 1;
      return acc;
    }, {});
  }, [compliance]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) {
      return;
    }
    const created = await apiFetch<{ id: string; name: string }>("/clusters", {
      method: "POST",
      body: JSON.stringify({
        name,
        apiUrl,
        caCert: caCert || undefined,
        insecureTLS: insecure,
        auth: { bearerToken: token || undefined }
      })
    });
    setList(prev => [created, ...prev]);
    setName("");
    setApiUrl("");
    setToken("");
    setCaCert("");
    setInsecure(false);
  }

  const warRoomPreviewNote = warRoom?.notes[0];
  return (
    <div className="space-y-10 px-8 pb-16">
      <header className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-accent" />
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Instellingen</p>
          <h1 className="text-3xl font-semibold text-white">Personaliseer je command center</h1>
        </div>
      </header>

      {user?.company.role === "admin" && user.company.status === "active" && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-lg font-semibold text-white">Bedrijf beheren</h2>
                <p className="text-sm text-white/60">Nodig teammates uit, beheer rollen en verwerk aanvragen</p>
              </div>
            </div>
            <Link
              href="/settings/company"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
            >
              Open beheer
              <ArrowUpRight className="h-4 w-4 text-accent" />
            </Link>
          </div>
        </section>
      )}
      <section className="grid gap-6 md:grid-cols-2">
        {toggles.map(toggle => (
          <article key={toggle.label} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{toggle.label}</h2>
                <p className="text-sm text-white/50">{toggle.description}</p>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full border border-white/10 bg-white/10 p-1 ${
                  toggle.enabled ? "justify-end" : "justify-start"
                }`}
              >
                <span className="h-4 w-4 rounded-full bg-gradient-to-r from-primary-500 to-accent shadow" />
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Incident war room</p>
              <h2 className="text-xl font-semibold text-white">Emergency-mode overlay</h2>
              <p className="mt-2 text-sm text-white/60">
                Combineer bridges, notities, live metrics en een postmortem concept in noodmodus.
              </p>
            </div>
            {warRoom && (
              <span className={`rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] ${severityStyles[warRoom.severity]}`}>
                {statusLabels[warRoom.status]} - {warRoom.severity.toUpperCase()}
              </span>
            )}
          </header>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {warRoom ? (
              warRoom.metrics.slice(0, 3).map(metric => {
                const arrowClass = metric.trend === "down" ? "rotate-180" : metric.trend === "flat" ? "text-white/40" : "";
                return (
                  <div key={metric.id} className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
                    <div className="flex items-center justify-between text-white">
                      <span className="text-base font-semibold">{metric.label}</span>
                      <span className={`flex items-center gap-1 text-xs uppercase tracking-[0.35em] ${trendStyles[metric.trend]}`}>
                        {trendLabels[metric.trend]}
                        <ArrowUpRight className={`h-3 w-3 ${arrowClass}`} />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-semibold text-white">{metric.value}</span>
                      <span className="text-xs text-white/40">{metric.unit}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50 sm:col-span-3">
                Live incidentgegevens laden...
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between text-sm text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Laatste notitie</p>
                <p className="mt-1 text-white/80">
                  {warRoomPreviewNote?.content ?? "Nog geen notities gedeeld tijdens dit incident."}
                </p>
              </div>
              {warRoomPreviewNote && (
                <span className="text-xs uppercase tracking-[0.35em] text-white/40">{formatRelative(warRoomPreviewNote.timestamp)}</span>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenWarRoom}
              className="rounded-full bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black shadow-glow transition hover:bg-white"
            >
              Start emergency overlay
            </button>
            <button
              onClick={() => loadWarRoom(true)}
              className="rounded-full border border-white/10 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:text-white"
            >
              Refresh
            </button>
            <span className="text-xs uppercase tracking-[0.35em] text-white/30">
              Commander {warRoom?.commander ?? "-"} - gestart {warRoom ? formatRelative(warRoom.startedAt) : "..."}
            </span>
          </div>

          {warRoomLoading && <p className="mt-4 text-xs uppercase tracking-[0.35em] text-white/30">Realtime feed synchroniseren...</p>}
          {warRoomError && <p className="mt-4 text-sm text-danger">{warRoomError}</p>}
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Audit en compliance studio</p>
              <h2 className="text-xl font-semibold text-white">Policy radar en rapportage</h2>
              <p className="mt-2 text-sm text-white/60">
                Focus op RBAC-risico&apos;s, secret-rotation en OPA- of Kyverno-failures met exporteerbare rapporten.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50">
                Laatste scan {formatTime(compliance?.policies.lastScan)}
              </span>
              <button
                onClick={() => {
                  setComplianceLoading(true);
                  loadCompliance();
                }}
                className="rounded-full border border-white/10 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:text-white"
              >
                Refresh
              </button>
              <button
                onClick={handleExportReport}
                disabled={reportLoading}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black shadow-glow transition hover:shadow-[0_0_30px_rgba(0,245,212,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {reportLoading ? "Exporteren..." : "Download rapport"}
              </button>
            </div>
          </header>

          {complianceLoading && !compliance && <p className="mt-6 text-sm text-white/50">Compliance samenvatting laden...</p>}
          {!complianceLoading && !compliance && <p className="mt-6 text-sm text-danger">Geen compliance data beschikbaar.</p>}

          {compliance && (
            <div className="mt-6 space-y-6 text-sm text-white/70">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center gap-3 text-white">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                      <ShieldAlert className="h-5 w-5 text-danger" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">High risk roles</p>
                      <p className="text-2xl font-semibold">{compliance.rbac.highRiskRoles.length}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.35em] text-white/30">
                    {compliance.rbac.orphanedBindings} orphan bindings
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center gap-3 text-white">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                      <KeyRound className="h-5 w-5 text-primary-200" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">Secrets expiring</p>
                      <p className="text-2xl font-semibold">{compliance.secrets.expiring.length}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.35em] text-white/30">
                    Binnen {earliestExpiring?.daysRemaining ?? "-"} dagen
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center gap-3 text-white">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                      <ShieldCheck className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">Policy passing</p>
                      <p className="text-2xl font-semibold">{compliance.policies.passing}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.35em] text-white/30">
                    {compliance.policies.failing} failing - {compliance.policies.critical} critical
                  </p>
                </div>
              </div>

              <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <header className="flex items-center justify-between text-white">
                  <span>RBAC risk</span>
                  <ShieldAlert className="h-5 w-5 text-danger" />
                </header>
                <ul className="mt-4 space-y-3">
                  {compliance.rbac.highRiskRoles.map(role => (
                    <li key={role.name} className="rounded-xl border border-white/10 bg-black/60 p-4">
                      <div className="flex items-center justify-between text-white">
                        <span className="text-base font-semibold">{role.name}</span>
                        <span className="text-xs uppercase tracking-[0.35em] text-white/40">{role.members} leden</span>
                      </div>
                      <p className="mt-2 text-xs text-white/50">Privileges: {role.privileges.join(", ")}</p>
                      <p className="mt-2 text-xs text-white/40">Laatste review {formatRelative(role.lastReviewed)}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <header className="flex items-center justify-between text-white">
                  <span>Secret rotation</span>
                  <StickyNote className="h-5 w-5 text-accent" />
                </header>
                <ul className="mt-4 space-y-3">
                  {compliance.secrets.expiring.map(secret => (
                    <li key={`${secret.namespace}-${secret.name}`} className="rounded-xl border border-white/10 bg-black/60 p-4">
                      <div className="flex items-center justify-between text-white">
                        <span className="text-base font-semibold">{secret.name}</span>
                        <span className="text-xs uppercase tracking-[0.35em] text-white/40">{secret.daysRemaining} dagen</span>
                      </div>
                      <p className="mt-2 text-xs text-white/40">
                        {secret.namespace} - {secret.type}
                      </p>
                    </li>
                  ))}
                  {compliance.secrets.unencrypted.length > 0 && (
                    <li className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
                      {compliance.secrets.unencrypted.length} secrets zonder encryptie: {compliance.secrets.unencrypted.map(item => `${item.namespace}/${item.name}`).join(", ")}
                    </li>
                  )}
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <header className="flex items-center justify-between text-white">
                  <span>Policy scans</span>
                  <FileBarChart className="h-5 w-5 text-primary-200" />
                </header>
                <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.35em] text-white/40">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                    Passing {compliance.policies.passing}
                  </span>
                  {policySeverityCounts &&
                    Object.entries(policySeverityCounts).map(([severity, count]) => (
                      <span key={severity} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                        {severity} {count}
                      </span>
                    ))}
                </div>
                <ul className="mt-4 space-y-3">
                  {compliance.policies.failedPolicies.map(policy => (
                    <li key={policy.id} className="rounded-xl border border-white/10 bg-black/60 p-4">
                      <div className="flex items-center justify-between text-white">
                        <div>
                          <p className="text-base font-semibold">{policy.name}</p>
                          <p className="text-xs uppercase tracking-[0.35em] text-white/40">
                            {policy.id} - {policy.resource}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.35em] ${policySeverityClass(policy.severity)}`}>
                          {policy.severity}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-white/70">{policy.description}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <header className="flex items-center justify-between text-white">
                  <span>Aanbevelingen</span>
                  <Sparkles className="h-5 w-5 text-accent" />
                </header>
                <ul className="mt-4 space-y-3">
                  {compliance.recommendations.map(item => (
                    <li key={item} className="rounded-xl border border-white/10 bg-black/60 p-4 text-white/80">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {complianceError && <p className="mt-4 text-sm text-danger">{complianceError}</p>}
          {reportError && <p className="mt-2 text-sm text-danger">{reportError}</p>}
        </article>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {isAdmin ? (
        <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <h2 className="mb-4 text-lg font-semibold text-white">Cluster toevoegen</h2>
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/70">
            <Info className="mt-0.5 h-4 w-4 text-accent" />
            <div>
              <p className="text-sm font-medium text-white">Zo verbind je veilig</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-white/70">
                <li>Maak in je cluster een serviceaccount met minimaal read-only rechten voor namespaces, workloads en events.</li>
                <li>Noteer de API server URL (bijv. https://cluster.example.com:6443) en genereer een bearer token of client certificaat.</li>
                <li>Plak de gegevens hieronder en geef het cluster een herkenbare naam. Alleen in een labo omgeving vink je &ldquo;Skip TLS verify&rdquo; aan.</li>
              </ol>
              <p className="mt-3 text-xs text-white/50">Na het opslaan verschijnt je cluster rechts bij &ldquo;Jouw clusters&rdquo;. Tokens worden versleuteld opgeslagen en kun je altijd weer intrekken.</p>
            </div>
          </div>
          <div className="grid gap-3">
            <input
              className="rounded-md border border-white/10 bg-black/30 p-2 text-sm text-white/90"
              placeholder="Naam"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="rounded-md border border-white/10 bg-black/30 p-2 text-sm text-white/90"
              placeholder="API URL (https://host:6443)"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
            />
            <textarea
              className="rounded-md border border-white/10 bg-black/30 p-2 text-sm text-white/90"
              placeholder="Bearer token (optioneel als je certs gebruikt)"
              value={token}
              onChange={e => setToken(e.target.value)}
            />
            <textarea
              className="rounded-md border border-white/10 bg-black/30 p-2 text-sm text-white/90"
              placeholder="CA cert PEM (optioneel)"
              value={caCert}
              onChange={e => setCaCert(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={insecure} onChange={e => setInsecure(e.target.checked)} />
              Skip TLS verify (alleen lab)
            </label>
            <button type="submit" className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black">
              Opslaan
            </button>
          </div>
        </form>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow text-sm text-white/70">
            <h2 className="mb-3 text-lg font-semibold text-white">Clusterbeheer is alleen voor admins</h2>
            <p>Je kijkt mee met de clusters van je bedrijf. Vraag een admin om je rechten te verhogen als je zelf clusters wilt beheren.</p>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <h2 className="mb-4 text-lg font-semibold text-white">Jouw clusters</h2>
          <ul className="space-y-2">
            {list.map(c => (
              <li key={c.id} className="flex items-center justify-between rounded-md bg-black/30 p-3 text-sm text-white/80">
                <span>{c.name}</span>
                <button
                  onClick={async () => {
                    await apiFetch(`/clusters/${c.id}`, { method: "DELETE" });
                    setList(prev => prev.filter(x => x.id !== c.id));
                    if (typeof window !== "undefined" && localStorage.getItem("clusterId") === c.id) {
                      localStorage.removeItem("clusterId");
                    }
                  }}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  Verwijderen
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="text-xs text-white/40">Nog geen clusters toegevoegd</li>}
          </ul>
        </div>
      </section>

      <WarRoomOverlay
        open={warRoomOpen}
        data={warRoom}
        loading={warRoomLoading}
        error={warRoomError}
        noteContent={noteContent}
        onClose={() => setWarRoomOpen(false)}
        onRefresh={() => loadWarRoom(true)}
        onNoteChange={setNoteContent}
        onSubmitNote={handleNoteSubmit}
      />
    </div>
  );
}



