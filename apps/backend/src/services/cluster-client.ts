import { PassThrough } from "stream";
import { AppsV1Api, CoreV1Api, KubeConfig, Log, VersionApi, Watch, type VersionInfo } from "@kubernetes/client-node";
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

export async function getEventsFor(conn: ClusterConnection): Promise<ClusterEvent[]> {
  const apis = createApis(conn);
  if (!apis) return mockEvents;

  try {
    const response = await apis.core.listEventForAllNamespaces();
    const events = response.body.items
      .map(toClusterEvent)
      .filter((event): event is ClusterEvent => Boolean(event));
    return events;
  } catch (error) {
    logger.warn("events failed, falling back to mock", { error, clusterConnectionId: conn.id });
    return mockEvents;
  }
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
    const logStream = new PassThrough();
    const chunks: string[] = [];

    logStream.on("data", chunk => {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    });

    await apis.log.log(namespace, pod, container ?? "", logStream, { follow: false, tailLines: 200 });

    const payload = chunks.join("");
    const lines = payload.split(/\r?\n/).filter(Boolean);
    const now = Date.now();

    const entries = lines.map((line, index) => ({
      pod,
      namespace,
      container: container ?? "",
      timestamp: extractTimestampFromLogLine(line) ?? new Date(now - (lines.length - index - 1) * 1000).toISOString(),
      message: line,
      level: detectLogLevel(line)
    }));

    return entries;
  } catch (error) {
    logger.warn("logs failed, falling back to mock", { error, namespace, pod, container });
    return mockLogs;
  }
}

function toClusterEvent(event: import("@kubernetes/client-node").V1Event): ClusterEvent | null {
  if (!event || !event.metadata) {
    return null;
  }

  const id = event.metadata.uid ?? `${event.metadata.namespace ?? "default"}:${event.metadata.name ?? "event"}`;
  const involved = event.involvedObject ?? {};

  return {
    id,
    reason: event.reason ?? involved.kind ?? "Unknown",
    type: normalizeEventType(event.type),
    message: event.message ?? "",
    involvedObject: {
      kind: involved.kind ?? "Object",
      name: involved.name ?? id,
      namespace: involved.namespace ?? event.metadata.namespace ?? "default"
    },
    timestamp: resolveEventTimestamp(event)
  };
}

function normalizeEventType(value?: string): ClusterEvent["type"] {
  if (!value) return "Normal";
  const normalized = value.toLowerCase();
  if (normalized === "warning") return "Warning";
  if (normalized === "error" || normalized === "severe") return "Error";
  return "Normal";
}

function resolveEventTimestamp(event: import("@kubernetes/client-node").V1Event): string {
  const candidates: Array<string | Date | undefined> = [
    (event as unknown as { eventTime?: string }).eventTime,
    event.lastTimestamp,
    event.firstTimestamp,
    event.metadata?.creationTimestamp
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const asString = typeof candidate === "string" ? candidate : candidate instanceof Date ? candidate.toISOString() : candidate.toString();
    const parsed = Date.parse(asString);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
}

function detectLogLevel(line: string): LiveLogEntry["level"] {
  const value = line.toLowerCase();
  if (/(\berr(?:or)?|\bfatal|\bsevere)/.test(value)) {
    return "error";
  }
  if (/\bwarn(?:ing)?/.test(value)) {
    return "warn";
  }
  if (/\bdebug/.test(value)) {
    return "debug";
  }
  return "info";
}

function extractTimestampFromLogLine(line: string): string | undefined {
  const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
  if (isoMatch) {
    const parsed = Date.parse(isoMatch[0]);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return undefined;
}


type ClusterProbeSuccess = { ok: true; clusterName?: string; kubernetesVersion?: string };
type ClusterProbeFailure = { ok: false; error: string; details?: Record<string, unknown> };
export type ClusterProbeResult = ClusterProbeSuccess | ClusterProbeFailure;

export async function testClusterConnection(conn: ClusterConnection): Promise<ClusterProbeResult> {
  let kubeConfig: KubeConfig;
  try {
    kubeConfig = buildKubeConfigFromConnection(conn);
  } catch (error) {
    logger.error("failed to build kube config for probe", { error, clusterId: conn.id, name: conn.name });
    return { ok: false, error: "Kon Kubernetes-configuratie niet opbouwen." };
  }

  try {
    const versionApi = kubeConfig.makeApiClient(VersionApi);
    const coreApi = kubeConfig.makeApiClient(CoreV1Api);

    let versionInfo: VersionInfo | undefined;
    try {
      const response = await versionApi.getCode();
      versionInfo = response.body;
    } catch (error_) {
      throw { stage: "version", cause: error_ };
    }

    try {
      await coreApi.listNamespace(undefined, undefined, undefined, undefined, 1);
    } catch (error_) {
      throw { stage: "namespaces", cause: error_ };
    }

    return {
      ok: true,
      clusterName: kubeConfig.getCurrentCluster()?.name ?? conn.name,
      kubernetesVersion: versionInfo?.gitVersion
    };
  } catch (error) {
    const normalized = normalizeProbeError(error);
    logger.warn("cluster probe failed", {
      clusterId: conn.id,
      name: conn.name,
      stage: normalized.stage,
      error: normalized.logPayload
    });
    return { ok: false, error: normalized.message, details: normalized.details };
  }
}

interface NormalizedProbeFailure {
  message: string;
  details?: Record<string, unknown>;
  stage?: string;
  logPayload: Record<string, unknown>;
}

function normalizeProbeError(error: unknown): NormalizedProbeFailure {
  let stage: string | undefined;
  let original: unknown = error;

  if (typeof error === "object" && error !== null) {
    const candidate = error as { cause?: unknown; stage?: unknown };
    if (typeof candidate.stage === "string") {
      stage = candidate.stage;
    }
    if ("cause" in candidate && candidate.cause !== undefined) {
      original = candidate.cause;
    }
  }

  const parsed = parseKubernetesError(original);
  let details = parsed.details ? { ...parsed.details } : undefined;
  if (stage) {
    details = { ...(details ?? {}), stage };
  }

  return {
    message: stage ? `${stage} probe failed: ${parsed.message}` : parsed.message,
    details,
    stage,
    logPayload: {
      stage,
      message: parsed.message,
      details: parsed.details
    }
  };
}

function parseKubernetesError(error: unknown): { message: string; details?: Record<string, unknown> } {
  if (!error) {
    return { message: "Unknown error" };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  if (error instanceof Error) {
    const anyError = error as Error & {
      response?: { statusCode?: number; body?: unknown };
      statusCode?: number;
      body?: unknown;
      code?: string | number;
    };
    const response = anyError.response;
    const statusCode = typeof anyError.statusCode === "number" ? anyError.statusCode : response?.statusCode;
    const body = (anyError.body ?? response?.body) as Record<string, unknown> | undefined;
    const messageFromBody =
      body && typeof (body as any).message === "string" ? ((body as any).message as string) : undefined;
    const message = messageFromBody ?? anyError.message ?? "Unknown error";
    const details: Record<string, unknown> = {};
    if (typeof statusCode === "number") {
      details.statusCode = statusCode;
    }
    if (body && typeof body === "object") {
      details.body = body;
    }
    if (anyError.code !== undefined) {
      details.code = anyError.code;
    }
    return { message, details: Object.keys(details).length ? details : undefined };
  }
  if (typeof error === "object") {
    try {
      return { message: JSON.stringify(error) };
    } catch {
      return { message: "Unknown error" };
    }
  }
  return { message: String(error) };
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
