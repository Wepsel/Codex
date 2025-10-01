import type { NodeStatus } from "@kube-suite/shared";
import { AlertTriangle, Cpu, HardDrive, Server } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodePulseProps {
  nodes: NodeStatus[];
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function intensityColor(value: number): string {
  if (value >= 0.85) return "bg-danger";
  if (value >= 0.7) return "bg-warning";
  if (value >= 0.5) return "bg-accent";
  return "bg-white/20";
}

export function NodePulse({ nodes }: NodePulseProps) {
  const total = nodes.length;
  const unavailable = nodes.filter(node => node.status !== "Ready");
  const hotNodes = nodes.filter(node => node.cpu >= 0.75 || node.memory >= 0.8);
  const avgCpu = total > 0 ? nodes.reduce((sum, node) => sum + node.cpu, 0) / total : 0;
  const avgMem = total > 0 ? nodes.reduce((sum, node) => sum + node.memory, 0) / total : 0;

  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Nodes"
          primary={total.toString()}
          secondary={unavailable.length > 0 ? `${unavailable.length} unavailable` : "All ready"}
          tone={unavailable.length > 0 ? "alert" : "ok"}
          icon={Server}
        />
        <MetricCard
          title="Average CPU"
          primary={formatPercent(avgCpu)}
          secondary={hotNodes.length > 0 ? `${hotNodes.length} nodes > 70%` : "Balanced"}
          tone={avgCpu >= 0.7 ? "warn" : "ok"}
          icon={Cpu}
        />
        <MetricCard
          title="Average memory"
          primary={formatPercent(avgMem)}
          secondary={avgMem >= 0.75 ? "Scale soon" : "Plenty headroom"}
          tone={avgMem >= 0.75 ? "warn" : "ok"}
          icon={HardDrive}
        />
        <MetricCard
          title="Hot spots"
          primary={hotNodes.length.toString()}
          secondary={hotNodes.length > 0 ? "Investigate spikes" : "None detected"}
          tone={hotNodes.length > 0 ? "alert" : "ok"}
          icon={AlertTriangle}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {nodes.map(node => (
          <article
            key={node.name}
            className={cn(
              "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow transition",
              node.status !== "Ready" ? "border-danger/40 bg-danger/10" : "hover:border-white/20 hover:bg-white/10"
            )}
          >
            <div className="absolute -right-24 top-0 h-48 w-48 rounded-full bg-primary-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-4 text-white">
              <header className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">{node.roles.join(", ") || "worker"}</p>
                  <h2 className="text-xl font-semibold">{node.name}</h2>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs uppercase tracking-[0.35em]",
                    node.status === "Ready" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                  )}
                >
                  {node.status}
                </span>
              </header>

              <div className="space-y-3">
                <UsageBar label="CPU" value={node.cpu} />
                <UsageBar label="Memory" value={node.memory} />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.35em] text-white/40">
                <span>Pods: {node.pods}</span>
                <span>Age: {node.age}</span>
                <span>Version: {node.kubeletVersion}</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function UsageBar({ label, value }: { label: string; value: number }) {
  const percent = Math.min(1, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
        <span>{label}</span>
        <span>{formatPercent(percent)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full", intensityColor(percent))}
          style={{ width: `${percent * 100}%` }}
        />
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  primary: string;
  secondary: string;
  tone: "ok" | "warn" | "alert";
  icon: React.ComponentType<{ className?: string }>;
}

function MetricCard({ title, primary, secondary, tone, icon: Icon }: MetricCardProps) {
  const palette =
    tone === "alert"
      ? "border-danger/40 bg-danger/10 text-danger"
      : tone === "warn"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-white/10 bg-white/5 text-white";

  return (
    <article className={cn("relative overflow-hidden rounded-3xl p-5 transition", `border ${palette}`)}>
      <div className="absolute -top-16 right-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.35em] text-white/40">
          <Icon className="h-5 w-5" />
          {title}
        </div>
        <p className="text-4xl font-semibold text-white">{primary}</p>
        <p className="text-xs text-white/60">{secondary}</p>
      </div>
    </article>
  );
}
