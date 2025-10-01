export const dynamic = "force-dynamic";
import type { ClusterSummary, WorkloadSummary } from "@kube-suite/shared";
import { apiFetch, isCompanyMembershipInactiveError } from "@/lib/api-client";
import { getRuntimeClusterId } from "@/lib/runtime-cluster";
import { WorkloadTable } from "@/components/dashboard/workload-table";
import { PendingMembershipNotice } from "@/components/pending-membership";

async function getWorkloadData(clusterId?: string) {
  const [summary, workloads] = await Promise.all([
    apiFetch<ClusterSummary>("/cluster/summary", {}, clusterId),
    apiFetch<WorkloadSummary[]>("/cluster/workloads", {}, clusterId)
  ]);

  return { summary, workloads };
}

export default async function WorkloadsPage() {
  try {
    const clusterId = getRuntimeClusterId();
    const { summary, workloads } = await getWorkloadData(clusterId);

    return (
      <div className="space-y-8 px-8 pb-16">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">{summary.name}</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Workloads overzicht</h1>
          <p className="mt-2 text-sm text-white/50">
            {summary.workloads} workloads | {summary.pods} pods | {summary.namespaces.length} namespaces
          </p>
        </header>

        <WorkloadTable workloads={workloads} />
      </div>
    );
  } catch (error) {
    if (isCompanyMembershipInactiveError(error)) {
      return <PendingMembershipNotice />;
    }
    throw error;
  }
}
