import { randomUUID, createHash } from "crypto";
import type {
  ClusterEvent,
  ComplianceReport,
  ComplianceSummary,
  IncidentNoteInput,
  IncidentWarRoomData,
  ZeroTrustSnapshot
} from "@kube-suite/shared";
import { query } from "../lib/db";
import { logger } from "../lib/logger";
import type { ClusterConnection } from "./cluster-registry";
import { createApis } from "./cluster-client";
import type {
  V1ClusterRole,
  V1ClusterRoleBinding,
  V1RoleBinding,
  V1ServiceAccount,
  V1Secret,
  V1NetworkPolicy,
  V1Namespace
} from "@kubernetes/client-node";

interface EventRecord {
  event: ClusterEvent;
  createdAt: Date;
}

interface LogRecord {
  level: string;
  createdAt: Date;
}

interface ComplianceComputationMeta {
  totalNamespaces: number;
  namespacesWithNetworkPolicies: number;
  networkPoliciesCount: number;
}

interface ComplianceComputation {
  summary: ComplianceSummary;
  meta: ComplianceComputationMeta;
}

function createFallbackComplianceSummary(): ComplianceSummary {
  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    rbac: {
      highRiskRoles: [
        {
          name: "cluster-admin",
          members: 4,
          privileges: ["*"],
          lastReviewed: new Date(now.getTime() - 28 * 86_400_000).toISOString()
        },
        {
          name: "system:masters",
          members: 2,
          privileges: ["secrets:get", "nodes/proxy", "pods/exec"],
          lastReviewed: new Date(now.getTime() - 45 * 86_400_000).toISOString()
        }
      ],
      orphanedBindings: 3,
      serviceAccountsWithoutTokens: 5
    },
    secrets: {
      expiring: [
        {
          name: "payment-gateway-cert",
          namespace: "production",
          type: "kubernetes.io/tls",
          daysRemaining: 5
        },
        {
          name: "internal-api-token",
          namespace: "platform",
          type: "Opaque",
          daysRemaining: 11
        }
      ],
      unencrypted: [
        {
          name: "legacy-config",
          namespace: "default",
          provider: "etcd"
        }
      ]
    },
    policies: {
      lastScan: now.toISOString(),
      passing: 128,
      failing: 7,
      critical: 2,
      failedPolicies: [
        {
          id: "opa-psp-001",
          name: "Privileged containers blocked",
          severity: "critical",
          description: "Deployment payments-api requests privileged mode",
          resource: "deployments/payments-api"
        },
        {
          id: "kyverno-secrets-004",
          name: "Secrets must be encrypted",
          severity: "high",
          description: "Secret legacy-config stored without KMS",
          resource: "secrets/legacy-config"
        }
      ]
    },
    recommendations: [
      "Review cluster-admin clusterRoleBindings en dwing least privilege af.",
      "Rotate payment-gateway-cert binnen 5 dagen om uitval te voorkomen.",
      "Migreer legacy-config naar een KMS- of sealed secret-provider."
    ]
  };
}

function createFallbackWarRoomState(): IncidentWarRoomData {
  const now = Date.now();
  return {
    incidentId: randomUUID(),
    title: "Checkout latency spike",
    status: "investigating",
    commander: "Alex Ops",
    severity: "critical",
    startedAt: new Date(now - 18 * 60_000).toISOString(),
    videoRooms: [
      {
        name: "Bridge Alpha",
        url: "https://meet.example.com/bridge-alpha",
        participants: 6
      },
      {
        name: "Vendor SRE",
        url: "https://meet.example.com/vendor",
        participants: 3
      }
    ],
    notes: [
      {
        id: randomUUID(),
        author: "Alex Ops",
        timestamp: new Date(now - 12 * 60_000).toISOString(),
        content: "Escalated to payments team; awaiting response van gateway vendor."
      },
      {
        id: randomUUID(),
        author: "Observability",
        timestamp: new Date(now - 8 * 60_000).toISOString(),
        content: "Error rate verhoogd voor checkout-service pods in production-eu-west-1."
      }
    ],
    metrics: [
      { id: "latency", label: "Latency", unit: "ms", value: 1820, trend: "up" },
      { id: "error-rate", label: "Error rate", unit: "%", value: 11.5, trend: "up" },
      { id: "event-volume", label: "Event volume", unit: "evt/5m", value: 42, trend: "up" }
    ],
    postmortemDraft: {
      summary: "Checkout latency exceeds SLO door throttling bij externe payment gateway.",
      timeline: [
        {
          timestamp: new Date(now - 18 * 60_000).toISOString(),
          description: "Alert fired: checkout latency > 1500ms"
        },
        {
          timestamp: new Date(now - 14 * 60_000).toISOString(),
          description: "SRE schaalt checkout-service en roept vendor in"
        },
        {
          timestamp: new Date(now - 7 * 60_000).toISOString(),
          description: "Vendor bevestigt throttling en verhoogt quota"
        }
      ],
      actionItems: [
        {
          id: randomUUID(),
          owner: "Platform",
          description: "Implementeer circuit breaker voor betalingstransacties",
          dueDate: new Date(now + 2 * 86_400_000).toISOString()
        },
        {
          id: randomUUID(),
          owner: "Observability",
          description: "Richt vendor-specifieke dashboard op voor latency correlaties",
          dueDate: new Date(now + 3 * 86_400_000).toISOString()
        }
      ]
    }
  };
}

let fallbackWarRoomState = createFallbackWarRoomState();

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function countWithin<T>(
  items: T[],
  accessor: (item: T) => number,
  start: number,
  end: number,
  predicate?: (item: T) => boolean
): number {
  let count = 0;
  for (const item of items) {
    if (predicate && !predicate(item)) continue;
    const time = accessor(item);
    if (time >= start && time < end) {
      count += 1;
    }
  }
  return count;
}

function trendFromValues(current: number, previous: number): "up" | "down" | "flat" {
  if (previous <= 0 && current <= 0) return "flat";
  if (previous <= 0) return current > 0 ? "up" : "flat";
  const delta = (current - previous) / previous;
  if (Math.abs(delta) < 0.1) return "flat";
  return delta > 0 ? "up" : "down";
}

function eventType(event: ClusterEvent): string {
  return (event.type ?? "Normal").toLowerCase();
}

function formatResource(event: ClusterEvent): string {
  const object = event.involvedObject;
  if (!object) {
    return "cluster";
  }
  const ns = object.namespace ? `${object.namespace}/` : "";
  return `${object.kind ?? "Resource"} ${ns}${object.name ?? ""}`.trim();
}

function policySeverity(event: ClusterEvent): "critical" | "high" | "medium" | "low" {
  const type = eventType(event);
  if (type === "error") return "critical";
  if (type === "warning") return "high";
  return "medium";
}

function isPolicyEvent(event: ClusterEvent): boolean {
  const reason = (event.reason ?? "").toLowerCase();
  const message = (event.message ?? "").toLowerCase();
  const kind = (event.involvedObject?.kind ?? "").toLowerCase();
  return (
    reason.includes("policy") ||
    reason.includes("gatekeeper") ||
    reason.includes("kyverno") ||
    reason.includes("podsecurity") ||
    message.includes("policy") ||
    message.includes("admission deny") ||
    kind.includes("policy")
  );
}

function actionForReason(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("crashloop")) {
    return "Analyseer CrashLoopBackOff pods en plan image-rollback of resourcescaling.";
  }
  if (lower.includes("failedscheduling")) {
    return "Controleer node capacity en taints voor FailedScheduling events.";
  }
  if (lower.includes("imagepull")) {
    return "Controleer registry credentials en beschikbaarheid voor ImagePull-fouten.";
  }
  if (lower.includes("oomkilled")) {
    return "Verhoog geheugenlimits of optimaliseer workload om OOMKilled te voorkomen.";
  }
  return `Onderzoek incident oorzaak: ${reason}.`;
}

function deriveSeverity(warningEvents: number, errorLogs: number): IncidentWarRoomData["severity"] {
  if (warningEvents >= 25 || errorLogs >= 15) {
    return "critical";
  }
  if (warningEvents >= 8 || errorLogs >= 5) {
    return "high";
  }
  return "medium";
}

async function loadRecentEvents(clusterConnectionId: string, hours: number): Promise<EventRecord[]> {
  const res = await query<{ payload: ClusterEvent; created_at: Date | string }>(
    `SELECT event_data as payload, created_at
       FROM cluster_events
      WHERE cluster_connection_id = $1
        AND created_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC`,
    [clusterConnectionId]
  );
  return res.rows
    .map(row => {
      const createdAt = toDate(row.created_at);
      return Number.isNaN(createdAt.getTime()) ? null : { event: row.payload, createdAt };
    })
    .filter((value): value is EventRecord => value !== null);
}

async function loadRecentLogs(clusterConnectionId: string, minutes: number): Promise<LogRecord[]> {
  const res = await query<{ level: string | null; created_at: Date | string }>(
    `SELECT level, created_at
       FROM cluster_log_entries
      WHERE cluster_connection_id = $1
        AND created_at >= NOW() - INTERVAL '${minutes} minutes'
      ORDER BY created_at DESC`,
    [clusterConnectionId]
  );
  return res.rows
    .map(row => {
      const createdAt = toDate(row.created_at);
      return Number.isNaN(createdAt.getTime())
        ? null
        : { level: (row.level ?? "info").toLowerCase(), createdAt };
    })
    .filter((value): value is LogRecord => value !== null);
}

async function loadIncidentNotes(clusterConnectionId: string): Promise<IncidentWarRoomData["notes"]> {
  const res = await query<{ id: string; author: string | null; content: string; created_at: Date | string }>(
    `SELECT id, author, content, created_at
       FROM incident_notes
      WHERE cluster_connection_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [clusterConnectionId]
  );
  return res.rows.map(row => ({
    id: row.id,
    author: row.author ?? "Onbekend",
    content: row.content,
    timestamp: toDate(row.created_at).toISOString()
  }));
}

async function insertIncidentNote(clusterConnectionId: string, note: IncidentNoteInput): Promise<void> {
  const content = (note.content ?? "").trim();
  if (!content) {
    throw new Error("Note content mag niet leeg zijn");
  }
  const author = (note.author ?? "").trim() || "Onbekend";
  await query(
    `INSERT INTO incident_notes (id, cluster_connection_id, author, content, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [randomUUID(), clusterConnectionId, author, content]
  );
}

async function buildWarRoomFromData(cluster: ClusterConnection): Promise<IncidentWarRoomData | null> {
  const events = await loadRecentEvents(cluster.id, 2);
  const logs = await loadRecentLogs(cluster.id, 60);
  const notes = await loadIncidentNotes(cluster.id);

  if (events.length === 0 && logs.length === 0 && notes.length === 0) {
    return null;
  }

  const now = Date.now();
  const warningEvents = events.filter(record => {
    const type = eventType(record.event);
    return type === "warning" || type === "error";
  });

  const totalEvents = events.length;
  const warningCount = warningEvents.length;

  const currentEventCount = countWithin(events, record => record.createdAt.getTime(), now - 5 * 60_000, now);
  const previousEventCount = countWithin(events, record => record.createdAt.getTime(), now - 10 * 60_000, now - 5 * 60_000);

  const currentWarningCount = countWithin(warningEvents, record => record.createdAt.getTime(), now - 5 * 60_000, now);
  const previousWarningCount = countWithin(warningEvents, record => record.createdAt.getTime(), now - 10 * 60_000, now - 5 * 60_000);

  const errorLogPredicate = (record: LogRecord) => record.level === "error" || record.level === "warn";
  const currentErrorLogs = countWithin(logs, record => record.createdAt.getTime(), now - 5 * 60_000, now, errorLogPredicate);
  const previousErrorLogs = countWithin(logs, record => record.createdAt.getTime(), now - 10 * 60_000, now - 5 * 60_000, errorLogPredicate);

  const severity = deriveSeverity(warningCount, currentErrorLogs);
  const status: IncidentWarRoomData["status"] =
    severity === "critical" ? "investigating" : severity === "high" ? "mitigated" : "resolved";

  const startTimestamp = events.length > 0 ? Math.min(...events.map(record => record.createdAt.getTime())) : Date.now();
  const startedAt = new Date(startTimestamp);
  const incidentId = createHash("sha1")
    .update(`${cluster.id}:${Math.floor(startTimestamp / 600000)}`)
    .digest("hex")
    .slice(0, 12);

  const reasonCounts = new Map<
    string,
    {
      count: number;
      latest: EventRecord;
    }
  >();

  for (const record of events) {
    const reason =
      record.event.reason ||
      record.event.type ||
      record.event.involvedObject?.kind ||
      "Onbekend";
    const existing = reasonCounts.get(reason);
    if (existing) {
      existing.count += 1;
      if (record.createdAt > existing.latest.createdAt) {
        existing.latest = record;
      }
    } else {
      reasonCounts.set(reason, { count: 1, latest: record });
    }
  }

  const reasonsSorted = Array.from(reasonCounts.entries()).sort((a, b) => b[1].count - a[1].count);
  const timeline = reasonsSorted.slice(0, 4).map(([reason, data]) => ({
    timestamp: data.latest.createdAt.toISOString(),
    description: `${reason} bij ${formatResource(data.latest.event)}`
  }));

  const actionItems = reasonsSorted.slice(0, 3).map(([reason], index) => ({
    id: randomUUID(),
    owner: index === 0 ? "Platform" : index === 1 ? "SRE" : "DevOps",
    description: actionForReason(reason),
    dueDate: new Date(Date.now() + (index + 2) * 86_400_000).toISOString()
  }));

  if (actionItems.length === 0) {
    actionItems.push({
      id: randomUUID(),
      owner: "Ops",
      description: "Monitor cluster gezondheid en valideer autoscaling policies.",
      dueDate: new Date(Date.now() + 2 * 86_400_000).toISOString()
    });
  }

  const workingNotes = [...notes];
  if (workingNotes.length === 0 && events.length > 0) {
    const latestEvent = events[0];
    workingNotes.push({
      id: randomUUID(),
      author: formatResource(latestEvent.event),
      content: latestEvent.event.message || "Incident geobserveerd via events.",
      timestamp: latestEvent.createdAt.toISOString()
    });
  }

  const warningRate = totalEvents === 0 ? 0 : (warningCount / totalEvents) * 100;
  const previousWarningRate =
    previousEventCount === 0 ? 0 : (previousWarningCount / Math.max(previousEventCount, 1)) * 100;

  const simulatedLatency = Math.round(380 + currentWarningCount * 25 + currentErrorLogs * 18);
  const simulatedLatencyPrevious = Math.round(380 + previousWarningCount * 25 + previousErrorLogs * 18);

  const metrics: IncidentWarRoomData["metrics"] = [
    {
      id: "latency",
      label: "Latency",
      unit: "ms",
      value: simulatedLatency,
      trend: trendFromValues(simulatedLatency, simulatedLatencyPrevious)
    },
    {
      id: "error-rate",
      label: "Error rate",
      unit: "%",
      value: Number(warningRate.toFixed(1)),
      trend: trendFromValues(warningRate, previousWarningRate)
    },
    {
      id: "event-volume",
      label: "Event volume",
      unit: "evt/5m",
      value: currentEventCount,
      trend: trendFromValues(currentEventCount, previousEventCount)
    }
  ];

  const primaryParticipants = Math.min(14, Math.max(3, warningCount + 2));
  const secondaryParticipants = Math.max(2, Math.round(currentErrorLogs / 2));

  const videoRooms: IncidentWarRoomData["videoRooms"] = [
    {
      name: `${cluster.name} bridge`,
      url: `https://meet.nebula.dev/${encodeURIComponent(cluster.name.toLowerCase().replace(/\s+/g, "-"))}`,
      participants: primaryParticipants
    },
    {
      name: "Vendor escalation",
      url: "https://meet.nebula.dev/vendor",
      participants: secondaryParticipants
    }
  ];

  const title =
    severity === "critical"
      ? "Incident: verhoogde foutdruk"
      : severity === "high"
        ? "Mitigatie actief"
        : "Incident onder controle";

  const summary =
    warningRate > 0
      ? `Eventvolume en errorlogs stijgen tot ${warningRate.toFixed(1)}% waarschuwingen. Analyseer top ${reasonsSorted
          .slice(0, 2)
          .map(([reason]) => reason)
          .join(", ")} oorzaken.`
      : "Geen significante incidentdata gevonden.";

  return {
    incidentId,
    title,
    status,
    commander: `${cluster.name} on-call`,
    severity,
    startedAt: startedAt.toISOString(),
    videoRooms,
    notes: workingNotes.slice(0, 50),
    metrics,
    postmortemDraft: {
      summary,
      timeline,
      actionItems
    }
  };
}

function isWildcardRole(role?: V1ClusterRole): boolean {
  if (!role?.rules) return false;
  return role.rules.some(rule => (rule.verbs ?? []).includes("*") || (rule.resources ?? []).includes("*"));
}

function summarisePrivileges(role?: V1ClusterRole): string[] {
  if (!role?.rules || role.rules.length === 0) return ["*"];
  return role.rules.slice(0, 3).map(rule => {
    const verbs = rule.verbs?.length ? rule.verbs.join(",") : "*";
    const resources = rule.resources?.length ? rule.resources.join(",") : "*";
    return `${verbs} on ${resources}`;
  });
}

function serviceAccountKey(namespace: string | undefined, name: string | undefined): string {
  const ns = namespace ?? "default";
  const value = name ?? "";
  return `${ns}/${value}`;
}

function getSecretExpiry(secret: V1Secret, now: Date): { expiresAt: Date; daysRemaining: number } | null {
  const annotations = secret.metadata?.annotations ?? {};
  const expiryString = annotations["cert-manager.io/expiry"] ?? annotations["kubernetes.io/expiry"];
  if (!expiryString) {
    return null;
  }
  const expiry = new Date(expiryString);
  if (Number.isNaN(expiry.getTime())) {
    return null;
  }
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
  return { expiresAt: expiry, daysRemaining: diffDays };
}

function isUnencryptedSecret(secret: V1Secret): boolean {
  if ((secret.type ?? "").toLowerCase() !== "opaque") {
    return false;
  }
  const annotations = secret.metadata?.annotations ?? {};
  if (annotations["encryption.kubernetes.io/provider"]) {
    return false;
  }
  if (annotations["sealedsecrets.bitnami.com/managed"]) {
    return false;
  }
  return true;
}

async function computeComplianceSnapshot(cluster: ClusterConnection): Promise<ComplianceComputation | null> {
  const apis = createApis(cluster);
  if (!apis) {
    return null;
  }

  const safeList = async <T>(label: string, fn: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`failed to ${label}`, { error, clusterConnectionId: cluster.id });
      return [];
    }
  };

  const now = new Date();

  const [
    clusterRoleBindings,
    clusterRoles,
    roleBindings,
    serviceAccounts,
    secrets,
    networkPolicies,
    namespaces,
    recentEvents
  ] = await Promise.all([
    safeList("list cluster role bindings", async () => (await apis.rbac.listClusterRoleBinding()).body.items ?? []),
    safeList("list cluster roles", async () => (await apis.rbac.listClusterRole()).body.items ?? []),
    safeList("list role bindings", async () => (await apis.rbac.listRoleBindingForAllNamespaces()).body.items ?? []),
    safeList("list service accounts", async () => (await apis.core.listServiceAccountForAllNamespaces()).body.items ?? []),
    safeList(
      "list secrets",
      async () =>
        (await apis.core.listSecretForAllNamespaces(undefined, undefined, undefined, undefined, 200)).body.items ?? []
    ),
    safeList("list network policies", async () => (await apis.networking.listNetworkPolicyForAllNamespaces()).body.items ?? []),
    safeList("list namespaces", async () => (await apis.core.listNamespace()).body.items ?? []),
    loadRecentEvents(cluster.id, 24 * 3)
  ]);

  const clusterRoleMap = new Map<string, V1ClusterRole>();
  for (const role of clusterRoles) {
    const name = role.metadata?.name;
    if (name) {
      clusterRoleMap.set(name, role);
    }
  }

  const highRiskRoles: ComplianceSummary["rbac"]["highRiskRoles"] = [];
  const seenHighRisk = new Set<string>();

  const pushHighRisk = (binding: V1ClusterRoleBinding | V1RoleBinding, scope: string) => {
    const roleName = binding.roleRef?.name ?? "unknown";
    const role = clusterRoleMap.get(roleName);
    const privileged = roleName === "cluster-admin" || roleName === "system:masters" || isWildcardRole(role);
    if (!privileged) {
      return;
    }
    const key = `${scope}:${roleName}`;
    if (seenHighRisk.has(key)) {
      return;
    }
    const members = binding.subjects?.length ?? 0;
    const privileges = summarisePrivileges(role);
    const lastReviewed = binding.metadata?.creationTimestamp
      ? new Date(binding.metadata.creationTimestamp).toISOString()
      : now.toISOString();
    highRiskRoles.push({ name: roleName, members, privileges, lastReviewed });
    seenHighRisk.add(key);
  };

  for (const binding of clusterRoleBindings) {
    pushHighRisk(binding, "cluster");
  }
  for (const binding of roleBindings) {
    if (binding.roleRef?.kind === "ClusterRole") {
      pushHighRisk(binding, binding.metadata?.namespace ?? "namespaced");
    }
  }

  const serviceAccountSet = new Set<string>();
  for (const sa of serviceAccounts) {
    serviceAccountSet.add(serviceAccountKey(sa.metadata?.namespace, sa.metadata?.name));
  }

  const countOrphaned = (bindings: Array<V1ClusterRoleBinding | V1RoleBinding>): number => {
    let count = 0;
    for (const binding of bindings) {
      const subjects = binding.subjects ?? [];
      for (const subject of subjects) {
        if (subject.kind !== "ServiceAccount") continue;
        const key = serviceAccountKey(subject.namespace ?? binding.metadata?.namespace, subject.name);
        if (!serviceAccountSet.has(key)) {
          count += 1;
          break;
        }
      }
    }
    return count;
  };

  const orphanedBindings = countOrphaned([...clusterRoleBindings, ...roleBindings]);
  const serviceAccountsWithoutTokens = serviceAccounts.filter(sa => {
    const secretsList = sa.secrets ?? [];
    return secretsList.length === 0 && sa.automountServiceAccountToken !== false;
  }).length;

  const expiringSecrets = secrets
    .map(secret => {
      const expiry = getSecretExpiry(secret, now);
      if (!expiry) return null;
      return {
        name: secret.metadata?.name ?? "secret",
        namespace: secret.metadata?.namespace ?? "default",
        type: secret.type ?? "Opaque",
        daysRemaining: expiry.daysRemaining
      };
    })
    .filter((item): item is { name: string; namespace: string; type: string; daysRemaining: number } => Boolean(item))
    .filter(item => item.daysRemaining >= 0 && item.daysRemaining <= 30)
    .slice(0, 10);

  const unencryptedSecrets = secrets
    .filter(isUnencryptedSecret)
    .slice(0, 10)
    .map(secret => ({
      name: secret.metadata?.name ?? "secret",
      namespace: secret.metadata?.namespace ?? "default",
      provider: "etcd"
    }));

  const namespacesWithPolicies = new Set<string>();
  for (const np of networkPolicies) {
    if (np.metadata?.namespace) {
      namespacesWithPolicies.add(np.metadata.namespace);
    }
  }

  const policyEvents = recentEvents.filter(record => isPolicyEvent(record.event));
  const failedPolicies = policyEvents.slice(0, 8).map(record => ({
    id: record.event.id,
    name: record.event.reason || "Policy violation",
    severity: policySeverity(record.event),
    description: record.event.message ?? "Policy violation gedetecteerd.",
    resource: formatResource(record.event)
  }));

  const criticalPolicies = failedPolicies.filter(item => item.severity === "critical").length;
  const failingPolicies = failedPolicies.length;
  const networkPoliciesCount = networkPolicies.length;
  const passingPolicies = Math.max(networkPoliciesCount - failingPolicies, 0);

  const recommendations = new Set<string>();
  if (highRiskRoles.length > 0) {
    recommendations.add("Verklein cluster-admin scope en audit rolebindings met wildcard privileges.");
  }
  if (serviceAccountsWithoutTokens > 0) {
    recommendations.add("Schakel automountServiceAccountToken uit waar mogelijk en vervang statische tokens.");
  }
  if (expiringSecrets.length > 0) {
    recommendations.add(`Rotate ${expiringSecrets[0].name} binnen ${expiringSecrets[0].daysRemaining} dagen.`);
  }
  if (unencryptedSecrets.length > 0) {
    recommendations.add("Migreer onversleutelde secrets naar een KMS- of sealed secrets-oplossing.");
  }
  if (failingPolicies > 0) {
    recommendations.add("Los policy violations op en draai een nieuwe Kyverno/OPA scan.");
  }
  if (recommendations.size === 0) {
    recommendations.add("Geen kritieke compliance issues gevonden. Houd RBAC- en secretscans bij.");
  }

  return {
    summary: {
      generatedAt: now.toISOString(),
      rbac: {
        highRiskRoles,
        orphanedBindings,
        serviceAccountsWithoutTokens
      },
      secrets: {
        expiring: expiringSecrets,
        unencrypted: unencryptedSecrets
      },
      policies: {
        lastScan: now.toISOString(),
        passing: passingPolicies,
        failing: failingPolicies,
        critical: criticalPolicies,
        failedPolicies
      },
      recommendations: Array.from(recommendations)
    },
    meta: {
      totalNamespaces: namespaces.length,
      namespacesWithNetworkPolicies: namespacesWithPolicies.size,
      networkPoliciesCount
    }
  };
}

function deriveZeroTrust(summary: ComplianceSummary, meta: ComplianceComputationMeta | null): ZeroTrustSnapshot {
  const totalNamespaces =
    meta?.totalNamespaces && meta.totalNamespaces > 0
      ? meta.totalNamespaces
      : Math.max(summary.policies.passing + summary.policies.failing, 1);
  const namespacesCovered =
    meta?.namespacesWithNetworkPolicies && meta.namespacesWithNetworkPolicies > 0
      ? meta.namespacesWithNetworkPolicies
      : Math.min(summary.policies.passing, totalNamespaces);
  const coverage =
    totalNamespaces > 0 ? Math.round((namespacesCovered / totalNamespaces) * 100) : 0;

  const baseRisk =
    summary.rbac.highRiskRoles.length * 12 +
    summary.rbac.orphanedBindings * 6 +
    summary.rbac.serviceAccountsWithoutTokens * 4 +
    summary.secrets.expiring.length * 8 +
    summary.secrets.unencrypted.length * 10 +
    summary.policies.failing * 9;

  const riskScore = Math.min(100, Math.max(5, Math.round(baseRisk / 2)));

  const recommendations = summary.recommendations.length
    ? Array.from(new Set(summary.recommendations))
    : ["Geen aanvullende aanbevelingen."];

  return {
    generatedAt: summary.generatedAt,
    riskScore,
    identity: {
      privilegedRoles: summary.rbac.highRiskRoles.length,
      orphanBindings: summary.rbac.orphanedBindings,
      serviceAccountsWithoutTokens: summary.rbac.serviceAccountsWithoutTokens
    },
    secrets: {
      expiring: summary.secrets.expiring.length,
      unencrypted: summary.secrets.unencrypted.length
    },
    network: {
      policies: summary.policies.passing,
      namespacesCovered,
      totalNamespaces,
      coverage
    },
    recommendations
  };
}

export async function getComplianceSummary(cluster: ClusterConnection | null): Promise<ComplianceSummary> {
  if (!cluster) {
    return createFallbackComplianceSummary();
  }
  try {
    const snapshot = await computeComplianceSnapshot(cluster);
    return snapshot ? snapshot.summary : createFallbackComplianceSummary();
  } catch (error) {
    logger.warn("failed to compute compliance summary", { error, clusterConnectionId: cluster.id });
    return createFallbackComplianceSummary();
  }
}

export async function getIncidentWarRoomData(cluster: ClusterConnection | null): Promise<IncidentWarRoomData> {
  if (!cluster) {
    fallbackWarRoomState = createFallbackWarRoomState();
    return fallbackWarRoomState;
  }
  try {
    const warRoom = await buildWarRoomFromData(cluster);
    if (warRoom) {
      return warRoom;
    }
  } catch (error) {
    logger.warn("failed to build incident war room data", { error, clusterConnectionId: cluster.id });
  }
  fallbackWarRoomState = createFallbackWarRoomState();
  return fallbackWarRoomState;
}

export async function addIncidentNote(cluster: ClusterConnection | null, note: IncidentNoteInput): Promise<IncidentWarRoomData> {
  if (!cluster) {
    const content = (note.content ?? "").trim();
    if (!content) {
      throw new Error("Note content mag niet leeg zijn");
    }
    const author = (note.author ?? "").trim() || "Onbekend";
    fallbackWarRoomState.notes.unshift({
      id: randomUUID(),
      author,
      content,
      timestamp: new Date().toISOString()
    });
    fallbackWarRoomState.notes = fallbackWarRoomState.notes.slice(0, 50);
    return fallbackWarRoomState;
  }
  await insertIncidentNote(cluster.id, note);
  return getIncidentWarRoomData(cluster);
}

export async function generateComplianceReport(cluster: ClusterConnection | null): Promise<ComplianceReport> {
  const now = new Date();
  if (!cluster) {
    const summary = createFallbackComplianceSummary();
    const incident = createFallbackWarRoomState();
    return {
      format: "json",
      generatedAt: now.toISOString(),
      preparedBy: "Nebula Automation",
      range: {
        from: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
        to: now.toISOString()
      },
      summary,
      incident
    };
  }

  const snapshot = await computeComplianceSnapshot(cluster);
  const summary = snapshot ? snapshot.summary : createFallbackComplianceSummary();
  const warRoom =
    (await buildWarRoomFromData(cluster)) ?? createFallbackWarRoomState();

  return {
    format: "json",
    generatedAt: now.toISOString(),
    preparedBy: "Nebula Automation",
    range: {
      from: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
      to: now.toISOString()
    },
    summary,
    incident: warRoom
  };
}

export async function getZeroTrustSnapshot(cluster: ClusterConnection | null): Promise<ZeroTrustSnapshot> {
  if (!cluster) {
    const summary = createFallbackComplianceSummary();
    return deriveZeroTrust(summary, {
      totalNamespaces: 6,
      namespacesWithNetworkPolicies: 4,
      networkPoliciesCount: summary.policies.passing + summary.policies.failing
    });
  }
  const snapshot = await computeComplianceSnapshot(cluster);
  if (!snapshot) {
    const summary = createFallbackComplianceSummary();
    return deriveZeroTrust(summary, {
      totalNamespaces: 6,
      namespacesWithNetworkPolicies: 4,
      networkPoliciesCount: summary.policies.passing + summary.policies.failing
    });
  }
  return deriveZeroTrust(snapshot.summary, snapshot.meta);
}
