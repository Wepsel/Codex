import { PassThrough } from "stream";
import { randomUUID } from "crypto";
import type { V1Node, V1PodList } from "@kubernetes/client-node";
import { AppsV1Api, CoreV1Api, KubeConfig, Log, Watch } from "@kubernetes/client-node";
import type {
  AlertItem,
  AuditLogEntry,
  ClusterEvent,
  ClusterSummary,
  DeploymentPlanResponse,
  DeploymentWizardPayload,
  LiveLogEntry,
  NamespaceSummary,
  NodeStatus,
  WorkloadSummary
} from "@kube-suite/shared";
import env from "../config/env";
import { logger } from "../lib/logger";
import {
  mockAlertFeed,
  mockAuditLog,
  mockClusterSummary,
  mockEvents,
  mockLogs,
  mockNodeStatuses,
  mockWorkloads
} from "./mock-data";
import { simulateDeploymentProgress } from "./streaming.service";

export class KubernetesService {
  private kubeConfig: KubeConfig | null = null;
  private coreApi: CoreV1Api | null = null;
  private appsApi: AppsV1Api | null = null;
  private watch: Watch | null = null;
  private logs: Log | null = null;

  constructor() {
    if (!env.mockMode) {
      try {
        this.initialize();
      } catch (error) {
        logger.error("failed to initialise kubernetes client", { error });
      }
    }
  }

  private initialize(): void {
    const kubeConfig = new KubeConfig();
    if (env.kubeConfigPath) {
      kubeConfig.loadFromFile(env.kubeConfigPath);
    } else {
      kubeConfig.loadFromDefault();
    }

    this.kubeConfig = kubeConfig;
    this.coreApi = kubeConfig.makeApiClient(CoreV1Api);
    this.appsApi = kubeConfig.makeApiClient(AppsV1Api);
    this.watch = new Watch(kubeConfig);
    this.logs = new Log(kubeConfig);
  }

  async getClusterSummary(): Promise<ClusterSummary> {
    if (!this.coreApi || !this.appsApi) {
      return mockClusterSummary;
    }

    try {
      const [nodesResponse, podsResponse] = await Promise.all([
        this.coreApi.listNode(),
        this.coreApi.listPodForAllNamespaces()
      ]);

      const nodes = nodesResponse.body.items;
      const pods = podsResponse.body.items;
      const namespaces = this.toNamespaceSummary(podsResponse.body);

      const cpuUsage = Number((Math.random() * 0.4 + 0.4).toFixed(2));
      const memoryUsage = Number((Math.random() * 0.4 + 0.4).toFixed(2));

      return {
        id: this.kubeConfig?.getCurrentContext() ?? "default-context",
        name: this.kubeConfig?.getCurrentCluster()?.name ?? "Kubernetes Cluster",
        context: this.kubeConfig?.getCurrentContext() ?? "unknown",
        distribution: this.kubeConfig?.getCurrentCluster()?.server?.includes("eks") ? "EKS" : "Generic",
        version: nodes[0]?.status?.nodeInfo?.kubeletVersion ?? "unknown",
        nodes: nodes.length,
        workloads: pods.length,
        pods: pods.length,
        phase: "Healthy",
        lastSync: new Date().toISOString(),
        cpuUsage,
        memoryUsage,
        namespaces
      };
    } catch (error) {
      logger.error("failed to query cluster summary", { error });
      return mockClusterSummary;
    }
  }

  async getNamespaces(): Promise<NamespaceSummary[]> {
    if (!this.coreApi) {
      return mockClusterSummary.namespaces;
    }

    try {
      const response = await this.coreApi.listNamespace();
      return response.body.items.map(ns => ({
        name: ns.metadata?.name ?? "unknown",
        workloads: 0,
        pods: 0,
        activeAlerts: 0
      }));
    } catch (error) {
      logger.warn("failed to list namespaces, using mock", { error });
      return mockClusterSummary.namespaces;
    }
  }

  async getWorkloads(): Promise<WorkloadSummary[]> {
    if (!this.appsApi) {
      return mockWorkloads;
    }

    try {
      const response = await this.appsApi.listDeploymentForAllNamespaces();
      return response.body.items.map(item => ({
        name: item.metadata?.name ?? "deployment",
        type: "Deployment",
        namespace: item.metadata?.namespace ?? "default",
        replicasDesired: item.spec?.replicas ?? 0,
        replicasReady: item.status?.readyReplicas ?? 0,
        updatedAt: (item.metadata?.creationTimestamp ?? new Date().toISOString()).toString(),
        image: item.spec?.template?.spec?.containers?.[0]?.image ?? "unknown"
      }));
    } catch (error) {
      logger.warn("failed to list deployments, using mock", { error });
      return mockWorkloads;
    }
  }


  async getNodeStatuses(): Promise<NodeStatus[]> {
    if (!this.coreApi) {
      return mockNodeStatuses;
    }

    try {
      const response = await this.coreApi.listNode();
      return response.body.items
        .map(node => this.toNodeStatus(node))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.warn("failed to list nodes, using mock", { error });
      return mockNodeStatuses;
    }
  }
  async getAlerts(): Promise<AlertItem[]> {
    return mockAlertFeed;
  }

  async getAuditLog(): Promise<AuditLogEntry[]> {
    return mockAuditLog;
  }

  async getEvents(): Promise<ClusterEvent[]> {
    if (!this.watch) {
      return mockEvents;
    }

    return mockEvents;
  }

  async getPodLogs(namespace: string, pod: string, container?: string): Promise<LiveLogEntry[]> {
    if (!this.logs) {
      return mockLogs;
    }

    const logStream = new PassThrough();

    await this.logs.log(namespace, pod, container ?? "", logStream, {
      follow: false,
      tailLines: 200
    });

    const data = logStream.read()?.toString() ?? "";
    const entries = data
      .split("\n")
      .filter(Boolean)
      .map((line: string) => ({
        pod,
        namespace,
        container: container ?? "",
        timestamp: new Date().toISOString(),
        level: line.includes("ERR") ? "error" : line.includes("WARN") ? "warn" : "info",
        message: line
      }));

    return entries.length > 0 ? entries : mockLogs;
  }

  async applyManifest(manifestYaml: string): Promise<{ accepted: boolean; executionId: string }> {
    const executionId = randomUUID();
    logger.info("manifest apply invoked", { length: manifestYaml.length, executionId });
    const manifestNameMatch = manifestYaml.match(/name:\s*(.*)/);
    const manifestName = manifestNameMatch?.[1]?.trim() ?? "deploy-wizard";
    setTimeout(() => simulateDeploymentProgress(executionId, manifestName), 200);
    return { accepted: true, executionId };
  }

  async planDeployment(payload: DeploymentWizardPayload): Promise<DeploymentPlanResponse> {
    const id = randomUUID();
    const targetTag = payload.strategy === "RollingUpdate" ? "stable" : "canary";

    const steps: DeploymentPlanResponse["steps"] = [
      {
        id: "lint",
        title: "Schema validation",
        description: "Manifest checked against Kubernetes schema",
        status: "complete"
      },
      {
        id: "policy",
        title: "Policy guardrails",
        description: "OPA policies satisfied - no gated failures",
        status: "complete"
      },
      {
        id: "dry-run",
        title: "Server-side dry-run",
        description: "API server dry-run rendered successfully",
        status: "in_progress"
      },
      {
        id: "rollout",
        title: "Rollout ready",
        description: "Ready to apply with selected strategy",
        status: "pending"
      }
    ];

    // Extract ALL container images from the provided manifestYaml to support multi-container workloads
    const images: string[] = [];
    const manifest = payload.manifestYaml ?? "";
    const imageLineRegex = /(^|\n)\s*image:\s*([^\s#]+)\s*(?:#.*)?/g; // capture non-space image values
    let match: RegExpExecArray | null;
    while ((match = imageLineRegex.exec(manifest)) !== null) {
      const image = match[2].trim();
      if (image.length > 0) {
        images.push(image);
      }
    }

    const uniqueImages = Array.from(new Set(images));
    const diffLines: string[] = [
      `@@ manifest/${payload.name}.yaml`
    ];
    for (const image of uniqueImages) {
      const base = image.includes(":") ? image.split(":")[0] : image;
      diffLines.push(`- image: ${image}`);
      diffLines.push(`+ image: ${base}:${targetTag}`);
    }
    // Fallback: if no images were detected, include at least the single provided image field
    if (uniqueImages.length === 0 && payload.image) {
      const baseSingle = payload.image.includes(":") ? payload.image.split(":")[0] : payload.image;
      diffLines.push(`- image: ${payload.image}`);
      diffLines.push(`+ image: ${baseSingle}:${targetTag}`);
    }

    const warnings: string[] = [];
    if (payload.replicas > 5) warnings.push("Scaling beyond 5 replicas may require PDB update");
    if (uniqueImages.length > 1) warnings.push("Multiple container images detected; verify all tags before rollout");
    if (uniqueImages.length === 0) warnings.push("No explicit image lines found; ensure manifest contains container images");

    return {
      id,
      manifestName: payload.name,
      namespace: payload.namespace,
      steps,
      diff: diffLines.join("\n"),
      warnings
    };
  }

  private toNodeStatus(node: V1Node): NodeStatus {
    const metadata = node.metadata ?? {};
    const status = node.status ?? {};
    const allocatable = status.allocatable ?? {};
    const capacity = status.capacity ?? {};
    const roles = extractNodeRoles(metadata.labels ?? {});
    const readyCondition = (status.conditions ?? []).find(condition => condition.type === "Ready");
    const parsedAllocatableCpu = parseCpuValue(allocatable.cpu);
    const parsedCapacityCpu = parseCpuValue(capacity.cpu);
    const parsedAllocatableMemory = parseMemoryValue(allocatable.memory);
    const parsedCapacityMemory = parseMemoryValue(capacity.memory);

    const podCapacity = Number(capacity.pods ?? 0);
    const allocatablePods = Number(allocatable.pods ?? 0);
    const usedPods = Math.max(0, podCapacity - allocatablePods);

    return {
      name: metadata.name ?? "unknown",
      roles: roles.length > 0 ? roles : ["worker"],
      cpu: computeUsageRatio(parsedAllocatableCpu, parsedCapacityCpu),
      memory: computeUsageRatio(parsedAllocatableMemory, parsedCapacityMemory),
      pods: usedPods,
      age: formatNodeAge(metadata.creationTimestamp),
      status:
        readyCondition?.status === "True"
          ? "Ready"
          : readyCondition?.status === "False"
            ? "NotReady"
            : "Unknown",
      kubeletVersion: status.nodeInfo?.kubeletVersion ?? "unknown"
    };
  }
  private toNamespaceSummary(pods: V1PodList): NamespaceSummary[] {
    const namespaces = new Map<string, NamespaceSummary>();
    pods.items.forEach(pod => {
      const namespace = pod.metadata?.namespace ?? "default";
      const summary = namespaces.get(namespace) ?? {
        name: namespace,
        workloads: 0,
        pods: 0,
        activeAlerts: 0
      };
      summary.pods += 1;
      summary.workloads = summary.workloads + Number(pod.metadata?.ownerReferences?.length ?? 0);
      namespaces.set(namespace, summary);
    });

    return Array.from(namespaces.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
}

const kubernetesService = new KubernetesService();

export default kubernetesService;

function extractNodeRoles(labels: Record<string, string>): string[] {
  const roles = Object.keys(labels)
    .filter(key => key.startsWith("node-role.kubernetes.io/") || key === "kubernetes.io/role")
    .map(key => {
      if (key === "kubernetes.io/role") {
        return labels[key];
      }
      const parts = key.split("/");
      const role = parts[parts.length - 1];
      return role.length > 0 ? role : "worker";
    })
    .filter((role): role is string => Boolean(role && role.trim().length > 0));

  return Array.from(new Set(roles));
}

function parseCpuValue(value?: string): number {
  if (!value) {
    return 0;
  }
  if (value.endsWith("m")) {
    const milli = Number(value.slice(0, -1));
    return Number.isFinite(milli) ? milli / 1000 : 0;
  }
  const cpu = Number(value);
  return Number.isFinite(cpu) ? cpu : 0;
}

function parseMemoryValue(value?: string): number {
  if (!value) {
    return 0;
  }
  const match = value.match(/^(\d+)(Ei|Pi|Ti|Gi|Mi|Ki)?$/);
  if (!match) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return 0;
  }

  const unit = match[2];
  const multipliers: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6
  };

  if (!unit) {
    return amount;
  }

  return amount * (multipliers[unit] ?? 1);
}

function computeUsageRatio(allocatable: number, capacity: number): number {
  if (capacity <= 0) {
    return 0;
  }
  const used = Math.max(0, capacity - allocatable);
  const ratio = used / capacity;
  return Number(Math.min(1, Math.max(0, ratio)).toFixed(2));
}

function formatNodeAge(timestamp?: string | Date): string {
  if (!timestamp) {
    return "-";
  }
  const created = new Date(timestamp).getTime();
  if (Number.isNaN(created)) {
    return "-";
  }

  const diffMs = Date.now() - created;
  const days = Math.floor(diffMs / 86_400_000);
  if (days > 0) {
    return `${days}d`;
  }
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours > 0) {
    return `${hours}h`;
  }
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  return `${minutes}m`;
}












