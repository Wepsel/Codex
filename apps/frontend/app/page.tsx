import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-grid-glow opacity-40" />
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <p className="text-sm uppercase tracking-[0.55em] text-white/50">Next-gen Kubernetes control</p>
        <h1 className="mt-6 bg-gradient-to-r from-white via-primary-100 to-accent bg-clip-text font-display text-6xl font-black tracking-tight text-transparent">
          Bestuur je cluster als een ruimtecommandant
        </h1>
        <p className="mt-6 text-lg text-white/60">
          Nebula Ops geeft je een cinematic uitzicht over al je clusters, workloads en real-time events. Van deploy naar observability in een soepel control center.
        </p>
        <div className="mt-12 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="group flex items-center gap-3 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-background shadow-glow"
          >
            Log in
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-white/20 px-6 py-3 text-sm uppercase tracking-[0.35em] text-white/70 transition hover:border-white/40 hover:text-white"
          >
            Registreer
          </Link>
        </div>
      </div>
    </div>
  );
}
