"use server";

import { apiFetch } from "@/lib/api-client";

export async function scaleDeployment(namespace: string, name: string, replicas: number) {
  return apiFetch(`/cluster/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}/scale`, {
    method: "POST",
    body: JSON.stringify({ replicas })
  });
}

export async function restartDeployment(namespace: string, name: string) {
  return apiFetch(`/cluster/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}/restart`, {
    method: "POST"
  });
}


