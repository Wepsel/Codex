"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useSession } from "@/components/session-context";

export default function LoginPage() {
  const { login, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await login(form);
      router.replace(redirectTo);
    } catch (err) {
      const message = (err as Error).message || "Login failed";
      setError(message === "Unauthorized" ? "Onjuiste gebruikersnaam of wachtwoord" : message);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-white">
      <div className="absolute inset-0 bg-grid-glow opacity-40" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xl rounded-3xl border border-white/10 bg-black/40 p-10 shadow-[0_0_60px_rgba(64,64,255,0.35)] backdrop-blur"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-white/40">Nebula Ops Access</p>
            <h1 className="mt-4 text-3xl font-semibold text-white">Welkom terug, commander</h1>
            <p className="mt-2 text-sm text-white/60">Log in met je credenties om het control center te starten.</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 via-primary-400 to-accent text-background shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Username</label>
            <input
              value={form.username}
              onChange={event => setForm({ ...form, username: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="bijv. admin"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="��������"
              autoComplete="current-password"
              required
            />
            <p className="mt-2 text-xs text-white/40">Standaard login: <span className="font-semibold text-white">admin / admin</span></p>
          </div>

          {error && (
            <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-background shadow-glow transition hover:shadow-[0_0_30px_rgba(0,245,212,0.35)] disabled:opacity-60"
            disabled={loading}
          >
            <ShieldCheck className="h-4 w-4" /> {loading ? "Bezig..." : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-white/50">
          Nog geen account?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Maak er een aan
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
