export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, Bell, CheckCircle2, Cpu, Lock, LogOut, MapPinned, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import type { UserProfile } from "@kube-suite/shared";
import { apiFetch } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Nebula Ops | Profile",
  description: "Account preferences and activity overview"
};

const recentActivity = [
  { id: "a1", title: "Scaled checkout", detail: "Replicas 4 -> 6", ts: "12 minutes ago" },
  { id: "a2", title: "Applied payments manifest", detail: "Rolling update via wizard", ts: "45 minutes ago" },
  { id: "a3", title: "Alert routing updated", detail: "PagerDuty linked", ts: "Yesterday" }
];

const accessTokens = [
  { id: "t1", label: "GitOps pipeline", scope: "deployments:write", lastUsed: "18 minutes ago" },
  { id: "t2", label: "Grafana sync", scope: "metrics:read", lastUsed: "Yesterday" }
];

export default async function ProfilePage() {
  const user = await apiFetch<UserProfile>("/auth/me");

  const preferenceToggles = [
    {
      id: "theme",
      label: "Night drive theme",
      description: "Low-light UI with cyan accents",
      enabled: user.preferences.theme === "dark"
    },
    {
      id: "alerts",
      label: "Realtime alerts push",
      description: "Receive incidents instantly",
      enabled: user.preferences.notifications
    },
    {
      id: "digest",
      label: "Weekly ops digest",
      description: "Email summary every Monday",
      enabled: false
    }
  ];

  const roleDisplay = user.roles.join(" - ");

  return (
    <div className="relative space-y-10 px-8 pb-20">
      <div className="absolute inset-0 bg-grid-glow opacity-30" aria-hidden />
      <header className="relative z-10 mt-6 flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 via-primary-400 to-accent text-3xl font-bold text-background shadow-[0_0_35px_rgba(0,245,212,0.4)]">
            {user.name
              .split(" ")
              .map(part => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-white/40">Account command</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{user.name}</h1>
            <p className="text-sm text-white/60">{roleDisplay} - {user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:border-white/30 hover:text-white">
            <UploadCloud className="h-4 w-4 text-accent" /> Upload avatar
          </button>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-background shadow-glow transition hover:shadow-[0_0_30px_rgba(0,245,212,0.35)]"
          >
            <Sparkles className="h-4 w-4" /> UI preferences
          </Link>
        </div>
      </header>

      <section className="relative z-10 grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Profile</p>
              <h2 className="text-xl font-semibold text-white">Personal data</h2>
            </div>
            <ShieldCheck className="h-5 w-5 text-accent" />
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoField label="Name" value={user.name} />
            <InfoField label="Role" value={roleDisplay} />
            <InfoField label="Email" value={user.email} />
            <InfoField label="Region" value="Amsterdam - UTC+1" icon={<MapPinned className="h-4 w-4 text-accent" />} />
            <InfoField label="Member since" value="January 12, 2024" icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
            <InfoField label="Last login" value="36 minutes ago" icon={<Activity className="h-4 w-4 text-primary-200" />} />
          </div>
        </article>

        <article className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Security</p>
              <h2 className="text-xl font-semibold text-white">Sessions & access</h2>
            </div>
            <Lock className="h-5 w-5 text-warning" />
          </header>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
            <p className="font-semibold text-white">MFA status</p>
            <p className="mt-1 text-xs text-white/50">Hardware key paired - last confirmation 2 weeks ago</p>
          </div>
          <div className="space-y-3 text-sm text-white/70">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <span>Active sessions</span>
              <span className="text-xs text-white/40">3 devices</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <span>API rate limit</span>
              <span className="text-xs text-white/40">12% used</span>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-full border border-danger/40 bg-danger/10 px-5 py-2 text-xs uppercase tracking-[0.35em] text-danger transition hover:border-danger/60">
            <LogOut className="h-4 w-4" /> Sign out everywhere
          </button>
        </article>
      </section>

      <section className="relative z-10 grid gap-6 lg:grid-cols-3">
        <article className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Preferences</p>
              <h2 className="text-xl font-semibold text-white">Control centre setup</h2>
            </div>
            <Cpu className="h-5 w-5 text-primary-200" />
          </header>
          <div className="space-y-3">
            {preferenceToggles.map(pref => (
              <label key={pref.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70 transition hover:border-white/20">
                <div className={`relative mt-1 flex h-5 w-5 items-center justify-center rounded-md border ${pref.enabled ? "border-primary-400 bg-primary-500/40" : "border-white/20 bg-white/5"}`}>
                  {pref.enabled && <span className="h-2.5 w-2.5 rounded-sm bg-accent" />}
                </div>
                <div>
                  <p className="font-semibold text-white">{pref.label}</p>
                  <p className="text-xs text-white/50">{pref.description}</p>
                </div>
              </label>
            ))}
          </div>
        </article>

        <article className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow lg:col-span-2">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Recent activity</p>
              <h2 className="text-xl font-semibold text-white">Audit trail</h2>
            </div>
            <Bell className="h-5 w-5 text-accent" />
          </header>
          <div className="space-y-3">
            {recentActivity.map(item => (
              <div key={item.id} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-success/20 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 text-sm text-white/70">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-white/50">{item.detail}</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">{item.ts}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="relative z-10 grid gap-6 lg:grid-cols-2">
        <article className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Access</p>
              <h2 className="text-xl font-semibold text-white">API tokens</h2>
            </div>
            <Sparkles className="h-5 w-5 text-primary-200" />
          </header>
          <div className="space-y-3">
            {accessTokens.map(token => (
              <div key={token.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-sm text-white/70">
                <div>
                  <p className="font-semibold text-white">{token.label}</p>
                  <p className="text-xs text-white/50">{token.scope}</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">{token.lastUsed}</span>
              </div>
            ))}
          </div>
          <button className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs uppercase tracking-[0.35em] text-white/60 transition hover:border-accent/40 hover:text-white">
            Generate new token
          </button>
        </article>

        <article className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Automations</p>
              <h2 className="text-xl font-semibold text-white">Copilot settings</h2>
            </div>
            <Activity className="h-5 w-5 text-success" />
          </header>
          <div className="space-y-3 text-sm text-white/70">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-semibold text-white">Command tone</p>
              <p className="text-xs text-white/50">Highlight risk with fallback suggestions</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-semibold text-white">Automations</p>
              <p className="text-xs text-white/50">3 active workflows - 2 pending reviews</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-semibold text-white">Last AI training</p>
              <p className="text-xs text-white/50">Model refreshed Sept 3 - drift under 1%</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

interface InfoFieldProps {
  label: string;
  value: string;
  icon?: ReactNode;
}

function InfoField({ label, value, icon }: InfoFieldProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
      <p className="text-xs uppercase tracking-[0.35em] text-white/40">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-white">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}

