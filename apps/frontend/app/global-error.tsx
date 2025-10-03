"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen w-full bg-[#0a0b23] px-6 py-16 text-white">
          <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-black/30 p-8 text-center shadow-[0_0_80px_rgba(64,64,255,0.35)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/15 text-danger">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold">Er is een onverwachte fout opgetreden</h1>
            <p className="mt-2 text-white/70">{error?.message ?? "Onbekende fout"}</p>
            <button
              onClick={() => reset()}
              className="mt-6 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-6 py-2 text-sm font-semibold text-background shadow-glow"
            >
              Probeer opnieuw
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}


