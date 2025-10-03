import { randomUUID } from "crypto";
import type { V1Node } from "@kubernetes/client-node";
import type {
  CapacityNamespaceSnapshot,
  CapacityNodeSnapshot,
  CapacitySnapshot,
  ClusterEfficiencyReport,
  ClusterEvent,
  EfficiencyInsight,
  EfficiencySeverity,
  NamespaceEfficiencySnapshot,
  NodeEfficiencySnapshot,
  OptimizerAutoAction,
  OptimizerHistory,
  WorkloadAttentionItem,
  WorkloadSummary
} from "@kube-suite/shared";
import type { ClusterConnection } from "./cluster-registry";
import { createApis, getWorkloadsFor, restartDeployment } from "./cluster-client";
import { simulateDeploymentProgress } from "./streaming.service";
import { logger } from "../lib/logger";
import { query } from "../lib/db";

const HOURS_PER_MONTH = 24 * 30;
const DEFAULT_CPU_HOURLY = 0.0325;
const DEFAULT_MEMORY_HOURLY = 0.0045;

interface NodePricing {
  cpuHourly: number;
  memoryHourly: number;
}

let pricingDefaultsEnsured = false;

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function parseCpuQuantity(value?: string): number {
  if (!value) return 0;
  if (value.endsWith("m")) {
    const milli = Number(value.slice(0, -1));
    return Number.isFinite(milli) ? milli : 0;
  }
  const cores = Number(value);
  return Number.isFinite(cores) ? cores * 1000 : 0;
}

function parseMemoryQuantity(value?: string): number {
  if (!value) return 0;
  const match = value.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|Pi|Ei)?$/);
  if (!match) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric / (1024 * 1024) : 0;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const unit = match[2] ?? "Mi";
  const multipliers: Record<string, number> = {
    Ki: 1 / 1024,
    Mi: 1,
    Gi: 1024,
    Ti: 1024 * 1024,
    Pi: 1024 * 1024 * 1024,
    Ei: 1024 * 1024 * 1024 * 1024
  };
  return amount * (multipliers[unit] ?? 1);
}

function sumContainerRequests(containers: readonly import("@kubernetes/client-node").V1Container[] | undefined) {
  let cpu = 0;
  let memory = 0;
  if (!containers) return { cpu, memory };
  for (const container of containers) {
    const requests = container.resources?.requests;
    if (!requests) continue;
    cpu += parseCpuQuantity(requests.cpu as string | undefined);
    memory += parseMemoryQuantity(requests.memory as string | undefined);
  }
  return { cpu, memory };
}

async function ensureDefaultPricing(): Promise<void> {
  if (pricingDefaultsEnsured) return;
  pricingDefaultsEnsured = true;
  const defaults: Array<[string, string, number, number]> = [
    ["*", "*", DEFAULT_CPU_HOURLY, DEFAULT_MEMORY_HOURLY],
    ["aws", "*", 0.034, 0.0048],
    ["aws", "m5.large", 0.048, 0.006],
    ["aws", "m5.xlarge", 0.096, 0.012],
    ["gcp", "*", 0.031, 0.0045],
    ["azure", "*", 0.032, 0.0047]
  ];
  for (const [provider, instance, cpuHourly, memoryHourly] of defaults) {
    await query(
      `INSERT INTO node_cost_catalog (provider, instance_type, cpu_hourly, memory_hourly)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, instance_type) DO NOTHING`,
      [provider, instance, cpuHourly, memoryHourly]
    );
  }
}

async function getPricingForNode(
  provider: string,
  instanceType: string,
  cache: Map<string, NodePricing>
): Promise<NodePricing> {
  const normalisedProvider = provider || "*";
  const normalisedInstance = instanceType || "*";
  const key = `${normalisedProvider}:${normalisedInstance}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const pick = async (prov: string, inst: string): Promise<NodePricing | null> => {
    const row = await query<{ cpu_hourly: string | number; memory_hourly: string | number }>(
      `SELECT cpu_hourly, memory_hourly FROM node_cost_catalog WHERE provider = $1 AND instance_type = $2`,
      [prov, inst]
    );
    if (row.rowCount === 0) {
      return null;
    }
    const cpuHourly = Number(row.rows[0].cpu_hourly ?? DEFAULT_CPU_HOURLY);
    const memoryHourly = Number(row.rows[0].memory_hourly ?? DEFAULT_MEMORY_HOURLY);
    return { cpuHourly, memoryHourly };
  };

  const exact = await pick(normalisedProvider, normalisedInstance);
  if (exact) {
    cache.set(key, exact);
    return exact;
  }

  const providerFallback = await pick(normalisedProvider, "*");
  if (providerFallback) {
    cache.set(key, providerFallback);
    return providerFallback;
  }

  const globalFallback = await pick("*", "*");
  const pricing = globalFallback ?? { cpuHourly: DEFAULT_CPU_HOURLY, memoryHourly: DEFAULT_MEMORY_HOURLY };
  cache.set(key, pricing);
  return pricing;
}

function extractProviderAndInstance(node: V1Node): { provider: string; instanceType: string } {
  const providerId = node.spec?.providerID ?? "";
  let provider = providerId.split(":")[0] ?? "";
  if (!provider) {
    provider = node.metadata?.labels?.["cloud.google.com/gke-nodepool"] ? "gcp" : "generic";
  }
  provider = provider.replace(/[^a-zA-Z]/g, "").toLowerCase() || "generic";
  const instanceType =
    node.metadata?.labels?.["node.kubernetes.io/instance-type"] ??
    node.metadata?.labels?.["beta.kubernetes.io/instance-type"] ??
    "generic";
  return { provider, instanceType };
}

function safeJsonParse(value: unknown): any {
  if (typeof value !== "string") {
    return value ?? null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function persistOptimizerInsights(clusterId: string, insights: EfficiencyInsight[]): Promise<void> {
  await query(`DELETE FROM optimizer_recommendations WHERE cluster_connection_id = $1`, [clusterId]);
  for (const insight of insights) {
    await query(
      `INSERT INTO optimizer_recommendations (id, cluster_connection_id, severity, title, description, recommendation)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [insight.id, clusterId, insight.severity, insight.title, insight.description, insight.recommendation ?? null]
    );
  }
}

async function fetchRecentOptimizerActions(clusterId: string): Promise<OptimizerAutoAction[]> {
  const rows = await query<{
    id: string;
    action: string;
    target: string;
    status: string;
    executed_at: Date;
    payload: any;
  }>(
    `SELECT id, action, target, status, executed_at, payload
       FROM optimizer_auto_actions
      WHERE cluster_connection_id = $1
      ORDER BY executed_at DESC
      LIMIT 15`,
    [clusterId]
  );

  return rows.rows.map(row => {
    const payload = safeJsonParse(row.payload);
    return {
      id: row.id,
      action: row.action,
      target: row.target,
      status: (row.status as OptimizerAutoAction["status"]) ?? "success",
      executedAt: new Date(row.executed_at ?? new Date()).toISOString(),
      details: typeof payload?.reason === "string" ? payload.reason : undefined
    };
  });
}

async function performAutoHealing(conn: ClusterConnection, workloads: WorkloadAttentionItem[]): Promise<void> {
  for (const workload of workloads) {
    if (workload.severity !== "high") {
      continue;
    }
    const targetKey = `${workload.namespace}/${workload.name}`;
    const recent = await query<{ exists: boolean }>(
      `SELECT 1 as exists
         FROM optimizer_auto_actions
        WHERE cluster_connection_id = $1
          AND action = $2
          AND target = $3
          AND executed_at >= (NOW() - INTERVAL '30 minutes')
        LIMIT 1`,
      [conn.id, "restart-deployment", targetKey]
    );
    if (recent.rowCount > 0) {
      continue;
    }

    let status: OptimizerAutoAction["status"] = "success";
    let details: string | undefined;
    try {
      const result = await restartDeployment(conn, workload.namespace, workload.name);
      if (!result.ok) {
        status = "failed";
        details = "restartDeployment returned ok=false";
      }
    } catch (error) {
      status = "failed";
      details = error instanceof Error ? error.message : String(error);
    }

    const executedAt = new Date().toISOString();
    await query(
      `INSERT INTO optimizer_auto_actions (id, cluster_connection_id, action, target, payload, status, executed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        conn.id,
        "restart-deployment",
        targetKey,
        JSON.stringify({
          namespace: workload.namespace,
          name: workload.name,
          severity: workload.severity,
          reason: workload.reason
        }),
        status,
        executedAt
      ]
    );

    if (status === "success") {
      simulateDeploymentProgress(`optimizer-${targetKey}`, `${workload.namespace}/${workload.name}`);
    } else if (details) {
      logger.warn("auto-healing action failed", {
        clusterConnectionId: conn.id,
        target: targetKey,
        details
      });
    }
  }
}

export async function getCapacitySnapshot(conn: ClusterConnection): Promise<CapacitySnapshot> {
  const apis = createApis(conn);
  if (!apis) {
    return {
      totals: {
        cpuCapacity: 6000,
        cpuAllocatable: 5600,
        cpuRequested: 3200,
        memoryCapacity: 49152,
        memoryAllocatable: 46080,
        memoryRequested: 24000,
        pods: 58
      },
      nodes: [
        {
          name: "node-a",
          cpuCapacity: 2000,
          cpuAllocatable: 1800,
          cpuRequested: 1100,
          cpuUtilization: Math.min(1, 1100 / 1800),
          memoryCapacity: 16384,
          memoryAllocatable: 15360,
          memoryRequested: 7800,
          memoryUtilization: Math.min(1, 7800 / 15360),
          pods: 21,
          conditions: [
            { type: "Ready", status: "True" },
            { type: "DiskPressure", status: "False" }
          ]
        }
      ],
      namespaces: [
        { name: "default", cpuRequested: 600, memoryRequested: 4300, workloads: 7 },
        { name: "platform", cpuRequested: 420, memoryRequested: 3600, workloads: 5 }
      ]
    };
  }

  try {
    const [nodesResponse, podsResponse] = await Promise.all([
      apis.core.listNode(),
      apis.core.listPodForAllNamespaces()
    ]);

    const nodes = nodesResponse.body.items ?? [];
    const pods = podsResponse.body.items ?? [];

    const nodeUsage = new Map<string, { cpuRequested: number; memoryRequested: number; pods: number }>();
    const namespaceUsage = new Map<string, { cpuRequested: number; memoryRequested: number; workloads: number }>();

    let totalCpuCapacity = 0;
    let totalCpuAllocatable = 0;
    let totalCpuRequested = 0;
    let totalMemoryCapacity = 0;
    let totalMemoryAllocatable = 0;
    let totalMemoryRequested = 0;
    let totalPods = 0;

    for (const pod of pods) {
      const nodeName = pod.spec?.nodeName;
      const namespace = pod.metadata?.namespace ?? "default";
      const containers = pod.spec?.containers ?? [];
      const initContainers = pod.spec?.initContainers ?? [];
      const { cpu: containerCpu, memory: containerMem } = sumContainerRequests(containers);
      const { cpu: initCpu, memory: initMem } = sumContainerRequests(initContainers);
      const cpuRequested = Math.max(containerCpu, initCpu);
      const memoryRequested = Math.max(containerMem, initMem);

      if (nodeName) {
        const usage = nodeUsage.get(nodeName) ?? { cpuRequested: 0, memoryRequested: 0, pods: 0 };
        usage.cpuRequested += cpuRequested;
        usage.memoryRequested += memoryRequested;
        usage.pods += 1;
        nodeUsage.set(nodeName, usage);
      }

      const nsUsage = namespaceUsage.get(namespace) ?? { cpuRequested: 0, memoryRequested: 0, workloads: 0 };
      nsUsage.cpuRequested += cpuRequested;
      nsUsage.memoryRequested += memoryRequested;
      nsUsage.workloads += 1;
      namespaceUsage.set(namespace, nsUsage);

      totalCpuRequested += cpuRequested;
      totalMemoryRequested += memoryRequested;
    }

    const nodeSnapshots: CapacityNodeSnapshot[] = nodes.map(node => {
      const name = node.metadata?.name ?? "node";
      const capacityCpu = parseCpuQuantity(node.status?.capacity?.cpu as string | undefined);
      const allocatableCpu = parseCpuQuantity(node.status?.allocatable?.cpu as string | undefined);
      const capacityMemory = parseMemoryQuantity(node.status?.capacity?.memory as string | undefined);
      const allocatableMemory = parseMemoryQuantity(node.status?.allocatable?.memory as string | undefined);
      const usage = nodeUsage.get(name) ?? { cpuRequested: 0, memoryRequested: 0, pods: 0 };
      totalCpuCapacity += capacityCpu;
      totalCpuAllocatable += allocatableCpu;
      totalMemoryCapacity += capacityMemory;
      totalMemoryAllocatable += allocatableMemory;
      totalPods += usage.pods;

      return {
        name,
        cpuCapacity: capacityCpu,
        cpuAllocatable: allocatableCpu,
        cpuRequested: usage.cpuRequested,
        cpuUtilization: allocatableCpu > 0 ? Math.min(1, usage.cpuRequested / allocatableCpu) : 0,
        memoryCapacity: capacityMemory,
        memoryAllocatable: allocatableMemory,
        memoryRequested: usage.memoryRequested,
        memoryUtilization: allocatableMemory > 0 ? Math.min(1, usage.memoryRequested / allocatableMemory) : 0,
        pods: usage.pods,
        conditions: (node.status?.conditions ?? []).map(condition => ({
          type: condition.type ?? "",
          status: condition.status ?? "Unknown"
        }))
      };
    });

    const namespaceSnapshots: CapacityNamespaceSnapshot[] = Array.from(namespaceUsage.entries())
      .map(([name, usage]) => ({
        name,
        cpuRequested: usage.cpuRequested,
        memoryRequested: usage.memoryRequested,
        workloads: usage.workloads
      }))
      .sort((a, b) => b.cpuRequested - a.cpuRequested)
      .slice(0, 12);

    return {
      totals: {
        cpuCapacity: totalCpuCapacity,
        cpuAllocatable: totalCpuAllocatable,
        cpuRequested: totalCpuRequested,
        memoryCapacity: totalMemoryCapacity,
        memoryAllocatable: totalMemoryAllocatable,
        memoryRequested: totalMemoryRequested,
        pods: totalPods
      },
      nodes: nodeSnapshots,
      namespaces: namespaceSnapshots
    };
  } catch (error) {
    logger.warn("capacity snapshot failed, falling back to mock", { error });
    return {
      totals: {
        cpuCapacity: 4500,
        cpuAllocatable: 4200,
        cpuRequested: 2100,
        memoryCapacity: 32768,
        memoryAllocatable: 30720,
        memoryRequested: 16400,
        pods: 42
      },
      nodes: [
        {
          name: "mock-node",
          cpuCapacity: 1500,
          cpuAllocatable: 1400,
          cpuRequested: 900,
          cpuUtilization: 0.64,
          memoryCapacity: 10922,
          memoryAllocatable: 10240,
          memoryRequested: 6200,
          memoryUtilization: 0.6,
          pods: 14,
          conditions: [{ type: "Ready", status: "True" }]
        }
      ],
      namespaces: [
        { name: "default", cpuRequested: 600, memoryRequested: 4300, workloads: 7 },
        { name: "platform", cpuRequested: 420, memoryRequested: 3600, workloads: 5 }
      ]
    };
  }
}

export async function getClusterEfficiencyReport(conn: ClusterConnection): Promise<ClusterEfficiencyReport> {
  await ensureDefaultPricing();

  const [capacity, workloads] = await Promise.all([
    getCapacitySnapshot(conn),
    getWorkloadsFor(conn)
  ]);

  const cpuRequested = capacity.totals.cpuRequested;
  const cpuAllocatable = capacity.totals.cpuAllocatable;
  const memoryRequested = capacity.totals.memoryRequested;
  const memoryAllocatable = capacity.totals.memoryAllocatable;

  const cpuutilization = cpuAllocatable > 0 ? cpuRequested / cpuAllocatable : 0;
  const memoryutilization = memoryAllocatable > 0 ? memoryRequested / memoryAllocatable : 0;

  const cpuWaste = Math.max(0, cpuAllocatable - cpuRequested);
  const memoryWaste = Math.max(0, memoryAllocatable - memoryRequested);

  const mapNode = (node: CapacityNodeSnapshot): NodeEfficiencySnapshot => ({
    name: node.name,
    cpuUtilization: Number(node.cpuUtilization.toFixed(3)),
    memoryUtilization: Number(node.memoryUtilization.toFixed(3)),
    pods: node.pods
  });

  const hotNodes = capacity.nodes.filter(node => Math.max(node.cpuUtilization, node.memoryUtilization) >= 0.75).map(mapNode);
  const coldNodes = capacity.nodes.filter(node => Math.max(node.cpuUtilization, node.memoryUtilization) <= 0.3).map(mapNode);

  const namespaces: NamespaceEfficiencySnapshot[] = capacity.namespaces
    .map(namespace => ({
      name: namespace.name,
      cpuShare: cpuRequested > 0 ? namespace.cpuRequested / cpuRequested : 0,
      memoryShare: memoryRequested > 0 ? namespace.memoryRequested / memoryRequested : 0,
      workloads: namespace.workloads,
      pressure:
        (cpuAllocatable > 0 && namespace.cpuRequested / cpuAllocatable >= 0.25) ||
        (memoryAllocatable > 0 && namespace.memoryRequested / memoryAllocatable >= 0.25)
    }))
    .sort((a, b) => b.cpuShare - a.cpuShare);

  const workloadsNeedingAttention: WorkloadAttentionItem[] = workloads
    .filter(workload => workload.replicasDesired > 0 && workload.replicasReady < workload.replicasDesired)
    .map(workload => {
      const missing = workload.replicasDesired - workload.replicasReady;
      const severity: EfficiencySeverity = missing >= 2 ? "high" : "medium";
      return {
        name: workload.name,
        namespace: workload.namespace,
        replicasDesired: workload.replicasDesired,
        replicasReady: workload.replicasReady,
        reason: `Ontbreekt ${missing} replica${missing === 1 ? "" : "'s"}`,
        severity
      };
    });

  const insights: EfficiencyInsight[] = [];
  const addInsight = (severity: EfficiencySeverity, title: string, description: string, recommendation?: string) => {
    insights.push({
      id: randomUUID(),
      severity,
      title,
      description,
      recommendation
    });
  };

  if (cpuutilization >= 0.85) {
    addInsight(
      "high",
      "CPU-capaciteit onder druk",
      `Cluster verbruikt ${formatPercent(cpuutilization)} van toegewezen CPU.`,
      "Verhoog node capaciteit of optimaliseer requests voor zwaar belaste workloads."
    );
  } else if (cpuutilization <= 0.45) {
    addInsight(
      "medium",
      "CPU overprovisioned",
      `Slechts ${formatPercent(cpuutilization)} van beschikbare CPU wordt actief gebruikt.`,
      "Verlaag container requests of schaal nodes terug om kosten te besparen."
    );
  }

  if (memoryutilization >= 0.85) {
    addInsight(
      "high",
      "Geheugen piekt",
      `Cluster gebruikt ${formatPercent(memoryutilization)} van toegewezen geheugen.`,
      "Voeg geheugen toe of herverdeel workloads met zware memory requests."
    );
  } else if (memoryWaste > memoryAllocatable * 0.25) {
    addInsight(
      "medium",
      "Geheugenoverschot",
      "Significante hoeveelheid geheugen staat ongebruikt klaar.",
      "Evalueer namespace limits en verlaag requests waar mogelijk."
    );
  }

  if (hotNodes.length > 0) {
    addInsight(
      "high",
      "Nodes onder hoge druk",
      `${hotNodes.length} node(s) zitten boven 75% CPU/geheugen.`,
      "Verspreid workloads of schaal horizontaal om hot spots te voorkomen."
    );
  }

  if (coldNodes.length > 0) {
    addInsight(
      "low",
      "Onderbenutte nodes",
      `${coldNodes.length} node(s) draaien structureel onder 30% belasting.`,
      "Overweeg cluster autoscaling of consolidate workloads."
    );
  }

  const pressuredNamespaces = namespaces.filter(namespace => namespace.pressure);
  if (pressuredNamespaces.length > 0) {
    addInsight(
      "medium",
      "Namespaces richting limiet",
      `${pressuredNamespaces.length} namespace(s) consumeren >25% van cluster resources.`,
      "Introduceer quotas of splits workloads om resource contention te beperken."
    );
  }

  if (workloadsNeedingAttention.length > 0) {
    addInsight(
      "high",
      "Workloads missen replicas",
      `${workloadsNeedingAttention.length} deployment(s) draaien minder replicas dan gewenst.`,
      "Inspecteer events/logs om scheduling of crash-loop issues op te lossen."
    );
  }

  const eventRows = await query<{ id: string; event_data: ClusterEvent; created_at: Date }>(
    `SELECT id, event_data, created_at
       FROM cluster_events
      WHERE cluster_connection_id = $1
        AND created_at >= (NOW() - INTERVAL '6 hours')
      ORDER BY created_at DESC
      LIMIT 50`,
    [conn.id]
  );

  const recentEvents = eventRows.rows.map(row => {
    const payload = row.event_data ?? {};
    const message = typeof payload.message === "string" ? payload.message : payload.reason;
    return {
      id: row.id,
      type: payload.type,
      reason: payload.reason,
      message: message ?? "",
      timestamp: new Date(row.created_at ?? new Date()).toISOString()
    };
  });

  const failedSchedulingCount = recentEvents.filter(event => (event.reason ?? "").toLowerCase() === "failedscheduling").length;
  if (failedSchedulingCount > 0) {
    addInsight(
      "high",
      "Pods wachten op resources",
      `${failedSchedulingCount} FailedScheduling events in de laatste 6 uur.`,
      "Controleer cluster capacity, taints en quotas."
    );
  }

  const logRows = await query<{ id: string; level: string; message: string; log_timestamp: Date }>(
    `SELECT id, level, message, log_timestamp
       FROM cluster_log_entries
      WHERE cluster_connection_id = $1
        AND log_timestamp >= (NOW() - INTERVAL '6 hours')
      ORDER BY log_timestamp DESC
      LIMIT 80`,
    [conn.id]
  );

  const errorLogs = logRows.rows
    .filter(row => (row.level ?? "info").toLowerCase() !== "info")
    .map(row => ({
      id: row.id,
      level: row.level ?? "info",
      message: row.message ?? "",
      timestamp: new Date(row.log_timestamp ?? new Date()).toISOString()
    }));

  const crashLoopLogs = errorLogs.filter(log => /crashloop|back-off restarting failed container/i.test(log.message)).length;
  if (crashLoopLogs > 0) {
    addInsight(
      "high",
      "CrashLoopBackOff gedetecteerd",
      `${crashLoopLogs} foutmeldingen in logs van het afgelopen uur.`,
      "Controleer pods met CrashLoopBackOff en draai indien nodig een restart."
    );
  }

  const pricingCache = new Map<string, NodePricing>();
  let monthlyCost = 0;
  let potentialSavings = 0;

  const apis = createApis(conn);
  let rawNodes: V1Node[] = [];
  if (apis) {
    try {
      rawNodes = (await apis.core.listNode()).body.items ?? [];
    } catch (error) {
      logger.warn("failed to list nodes for pricing", { error });
    }
  }

  const capacityNodesByName = new Map(capacity.nodes.map(node => [node.name, node]));

  for (const node of rawNodes) {
    const { provider, instanceType } = extractProviderAndInstance(node);
    const pricing = await getPricingForNode(provider, instanceType, pricingCache);
    const allocCpuMillicores = parseCpuQuantity(node.status?.allocatable?.cpu as string | undefined);
    const allocMemoryMi = parseMemoryQuantity(node.status?.allocatable?.memory as string | undefined);
    const allocCpuCores = allocCpuMillicores / 1000;
    const allocMemoryGi = allocMemoryMi / 1024;
    const nodeHourlyCost = allocCpuCores * pricing.cpuHourly + allocMemoryGi * pricing.memoryHourly;
    monthlyCost += nodeHourlyCost * HOURS_PER_MONTH;

    const snapshot = capacityNodesByName.get(node.metadata?.name ?? "");
    if (snapshot) {
      const nodeCpuWaste = Math.max(0, snapshot.cpuAllocatable - snapshot.cpuRequested) / 1000;
      const nodeMemoryWaste = Math.max(0, snapshot.memoryAllocatable - snapshot.memoryRequested) / 1024;
      potentialSavings += (nodeCpuWaste * pricing.cpuHourly + nodeMemoryWaste * pricing.memoryHourly) * HOURS_PER_MONTH;
    }
  }

  if (monthlyCost === 0) {
    monthlyCost = ((cpuAllocatable / 1000) * DEFAULT_CPU_HOURLY + (memoryAllocatable / 1024) * DEFAULT_MEMORY_HOURLY) * HOURS_PER_MONTH;
    potentialSavings = ((cpuWaste / 1000) * DEFAULT_CPU_HOURLY + (memoryWaste / 1024) * DEFAULT_MEMORY_HOURLY) * HOURS_PER_MONTH;
  }

  const savingsRatio = monthlyCost > 0 ? potentialSavings / monthlyCost : 0;
  if (potentialSavings > 0 && savingsRatio > 0.3) {
    addInsight(
      "medium",
      "Groot optimalisatiepotentieel",
      `Analyse ziet ${formatPercent(savingsRatio)} potentiële besparing.`,
      "Verlaag requests voor onderbenutte workloads of schaal nodepool terug."
    );
  }

  await persistOptimizerInsights(conn.id, insights);
  await performAutoHealing(conn, workloadsNeedingAttention);
  const autoHealing = await fetchRecentOptimizerActions(conn.id);

  const history: OptimizerHistory = {
    recentEvents: recentEvents.slice(0, 20),
    errorLogs: errorLogs.slice(0, 20)
  };

  return {
    generatedAt: new Date().toISOString(),
    cpu: {
      requested: cpuRequested,
      allocatable: cpuAllocatable,
      utilization: Number(cpuutilization.toFixed(3)),
      waste: cpuWaste
    },
    memory: {
      requested: memoryRequested,
      allocatable: memoryAllocatable,
      utilization: Number(memoryutilization.toFixed(3)),
      waste: memoryWaste
    },
    costEstimate: {
      monthly: Number(monthlyCost.toFixed(2)),
      potentialSavings: Number(potentialSavings.toFixed(2))
    },
    hotNodes,
    coldNodes,
    namespaces,
    workloadsNeedingAttention,
    insights,
    history,
    autoHealing
  };
}
