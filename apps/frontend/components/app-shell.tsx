"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/session-context";
import { ClusterSync } from "@/components/cluster-sync";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

const AUTH_ROUTES = ["/login", "/register"];
const PROTECTED_PREFIXES = ["/dashboard", "/workloads", "/events", "/capacity", "/optimizer", "/settings", "/profile", "/logs"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));

  useEffect(() => {
    if (loading) return;
    if (isProtected && !user) {
      router.replace("/login");
    }
    if (user && isAuthRoute) {
      router.replace("/dashboard");
    }
  }, [isAuthRoute, isProtected, loading, pathname, router, user]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!isProtected && !user) {
    return <>{children}</>;
  }

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-sm text-white/70 shadow-glow">
          Sessies worden geladen...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background text-white">
      <Sidebar user={user} />
      <main className="flex-1 overflow-hidden">
        <TopBar user={user} />
        <ClusterSync />
        {children}
      </main>
    </div>
  );
}



