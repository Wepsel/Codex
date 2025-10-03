"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BarChart3, LineChart, ShieldCheck, Sparkles, Workflow } from "lucide-react";

const modules = [
  {
    title: "AI Insights",
    description: "Realtime anomalies, logtrends en aanbevelingen afgestemd op je cluster.",
    href: "/ai-insights",
    icon: Sparkles
  },
  {
    title: "Events & live feed",
    description: "Volledige event-stream en log viewer met filters voor pods, namespaces en containers.",
    href: "/events",
    icon: Activity
  },
  {
    title: "Compliance & war room",
    description: "Incident war room, audit trail en rapport exports wanneer het erop aankomt.",
    href: "/compliance",
    icon: ShieldCheck
  },
  {
    title: "Zero Trust posture",
    description: "Identiteit, secrets en netwerk policies samengebracht in ÃƒÂ©ÃƒÂ©n risk score.",
    href: "/zero-trust",
    icon: LineChart
  }
];

const flows = [
  {
    name: "Self-healing workflows",
    description: "Start remediation scenarioÃ¢â‚¬â„¢s, verwijder pods of schaal workloads zonder context switch.",
    href: "/self-healing"
  },
  {
    name: "Copilot command center",
    description: "Vraag onze copiloten naar kubectlÃ¢â‚¬â„¢s, runbooks of postmortems direct naast je dashboards.",
    href: "/copilot"
  },
  {
    name: "Live dashboards",
    description: "Cluster health, workloads en observability widgets gericht op ruisvrije status.",
    href: "/dashboard"
  }
];

const personaContent = {
  sre: {
    name: "SRE",
    headline: "Verkort MTTR met automatische context" ,
    description:
      "Krijg incidentcontext, event timelines en self-healing acties in ÃƒÂ©ÃƒÂ©n cockpit. Onze dashboards geven je direct de volgende stap om downtime te beperken.",
    primary: { label: "Bekijk incidentflow", href: "/ai-insights" },
    secondary: { label: "Open war room", href: "/compliance" }
  },
  platform: {
    name: "Platform Lead",
    headline: "Bewijs impact met zero trust & governance" ,
    description:
      "Combineer compliance, risk scores en cluster workloads voor stakeholders. Toon in ÃƒÂ©ÃƒÂ©n oogopslag waar je platform staat en wat de volgende optimalisatie is.",
    primary: { label: "Bekijk governance", href: "/zero-trust" },
    secondary: { label: "Plan uitbreiding", href: "/dashboard" }
  }
} as const;

type PersonaKey = keyof typeof personaContent;

const demoEvents = [
  {
    type: "Warning",
    service: "checkout-api",
    detail: "CrashLoopBackOff opgelost door rollout",
    timestamp: "12:46:12"
  },
  {
    type: "Info",
    service: "payments-worker",
    detail: "Autoscaler verhoogde replicas naar 6",
    timestamp: "12:47:03"
  },
  {
    type: "Critical",
    service: "search-gateway",
    detail: "Latency spike ontdekt, circuit breaker actief",
    timestamp: "12:47:54"
  },
  {
    type: "Info",
    service: "observability",
    detail: "Nieuwe dashboard preset gedeployed",
    timestamp: "12:48:37"
  }
];

const demoMetrics = [
  {
    label: "Latency",
    unit: "ms",
    values: [482, 451, 509, 433, 468]
  },
  {
    label: "Error rate",
    unit: "%",
    values: [1.9, 1.4, 2.2, 1.1, 1.6]
  },
  {
    label: "Event volume",
    unit: "/min",
    values: [14, 19, 22, 17, 16]
  }
];

export default function HomePage() {
  const [persona, setPersona] = useState<PersonaKey>("sre");
  const [eventIndex, setEventIndex] = useState(0);
  const [metricTick, setMetricTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setEventIndex(prev => (prev + 1) % demoEvents.length);
      setMetricTick(prev => prev + 1);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const visibleEvents = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => demoEvents[(eventIndex + i) % demoEvents.length]);
  }, [eventIndex]);

  const rollingMetrics = useMemo(() => {
    return demoMetrics.map(metric => {
      const index = metricTick % metric.values.length;
      return {
        ...metric,
        value: metric.values[index]
      };
    });
  }, [metricTick]);

  const activePersona = personaContent[persona];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#0b1228,_#020617_65%)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-primary-500/25 blur-3xl" />
        <div className="absolute right-10 top-32 h-96 w-96 rounded-full bg-accent/25 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-screen flex-col justify-between px-6 pb-24 pt-24 sm:px-10 lg:px-16 xl:px-24">
        <header className="flex flex-col items-center gap-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.45em] text-white/60">
            <Workflow className="h-4 w-4 text-accent" />
            Nebula Ops Platform
          </span>
          <div className="flex flex-col items-center gap-6">
            <div className="flex rounded-full border border-white/10 bg-white/5 p-1 text-xs uppercase tracking-[0.35em] text-white/60">
              {(Object.keys(personaContent) as PersonaKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => setPersona(key)}
                  className={`rounded-full px-5 py-2 transition ${
                    persona === key ? "bg-gradient-to-r from-primary-500 via-primary-400 to-accent text-background shadow-[0_8px_30px_-18px_rgba(123,97,255,0.8)]" : "text-white/60"
                  }`}
                  type="button"
                >
                  {personaContent[key].name}
                </button>
              ))}
            </div>
            <h1 className="max-w-4xl bg-gradient-to-r from-white via-primary-100 to-accent bg-clip-text font-display text-4xl font-black tracking-tight text-transparent sm:text-6xl lg:text-7xl">
              {activePersona.headline}
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-white/70 sm:text-xl">{activePersona.description}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href={activePersona.primary.href}
              className="group flex items-center gap-3 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-background shadow-[0_12px_40px_-18px_rgba(123,97,255,0.8)] transition hover:scale-[1.02]"
            >
              {activePersona.primary.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href={activePersona.secondary.href}
              className="rounded-full border border-white/20 px-6 py-3 text-sm uppercase tracking-[0.35em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              {activePersona.secondary.label}
            </Link>
          </div>
        </header>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1.4fr_minmax(0,1fr)]">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Live hero demo</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Event feed ticker</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/50">
                Streams simulatie
              </span>
            </header>
            <ul className="mt-6 space-y-3">
              {visibleEvents.map((event, index) => (
                <li
                  key={`${event.timestamp}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-black/30 px-4 py-3 text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/40">{event.timestamp}</span>
                    <span className="text-sm font-semibold text-white">{event.service}</span>
                    <span className="text-xs text-white/60">{event.detail}</span>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.35em] ${
                      event.type === "Critical"
                        ? "border border-danger/30 bg-danger/20 text-danger"
                        : event.type === "Warning"
                          ? "border border-warning/30 bg-warning/10 text-warning"
                          : "border border-white/10 bg-white/10 text-white/60"
                    }`}
                  >
                    {event.type}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-primary-500/20 via-primary-400/10 to-transparent p-6 backdrop-blur">
            <header>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Cluster pulses</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Metrics snapshot</h2>
            </header>
            <div className="grid gap-4">
              {rollingMetrics.map(metric => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between text-sm text-white/60">
                    <span>{metric.label}</span>
                    <BarChart3 className="h-4 w-4 text-accent" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-white">{metric.value}</span>
                    <span className="text-xs text-white/40">{metric.unit}</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 via-primary-400 to-accent"
                      style={{ width: `${Math.min(100, (metric.value / metric.values[0]) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map(module => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                href={module.href}
                className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 text-left backdrop-blur transition hover:border-accent/40 hover:bg-white/10"
              >
                <div className="absolute inset-x-6 -top-16 h-28 rounded-full bg-gradient-to-br from-primary-500/20 via-primary-400/10 to-transparent blur-3xl transition-opacity group-hover:opacity-75" />
                <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="relative space-y-2">
                  <h3 className="text-base font-semibold text-white">{module.title}</h3>
                  <p className="text-sm leading-relaxed text-white/65">{module.description}</p>
                  <span className="inline-flex items-center text-xs uppercase tracking-[0.35em] text-white/40 transition group-hover:text-accent">
                    Bekijk module
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="mt-24 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <header className="mb-6 space-y-3">
              <p className="text-xs uppercase tracking-[0.45em] text-white/50">Wat je meteen kunt</p>
              <h2 className="text-2xl font-semibold text-white">Echte workflows, geen marketing slides</h2>
              <p className="text-sm text-white/65">
                Iedere tegel hieronder verwijst naar een werkend onderdeel van de app. Zodra je inlogt, worden ze gevoed met jouw clusters Ã¢â‚¬â€œ dezelfde UI, alleen met live data.
              </p>
            </header>
            <ul className="space-y-4 text-sm text-white/70">
              {flows.map(flow => (
                <li key={flow.name} className="rounded-2xl border border-white/5 bg-black/30 p-4 transition hover:border-white/20 hover:bg-black/40">
                  <Link href={flow.href} className="flex flex-col gap-1">
                    <span className="text-white font-semibold">{flow.name}</span>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/40">{flow.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </article>

          <aside className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-gradient-to-br from-primary-500/15 via-primary-400/10 to-transparent p-8 text-left backdrop-blur">
            <header className="space-y-2">
              <h3 className="text-xl font-semibold text-white">Waarom het werkt</h3>
              <p className="text-sm text-white/70">
                Nebula Ops draait bovenop je clusters via onze API gateway. Geen fake data Ã¢â‚¬â€œ de modules hierboven zijn exact dezelfde schermen die je na login ziet, gekoppeld aan echte endpoints.
              </p>
            </header>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-white/60">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Integratiepad</p>
              <p className="mt-2 text-white/70">
                1. Voeg een cluster toe via het settings-paneel.<br />
                2. Onze collectors streamen events, logs en metrics.<br />
                3. AI Insights, compliance en zero trust vullen zichzelf.
              </p>
            </div>
            <div className="text-xs uppercase tracking-[0.35em] text-white/40">
              Klaar? Meld je aan en stap gelijk binnen.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
