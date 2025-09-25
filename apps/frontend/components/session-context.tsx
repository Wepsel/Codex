"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@kube-suite/shared";
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest, register as registerRequest } from "@/lib/auth-client";

interface SessionState {
  user: UserProfile | null;
  loading: boolean;
  login: (payload: { username: string; password: string }) => Promise<void>;
  register: (payload: { username: string; email: string; name: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (payload: { username: string; password: string }) => {
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

  const register = useCallback(
    async (payload: { username: string; email: string; name: string; password: string }) => {
      setLoading(true);
      try {
        await registerRequest(payload);
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, register, refresh }),
    [user, loading, login, logout, register, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
