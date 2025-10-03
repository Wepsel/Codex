"use client";

import Link from "next/link";
import { Home, Radar, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_60%)] px-6 py-24 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-500/30 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.45em] text-white/60">
          <Radar className="h-4 w-4 text-accent" />
          Signaal kwijt
        </span>
        <h1 className="font-display text-6xl font-black tracking-tight sm:text-7xl">
          404
        </h1>
        <p className="max-w-xl text-balance text-lg text-white/70">
          Deze route bestaat niet of is uit je clusterkaart gevallen. Gebruik de navigatie hieronder om terug te keren naar bekende sectoren.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-background transition hover:scale-[1.01]"
          >
            <Home className="h-4 w-4" />
            Terug naar home
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-full border border-white/20 px-6 py-3 text-sm uppercase tracking-[0.35em] text-white/70 transition hover:border-white/40 hover:text-white"
          >
            <Sparkles className="h-4 w-4" />
            Open command center
          </Link>
        </div>
      </div>
    </main>
  );
}
