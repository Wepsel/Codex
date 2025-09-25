import { randomUUID } from "crypto";
import type { ComplianceSummary, IncidentWarRoomData } from "@kube-suite/shared";

export function getComplianceSummary(): ComplianceSummary {
  return {
    generatedAt: new Date().toISOString(),
    rbac: {
      highRiskRoles: [
        {
          name: "cluster-admin",
          members: 4,
          privileges: ["*"],
          lastReviewed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString()
        },
        {
          name: "system:masters",
          members: 2,
          privileges: ["secrets:get", "pods/exec", "nodes/proxy"],
          lastReviewed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 50).toISOString()
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
          type: "tls",
          daysRemaining: 5
        },
        {
          name: "internal-api-key",
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
      lastScan: new Date().toISOString(),
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
      "Review cluster-admin membership and enforce least privilege",
      "Rotate payment-gateway-cert within 5 days",
      "Encrypt legacy-config using KMS-backed secret provider"
    ]
  };
}

export function getIncidentWarRoomData(): IncidentWarRoomData {
  return {
    incidentId: randomUUID(),
    title: "Checkout latency spike",
    status: "investigating",
    commander: "Alex Ops",
    severity: "critical",
    startedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
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
        timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
        content: "Alert fired on checkout latency > 3s. Initial triage started."
      },
      {
        id: randomUUID(),
        author: "Priya SRE",
        timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
        content: "Identified spike on payment gateway dependency. Scaling out pods."
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
      summary: "Checkout latency exceeded SLO due to downstream payment gateway throttling.",
      timeline: [
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          description: "PagerDuty alert triggered"
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
          description: "War room assembled",
          owner: "Alex Ops"
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          description: "Payments pods scaled to 12",
          owner: "Priya SRE"
        }
      ],
      actionItems: [
        {
          id: randomUUID(),
          owner: "Platform Team",
          description: "Implement circuit breaker for payment gateway",
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString()
        },
        {
          id: randomUUID(),
          owner: "Vendor Ops",
          description: "Provide capacity update and throttling policy",
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()
        }
      ]
    }
  };
}
