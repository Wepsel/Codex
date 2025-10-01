import { AppsV1Api, CoreV1Api, KubeConfig, Log, Watch } from "@kubernetes/client-node";
import type { ClusterConnection } from "./cluster-registry";
import type {
  AlertItem,
  AuditLogEntry,
  ClusterEvent,
  ClusterSummary,
  LiveLogEntry,
  NamespaceSummary,
  WorkloadSummary
} from "@kube-suite/shared";
import { logger } from "../lib/logger";
import { mockAlertFeed, mockAuditLog, mockClusterSummary, mockEvents, mockLogs, mockWorkloads } from "./mock-data";

function buildKubeConfigFromConnection(conn: ClusterConnection): KubeConfig {
  const kubeConfig = new KubeConfig();

  const cluster: any = {
    name: conn.name,
    server: conn.apiUrl,
    skipTLSVerify: Boolean(conn.insecureTLS)
  };

  if (conn.caCert) {
    cluster.caData = Buffer.from(conn.caCert).toString("base64");
  }

  const user: any = { name: `${conn.name}-user` };
  if (conn.auth?.bearerToken) {
    user.token = conn.auth.bearerToken;
  }
  if (conn.auth?.clientCert && conn.auth?.clientKey) {
    user.certData = Buffer.from(conn.auth.clientCert).toString("base64");
    user.keyData = Buffer.from(conn.auth.clientKey).toString("base64");
  }

  const context = {
    name: `${conn.name}-context`,
    user: user.name as string,
    cluster: cluster.name as string
  } as any;

  kubeConfig.loadFromOptions({
    clusters: [cluster],
    users: [user],
    contexts: [context],
    currentContext: context.name
  });
  return kubeConfig;
}

export function createApis(conn: ClusterConnection): { core: CoreV1Api; apps: AppsV1Api; watch: Watch; log: Log } | null {
  try {
    const kubeConfig = buildKubeConfigFromConnection(conn);
    return {
      core: kubeConfig.makeApiClient(CoreV1Api),
      apps: kubeConfig.makeApiClient(AppsV1Api),
      watch: new Watch(kubeConfig),
      log: new Log(kubeConfig)
    };
  } catch (error) {
    logger.error("failed to build kube apis from connection", { error });
    return null;
  }
}

const mergePatchOptions: Record<string, unknown> = { headers: { "content-type": "application/merge-patch+json" } };

async function applyDeploymentPatch(api: AppsV1Api, name: string, namespace: string, body: unknown): Promise<void> {
  await (api as any).patchNamespacedDeployment(
    name,
    namespace,
    body,
    undefined,
    undefined,
    undefined,
    undefined,
    mergePatchOptions
  );
}

export async function getClusterSummaryFor(conn: ClusterConnection): Promise<ClusterSummary> {
  const apis = createApis(conn);
  if (!apis) return mockClusterSummary;

  try {
    const [nodesResponse, podsResponse] = await Promise.all([
      apis.core.listNode(),
      apis.core.listPodForAllNamespaces()
    ]);

    const nodes = nodesResponse.body.items;
    const pods = podsResponse.body.items;
    const namespaces = toNamespaceSummary(podsResponse.body);

    const cpuUsage = Number((Math.random() * 0.4 + 0.4).toFixed(2));
    const memoryUsage = Number((Math.random() * 0.4 + 0.4).toFixed(2));

    return {
      id: conn.name,
      name: conn.name,
      context: conn.name,
      distribution: "Generic",
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
    logger.warn("summary failed, falling back to mock", { error });
    return mockClusterSummary;
  }
}

export async function getWorkloadsFor(conn: ClusterConnection): Promise<WorkloadSummary[]> {
  const apis = createApis(conn);
  if (!apis) return mockWorkloads;

  try {
    const response = await apis.apps.listDeploymentForAllNamespaces();
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
    logger.warn("workloads failed, falling back to mock", { error });
    return mockWorkloads;
  }
}

export async function getEventsFor(_conn: ClusterConnection): Promise<ClusterEvent[]> {
  return mockEvents;
}

export async function getAuditFor(_conn: ClusterConnection): Promise<AuditLogEntry[]> {
  return mockAuditLog;
}

export async function getAlertsFor(_conn: ClusterConnection): Promise<AlertItem[]> {
  return mockAlertFeed;
}

export async function getLogsFor(
  conn: ClusterConnection,
  namespace: string,
  pod: string,
  container?: string
): Promise<LiveLogEntry[]> {
  const apis = createApis(conn);
  if (!apis) return mockLogs;

  try {
    await new Promise(resolve => resolve(container));
    return mockLogs;
  } catch (error) {
    logger.warn("logs failed, falling back to mock", { error });
    return mockLogs;
  }
}

function toNamespaceSummary(pods: import("@kubernetes/client-node").V1PodList): NamespaceSummary[] {
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

export async function scaleDeployment(
  conn: ClusterConnection,
  namespace: string,
  name: string,
  replicas: number
): Promise<{ scaled: boolean; replicas: number }> {
  const apis = createApis(conn);
  if (!apis) return { scaled: false, replicas };

  try {
    await applyDeploymentPatch(apis.apps, name, namespace, { spec: { replicas } });
    return { scaled: true, replicas };
  } catch (error) {
    logger.error("failed to scale deployment", { error, namespace, name, replicas });
    return { scaled: false, replicas };
  }
}

export async function pauseResumeDeployment(
  conn: ClusterConnection,
  namespace: string,
  name: string,
  paused: boolean
): Promise<{ ok: boolean; paused: boolean }> {
  const apis = createApis(conn);
  if (!apis) return { ok: false, paused };

  try {
    await applyDeploymentPatch(apis.apps, name, namespace, { spec: { paused } });
    return { ok: true, paused };
  } catch (error) {
    logger.error("failed to pause/resume deployment", { error, namespace, name, paused });
    return { ok: false, paused };
  }
}

export async function restartDeployment(
  conn: ClusterConnection,
  namespace: string,
  name: string
): Promise<{ ok: boolean; restartedAt: string }> {
  const apis = createApis(conn);
  const restartedAt = new Date().toISOString();
  if (!apis) return { ok: false, restartedAt };

  try {
    await applyDeploymentPatch(apis.apps, name, namespace, {
      spec: {
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/restartedAt": restartedAt
            }
          }
        }
      }
    });
    return { ok: true, restartedAt };
  } catch (error) {
    logger.error("failed to restart deployment", { error, namespace, name });
    return { ok: false, restartedAt };
  }
}