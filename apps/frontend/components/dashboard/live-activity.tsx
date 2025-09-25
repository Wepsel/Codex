"use client";

import type { ReactNode } from "react";
import { useLiveFeed } from "@/hooks/use-live-feed";
import { Activity, Code2, GitBranch } from "lucide-react";

export function LiveActivity() {
  const feed = useLiveFeed();

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="grid gap-6 md:grid-cols-3">
        <FeedColumn
          title="Logs"
          icon={<Code2 className="h-4 w-4" />}
          items={feed.logs.map(log => ({
            id: `${log.pod}-${log.timestamp}`,
            primary: `${log.pod} · ${log.container}`,
            secondary: log.message,
            timestamp: log.timestamp
          }))}
        />
        <FeedColumn
          title="Audit"
          icon={<GitBranch className="h-4 w-4" />}
          items={feed.audit.map(entry => ({
            id: entry.id,
            primary: `${entry.action} · ${entry.status}`,
            secondary: entry.target,
            timestamp: entry.createdAt
          }))}
        />
        <FeedColumn
          title="Events"
          icon={<Activity className="h-4 w-4" />}
          items={feed.events.map(event => ({
            id: event.id,
            primary: `${event.reason} (${event.type})`,
            secondary: event.message,
            timestamp: event.timestamp
          }))}
        />
      </div>
    </section>
  );
}

interface FeedColumnProps {
  title: string;
  icon: ReactNode;
  items: { id: string; primary: string; secondary: string; timestamp: string }[];
}

function FeedColumn({ title, icon, items }: FeedColumnProps) {
  return (
    <div className="flex h-80 flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/30">
      <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3 text-xs uppercase tracking-[0.35em] text-white/50">
        {icon}
        {title}
      </header>
      <div className="flex-1 space-y-3 overflow-auto px-4 py-4">
        {items.length === 0 && <p className="text-xs text-white/30">Nog geen realtime events</p>}
        {items.map(item => (
          <article key={item.id} className="rounded-xl bg-white/5 p-3 text-xs text-white/60">
            <p className="text-sm font-semibold text-white">{item.primary}</p>
            <p className="mt-1 line-clamp-2 text-white/50">{item.secondary}</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-white/30">
              {new Date(item.timestamp).toLocaleTimeString()}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
