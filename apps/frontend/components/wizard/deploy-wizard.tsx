"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Rocket, X, CheckCircle2, AlertCircle, FileDiff, Play } from "lucide-react";
import type {
  DeploymentPlanResponse,
  DeploymentProgressEvent,
  DeploymentWizardPayload,
  EventEnvelope
} from "@kube-suite/shared";
import { apiFetch } from "@/lib/api-client";

const defaultManifest = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nebula-gateway
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: nebula-gateway
  template:
    metadata:
      labels:
        app: nebula-gateway
    spec:
      containers:
        - name: web
          image: ghcr.io/nebula/gateway:1.9.0
          ports:
            - containerPort: 8080
`;

interface DeployWizardProps {
  open: boolean;
  onClose: () => void;
}

interface WizardState {
  name: string;
  namespace: string;
  image: string;
  replicas: number;
  strategy: DeploymentWizardPayload["strategy"];
  manifest: string;
}

const initialState: WizardState = {
  name: "nebula-gateway",
  namespace: "production",
  image: "ghcr.io/nebula/gateway:1.9.0",
  replicas: 3,
  strategy: "RollingUpdate",
  manifest: defaultManifest
};

export function DeployWizard({ open, onClose }: DeployWizardProps) {
  const [form, setForm] = useState<WizardState>(initialState);
  const [plan, setPlan] = useState<DeploymentPlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<DeploymentProgressEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPlan(null);
      setDeploying(false);
      setExecutionId(null);
      setProgress([]);
      setError(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !executionId) {
      return;
    }

    const socketModule = import("socket.io-client");
    let cleanup = () => {};

    socketModule.then(({ io }) => {
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5010", {
        path: process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/ws"
      });
      socket.emit("register", { userId: "deploy-wizard", clusters: ["demo-cluster"] });
      socket.on("workflow", (event: EventEnvelope<DeploymentProgressEvent>) => {
        const payload = event.payload as DeploymentProgressEvent;
        if (payload.id !== executionId) {
          return;
        }
        setProgress(prev => {
          const existingStages = new Set(prev.map(item => item.stage));
          return existingStages.has(payload.stage)
            ? prev.map(item => (item.stage === payload.stage ? payload : item))
            : [...prev, payload];
        });
        if (payload.stage === "complete") {
          setDeploying(false);
        }
      });
      cleanup = () => socket.disconnect();
    });

    return () => {
      cleanup();
    };
  }, [open, executionId]);

  const sortedProgress = useMemo(
    () =>
      [...progress].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [progress]
  );

  async function handleGeneratePlan() {
    setPlanLoading(true);
    setError(null);
    try {
      const payload: DeploymentWizardPayload = {
        name: form.name,
        namespace: form.namespace,
        image: form.image,
        replicas: form.replicas,
        strategy: form.strategy,
        manifestYaml: form.manifest
      };
      const result = await apiFetch<DeploymentPlanResponse>("/cluster/deployments/plan", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setPlan(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleLaunchDeploy() {
    setError(null);
    setDeploying(true);
    setProgress([]);
    try {
      const result = await apiFetch<{ accepted: boolean; executionId: string }>("/cluster/deployments", {
        method: "POST",
        body: JSON.stringify({ manifestYaml: form.manifest })
      });
      if (!result.executionId) {
        throw new Error("Geen execution id ontvangen");
      }
      setExecutionId(result.executionId);
    } catch (err) {
      setDeploying(false);
      setError((err as Error).message);
    }
  }

  function handleClose() {
    if (deploying) {
      return;
    }
    onClose();
  }

  function updateForm<T extends keyof WizardState>(key: T, value: WizardState[T]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative flex h-[90vh] w-[min(1100px,90vw)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0b23]/95 shadow-[0_0_60px_rgba(64,64,255,0.45)]"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 20 }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-8 py-6">
              <div>
                <p className="text-xs uppercase tracking-[0.45em] text-white/40">Deploy wizard</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Cinematic rollout journey</h2>
              </div>
              <div className="flex items-center gap-3">
                {deploying && (
                  <span className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-accent">
                    <Loader2 className="h-4 w-4 animate-spin" /> Live deploy
                  </span>
                )}
                <button
                  onClick={handleClose}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:text-white"
                  aria-label="Close wizard"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">\n              <div className="grid grid-cols-5 gap-6">
              <section className="col-span-3 flex flex-col space-y-6 overflow-hidden">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Naam</span>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 focus:border-accent focus:outline-none"
                      value={form.name}
                      onChange={event => updateForm("name", event.target.value)}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Namespace</span>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 focus:border-accent focus:outline-none"
                      value={form.namespace}
                      onChange={event => updateForm("namespace", event.target.value)}
                    />
                  </label>
                  <label className="col-span-2 space-y-2">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Container image</span>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 focus:border-accent focus:outline-none"
                      value={form.image}
                      onChange={event => updateForm("image", event.target.value)}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Replica''s</span>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 focus:border-accent focus:outline-none"
                      value={form.replicas}
                      onChange={event => updateForm("replicas", Number(event.target.value))}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Strategie</span>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 focus:border-accent focus:outline-none"
                      value={form.strategy}
                      onChange={event => updateForm("strategy", event.target.value as WizardState["strategy"])}
                    >
                      <option value="RollingUpdate">RollingUpdate</option>
                      <option value="Recreate">Recreate</option>
                    </select>
                  </label>
                </div>

                <div className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.35em] text-white/40">
                    <span>Manifest YAML</span>
                    <span className="flex items-center gap-2 text-white/30">
                      <FileDiff className="h-4 w-4" />
                      Synced with plan
                    </span>
                  </div>
                  <textarea
                    className="h-full w-full resize-none bg-transparent px-5 py-4 font-mono text-sm text-white/80 focus:outline-none"
                    value={form.manifest}
                    onChange={event => updateForm("manifest", event.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    {error && (
                      <span className="flex items-center gap-2 text-danger">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGeneratePlan}
                      disabled={planLoading}
                      className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                    >
                      {planLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDiff className="h-4 w-4" />}
                      Generate plan
                    </button>
                    <button
                      onClick={handleLaunchDeploy}
                      disabled={deploying || !plan}
                      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-background shadow-glow transition disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" /> Launch deploy
                    </button>
                  </div>
                </div>
              </section>

              <section className="col-span-2 flex flex-col space-y-6">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                  <header className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">Timeline</p>
                      <h3 className="text-lg font-semibold text-white">Mission checklist</h3>
                    </div>
                    <Rocket className="h-5 w-5 text-accent" />
                  </header>
                  <div className="mt-4 space-y-4">
                    {plan ? (
                      plan.steps.map(step => (
                        <div key={step.id} className="flex items-start gap-3">
                          <div
                            className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border ${
                              step.status === "complete"
                                ? "border-accent text-accent"
                                : step.status === "in_progress"
                                ? "border-primary-400 text-primary-200"
                                : "border-white/20 text-white/40"
                            }`}
                          >
                            {step.status === "complete" ? <CheckCircle2 className="h-4 w-4" /> : step.status === "in_progress" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <span className="text-xs">?</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{step.title}</p>
                            <p className="text-xs text-white/50">{step.description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-white/40">Genereer een plan om de timeline te vullen.</p>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5">
                  <header className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/40">Rollout feed</p>
                      <h3 className="text-lg font-semibold text-white">Live progress</h3>
                    </div>
                    {executionId && (
                      <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">ID: {executionId}</span>
                    )}
                  </header>
                  <div className="mt-4 space-y-4 overflow-auto pr-2 text-sm text-white/70">
                    {sortedProgress.length === 0 ? (
                      <p className="text-xs text-white/40">
                        Start een deploy om realtime progressie te volgen.
                      </p>
                    ) : (
                      sortedProgress.map(item => (
                        <div key={`${item.stage}-${item.timestamp}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
                            <span>{item.stage}</span>
                            <span>{item.percentage}%</span>
                          </div>
                          <p className="mt-2 text-sm text-white">{item.message}</p>
                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Diff preview</p>
                  <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-black/60 p-4 font-mono text-xs text-white/70">
                    {plan?.diff ?? "Nog geen diff"}
                  </pre>
                  {plan?.warnings?.length ? (
                    <ul className="mt-3 space-y-2 text-xs text-warning">
                      {plan.warnings.map(item => (
                        <li key={item}>? {item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}








