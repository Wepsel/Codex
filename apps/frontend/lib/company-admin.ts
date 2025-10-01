import type {
  CompanyAdminOverview,
  CompanyInvite,
  CompanyJoinRequest,
  CompanyMember,
  CompanyRole
} from "@kube-suite/shared";
import { apiFetch } from "./api-client";

export async function fetchCompanyAdminOverview(): Promise<CompanyAdminOverview> {
  return apiFetch<CompanyAdminOverview>("/auth/company/admin");
}

export async function inviteCompanyMember(payload: {
  email: string;
  role: CompanyRole;
  expiresAt?: string;
}): Promise<CompanyInvite> {
  return apiFetch<CompanyInvite>("/auth/company/invite", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateCompanyMember(memberId: string, role: CompanyRole): Promise<CompanyMember> {
  return apiFetch<CompanyMember>("/auth/company/members/" + memberId, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

export async function removeCompanyMember(memberId: string): Promise<void> {
  await apiFetch("/auth/company/members/" + memberId, {
    method: "DELETE",
    parseJson: false
  });
}

export async function resetCompanyMemberPassword(
  memberId: string
): Promise<{ userId: string; temporaryPassword: string }> {
  return apiFetch<{ userId: string; temporaryPassword: string }>("/auth/company/members/" + memberId + "/reset-password", {
    method: "POST"
  });
}

export async function decideCompanyJoinRequest(
  requestId: string,
  decision: "approve" | "reject"
): Promise<CompanyJoinRequest> {
  return apiFetch<CompanyJoinRequest>("/auth/company/requests/" + requestId + "/decision", {
    method: "POST",
    body: JSON.stringify({ decision })
  });
}
