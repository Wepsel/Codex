"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/components/session-context";
import { AlertTriangle, Bomb, RefreshCw, RotateCcw, Users } from "lucide-react";
import type { DeploymentProgressEvent, EventEnvelope } from "@kube-suite/shared";
import { restartDeployment as restartDeploy, scaleDeployment as scaleDeploy } from "./actions";
import { Confirm } from "./confirm";

interface NamespacePods {
  name: string;
  pods: { name: string; containers: string[] }[];
}

export default function SelfHealingPage() {
  const { loading } = useSession();
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNs, setSelectedNs] = useState<string | null>(null);
  const [pods, setPods] = useState<NamespacePods | null>(null);
  const [deployments, setDeployments] = useState<
    Array<{ name: string; replicasDesired: number; replicasReady: number; paused: boolean; image: string; updatedAt: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [busyPod, setBusyPod] = useState<string | null>(null);
  const [progress, setProgress] = useState<DeploymentProgressEvent[]>([]);
  const [scaleBusy, setScaleBusy] = useState<string | null>(null);
  const [restartBusy, setRestartBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    refreshNamespaces();
  }, [loading]);

  async function refreshNamespaces() {
    setError(null);
    try {
      const data = await apiFetch<string[]>("/cluster/namespaces");
      setNamespaces(data);
      if (!selectedNs && data.length > 0) {
        setSelectedNs(data[0]);
        await refreshPods(data[0]);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function restart(name: string) {
    if (!pods) return;
    setRestartBusy(name);
    try {
      await restartDeploy(pods.name, name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRestartBusy(null);
      await refreshPods(pods.name);
    }
  }

  async function scale(name: string, replicas: number) {
    if (!pods) return;
    setScaleBusy(name);
    try {
      await scaleDeploy(pods.name, name, replicas);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScaleBusy(null);
      await refreshPods(pods.name);
    }
  }

  async function refreshPods(ns: string) {
    setError(null);
    try {
      const list = await apiFetch<Array<{ name: string; containers: string[] }>>(`/cluster/namespaces/${encodeURIComponent(ns)}/pods`);
      setPods({ name: ns, pods: list });
      const deps = await apiFetch<Array<{ name: string; replicasDesired: number; replicasReady: number; paused: boolean; image: string; updatedAt: string }>>(
        `/cluster/namespaces/${encodeURIComponent(ns)}/deployments`
      );
      setDeployments(deps);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function crashPod(pod: string) {
    if (!pods) return;
    setBusyPod(pod);
    setError(null);
    try {
      // Use cluster-scoped alias; apiFetch will prepend the active cluster id automatically for /cluster/* paths
      await apiFetch(`/cluster/namespaces/${encodeURIComponent(pods.name)}/pods/${encodeURIComponent(pod)}`, {
        method: "DELETE",
        parseJson: false
      });
      await refreshPods(pods.name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyPod(null);
    }
  }

  // apiFetch scopes "/cluster/..." with the active cluster id automatically; for the DELETE endpoint we point to the fully scoped alias
  const canInteract = useMemo(() => namespaces.length > 0 && !loading, [namespaces, loading]);

  useEffect(() => {
    const socketModule = import("socket.io-client");
    let cleanup = () => {};
    socketModule.then(({ io }) => {
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5010", {
        path: process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/ws"
      });
      socket.emit("register", { userId: "self-healing", clusters: ["demo-cluster"] });
      socket.on("workflow", (event: EventEnvelope<DeploymentProgressEvent>) => {
        const payload = event.payload as DeploymentProgressEvent;
        setProgress(prev => {
          const existingStages = new Set(prev.map(p => p.stage));
          return existingStages.has(payload.stage)
            ? prev.map(item => (item.stage === payload.stage ? payload : item))
            : [...prev, payload];
        });
      });
      cleanup = () => socket.disconnect();
    });
    return () => cleanup();
  }, []);

  return (
    <div className="px-8 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Kubernetes</p>
          <h1 className="text-2xl font-semibold text-white">Self-Healing Lab</h1>
        </div>
        <button
          onClick={refreshNamespaces}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" /> Vernieuwen
        </button>
      </header>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-danger">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-5 gap-6">
        <aside className="col-span-1 rounded-2xl border border-white/10 bg-black/40 p-3">
          <p className="mb-2 px-2 text-xs uppercase tracking-[0.35em] text-white/40">Namespaces</p>
          <ul className="space-y-1">
            {namespaces.map(ns => (
              <li key={ns}>
                <button
                  onClick={() => {
                    setSelectedNs(ns);
                    refreshPods(ns);
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                    selectedNs === ns ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
                  }`}
                  disabled={!canInteract}
                >
                  {ns}
                </button>
              </li>
            ))}
            {namespaces.length === 0 ? (
              <li className="px-3 py-2 text-sm text-white/50">Geen namespaces gevonden</li>
            ) : null}
          </ul>
        </aside>

        <section className="col-span-4 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Deployments {pods ? `in ${pods.name}` : ""}</h2>
              <a href="/ai-insights" className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.35em] text-white/70 hover:text-white">
                AI Insights
              </a>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {deployments.map(d => (
                <div key={d.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{d.name}</p>
                      <p className="text-xs text-white/50">
                        {d.replicasReady}/{d.replicasDesired} ready • {d.paused ? "paused" : "active"} • {d.image}
                      </p>
                      <Status namespace={pods?.name ?? ""} name={d.name} />
                    </div>
                  <div className="flex items-center gap-2">
                    <Confirm
                      title={`Scale ${d.name} naar ${Math.max(0, d.replicasDesired - 1)} replicas?`}
                      actionLabel="Scale"
                      onConfirm={() => scale(d.name, Math.max(0, d.replicasDesired - 1))}
                    >
                      {(open) => (
                        <button
                          onClick={open}
                          disabled={scaleBusy === d.name}
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:text-white disabled:opacity-60"
                        >
                          - Replicas
                        </button>
                      )}
                    </Confirm>
                      <button
                        onClick={() => scale(d.name, d.replicasDesired + 1)}
                        disabled={scaleBusy === d.name}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:text-white disabled:opacity-60"
                      >
                        + Replicas
                      </button>
                    <Confirm
                      title={`Restart ${d.name}?`}
                      actionLabel="Restart"
                      onConfirm={() => restart(d.name)}
                    >
                      {(open) => (
                        <button
                          onClick={open}
                          disabled={restartBusy === d.name}
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:text-white disabled:opacity-60"
                        >
                          Restart
                        </button>
                      )}
                    </Confirm>
                    </div>
                  </div>
                </div>
              ))}
              {deployments.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                  Geen deployments gevonden.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Pods {pods ? `in ${pods.name}` : ""}</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
            {pods?.pods.map(p => (
              <div key={p.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-white/50">Containers: {p.containers.filter(Boolean).join(", ") || "-"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => scale(p.name, 0)}
                      disabled={scaleBusy === p.name}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:text-white disabled:opacity-60"
                      title="Scale to 0"
                    >
                      0 <Users className="ml-1 inline h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => restart(p.name)}
                      disabled={restartBusy === p.name}
                      className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:text-white disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restart
                    </button>
                      <Confirm
                        title={`Crash pod ${p.name}?`}
                        description="De pod wordt verwijderd; Kubernetes zal een nieuwe starten (self-healing)."
                        actionLabel="Crash"
                        variant="danger"
                        onConfirm={() => crashPod(p.name)}
                      >
                        {(open) => (
                          <button
                            onClick={open}
                            disabled={busyPod === p.name}
                            className="flex items-center gap-2 rounded-full border border-danger/30 bg-danger/15 px-3 py-1.5 text-xs uppercase tracking-[0.35em] text-danger hover:bg-danger/20 disabled:opacity-60"
                          >
                            <Bomb className="h-4 w-4" /> Crash
                          </button>
                        )}
                      </Confirm>
                  </div>
                </div>
              </div>
            ))}
            {!pods || pods.pods.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                Geen pods om te tonen.
              </div>
            ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
        <h3 className="text-lg font-semibold text-white">Live workflow</h3>
        <div className="mt-3 grid grid-cols-5 gap-3">
          {progress.length === 0 ? (
            <p className="col-span-5 text-sm text-white/60">Nog geen events.</p>
          ) : (
            progress.map(item => (
              <div key={`${item.stage}-${item.timestamp}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
                  <span>{item.stage}</span>
                  <span>{item.percentage}%</span>
                </div>
                <p className="mt-1 text-white">{item.message}</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Status({ namespace, name }: { namespace: string; name: string }) {
  const [status, setStatus] = useState<{ available: boolean; progressing: boolean; message?: string } | null>(null);
  useEffect(() => {
    let mounted = true;
    apiFetch<{ available: boolean; progressing: boolean; message?: string }>(
      `/cluster/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}/status`
    )
      .then(s => {
        if (mounted) setStatus(s);
      })
      .catch(() => {});
    const id = setInterval(() => {
      apiFetch<{ available: boolean; progressing: boolean; message?: string }>(
        `/cluster/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}/status`
      )
        .then(s => {
          if (mounted) setStatus(s);
        })
        .catch(() => {});
    }, 4000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [namespace, name]);

  if (!status) return null;
  return (
    <p className="mt-1 text-[11px] text-white/40">
      {status.available ? "Available" : status.progressing ? "Progressing" : "Pending"}
      {status.message ? ` • ${status.message}` : ""}
    </p>
  );
}


