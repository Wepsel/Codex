import type { AlertItem } from "@kube-suite/shared";
import { AlertTriangle, ShieldCheck, Siren } from "lucide-react";

interface AlertsPanelProps {
  alerts: AlertItem[];
}

const severityConfig = {
  critical: {
    icon: Siren,
    color: "bg-danger/20 text-danger"
  },
  warning: {
    icon: AlertTriangle,
    color: "bg-warning/20 text-warning"
  },
  info: {
    icon: ShieldCheck,
    color: "bg-primary-500/20 text-primary-200"
  }
} as const;

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Alerts</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Realtime incident feed</h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/50">
          {alerts.length} active
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {alerts.map(alert => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 ${config.color}`}
            >
              <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{alert.message}</p>
                <p className="text-xs text-white/50">{alert.source}</p>
              </div>
              <span className="ml-auto text-xs text-white/40">
                {new Date(alert.createdAt).toLocaleTimeString()}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
