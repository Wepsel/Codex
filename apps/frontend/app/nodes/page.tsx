export const dynamic = "force-dynamic";
import type { NodeStatus } from "@kube-suite/shared";
import { apiFetch, isCompanyMembershipInactiveError } from "@/lib/api-client";
import { PendingMembershipNotice } from "@/components/pending-membership";
import { NodePulse } from "@/components/nodes/node-pulse";

export const metadata = {
  title: "Nebula Ops | Node Pulse",
  description: "Diepe analyse van node gezondheid, hotspots en capaciteit"
};

async function getNodes() {
  return apiFetch<NodeStatus[]>("/cluster/nodes");
}

export default async function NodesPage() {
  try {
    const nodes = await getNodes();
    return (
      <div className="space-y-8 px-8 pb-16">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Node pulse</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Live node health & capacity</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Monitor skyline alerts, detect hotspots en zie direct welke nodes tegen de limieten aanlopen. Perfect voor autoscaling- en upgradebeslissingen.
          </p>
        </header>
        <NodePulse nodes={nodes} />
      </div>
    );
  } catch (error) {
    if (isCompanyMembershipInactiveError(error)) {
      return <PendingMembershipNotice />;
    }
    throw error;
  }
}
