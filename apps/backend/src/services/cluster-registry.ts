import crypto from "crypto";

export interface ClusterAuth {
  bearerToken?: string;
  clientCert?: string; // PEM
  clientKey?: string; // PEM
}

export interface ClusterConnection {
  id: string;
  userId: string;
  name: string;
  apiUrl: string;
  caCert?: string; // PEM
  insecureTLS?: boolean;
  auth: ClusterAuth;
  createdAt: string;
}

const userIdToClusters = new Map<string, ClusterConnection[]>();

export function listUserClusters(userId: string): ClusterConnection[] {
  return userIdToClusters.get(userId) ?? [];
}

export function addUserCluster(userId: string, input: Omit<ClusterConnection, "id" | "userId" | "createdAt">): ClusterConnection {
  const id = crypto.randomUUID();
  const record: ClusterConnection = {
    id,
    userId,
    name: input.name,
    apiUrl: input.apiUrl,
    caCert: input.caCert,
    insecureTLS: input.insecureTLS,
    auth: input.auth,
    createdAt: new Date().toISOString()
  };
  const list = userIdToClusters.get(userId) ?? [];
  list.push(record);
  userIdToClusters.set(userId, list);
  return record;
}

export function getUserCluster(userId: string, clusterId: string): ClusterConnection | undefined {
  return (userIdToClusters.get(userId) ?? []).find(c => c.id === clusterId);
}

export function removeUserCluster(userId: string, clusterId: string): boolean {
  const list = userIdToClusters.get(userId) ?? [];
  const next = list.filter(c => c.id !== clusterId);
  const removed = next.length !== list.length;
  userIdToClusters.set(userId, next);
  return removed;
}


