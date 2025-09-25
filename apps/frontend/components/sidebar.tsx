"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserProfile } from "@kube-suite/shared";
import { cn } from "@/lib/utils";
import {
  Activity,
  Cloud,
  Gauge,
  Layers,
  LayoutDashboard,
  Settings
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workloads", label: "Workloads", icon: Layers },
  { href: "/events", label: "Events", icon: Activity },
  { href: "/logs", label: "Logs", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar({ user }: { user: UserProfile }) {
  const pathname = usePathname();

  return (
    <aside className="relative hidden w-72 shrink-0 border-r border-white/5 bg-[#08091c] px-6 py-8 md:flex">
      <div className="absolute inset-0 bg-grid-glow opacity-40" />
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <Link href="/" className="mb-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-accent text-xl font-semibold shadow-glow">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-white/60">Nebula Ops</p>
              <p className="text-lg font-semibold text-white">Kube Control</p>
            </div>
          </Link>

          <nav className="space-y-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-white/10 text-white shadow-glow"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-white/30">
                    {active ? "Live" : ""}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Signed in as</p>
          <p className="mt-1 text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-white/50">{user.email}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-accent">
            <Gauge className="h-4 w-4" />
            Role: {user.roles.join(", ")}
          </div>
        </div>
      </div>
    </aside>
  );
}
