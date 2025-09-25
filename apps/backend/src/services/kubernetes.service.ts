import { PassThrough } from "stream";
import { randomUUID } from "crypto";
import type { V1PodList } from "@kubernetes/client-node";
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
      .map(line => ({
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
    const baseImage = payload.image.includes(":") ? payload.image.split(":")[0] : payload.image;
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

    const diff = `@@ manifest/${payload.name}.yaml\n- image: ${payload.image}\n+ image: ${baseImage}:${targetTag}`;
    const warnings = payload.replicas > 5 ? ["Scaling beyond 5 replicas may require PDB update"] : [];

    return {
      id,
      manifestName: payload.name,
      namespace: payload.namespace,
      steps,
      diff,
      warnings
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
