"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { AlertItem, ClusterSummary, WorkloadSummary } from "@kube-suite/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ClusterHealth } from "@/components/dashboard/cluster-health";
import { WorkloadTable } from "@/components/dashboard/workload-table";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { DeployWizard } from "@/components/wizard/deploy-wizard";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { Bot, Sparkles } from "lucide-react";

interface DashboardExperienceProps {
  summary: ClusterSummary;
  workloads: WorkloadSummary[];
  alerts: AlertItem[];
}

export function DashboardExperience({ summary, workloads, alerts }: DashboardExperienceProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [liveSummary, setLiveSummary] = useState(summary);
  const [liveWorkloads, setLiveWorkloads] = useState(workloads);
  const [liveAlerts, setLiveAlerts] = useState(alerts);

  useEffect(() => {
    setLiveSummary(summary);
    setLiveWorkloads(workloads);
    setLiveAlerts(alerts);
  }, [summary, workloads, alerts]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [s, w, a] = await Promise.all([
          apiFetch<ClusterSummary>("/cluster/summary"),
          apiFetch<WorkloadSummary[]>("/cluster/workloads"),
          apiFetch<AlertItem[]>("/cluster/alerts")
        ]);
        setLiveSummary(s);
        setLiveWorkloads(w);
        setLiveAlerts(a);
      } catch {
        // ignore transient errors
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative space-y-8 px-8 pb-16">
      <DeployWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <CopilotPanel
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onExecuteAction={value => {
          if (value === "scale") {
            setWizardOpen(true);
          }
        }}
      />

      <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-white/0 p-8 shadow-glow md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-white/40">Aurora Production Command</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Mission dashboard</h1>
          <p className="mt-2 text-sm text-white/50">
            Houd je deployments, telemetrie en rollouts in de gaten vanuit een cinematic cockpit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-background shadow-glow transition hover:shadow-[0_0_30px_rgba(0,245,212,0.4)]"
          >
            <Sparkles className="h-4 w-4" /> Deploy wizard
          </button>
          <button
            onClick={() => setCopilotOpen(open => !open)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:border-accent/40 hover:text-white"
          >
            <Bot className="h-4 w-4 text-accent" /> Copilot
          </button>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pods" value={liveSummary.pods.toString()} delta="+12% vs vorige week" trend="up" />
        <MetricCard label="Workloads" value={liveSummary.workloads.toString()} delta="Stable" trend="neutral" />
        <MetricCard label="Nodes" value={liveSummary.nodes.toString()} delta="0 changes" trend="neutral" />
        <MetricCard label="Alerts" value={liveAlerts.length.toString()} delta="-2 resolved" trend="down" />
      </section>

      <ClusterHealth summary={liveSummary} />

      <section className="grid gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <WorkloadTable workloads={liveWorkloads} />
        </div>
        <AlertsPanel alerts={alerts} />
      </section>

      <LiveActivity />
    </div>
  );
}




