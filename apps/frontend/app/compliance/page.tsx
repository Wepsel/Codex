import type { ComplianceSummary } from "@kube-suite/shared";
import { ComplianceStudio } from "@/components/compliance/compliance-studio";
import { apiFetch } from "@/lib/api-client";

export const metadata = {
  title: "Nebula Ops | Compliance Studio",
  description: "Audit en compliance cockpit voor RBAC, secrets en policy scans"
};

export default async function CompliancePage() {
  const summary = await apiFetch<ComplianceSummary>("/compliance/summary");
  return <ComplianceStudio summary={summary} />;
}
