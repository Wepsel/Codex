import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  LineChart,
  Radio
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI copiloten",
    description:
      "Laat onze copiloten je suggesties geven voor remedies, kubectl-commando's en verbeteringen terwijl je dashboards verkent."
  },
  {
    icon: ShieldCheck,
    title: "End-to-end governance",
    description:
      "Compliance, audits en alerts worden automatisch gebundeld zodat je elk cluster veilig houdt zelfs tijdens een incident."
  },
  {
    icon: LineChart,
    title: "Live observability",
    description:
      "Real-time workloads, events en logs in een cinematic interface. Van deploy tot rollback met een klik."
  }
];

const stats = [
  { value: "12k+", label: "Pods realtime gevolgd" },
  { value: "98%", label: "Snellere incident-resolutie" },
  { value: "40+", label: "Integraties & bronnen" }
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden bg-gradient-to-br from-[#050816] via-[#0b1026] to-[#150d2d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute right-10 top-32 h-96 w-96 rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-screen flex-col justify-between px-6 pb-24 pt-24 sm:px-10 lg:px-16 xl:px-24">
        <header className="flex flex-col items-center gap-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.45em] text-white/60">
            <Radio className="h-4 w-4 text-accent" />
            Command Center Online
          </span>
          <h1 className="max-w-4xl bg-gradient-to-r from-white via-primary-100 to-accent bg-clip-text font-display text-4xl font-black tracking-tight text-transparent sm:text-6xl lg:text-7xl">
            Bestuur je Kubernetes-sterrenstelsel met een cockpit
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-white/70 sm:text-xl">
            Creeer rustig overzicht tijdens chaos. Nebula Ops bundelt al je clusters, incidenten en compliance in een futuristische bediening die net zo snel als je team beweegt.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="group flex items-center gap-3 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-background shadow-[0_12px_40px_-18px_rgba(123,97,255,0.8)] transition"
            >
              Probeer gratis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/20 px-6 py-3 text-sm uppercase tracking-[0.35em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Log in
            </Link>
          </div>
        </header>

        <section className="mt-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(feature => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-8 backdrop-blur transition hover:border-white/15 hover:bg-white/10"
              >
                <div className="absolute inset-x-8 -top-20 h-40 rounded-full bg-gradient-to-br from-primary-500/20 via-primary-400/10 to-transparent blur-3xl transition-opacity group-hover:opacity-75" />
                <div className="relative flex h-full flex-col gap-4 text-left">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-accent">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-white/65">{feature.description}</p>
                </div>
              </article>
            );
          })}
        </section>

        <footer className="mt-24 flex flex-col items-center gap-10 rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center backdrop-blur">
          <p className="text-xs uppercase tracking-[0.45em] text-white/50">Vertrouwd door ambitieuze platform teams</p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-left text-white/80">
            {stats.map(stat => (
              <div key={stat.label} className="min-w-[150px]">
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.35em] text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>
          <p className="max-w-2xl text-sm text-white/60">
            Sluit je aan bij teams die hun nachtrust terugpakken. Geen spreadsheets, geen context-switching alleen een control room die voor jou toewerkt.
          </p>
        </footer>
      </div>
    </main>
  );
}
