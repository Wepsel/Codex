import type { AlertItem, ClusterSummary, WorkloadSummary } from "@kube-suite/shared";
import { DashboardExperience } from "@/components/dashboard/dashboard-experience";
import { apiFetch, isCompanyMembershipInactiveError } from "@/lib/api-client";
import { PendingMembershipNotice } from "@/components/pending-membership";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [summary, workloads, alerts] = await Promise.all([
    apiFetch<ClusterSummary>("/cluster/summary"),
    apiFetch<WorkloadSummary[]>("/cluster/workloads"),
    apiFetch<AlertItem[]>("/cluster/alerts")
  ]);

  return { summary, workloads, alerts };
}

export default async function DashboardPage() {
  try {
    const { summary, workloads, alerts } = await getDashboardData();
    return <DashboardExperience summary={summary} workloads={workloads} alerts={alerts} />;
  } catch (error) {
    if (isCompanyMembershipInactiveError(error)) {
      return <PendingMembershipNotice />;
    }
    throw error;
  }
}
