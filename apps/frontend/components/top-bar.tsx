"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Search, UserCircle2 } from "lucide-react";
import type { UserProfile } from "@kube-suite/shared";
import { useSession } from "@/components/session-context";

interface TopBarProps {
  user: UserProfile;
}

export function TopBar({ user }: TopBarProps) {
  const { logout } = useSession();
  const router = useRouter();
  const [time, setTime] = useState(new Date());
  const [showBell, setShowBell] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications] = useState([
    { id: "n1", text: "Deployment updated", ts: new Date().toLocaleTimeString() },
    { id: "n2", text: "Node Ready", ts: new Date().toLocaleTimeString() }
  ]);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-background/80 px-8 py-6 backdrop-blur">
      <div className="relative hidden max-w-md flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 shadow-inner md:flex">
        <Search className="h-4 w-4" />
        <input
          className="h-8 flex-1 bg-transparent placeholder:text-white/40 focus:outline-none"
          placeholder="Search workloads, namespaces, pods..."
        />
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-white/40">
          Ctrl + K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-6 relative">
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.45em] text-white/40">UTC</p>
          <p className="font-semibold text-white">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={() => setShowBell(v => !v)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:text-white"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
            {notifications.length}
          </span>
        </button>
        <div className="relative">
          <button
            onClick={() => setShowProfile(v => !v)}
            className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2"
          >
            <UserCircle2 className="h-7 w-7 text-white/70" />
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs uppercase tracking-[0.35em] text-accent/70">{user.roles.join(" � ")}</p>
            </div>
          </button>
          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-black/80 p-2 shadow-xl">
              <div className="px-3 py-2 text-xs uppercase tracking-[0.35em] text-white/40">Account</div>
              <Link
                href="/profile"
                onClick={() => setShowProfile(false)}
                className="block w-full rounded-md px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Profile
              </Link>
              <Link
                href="/settings"
                onClick={() => setShowProfile(false)}
                className="block w-full rounded-md px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Settings
              </Link>
              <div className="my-2 h-px bg-white/10" />
              <button
                onClick={handleLogout}
                className="w-full rounded-md px-3 py-2 text-sm text-danger transition hover:bg-danger/10 text-left"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {showBell && (
          <div className="absolute right-0 top-14 w-72 rounded-xl border border-white/10 bg-black/80 p-2 shadow-xl">
            <div className="px-3 py-2 text-xs uppercase tracking-[0.35em] text-white/40">Notifications</div>
            <div className="max-h-64 overflow-auto">
              {notifications.map(n => (
                <div key={n.id} className="rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10">
                  <div>{n.text}</div>
                  <div className="text-[10px] uppercase tracking-[0.35em] text-white/30">{n.ts}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
