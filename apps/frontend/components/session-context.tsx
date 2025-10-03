"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@kube-suite/shared";
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type LoginPayload,
  type RegisterPayload
} from "@/lib/auth-client";
import { ApiError } from "@/lib/api-client";

interface SessionState {
  user: UserProfile | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
      setOffline(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setOffline(err.message);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        await loginRequest(payload);
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      const profile = await registerRequest(payload);
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, register, refresh }),
    [user, loading, login, logout, register, refresh]
  );

  if (offline) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0b0c2a] to-[#0a0b23] px-6 py-16 text-white">
        <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-[0_0_80px_rgba(64,64,255,0.35)]">
          <div className="border-b border-white/10 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Verbindingsprobleem</p>
            <h1 className="mt-1 text-xl font-semibold">Backend niet bereikbaar</h1>
          </div>
          <div className="space-y-4 px-6 py-6 text-sm text-white/80">
            <p>{offline}</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setLoading(true);
                  refresh();
                }}
                className="rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-background shadow-glow"
              >
                Opnieuw proberen
              </button>
              <a
                href={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5010/api"}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.35em] text-white/80 hover:text-white"
              >
                Open API status
              </a>
            </div>
            <p className="pt-2 text-xs text-white/50">Tip: controleer NEXT_PUBLIC_API_BASE_URL en start de backend.</p>
          </div>
        </div>
      </div>
    );
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}