import type { ClusterSummary } from "@kube-suite/shared";

interface ClusterHealthProps {
  summary: ClusterSummary;
}

export function ClusterHealth({ summary }: ClusterHealthProps) {
  return (
    <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow lg:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.45em] text-white/40">Cluster status</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{summary.name}</h2>
        <p className="text-sm text-white/50">Context: {summary.context}</p>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-white/70">
          <div>
            <p className="text-white/40">Distribution</p>
            <p className="font-semibold text-white">{summary.distribution}</p>
          </div>
          <div>
            <p className="text-white/40">Version</p>
            <p className="font-semibold text-white">{summary.version}</p>
          </div>
          <div>
            <p className="text-white/40">Nodes</p>
            <p className="font-semibold text-white">{summary.nodes}</p>
          </div>
          <div>
            <p className="text-white/40">Workloads</p>
            <p className="font-semibold text-white">{summary.workloads}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Namespaces</p>
          <div className="mt-4 space-y-3">
            {summary.namespaces.map(ns => (
              <div key={ns.name} className="flex items-center justify-between text-sm">
                <span className="text-white/70">{ns.name}</span>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span>{ns.workloads} workloads</span>
                  <span>{ns.pods} pods</span>
                  <span>{ns.activeAlerts} alerts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Utilisatie</p>
          <div className="mt-6 grid grid-cols-2 gap-6">
            <Gauge label="CPU" value={summary.cpuUsage} />
            <Gauge label="Memory" value={summary.memoryUsage} />
          </div>
        </div>
        <p className="text-right text-xs text-white/40">
          Laatste synchronisatie: {new Date(summary.lastSync).toLocaleTimeString()}
        </p>
      </div>
    </section>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <div className="relative flex h-40 flex-col items-center justify-center overflow-hidden rounded-2xl bg-black/30">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 200">
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5f70ff" />
            <stop offset="100%" stopColor="#00f5d4" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="70" stroke="rgba(255,255,255,0.08)" strokeWidth="18" fill="none" />
        <path
          d={describeArc(100, 100, 70, -120, value * 240 - 120)}
          stroke={`url(#gradient-${label})`}
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div className="relative z-10 text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-white/40">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-white">{Math.round(value * 100)}%</p>
      </div>
    </div>
  );
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y
  ].join(" ");
}

function polarToCartesian(x: number, y: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: x + radius * Math.cos(angleInRadians),
    y: y + radius * Math.sin(angleInRadians)
  };
}
