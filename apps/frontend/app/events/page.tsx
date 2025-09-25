import type { ClusterEvent } from "@kube-suite/shared";
import { apiFetch } from "@/lib/api-client";
import { Activity } from "lucide-react";

async function getEvents(clusterId?: string) {
  return apiFetch<ClusterEvent[]>("/cluster/events", {}, clusterId);
}

export default async function EventsPage() {
  const clusterId = typeof window === "undefined" ? undefined : (global as any).selectedClusterId;
  const events = await getEvents(clusterId);

  return (
    <div className="space-y-8 px-8 pb-16">
      <header className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-accent" />
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Kubernetes events</p>
          <h1 className="text-3xl font-semibold text-white">Realtime event stream</h1>
        </div>
      </header>

      <div className="space-y-4">
        {events.map(event => (
          <article
            key={event.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/50">
                {event.type}
              </span>
              <span className="text-xs text-white/40">{new Date(event.timestamp).toLocaleString()}</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white">{event.reason}</h2>
            <p className="mt-2 text-sm text-white/60">{event.message}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.35em] text-white/30">
              {event.involvedObject.kind} · {event.involvedObject.name}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
