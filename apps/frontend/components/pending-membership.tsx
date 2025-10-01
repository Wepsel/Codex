import Link from "next/link";
import { ShieldAlert, Clock } from "lucide-react";

export function PendingMembershipNotice() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6 py-16">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_30px_120px_-60px_rgba(123,97,255,0.8)] backdrop-blur">
        <div className="absolute -top-24 right-1/4 h-48 w-48 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-accent/15 blur-[100px]" />

        <div className="relative flex flex-col items-center gap-5 text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.4em] text-white/50">
            <ShieldAlert className="h-4 w-4 text-accent" />
            Toegang in behandeling
          </span>

          <h1 className="max-w-2xl bg-gradient-to-r from-white via-primary-100 to-accent bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            Een admin bevestigt je lidmaatschap binnen enkele momenten
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-white/60">
            Je account is aangemaakt, maar we hebben nog geen actief lidmaatschap voor dit bedrijf gevonden. Zodra een admin je verzoek accepteert of je uitnodiging activeert, krijg je automatisch toegang tot alle dashboards.
          </p>

          <ul className="mt-6 flex flex-col gap-3 text-left text-sm text-white/55">
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-accent" />
              <span>Check je mailbox: bevestig eventuele uitnodigingen die via e-mail zijn verstuurd.</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-accent" />
              <span>Laat een admin weten dat je klaarstaat; zij kunnen je verzoek goedkeuren vanuit het admin-overzicht.</span>
            </li>
          </ul>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/profile"
              className="rounded-full border border-white/15 px-6 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Bekijk profiel
            </Link>
            <Link
              href="/settings"
              className="rounded-full border border-white/15 px-6 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Bekijk aanvragen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
