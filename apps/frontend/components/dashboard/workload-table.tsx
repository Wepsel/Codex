"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkloadSummary } from "@kube-suite/shared";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/components/session-context";
import { getRuntimeClusterId } from "@/lib/runtime-cluster";

interface WorkloadTableProps {
  workloads: WorkloadSummary[];
}

interface ScaleState {
  ns: string;
  name: string;
  current: number;
}

export function WorkloadTable({ workloads }: WorkloadTableProps) {
  const { user } = useSession();
  const isAdmin = user?.company.role === "admin" && user.company.status === "active";

  const [query, setQuery] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState<string>("all");
  const [scaleOpen, setScaleOpen] = useState<ScaleState | null>(null);
  const [desired, setDesired] = useState<number>(0);

  useEffect(() => {
    if (scaleOpen) {
      setDesired(scaleOpen.current);
    }
  }, [scaleOpen]);

  useEffect(() => {
    if (!isAdmin && scaleOpen) {
      setScaleOpen(null);
    }
  }, [isAdmin, scaleOpen]);

  const resolveClusterId = useCallback(() => {
    if (typeof window === "undefined") {
      return getRuntimeClusterId();
    }
    const stored = window.localStorage.getItem("clusterId");
    return stored && stored.length > 0 ? stored : undefined;
  }, []);

  const executeClusterAction = useCallback(
    async (path: string, init?: RequestInit) => {
      const clusterId = resolveClusterId();
      if (!clusterId) {
        alert("Selecteer eerst een cluster in de instellingen.");
        return false;
      }
      try {
        await apiFetch(`/clusters/${clusterId}${path}`, init);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Actie mislukt";
        alert(message);
        return false;
      }
    },
    [resolveClusterId]
  );

  const namespaces = useMemo(() => {
    return Array.from(new Set(workloads.map(w => w.namespace))).sort();
  }, [workloads]);

  const filtered = useMemo(() => {
    return workloads.filter(w => {
      const namespaceMatch = namespaceFilter === "all" || w.namespace === namespaceFilter;
      const nameMatch = w.name.toLowerCase().includes(query.toLowerCase());
      return namespaceMatch && nameMatch;
    });
  }, [workloads, namespaceFilter, query]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Top workloads</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Realtime replica status</h3>
        </div>
        <div className="flex items-center gap-3">
          <input
            placeholder="Zoek..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-1 text-sm text-white/80"
          />
          <select
            value={namespaceFilter}
            onChange={event => setNamespaceFilter(event.target.value)}
            className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80"
          >
            <option value="all">Alle namespaces</option>
            {namespaces.map(ns => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/50">
            {filtered.length} workloads
          </span>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
        <table className="min-w-full divide-y divide-white/5">
          <thead className="bg-black/20 text-left text-xs uppercase tracking-[0.35em] text-white/40">
            <tr>
              <th className="px-6 py-4">Naam</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4">Replica&apos;s</th>
              <th className="px-6 py-4">Image</th>
              <th className="px-6 py-4">Laatst bijgewerkt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.slice(0, 50).map((workload, index) => (
              <motion.tr
                key={`${workload.namespace}-${workload.name}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/[0.02] text-sm text-white/70 hover:bg-white/[0.06]"
              >
                <td className="px-6 py-4 font-medium text-white">{workload.name}</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/60">
                    {workload.namespace}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <ReplicaPill desired={workload.replicasDesired} ready={workload.replicasReady} />
                    {isAdmin ? (
                      <>
                        <button
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                          onClick={() => setScaleOpen({ ns: workload.namespace, name: workload.name, current: workload.replicasDesired })}
                        >
                          Scale
                        </button>
                        <button
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                          onClick={async () => {
                            const ok = await executeClusterAction(
                              `/namespaces/${workload.namespace}/deployments/${workload.name}/pause`,
                              { method: "POST" }
                            );
                            if (ok) {
                              alert("Rollout gepauzeerd (202)");
                            }
                          }}
                        >
                          Pause
                        </button>
                        <button
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                          onClick={async () => {
                            const ok = await executeClusterAction(
                              `/namespaces/${workload.namespace}/deployments/${workload.name}/resume`,
                              { method: "POST" }
                            );
                            if (ok) {
                              alert("Rollout hervat (202)");
                            }
                          }}
                        >
                          Resume
                        </button>
                        <button
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                          onClick={async () => {
                            const ok = await executeClusterAction(
                              `/namespaces/${workload.namespace}/deployments/${workload.name}/restart`,
                              { method: "POST" }
                            );
                            if (ok) {
                              alert("Rollout opnieuw gestart (202)");
                            }
                          }}
                        >
                          Restart
                        </button>
                      </>
                    ) : (
                      <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/40">Alleen lezen</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-white/40">{workload.image}</td>
                <td className="px-6 py-4 text-xs text-white/50">{new Date(workload.updatedAt).toLocaleString()}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {scaleOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-background p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Scale {scaleOpen.name}</h3>
            <p className="mt-1 text-xs text-white/50">Namespace: {scaleOpen.ns}</p>
            <div className="mt-4 space-y-3">
              <input
                type="number"
                min={0}
                value={desired}
                onChange={event => setDesired(Number(event.target.value))}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80"
              />
              <input
                type="range"
                min={0}
                max={Math.max(10, scaleOpen.current * 2)}
                value={desired}
                onChange={event => setDesired(Number(event.target.value))}
                className="w-full"
              />
              <div className="text-xs text-white/60">Huidig: {scaleOpen.current} | Nieuw: {desired}</div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                onClick={() => setScaleOpen(null)}
              >
                Annuleren
              </button>
              <button
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black"
                onClick={async () => {
                  const ok = await executeClusterAction(
                    `/namespaces/${scaleOpen.ns}/deployments/${scaleOpen.name}/scale`,
                    {
                      method: "POST",
                      body: JSON.stringify({ replicas: desired })
                    }
                  );
                  if (ok) {
                    setScaleOpen(null);
                  }
                }}
              >
                Scale naar {desired}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReplicaPill({ desired, ready }: { desired: number; ready: number }) {
  const percentage = desired === 0 ? 0 : Math.round((ready / desired) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 w-32 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 via-primary-400 to-accent"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className="text-xs text-white/50">
        {ready}/{desired}
      </span>
    </div>
  );
}