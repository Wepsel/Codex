"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Search, Sparkles, UserPlus } from "lucide-react";
import type { CompanyDirectoryEntry } from "@kube-suite/shared";
import { useSession } from "@/components/session-context";
import { searchCompanies } from "@/lib/auth-client";

export default function RegisterPage() {
  const { register, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [form, setForm] = useState({ username: "", email: "", name: "", password: "" });
  const [mode, setMode] = useState<"create" | "join">("create");
  const [companyForm, setCompanyForm] = useState({ name: "", description: "", inviteOnly: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<CompanyDirectoryEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDirectoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "create") {
      setSearchTerm("");
      setSearchResults([]);
      setSelectedCompany(null);
      setSearchError(null);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "join") {
      return;
    }
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);

    const handle = setTimeout(async () => {
      try {
        const results = await searchCompanies(trimmed);
        if (cancelled) {
          return;
        }
        setSearchResults(results);
        if (results.length === 0) {
          setSearchError("Geen bedrijven gevonden. Vraag je admin om je uit te nodigen.");
        }
      } catch (err) {
        if (!cancelled) {
          setSearchError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [mode, searchTerm]);

  const canSubmit = useMemo(() => {
    if (mode === "create") {
      return companyForm.name.trim().length > 1;
    }
    return Boolean(selectedCompany);
  }, [companyForm.name, mode, selectedCompany]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      if (mode === "create" && companyForm.name.trim().length < 2) {
        setError("Kies een bedrijfsnaam met minimaal 2 karakters.");
        return;
      }
      if (mode === "join" && !selectedCompany) {
        setError("Selecteer het bedrijf dat je wilt joinen.");
        return;
      }

      const profile = await register({
        ...form,
        company:
          mode === "create"
            ? {
                mode: "create" as const,
                name: companyForm.name.trim(),
                description: companyForm.description.trim() || undefined,
                inviteOnly: companyForm.inviteOnly
              }
            : {
                mode: "join" as const,
                companyId: selectedCompany!.id
              }
      });

      const destination = profile.company.status === "active" ? redirectTo : "/settings?membership=pending";
      router.replace(destination);
    } catch (err) {
      const message = (err as Error).message || "Registratie mislukt";
      if (message === "Username already exists") {
        setError("Deze gebruikersnaam is al bezet");
      } else if (message === "Email already exists") {
        setError("Dit e-mailadres is al geregistreerd");
      } else if (message === "Company not found") {
        setError("We konden dit bedrijf niet vinden. Controleer je keuze of vraag een admin om een uitnodiging." );
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
        className="relative z-10 w-full max-w-3xl rounded-3xl border border-white/10 bg-black/40 p-10 shadow-[0_0_60px_rgba(64,64,255,0.35)] backdrop-blur"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-white/40">Nebula Ops Onboarding</p>
            <h1 className="mt-4 text-3xl font-semibold text-white">Start je command center</h1>
            <p className="mt-2 text-sm text-white/60">
              Je registreert voor het platform van jouw bedrijf: als oprichter wordt je direct admin, anders gaat er een verzoek naar de beheerder.
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 via-primary-400 to-accent text-background shadow-glow">
            <UserPlus className="h-6 w-6" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${mode === "create" ? "bg-white text-black shadow-glow" : "text-white/70 hover:bg-white/10"}`}
              onClick={() => setMode("create")}
            >
              Nieuw bedrijf starten
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${mode === "join" ? "bg-white text-black shadow-glow" : "text-white/70 hover:bg-white/10"}`}
              onClick={() => setMode("join")}
            >
              Aansluiten bij bedrijf
            </button>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Naam</label>
            <input
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="Platform Hero"
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Username</label>
            <input
              value={form.username}
              onChange={event => setForm(prev => ({ ...prev, username: event.target.value }))}
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
              onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="jij@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-[0.35em] text-white/40">Wachtwoord</label>
            <input
              type="password"
              value={form.password}
              onChange={event => setForm(prev => ({ ...prev, password: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
              placeholder="Minimaal 6 karakters"
              autoComplete="new-password"
              required
            />
            <p className="mt-2 text-xs text-white/40">Je wordt na registratie automatisch ingelogd.</p>
          </div>

          {mode === "create" ? (
            <div className="sm:col-span-2 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <header className="flex items-center gap-3 text-white/80">
                <Building2 className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-semibold">Bedrijf aanmaken</p>
                  <p className="text-xs text-white/50">
                    Jij wordt de admin van dit control center en kunt daarna teammates uitnodigen.
                  </p>
                </div>
              </header>
              <div>
                <label className="text-xs uppercase tracking-[0.35em] text-white/40">Bedrijfsnaam</label>
                <input
                  value={companyForm.name}
                  onChange={event => setCompanyForm(prev => ({ ...prev, name: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
                  placeholder="Bijv. Aurora Cloud BV"
                  required
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.35em] text-white/40">Omschrijving (optioneel)</label>
                <textarea
                  value={companyForm.description}
                  onChange={event => setCompanyForm(prev => ({ ...prev, description: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80 focus:border-accent focus:outline-none"
                  placeholder="Wie krijgt toegang en wat beheren jullie hier?"
                  rows={3}
                />
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={companyForm.inviteOnly}
                  onChange={event => setCompanyForm(prev => ({ ...prev, inviteOnly: event.target.checked }))}
                />
                Alleen via uitnodigingen toegang geven
              </label>
            </div>
          ) : (
            <div className="sm:col-span-2 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <header className="flex items-center gap-3 text-white/80">
                <Search className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-semibold">Zoek je bedrijf</p>
                  <p className="text-xs text-white/50">
                    Je verzoek wordt doorgestuurd naar de beheerders van het gekozen bedrijf.
                  </p>
                </div>
              </header>
              <div className="relative">
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 pl-10 text-sm text-white/80 focus:border-accent focus:outline-none"
                  placeholder="Typ minimaal 2 letters"
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                {searchLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-accent" />}
              </div>
              {searchError && <p className="text-xs text-danger">{searchError}</p>}
              <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {searchResults.map(company => {
                  const isActive = selectedCompany?.id === company.id;
                  return (
                    <li
                      key={company.id}
                      className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${
                        isActive ? "border-accent bg-accent/20 text-white" : "border-white/10 bg-black/40 text-white/80 hover:border-accent/60"
                      }`}
                      onClick={() => setSelectedCompany(company)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{company.name}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-white/40">{company.memberCount} leden</span>
                      </div>
                      <p className="mt-1 text-xs text-white/50">{company.inviteOnly ? "Invite only" : "Open voor aanvraag"}</p>
                    </li>
                  );
                })}
                {!searchLoading && searchResults.length === 0 && searchTerm.trim().length >= 2 && !searchError && (
                  <li className="rounded-xl border border-dashed border-white/20 bg-black/30 px-4 py-3 text-xs text-white/50">
                    Nog geen match. Laat een admin je uitnodigen of start een nieuw bedrijf.
                  </li>
                )}
              </ul>
            </div>
          )}

          {error && (
            <div className="sm:col-span-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-background shadow-glow transition hover:shadow-[0_0_30px_rgba(0,245,212,0.35)] disabled:opacity-60"
              disabled={loading || !canSubmit}
            >
              <Sparkles className="h-4 w-4" /> {loading ? "Bezig..." : mode === "create" ? "Bedrijf lanceren" : "Verzoek versturen"}
            </button>
            {mode === "join" && (
              <p className="mt-2 text-xs text-white/50">
                Je ontvangt een mail zodra de admin je aanvraag goedkeurt. Tot die tijd kun je je profiel alvast verder inrichten.
              </p>
            )}
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