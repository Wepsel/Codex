"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Copy, Link2, ServerOff } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Optionally log to an error reporting service
    // console.error(error);
  }, [error]);

  const hint = (() => {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("kon geen verbinding maken met api") || msg.includes("failed to fetch")) {
      return "Controleer of de backend draait en of NEXT_PUBLIC_API_BASE_URL correct is ingesteld.";
    }
    return undefined;
  })();

  function copyDetails() {
    const text = [error?.message, error?.stack].filter(Boolean).join("\n\n");
    try {
      navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-[80vh] w-full bg-gradient-to-b from-[#0b0c2a] to-[#0a0b23] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-[0_0_80px_rgba(64,64,255,0.35)]">
          <div className="absolute -inset-1 -z-10 rounded-3xl bg-gradient-to-r from-primary-500/20 via-accent/20 to-primary-400/20 blur-2xl" />
          <div className="flex items-start gap-4 border-b border-white/10 px-6 py-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/15 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Er is iets misgegaan</p>
              <h1 className="mt-1 text-xl font-semibold text-white">Kon de pagina niet laden</h1>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <ServerOff className="mt-0.5 h-5 w-5 text-white/70" />
              <div className="text-sm text-white/80">
                <p className="font-medium">{error?.message ?? "Onbekende fout"}</p>
                {hint ? <p className="mt-1 text-white/60">{hint}</p> : null}
                {error?.digest ? (
                  <p className="mt-1 text-xs text-white/40">Ref: {error.digest}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => reset()}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-background shadow-glow"
              >
                <RefreshCw className="h-4 w-4" /> Opnieuw proberen
              </button>
              <button
                onClick={copyDetails}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.35em] text-white/80 hover:text-white"
              >
                <Copy className="h-4 w-4" /> Kopieer details
              </button>
              <a
                href="/"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.35em] text-white/80 hover:text-white"
              >
                <Link2 className="h-4 w-4" /> Terug naar dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


