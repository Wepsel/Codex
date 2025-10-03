export const dynamic = "force-dynamic";

import type {
  CapacityNamespaceSnapshot,
  CapacityNodeSnapshot,
  CapacitySnapshot
} from "@kube-suite/shared";
import { ApiError, apiFetch, isCompanyMembershipInactiveError } from "@/lib/api-client";
import { getRuntimeClusterId } from "@/lib/runtime-cluster";
import { PendingMembershipNotice } from "@/components/pending-membership";
import { Cpu, Gauge, Layers, Server } from "lucide-react";

function formatCores(millicores: number): string {
  if (!Number.isFinite(millicores)) {
    return "--";
  }
  const cores = millicores / 1000;
  if (cores >= 10) {
    return `${cores.toFixed(1)} cores`;
  }
  return `${cores.toFixed(2)} cores`;
}

function formatMemoryMi(mebibytes: number): string {
  if (!Number.isFinite(mebibytes)) {
    return "--";
  }
  const gib = mebibytes / 1024;
  if (gib >= 1) {
    return `${gib.toFixed(gib >= 10 ? 1 : 2)} GiB`;
  }
  return `${Math.round(mebibytes)} MiB`;
}

function usageRatio(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, used / total));
}

function UsageBar({ ratio }: { ratio: number }) {
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full bg-gradient-to-r from-primary-400 via-primary-500 to-accent"
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </div>
  );
}

function NodeCard({ node }: { node: CapacityNodeSnapshot }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Node</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{node.name}</h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/50">
          {node.pods} pods
        </span>
      </header>

      <div className="mt-6 space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>CPU</span>
            <span>
              {formatCores(node.cpuRequested)} / {formatCores(node.cpuAllocatable)}
            </span>
          </div>
          <UsageBar ratio={usageRatio(node.cpuRequested, node.cpuAllocatable)} />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Geheugen</span>
            <span>
              {formatMemoryMi(node.memoryRequested)} / {formatMemoryMi(node.memoryAllocatable)}
            </span>
          </div>
          <UsageBar ratio={usageRatio(node.memoryRequested, node.memoryAllocatable)} />
        </div>

        <div className="flex flex-wrap gap-2">
          {node.conditions.map(condition => {
            const tone =
              condition.status === "True"
                ? "bg-success/20 text-success"
                : condition.status === "False"
                ? "bg-danger/20 text-danger"
                : "bg-white/10 text-white/60";
            return (
              <span
                key={`${condition.type}-${condition.status}`}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.35em] ${tone}`}
              >
                {condition.type}
              </span>
            );
          })}
          {node.conditions.length === 0 && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/50">
              Geen condities
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function NamespaceRow({ namespace, totalCpu, totalMemory }: {
  namespace: CapacityNamespaceSnapshot;
  totalCpu: number;
  totalMemory: number;
}) {
  const cpuRatio = usageRatio(namespace.cpuRequested, totalCpu);
  const memoryRatio = usageRatio(namespace.memoryRequested, totalMemory);

  return (
    <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{namespace.name}</p>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">
            {namespace.workloads} workloads
          </p>
        </div>
        <div className="text-right text-xs text-white/50">
          <p>CPU {formatCores(namespace.cpuRequested)}</p>
          <p>Mem {formatMemoryMi(namespace.memoryRequested)}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
            <span>CPU</span>
            <span>{Math.round(cpuRatio * 100)}%</span>
          </div>
          <UsageBar ratio={cpuRatio} />
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
            <span>Memory</span>
            <span>{Math.round(memoryRatio * 100)}%</span>
          </div>
          <UsageBar ratio={memoryRatio} />
        </div>
      </div>
    </li>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-glow">
      <p className="text-xs uppercase tracking-[0.35em] text-white/40">{title}</p>
      <p className="mt-4 text-sm text-white/60">{description}</p>
    </div>
  );
}

async function getCapacitySnapshot(clusterId?: string): Promise<CapacitySnapshot> {
  return apiFetch<CapacitySnapshot>("/cluster/capacity/overview", {}, clusterId);
}

export default async function CapacityPage() {
  try {
    const clusterId = getRuntimeClusterId();
    const snapshot = await getCapacitySnapshot(clusterId);
    const cpuUsedRatio = usageRatio(snapshot.totals.cpuRequested, snapshot.totals.cpuAllocatable);
    const memoryUsedRatio = usageRatio(snapshot.totals.memoryRequested, snapshot.totals.memoryAllocatable);

    return (
      <div className="space-y-8 px-8 pb-16">
        <header className="flex items-center gap-3">
          <Cpu className="h-6 w-6 text-accent" />
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Cluster capacity</p>
            <h1 className="text-3xl font-semibold text-white">Resource overview</h1>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <Gauge className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">CPU verbruik</p>
                <p className="text-lg font-semibold text-white">
                  {formatCores(snapshot.totals.cpuRequested)} / {formatCores(snapshot.totals.cpuAllocatable)}
                </p>
              </div>
            </div>
            <UsageBar ratio={cpuUsedRatio} />
            <p className="mt-3 text-xs text-white/50">
              Totale capaciteit: {formatCores(snapshot.totals.cpuCapacity)}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <Server className="h-5 w-5 text-primary-200" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Geheugen verbruik</p>
                <p className="text-lg font-semibold text-white">
                  {formatMemoryMi(snapshot.totals.memoryRequested)} / {formatMemoryMi(snapshot.totals.memoryAllocatable)}
                </p>
              </div>
            </div>
            <UsageBar ratio={memoryUsedRatio} />
            <p className="mt-3 text-xs text-white/50">
              Totale capaciteit: {formatMemoryMi(snapshot.totals.memoryCapacity)}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <Layers className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Pods actief</p>
                <p className="text-lg font-semibold text-white">{snapshot.totals.pods}</p>
              </div>
            </div>
            <p className="mt-5 text-sm text-white/60">
              {snapshot.nodes.length} nodes gerapporteerd
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Nodes</h2>
            {snapshot.nodes.length === 0 ? (
              <EmptyState
                title="Geen nodes"
                description="Selecteer een cluster met actieve nodes om capaciteitsdata te laden."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {snapshot.nodes.map(node => (
                  <NodeCard key={node.name} node={node} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.35em] text-white/40">Top namespaces</h2>
            {snapshot.namespaces.length === 0 ? (
              <EmptyState
                title="Geen namespaces"
                description="Er zijn geen workloads gevonden met resource requests."
              />
            ) : (
              <ul className="space-y-3">
                {snapshot.namespaces.map(namespace => (
                  <NamespaceRow
                    key={namespace.name}
                    namespace={namespace}
                    totalCpu={snapshot.totals.cpuRequested}
                    totalMemory={snapshot.totals.memoryRequested}
                  />
                ))}
              </ul>
            )}
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
            <EmptyState
              title="Geen cluster geselecteerd"
              description="Kies een cluster in de bovenste balk om capaciteitsinformatie op te halen."
            />
          </div>
        );
      }

      if (error.status === 0) {
        return (
          <div className="px-8 pb-16">
            <EmptyState
              title="Backend niet bereikbaar"
              description="Controleer of de backend draait en probeer het opnieuw."
            />
          </div>
        );
      }
    }

    throw error;
  }
}
