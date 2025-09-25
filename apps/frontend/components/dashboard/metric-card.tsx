interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({ label, value, delta, trend = "neutral" }: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-40" />
      <div className="relative z-10">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">{label}</p>
        <p className="mt-4 text-4xl font-bold text-white">{value}</p>
        {delta && (
          <p
            className={`mt-3 text-xs font-semibold uppercase tracking-[0.35em] ${
              trend === "up"
                ? "text-success"
                : trend === "down"
                ? "text-danger"
                : "text-white/50"
            }`}
          >
            {delta}
          </p>
        )}
      </div>
    </div>
  );
}
