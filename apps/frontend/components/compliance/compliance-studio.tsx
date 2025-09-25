"use client";

import { useMemo } from "react";
import type { ComplianceSummary } from "@kube-suite/shared";
import { Download, FileBarChart, KeyRound, ShieldAlert, ShieldCheck, Siren, Sparkles, StickyNote } from "lucide-react";

interface ComplianceStudioProps {
  summary: ComplianceSummary;
}

export function ComplianceStudio({ summary }: ComplianceStudioProps) {
  const rotationWindow = [...summary.secrets.expiring].sort((a, b) => a.daysRemaining - b.daysRemaining);
  const severityMap = summary.policies.failedPolicies.reduce(
    (acc, policy) => {
      acc[policy.severity] = (acc[policy.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const exportPayload = useMemo(
    () =>
      JSON.stringify(
        {
          generatedAt: summary.generatedAt,
          rbac: summary.rbac,
          secrets: summary.secrets,
          policies: summary.policies,
          recommendations: summary.recommendations
        },
        null,
        2
      ),
    [summary]
  );

  function handleExport() {
    const file = new Blob([exportPayload], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    const dateKey = new Date(summary.generatedAt).toISOString().split("T")[0] ?? "report";
    anchor.download = `nebula-compliance-${dateKey}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="relative space-y-10 px-8 pb-20">
      <div className="absolute inset-0 bg-grid-glow opacity-25" aria-hidden />
      <header className="relative z-10 flex flex-col gap-6 rounded-3xl border border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-transparent p-8 shadow-glow xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-white/40">Audit & compliance studio</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Realtime policy intelligence</h1>
          <p className="mt-2 text-sm text-white/60">
            Overzicht van RBAC, secrets en policy drift met exporteerbare rapporten voor OPA en Kyverno.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs uppercase tracking-[0.35em] text-accent">
            Laatste scan {new Date(summary.policies.lastScan).toLocaleString()}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-background shadow-glow transition hover:shadow-[0_0_30px_rgba(0,245,212,0.4)]"
          >
            <Download className="h-4 w-4" /> Exporteer rapport
          </button>
        </div>
      </header>

      <section className="relative z-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          icon={<ShieldAlert className="h-5 w-5 text-accent" />}
          label="High risk roles"
          primary={summary.rbac.highRiskRoles.length.toString()}
          helper={`${summary.rbac.orphanedBindings} orphan bindings`}
        />
        <SummaryStatCard
          icon={<KeyRound className="h-5 w-5 text-primary-200" />}
          label="Secrets expiring"
          primary={summary.secrets.expiring.length.toString()}
          helper={`Binnen ${rotationWindow[0]?.daysRemaining ?? 0} dagen`}
        />
        <SummaryStatCard
          icon={<ShieldCheck className="h-5 w-5 text-success" />}
          label="Policy passing"
          primary={summary.policies.passing.toString()}
          helper={`${summary.policies.failing} failing`}
        />
        <SummaryStatCard
          icon={<Siren className="h-5 w-5 text-danger" />}
          label="Critical controls"
          primary={summary.policies.critical.toString()}
          helper={`${severityMap.critical ?? 0} failing rules`}
        />
      </section>

      <section className="relative z-10 grid gap-6 xl:grid-cols-3">
        <article className="xl:col-span-2 space-y-5 rounded-3xl border border-white/10 bg-black/40 p-6 shadow-glow">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">RBAC high-risk roles</p>
              <h2 className="text-xl font-semibold text-white">Privileges die review nodig hebben</h2>
            </div>
            <ShieldAlert className="h-5 w-5 text-danger" />
          </header>
          <div className="space-y-3">
            {summary.rbac.highRiskRoles.map(role => (
              <div key={role.name} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                <div className="flex items-center justify-between text-white">
                  <span className="text-lg font-semibold">{role.name}</span>
                  <span className="text-xs uppercase tracking-[0.35em] text-white/40">{role.members} members</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
                  {role.privileges.map(priv => (
                    <span key={priv} className="rounded-full bg-danger/20 px-3 py-1 text-danger">{priv}</span>
                  ))}
                </div>
                <div className="mt-3 text-[11px] uppercase tracking-[0.35em] text-white/30">
                  Laatste review {new Date(role.lastReviewed).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="space-y-5 rounded-3xl border border-white/10 bg-black/40 p-6 shadow-glow">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Secret rotation</p>
              <h2 className="text-xl font-semibold text-white">Expiring credentials</h2>
            </div>
            <KeyRound className="h-5 w-5 text-primary-200" />
          </header>
          <div className="space-y-3">
            {rotationWindow.map(secret => (
              <div key={secret.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-white">
                  <div>
                    <p className="font-semibold">{secret.name}</p>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">{secret.namespace} - {secret.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">Dagen resterend</p>
                    <p className="text-2xl font-semibold">{secret.daysRemaining}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-danger via-accent to-success"
                    style={{ width: `${Math.max(0, Math.min(100, ((30 - secret.daysRemaining) / 30) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
            {summary.secrets.unencrypted.length > 0 && (
              <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
                {summary.secrets.unencrypted.length} secrets zonder encryptie ({summary.secrets.unencrypted
                  .map(item => `${item.namespace}/${item.name}`)
                  .join(", ")})
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="relative z-10 grid gap-6 xl:grid-cols-3">
        <article className="space-y-4 rounded-3xl border border-white/10 bg-black/40 p-6 shadow-glow xl:col-span-2">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Policy scans</p>
              <h2 className="text-xl font-semibold text-white">OPA en Kyverno resultaten</h2>
            </div>
            <FileBarChart className="h-5 w-5 text-primary-200" />
          </header>
          <div className="flex flex-wrap gap-3 text-xs text-white/60">
            {Object.entries(severityMap).map(([severity, count]) => (
              <span key={severity} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                {severity.toUpperCase()} - {count}
              </span>
            ))}
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
              Passing - {summary.policies.passing}
            </span>
          </div>
          <div className="space-y-3 text-sm text-white/70">
            {summary.policies.failedPolicies.map(policy => (
              <div key={policy.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <p className="text-sm font-semibold">{policy.name}</p>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">{policy.id} - {policy.resource}</p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/80"
                    style={{ backgroundColor: badgeColor(policy.severity), border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {policy.severity}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white/70">{policy.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="space-y-4 rounded-3xl border border-white/10 bg-black/40 p-6 shadow-glow">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Action board</p>
              <h2 className="text-xl font-semibold text-white">Aanbevelingen</h2>
            </div>
            <StickyNote className="h-5 w-5 text-accent" />
          </header>
          <ul className="space-y-3 text-sm text-white/70">
            {summary.recommendations.map(item => (
              <li key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Sparkles className="mb-2 h-5 w-5 text-accent" />
                <p>{item}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}

interface SummaryStatCardProps {
  icon: React.ReactNode;
  label: string;
  primary: string;
  helper: string;
}

function SummaryStatCard({ icon, label, primary, helper }: SummaryStatCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-glow">
      <div className="flex items-center gap-3 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">{label}</p>
          <p className="text-2xl font-semibold">{primary}</p>
        </div>
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.35em] text-white/30">{helper}</p>
    </article>
  );
}

function badgeColor(severity: string) {
  switch (severity) {
    case "critical":
      return "rgba(220, 38, 38, 0.25)";
    case "high":
      return "rgba(253, 186, 116, 0.25)";
    case "medium":
      return "rgba(96, 165, 250, 0.25)";
    default:
      return "rgba(16, 185, 129, 0.25)";
  }
}
