"use client";

import { useState } from "react";

interface ConfirmProps {
  title: string;
  description?: string;
  actionLabel: string;
  onConfirm: () => Promise<void> | void;
  variant?: "danger" | "default";
  children: (open: () => void, busy: boolean) => React.ReactNode;
}

export function Confirm({ title, description, actionLabel, onConfirm, variant = "default", children }: ConfirmProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {children(() => setOpen(true), busy)}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0c2a] p-6 text-white shadow-glow">
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && <p className="mt-2 text-sm text-white/70">{description}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 hover:text-white"
              >
                Annuleren
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.35em] ${
                  variant === "danger"
                    ? "border border-danger/40 bg-danger/20 text-danger hover:bg-danger/25"
                    : "border border-white/15 bg-white/10 text-white/80 hover:text-white"
                } disabled:opacity-60`}
              >
                {actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


