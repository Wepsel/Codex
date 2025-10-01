import type { CompanyDirectoryEntry, UserProfile } from "@kube-suite/shared";
import { apiFetch } from "./api-client";

export interface LoginPayload {
  username: string;
  password: string;
}

export type RegisterCompanyPayload =
  | {
      mode: "create";
      name: string;
      description?: string;
      inviteOnly?: boolean;
    }
  | {
      mode: "join";
      companyId: string;
    };

export interface RegisterPayload {
  username: string;
  email: string;
  name: string;
  password: string;
  company: RegisterCompanyPayload;
}

export async function login(payload: LoginPayload): Promise<UserProfile> {
  return apiFetch<UserProfile>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function register(payload: RegisterPayload): Promise<UserProfile> {
  return apiFetch<UserProfile>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function searchCompanies(query: string): Promise<CompanyDirectoryEntry[]> {
  const trimmed = query.trim();
  const path = trimmed.length > 0 ? `/auth/companies?q=${encodeURIComponent(trimmed)}` : "/auth/companies";
  return apiFetch<CompanyDirectoryEntry[]>(path);
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", {
    method: "POST",
    parseJson: false
  });
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/auth/me");
}