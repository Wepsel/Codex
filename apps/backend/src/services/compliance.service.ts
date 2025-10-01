import { randomUUID } from "crypto";
import type { ComplianceReport, ComplianceSummary, IncidentNoteInput, IncidentWarRoomData } from "@kube-suite/shared";

interface HighRiskRoleTemplate {
  name: string;
  members: number;
  privileges: string[];
  reviewedDaysAgo: number;
}

interface ExpiringSecretTemplate {
  name: string;
  namespace: string;
  type: string;
  daysRemaining: number;
}

interface PolicyFailureTemplate {
  id: string;
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  resource: string;
}

const highRiskRoleTemplates: HighRiskRoleTemplate[] = [
  {
    name: "cluster-admin",
    members: 4,
    privileges: ["*"],
    reviewedDaysAgo: 28
  },
  {
    name: "system:masters",
    members: 2,
    privileges: ["secrets:get", "pods/exec", "nodes/proxy"],
    reviewedDaysAgo: 50
  }
];

const expiringSecretTemplates: ExpiringSecretTemplate[] = [
  {
    name: "payment-gateway-cert",
    namespace: "production",
    type: "tls",
    daysRemaining: 5
  },
  {
    name: "internal-api-key",
    namespace: "platform",
    type: "Opaque",
    daysRemaining: 11
  }
];

const unencryptedSecretTemplates: Array<{
  name: string;
  namespace: string;
  provider: string;
}> = [
  {
    name: "legacy-config",
    namespace: "default",
    provider: "etcd"
  }
];

const policyFailureTemplates: PolicyFailureTemplate[] = [
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
];

const policyStats = {
  passing: 128,
  failing: 7,
  critical: 2
};

const recommendations = [
  "Review cluster-admin membership and enforce least privilege",
  "Rotate payment-gateway-cert within 5 days",
  "Encrypt legacy-config using KMS-backed secret provider"
];

const warRoomState: IncidentWarRoomData = createInitialWarRoomState();

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function createInitialWarRoomState(): IncidentWarRoomData {
  return {
    incidentId: randomUUID(),
    title: "Checkout latency spike",
    status: "investigating",
    commander: "Alex Ops",
    severity: "critical",
    startedAt: isoMinutesAgo(18),
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
        timestamp: isoMinutesAgo(17),
        content: "Alert fired on checkout latency > 3s. Initial triage started."
      },
      {
        id: randomUUID(),
        author: "Priya SRE",
        timestamp: isoMinutesAgo(12),
        content: "Identified spike on payment gateway dependency. Scaling out pods."
      },
      {
        id: randomUUID(),
        author: "Vendor Ops",
        timestamp: isoMinutesAgo(8),
        content: "Vendor acknowledges throttling. Rate-limit increase requested."
      }
    ],
    metrics: [
      {
        id: "latency",
        label: "Checkout p95",
        unit: "ms",
        value: 2450,
        trend: "down"
      },
      {
        id: "error-rate",
        label: "Checkout error rate",
        unit: "%",
        value: 3.6,
        trend: "down"
      },
      {
        id: "cpu",
        label: "Payments CPU",
        unit: "%",
        value: 82,
        trend: "flat"
      }
    ],
    postmortemDraft: {
      summary: "Checkout latency exceeds SLO due to downstream payment gateway throttling.",
      timeline: [
        {
          timestamp: isoMinutesAgo(30),
          description: "PagerDuty alert triggered"
        },
        {
          timestamp: isoMinutesAgo(22),
          description: "War room assembled",
          owner: "Alex Ops"
        },
        {
          timestamp: isoMinutesAgo(14),
          description: "Payments pods scaled to 12",
          owner: "Priya SRE"
        },
        {
          timestamp: isoMinutesAgo(9),
          description: "Vendor throttling confirmed",
          owner: "Vendor Ops"
        }
      ],
      actionItems: [
        {
          id: randomUUID(),
          owner: "Platform Team",
          description: "Implement circuit breaker for payment gateway",
          dueDate: isoDaysFromNow(5)
        },
        {
          id: randomUUID(),
          owner: "Vendor Ops",
          description: "Provide capacity update and throttling policy",
          dueDate: isoDaysFromNow(3)
        }
      ]
    }
  };
}

function mutateWarRoomMetrics(state: IncidentWarRoomData): void {
  state.metrics = state.metrics.map(metric => {
    const previous = metric.value;
    const jitter = (Math.random() - 0.5) * 0.18;
    let next = previous * (1 + jitter);

    if (metric.unit === "%") {
      const clamped = Math.min(100, Math.max(0, next));
      next = Number(clamped.toFixed(1));
    } else {
      next = Math.max(0, Math.round(next));
    }

    let trend: "up" | "down" | "flat" = "flat";
    if (next > previous * 1.05) {
      trend = "up";
    } else if (next < previous * 0.95) {
      trend = "down";
    }

    return {
      ...metric,
      value: next,
      trend
    };
  });
}

function mutateWarRoomAttendance(state: IncidentWarRoomData): void {
  state.videoRooms = state.videoRooms.map(room => {
    const drift = Math.round((Math.random() - 0.5) * 2);
    const participants = Math.max(0, room.participants + drift);
    return { ...room, participants };
  });
}

function updateWarRoomStatus(state: IncidentWarRoomData): void {
  const latency = state.metrics.find(metric => metric.id === "latency")?.value ?? 0;
  const errorRate = state.metrics.find(metric => metric.id === "error-rate")?.value ?? 0;

  if (latency < 900 && errorRate < 1) {
    state.status = "resolved";
    state.severity = "medium";
    state.postmortemDraft.summary =
      "Checkout latency recovered after scaling and vendor coordination.";
  } else if (latency < 1600 && errorRate < 2.5) {
    state.status = "mitigated";
    state.severity = "high";
    state.postmortemDraft.summary =
      "Mitigations in progress; latency trending down as we coordinate with the payment gateway vendor.";
  } else {
    state.status = "investigating";
    state.severity = "critical";
    state.postmortemDraft.summary =
      "Checkout latency exceeds SLO due to downstream payment gateway throttling.";
  }
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getComplianceSummary(): ComplianceSummary {
  const now = new Date();

  return {
    generatedAt: now.toISOString(),
    rbac: {
      highRiskRoles: highRiskRoleTemplates.map(role => ({
        name: role.name,
        members: role.members,
        privileges: [...role.privileges],
        lastReviewed: isoDaysAgo(role.reviewedDaysAgo)
      })),
      orphanedBindings: 3,
      serviceAccountsWithoutTokens: 5
    },
    secrets: {
      expiring: expiringSecretTemplates.map(secret => ({
        ...secret
      })),
      unencrypted: unencryptedSecretTemplates.map(secret => ({
        ...secret
      }))
    },
    policies: {
      lastScan: now.toISOString(),
      passing: policyStats.passing,
      failing: policyStats.failing,
      critical: policyStats.critical,
      failedPolicies: policyFailureTemplates.map(policy => ({
        ...policy
      }))
    },
    recommendations: [...recommendations]
  };
}

export function getIncidentWarRoomData(): IncidentWarRoomData {
  mutateWarRoomMetrics(warRoomState);
  mutateWarRoomAttendance(warRoomState);
  updateWarRoomStatus(warRoomState);
  return cloneState(warRoomState);
}

export function addIncidentNote(note: IncidentNoteInput): IncidentWarRoomData {
  const content = note.content.trim();
  if (!content) {
    throw new Error("Note content mag niet leeg zijn");
  }

  const author = (note.author ?? "").trim() || "Onbekend";

  warRoomState.notes.unshift({
    id: randomUUID(),
    author,
    content,
    timestamp: new Date().toISOString()
  });

  if (warRoomState.notes.length > 50) {
    warRoomState.notes.length = 50;
  }

  return getIncidentWarRoomData();
}

export function generateComplianceReport(): ComplianceReport {
  const now = new Date();

  return {
    format: "json",
    generatedAt: now.toISOString(),
    preparedBy: "Nebula Automation",
    range: {
      from: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
      to: now.toISOString()
    },
    summary: getComplianceSummary(),
    incident: getIncidentWarRoomData()
  };
}
