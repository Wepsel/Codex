export const dynamic = "force-dynamic";
import type { ComplianceSummary } from "@kube-suite/shared";
import { ComplianceStudio } from "@/components/compliance/compliance-studio";
import { apiFetch, isCompanyMembershipInactiveError } from "@/lib/api-client";
import { PendingMembershipNotice } from "@/components/pending-membership";

export const metadata = {
  title: "Nebula Ops | Compliance Studio",
  description: "Audit en compliance cockpit voor RBAC, secrets en policy scans"
};

export default async function CompliancePage() {
  try {
    const summary = await apiFetch<ComplianceSummary>("/compliance/summary");
    return <ComplianceStudio summary={summary} />;
  } catch (error) {
    if (isCompanyMembershipInactiveError(error)) {
      return <PendingMembershipNotice />;
    }
    throw error;
  }
}
