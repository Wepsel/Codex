"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { Sparkles, UserPlus } from "lucide-react";
import { useSession } from "@/components/session-context";

export default function RegisterPage() {
  const { register, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const [form, setForm] = useState({ username: "", email: "", name: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await register(form);
      router.replace(redirectTo);
    } catch (err) {
      const message = (err as Error).message || "Registration failed";
      if (message === "Username already exists") {
        setError("Deze gebruikersnaam is al bezet");
      } else if (message === "Email already exists") {
        setError("Dit e-mailadres is al geregistreerd");
      } else {
        setError(message);
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-white">
      <div className="absolute inset-0 bg-grid-glow opacity-40" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40 p-10 shadow-[0_0_60px_rgba(64,64,255,0.35)] backdrop-blur"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-white/40">Nebula Ops Onboarding</p>
            <h1 className="mt-4 text-3xl font-semibold text-white">Start je command center</h1>
            <p className="mt-2 text-sm text-white/60">Maak een account aan en deploy direct je kubernetes workflows.</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 via-primary-400 to-accent text-background shadow-glow">
            <UserPlus className="h-6 w-6" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Naam</label>
            <input
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="Platform Hero"
              autoComplete="name"
              required
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Username</label>
            <input
              value={form.username}
              onChange={event => setForm({ ...form, username: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="bijv. commander"
              autoComplete="username"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={event => setForm({ ...form, email: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="jij@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="Minimaal 6 karakters"
              autoComplete="new-password"
              required
            />
            <p className="mt-2 text-xs text-white/40">Je wordt na registratie automatisch ingelogd.</p>
          </div>

          {error && (
            <div className="sm:col-span-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-background shadow-glow transition hover:shadow-[0_0_30px_rgba(0,245,212,0.35)] disabled:opacity-60"
              disabled={loading}
            >
              <Sparkles className="h-4 w-4" /> {loading ? "Bezig..." : "Account aanmaken"}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-xs text-white/50">
          Heb je al toegang?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log hier in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
