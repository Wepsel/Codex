export const dynamic = "force-dynamic";

import type { ClusterEfficiencyReport } from "@kube-suite/shared";
import { ApiError, apiFetch, isCompanyMembershipInactiveError } from "@/lib/api-client";
import { getRuntimeClusterId } from "@/lib/runtime-cluster";
import { PendingMembershipNotice } from "@/components/pending-membership";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, Clock, Flame, Gauge, PiggyBank, XCircle } from "lucide-react";

function formatMillicores(value: number): string {
  return `${(value / 1000).toFixed(2)} cores`;
}

function formatMegabytes(value: number): string {
  return `${(value / 1024).toFixed(1)} GiB`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value < 100 ? 2 : 0
  }).format(value);
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function truncate(value: string, length = 120): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}...`;
}

const severityStyles: Record<string, string> = {
  high: "border-danger/40 bg-danger/10 text-danger",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-white/10 bg-white/5 text-white/70"
};

const autoStatusStyles: Record<string, string> = {
  success: "border-success/40 bg-success/10 text-success",
  failed: "border-danger/40 bg-danger/10 text-danger",
  pending: "border-warning/40 bg-warning/10 text-warning"
};

async function loadEfficiency(clusterId?: string): Promise<ClusterEfficiencyReport> {
  return apiFetch<ClusterEfficiencyReport>("/cluster/optimizer/efficiency", {}, clusterId);
}

export default async function OptimizerPage() {
  try {
    const clusterId = getRuntimeClusterId();
    const report = await loadEfficiency(clusterId);

    const cpuUtilPercent = Math.round(report.cpu.utilization * 100);
    const memoryUtilPercent = Math.round(report.memory.utilization * 100);
    const potentialSavings = report.costEstimate.potentialSavings;

    return (
      <div className="space-y-8 px-8 pb-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Flame className="h-6 w-6 text-accent" />
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Cluster optimizer</p>
              <h1 className="text-3xl font-semibold text-white">Resource efficiency & advies</h1>
            </div>
          </div>
          <p className="text-xs text-white/40">Laatste analyse: {new Date(report.generatedAt).toLocaleTimeString()}</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">CPU verbruik</p>
                <p className="mt-3 text-3xl font-semibold text-white">{cpuUtilPercent}%</p>
                <p className="mt-1 text-xs text-white/50">
                  {formatMillicores(report.cpu.requested)} van {formatMillicores(report.cpu.allocatable)} allocatable
                </p>
              </div>
              <Gauge className="h-10 w-10 text-accent" />
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Memory verbruik</p>
                <p className="mt-3 text-3xl font-semibold text-white">{memoryUtilPercent}%</p>
                <p className="mt-1 text-xs text-white/50">
                  {formatMegabytes(report.memory.requested)} van {formatMegabytes(report.memory.allocatable)} allocatable
                </p>
              </div>
              <BarChart3 className="h-10 w-10 text-primary-200" />
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Potentiële besparing</p>
                <p className="mt-3 text-3xl font-semibold text-success">{formatEuro(potentialSavings)}</p>
                <p className="mt-1 text-xs text-white/50">Gebaseerd op onbenutte CPU/geheugen-resources</p>
              </div>
              <PiggyBank className="h-10 w-10 text-success" />
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Belangrijkste inzichten</h2>
            <div className="space-y-3">
              {report.insights.map(insight => (
                <div
                  key={insight.id}
                  className={`rounded-2xl border p-5 ${severityStyles[insight.severity] ?? severityStyles.low}`}
                >
                  <p className="text-sm font-semibold">{insight.title}</p>
                  <p className="mt-2 text-sm text-white/70">{insight.description}</p>
                  {insight.recommendation && (
                    <p className="mt-3 text-xs uppercase tracking-[0.35em] text-white/40">
                      Aanpak: {insight.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Workload alerts</h2>
            {report.workloadsNeedingAttention.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
                Alle deployments draaien met de gewenste replicas.
              </div>
            ) : (
              <ul className="space-y-3">
                {report.workloadsNeedingAttention.map(item => (
                  <li key={`${item.namespace}/${item.name}`} className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <span className="text-xs uppercase tracking-[0.35em] text-white/40">{item.namespace}</span>
                    </div>
                    <p className="mt-2 text-sm text-white/70">{item.reason}</p>
                    <p className="mt-1 text-xs text-white/40">
                      Ready {item.replicasReady}/{item.replicasDesired}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Hot nodes</h2>
            {report.hotNodes.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
                Geen nodes boven 75% belasting.
              </div>
            ) : (
              <ul className="space-y-3">
                {report.hotNodes.map(node => (
                  <li key={node.name} className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm">
                    <div className="flex items-center justify-between text-white">
                      <span className="font-semibold">{node.name}</span>
                      <AlertTriangle className="h-4 w-4 text-danger" />
                    </div>
                    <p className="mt-2 text-white/70">CPU {formatPercent(node.cpuUtilization)}</p>
                    <p className="text-white/70">Memory {formatPercent(node.memoryUtilization)}</p>
                    <p className="mt-1 text-xs text-white/40">Pods: {node.pods}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Onderbenutte nodes</h2>
            {report.coldNodes.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
                Geen nodes onder 30% gemiddelde belasting.
              </div>
            ) : (
              <ul className="space-y-3">
                {report.coldNodes.map(node => (
                  <li key={node.name} className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-white">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{node.name}</span>
                      <ArrowDownRight className="h-4 w-4 text-success" />
                    </div>
                    <p className="mt-2 text-white/70">CPU {formatPercent(node.cpuUtilization)}</p>
                    <p className="text-white/70">Memory {formatPercent(node.memoryUtilization)}</p>
                    <p className="mt-1 text-xs text-white/40">Pods: {node.pods}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Namespaces</h2>
          {report.namespaces.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
              Geen namespace data beschikbaar.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.namespaces.map(namespace => (
                <div key={namespace.name} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{namespace.name}</span>
                    {namespace.pressure ? (
                      <ArrowUpRight className="h-4 w-4 text-warning" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-white/40" />
                    )}
                  </div>
                  <p className="mt-2 text-white/70">CPU aandeel: {formatPercent(namespace.cpuShare)}</p>
                  <p className="text-white/70">Memory aandeel: {formatPercent(namespace.memoryShare)}</p>
                  <p className="mt-1 text-xs text-white/40">Workloads: {namespace.workloads}</p>
                  {namespace.pressure && (
                    <p className="mt-2 text-xs uppercase tracking-[0.35em] text-warning">
                      Richting quota
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
<section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Auto-healing acties</h2>
            {report.autoHealing.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
                Geen automatische acties uitgevoerd in de laatste periode.
              </div>
            ) : (
              <ul className="space-y-3">
                {report.autoHealing.map(action => (
                  <li
                    key={action.id}
                    className={`rounded-2xl border p-4 text-sm ${autoStatusStyles[action.status] ?? autoStatusStyles.pending}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        {action.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : action.status === "failed" ? (
                          <XCircle className="h-4 w-4 text-danger" />
                        ) : (
                          <Clock className="h-4 w-4 text-warning" />
                        )}
                        <span className="font-semibold">{action.action}</span>
                      </div>
                      <span className="text-xs uppercase tracking-[0.35em] text-white/40">
                        {formatTimestamp(action.executedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-white/50">{action.target}</p>
                    {action.details && <p className="mt-1 text-xs text-white/60">{action.details}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Recent events & errors</h2>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Events</p>
              {report.history.recentEvents.length === 0 ? (
                <p className="mt-2 text-xs text-white/50">Geen recente events gevonden.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {report.history.recentEvents.slice(0, 5).map(event => (
                    <li key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between text-xs text-white/50">
                        <span>{event.reason ?? event.type ?? "Event"}</span>
                        <span>{formatTimestamp(event.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-sm text-white/70">{truncate(event.message ?? "", 140)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Error logs</p>
              {report.history.errorLogs.length === 0 ? (
                <p className="mt-2 text-xs text-white/50">Geen error logs gevonden.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {report.history.errorLogs.slice(0, 5).map(log => (
                    <li key={log.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between text-xs text-white/50">
                        <span>{log.level.toUpperCase()}</span>
                        <span>{formatTimestamp(log.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-sm text-white/70">{truncate(log.message, 160)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    if (isCompanyMembershipInactiveError(error)) {
      return <PendingMembershipNotice />;
    }

    if (error instanceof ApiError) {
      if (error.status === 404) {
        return (
          <div className="px-8 pb-16">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/60">
              Kies eerst een cluster in de top bar om optimizer inzichten op te halen.
            </div>
          </div>
        );
      }

      if (error.status === 0) {
        return (
          <div className="px-8 pb-16">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/60">
              Backend niet bereikbaar. Controleer de API en probeer opnieuw.
            </div>
          </div>
        );
      }
    }

    throw error;
  }
}



