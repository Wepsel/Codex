"use client";

interface Point { t: Date; v: number }

export function MiniChart({ data, height = 80 }: { data: Point[]; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.v));
  return (
    <div className="relative h-24 w-full">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${data.length - 1} ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          if (i === 0) return null;
          const prev = data[i - 1];
          const x1 = i - 1;
          const x2 = i;
          const y1 = height - (prev.v / max) * height;
          const y2 = height - (d.v / max) * height;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#g)" strokeWidth={2} />;
        })}
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8ab4ff" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/10 to-transparent" />
    </div>
  );
}


