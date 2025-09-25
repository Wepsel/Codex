import { randomUUID } from "crypto";
import type {
  AlertItem,
  AuditLogEntry,
  ClusterEvent,
  ClusterSummary,
  LiveLogEntry,
  NamespaceSummary,
  WorkloadSummary
} from "@kube-suite/shared";

const baseTimestamp = Date.now();

const namespaces: NamespaceSummary[] = [
  {
    name: "default",
    workloads: 12,
    pods: 36,
    activeAlerts: 1
  },
  {
    name: "kube-system",
    workloads: 18,
    pods: 54,
    activeAlerts: 0
  },
  {
    name: "production",
    workloads: 9,
    pods: 24,
    activeAlerts: 2
  }
];

const workloads: WorkloadSummary[] = Array.from({ length: 12 }).map((_, idx) => ({
  name: `service-${idx + 1}`,
  type: idx % 3 === 0 ? "StatefulSet" : "Deployment",
  namespace: idx % 2 === 0 ? "default" : "production",
  replicasDesired: 4,
  replicasReady: idx % 4 === 0 ? 3 : 4,
  updatedAt: new Date(baseTimestamp - idx * 4_000_000).toISOString(),
  image: "ghcr.io/example/app:1.6.2"
}));

const auditLogs: AuditLogEntry[] = Array.from({ length: 10 }).map((_, idx) => ({
  id: randomUUID(),
  userId: idx % 2 === 0 ? "ops-admin" : "devops-lead",
  action: idx % 2 === 0 ? "RestartPod" : "TriggerDeployment",
  target: idx % 2 === 0 ? "pod/frontend-58cbdc" : "deployments/payment-api",
  status: idx % 3 === 0 ? "failure" : "success",
  createdAt: new Date(baseTimestamp - idx * 60_000).toISOString(),
  metadata: {
    namespace: idx % 2 === 0 ? "default" : "production",
    clusterId: "demo-cluster"
  }
}));

const alerts: AlertItem[] = [
  {
    id: randomUUID(),
    severity: "critical",
    message: "Node ip-10-12-21-8 is unreachable",
    source: "node-prober",
    createdAt: new Date(baseTimestamp - 120_000).toISOString()
  },
  {
    id: randomUUID(),
    severity: "warning",
    message: "Pod payments-7f7c pending for 3m",
    source: "scheduler",
    createdAt: new Date(baseTimestamp - 90_000).toISOString()
  }
];

const logs: LiveLogEntry[] = Array.from({ length: 20 }).map((_, idx) => ({
  pod: "frontend-6d7f8",
  namespace: "production",
  container: "web",
  timestamp: new Date(baseTimestamp - idx * 2_000).toISOString(),
  level: idx % 5 === 0 ? "warn" : "info",
  message:
    idx % 5 === 0
      ? `Latency spike detected on route /checkout (${80 + idx}ms)`
      : `HTTP 200 - GET /api/catalog?page=${idx}`
}));

const events: ClusterEvent[] = [
  {
    id: randomUUID(),
    type: "Warning",
    reason: "FailedScheduling",
    message: "0/6 nodes available: insufficient memory",
    involvedObject: {
      kind: "Pod",
      name: "checkout-7c9464",
      namespace: "production"
    },
    timestamp: new Date(baseTimestamp - 300_000).toISOString()
  },
  {
    id: randomUUID(),
    type: "Normal",
    reason: "ScalingReplicaSet",
    message: "Scaled up replica set cart-6f66c8 to 4",
    involvedObject: {
      kind: "Deployment",
      name: "cart",
      namespace: "default"
    },
    timestamp: new Date(baseTimestamp - 180_000).toISOString()
  }
];

export const mockClusterSummary: ClusterSummary = {
  id: "demo-cluster",
  name: "Aurora Production",
  context: "aurora-prod",
  distribution: "EKS",
  version: "1.29.3",
  nodes: 8,
  workloads: workloads.length,
  pods: 140,
  phase: "Healthy",
  lastSync: new Date(baseTimestamp).toISOString(),
  cpuUsage: 0.62,
  memoryUsage: 0.71,
  namespaces
};

export const mockWorkloads = workloads;
export const mockAlertFeed = alerts;
export const mockAuditLog = auditLogs;
export const mockLogs = logs;
export const mockEvents = events;
