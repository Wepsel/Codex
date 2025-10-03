import { Router } from "express";
import type { Response } from "express";
import { ensureAuthenticated, ensureActiveCompanyMember, requireCompanyAdmin } from "../middleware/auth";
import { createCluster, deleteCluster, getCluster, listClusters, probeAdhocConnection, probeClusterConnection } from "../controllers/clusters.controller";
import { getCompanyCluster } from "../services/cluster-registry";
import { deployManifest, planDeployment } from "../controllers/cluster.controller";
import { persistClusterEvents } from "../services/event-store";
import { getClusterAnomalyScore, getClusterLogTrend } from "../services/ai-insights.service";
import { getComplianceSummary, getIncidentWarRoomData, addIncidentNote, getZeroTrustSnapshot } from "../services/compliance.service";
import { query } from "../lib/db";
import { logger } from "../lib/logger";
import { getCapacitySnapshot, getClusterEfficiencyReport } from "../services/optimizer.service";
import {
  applyManifestFor,
  deletePod,
  listDeploymentsForNamespace,
  getDeploymentRolloutStatus,
  getAlertsFor,
  getAuditFor,
  getClusterSummaryFor,
  getEventsFor,
  getLogsFor,
  getWorkloadsFor,
  scaleDeployment,
  pauseResumeDeployment,
  restartDeployment,
  listNamespacesFor,
  listPodsForNamespace
} from "../services/cluster-client";
import type { RequestWithUser } from "../types";
import type { ClusterEvent } from "@kube-suite/shared";

const router = Router();

router.use(ensureAuthenticated);

router.post("/", requireCompanyAdmin, createCluster);
router.get("/", ensureActiveCompanyMember, listClusters);
router.get("/:id", ensureActiveCompanyMember, getCluster);
router.post("/probe", requireCompanyAdmin, probeAdhocConnection);
router.post("/:id/probe", ensureActiveCompanyMember, probeClusterConnection);
router.delete("/:id", requireCompanyAdmin, deleteCluster);

async function resolveCompanyCluster(req: RequestWithUser) {
  return getCompanyCluster(req.user!.company.id, req.params.id);
}

function clusterNotFound(res: Response) {
  res.status(404).json({ ok: false, error: "Not found" });
}


async function capacityOverviewHandler(req: RequestWithUser, res: Response) {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  try {
    const data = await getCapacitySnapshot(conn);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error("failed to load capacity snapshot", { error, clusterConnectionId: conn.id });
    res.status(500).json({ ok: false, error: "Kon capaciteitsoverzicht niet laden" });
  }
}

async function complianceSummaryHandler(req: RequestWithUser, res: Response) {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  try {
    const data = await getComplianceSummary(conn);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error("failed to load compliance summary", { error, clusterConnectionId: conn.id });
    res.status(500).json({ ok: false, error: "Kon compliance samenvatting niet laden" });
  }
}

async function complianceWarRoomHandler(req: RequestWithUser, res: Response) {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  try {
    const data = await getIncidentWarRoomData(conn);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error("failed to load war room data", { error, clusterConnectionId: conn.id });
    res.status(500).json({ ok: false, error: "Kon incident war room niet laden" });
  }
}

async function complianceNoteHandler(req: RequestWithUser, res: Response) {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const body = req.body as { content?: string; author?: string } | undefined;
  const content = body?.content ?? "";
  const author = body?.author ?? req.user?.name;
  try {
    const data = await addIncidentNote(conn, { content, author });
    res.status(201).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kon notitie niet opslaan";
    res.status(400).json({ ok: false, error: message });
  }
}

async function zeroTrustHandler(req: RequestWithUser, res: Response) {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  try {
    const data = await getZeroTrustSnapshot(conn);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error("failed to load zero trust snapshot", { error, clusterConnectionId: conn.id });
    res.status(500).json({ ok: false, error: "Kon zero trust gegevens niet laden" });
  }
}


// proxied data endpoints per cluster
router.get("/:id/cluster/summary", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getClusterSummaryFor(conn);
  res.json({ ok: true, data });
});

// alias: allow both /:id/workloads and /:id/cluster/workloads
router.get("/:id/workloads", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getWorkloadsFor(conn);
  res.json({ ok: true, data });
});
router.get("/:id/cluster/workloads", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getWorkloadsFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/events", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getEventsFor(conn);
  res.json({ ok: true, data });
});
router.get("/:id/cluster/events", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);

  let live: ClusterEvent[] = [];
  try {
    live = await getEventsFor(conn);
  } catch (error) {
    logger.warn("failed to fetch live cluster events", { error, clusterConnectionId: conn.id });
  }

  if (live.length > 0) {
    persistClusterEvents(req.user!.company.id, conn.id, live).catch(error => {
      logger.warn("failed to persist cluster events", { error, clusterConnectionId: conn.id });
    });
    res.json({ ok: true, data: live });
    return;
  }

  const fromDb = await query<{ payload: ClusterEvent; created_at: string }>(
    `SELECT event_data as payload, created_at FROM cluster_events WHERE cluster_connection_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [conn.id]
  );

  if (fromDb.rows.length > 0) {
    const mapped = fromDb.rows.map(r => ({ ...(r.payload as ClusterEvent) }));
    res.json({ ok: true, data: mapped });
    return;
  }

  res.json({ ok: true, data: [] });
});

router.get("/:id/cluster/ai/anomaly", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getClusterAnomalyScore(conn.id);
  res.json({ ok: true, data });
});

router.get("/:id/cluster/ai/log-trend", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getClusterLogTrend(conn.id);
  res.json({ ok: true, data });
});

router.get("/:id/capacity/overview", ensureActiveCompanyMember, capacityOverviewHandler);
router.get("/:id/cluster/capacity/overview", ensureActiveCompanyMember, capacityOverviewHandler);
router.get("/:id/optimizer/efficiency", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  try {
    const data = await getClusterEfficiencyReport(conn);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error("failed to load efficiency report", { error, clusterConnectionId: conn.id });
    res.status(500).json({ ok: false, error: "Kon optimizer rapport niet laden" });
  }
});
router.get("/:id/cluster/optimizer/efficiency", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  try {
    const data = await getClusterEfficiencyReport(conn);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error("failed to load efficiency report", { error, clusterConnectionId: conn.id });
    res.status(500).json({ ok: false, error: "Kon optimizer rapport niet laden" });
  }
});

router.get("/:id/compliance/summary", ensureActiveCompanyMember, complianceSummaryHandler);
router.get("/:id/cluster/compliance/summary", ensureActiveCompanyMember, complianceSummaryHandler);
router.get("/:id/compliance/war-room", ensureActiveCompanyMember, complianceWarRoomHandler);
router.get("/:id/cluster/compliance/war-room", ensureActiveCompanyMember, complianceWarRoomHandler);
router.post("/:id/compliance/war-room/notes", requireCompanyAdmin, complianceNoteHandler);
router.post("/:id/cluster/compliance/war-room/notes", requireCompanyAdmin, complianceNoteHandler);
router.get("/:id/compliance/zero-trust", ensureActiveCompanyMember, zeroTrustHandler);
router.get("/:id/cluster/compliance/zero-trust", ensureActiveCompanyMember, zeroTrustHandler);

router.get("/:id/alerts", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getAlertsFor(conn);
  res.json({ ok: true, data });
});
router.get("/:id/cluster/alerts", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getAlertsFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/audit", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getAuditFor(conn);
  res.json({ ok: true, data });
});
router.get("/:id/cluster/audit", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getAuditFor(conn);
  res.json({ ok: true, data });
});

// deployment planning/execution aliases to match frontend cluster-scoped paths
router.post(
  "/:id/cluster/deployments/plan",
  ensureActiveCompanyMember,
  planDeployment
);
router.post(
  "/:id/cluster/deployments",
  requireCompanyAdmin,
  async (req: RequestWithUser, res: Response) => {
    const conn = await resolveCompanyCluster(req);
    if (!conn) return clusterNotFound(res);
    const { manifestYaml } = req.body as { manifestYaml: string };
    const data = await applyManifestFor(conn, manifestYaml);
    res.status(data.accepted ? 202 : 500).json({ ok: data.accepted, data });
  }
);

// logs alias
router.get("/:id/namespaces/:namespace/pods/:pod/logs", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace, pod } = req.params as { namespace: string; pod: string };
  const { container } = req.query as { container?: string };
  const data = await getLogsFor(conn, namespace, pod, container);
  res.json({ ok: true, data });
});
router.get("/:id/cluster/namespaces/:namespace/pods/:pod/logs", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace, pod } = req.params as { namespace: string; pod: string };
  const { container } = req.query as { container?: string };
  const data = await getLogsFor(conn, namespace, pod, container);
  res.json({ ok: true, data });
});

// Helpers to power logs UI with real pod/container discovery
router.get("/:id/cluster/namespaces", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await listNamespacesFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/cluster/namespaces/:namespace/pods", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace } = req.params as { namespace: string };
  const data = await listPodsForNamespace(conn, namespace);
  res.json({ ok: true, data });
});

router.get("/:id/cluster/namespaces/:namespace/deployments", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace } = req.params as { namespace: string };
  const data = await listDeploymentsForNamespace(conn, namespace);
  res.json({ ok: true, data });
});

router.get("/:id/cluster/namespaces/:namespace/deployments/:name/status", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace, name } = req.params as { namespace: string; name: string };
  const data = await getDeploymentRolloutStatus(conn, namespace, name);
  res.json({ ok: true, data });
});

// crash pod (delete) to simulate self-healing
router.delete(
  "/:id/cluster/namespaces/:namespace/pods/:pod",
  requireCompanyAdmin,
  async (req: RequestWithUser, res: Response) => {
    const conn = await resolveCompanyCluster(req);
    if (!conn) return clusterNotFound(res);
    const { namespace, pod } = req.params as { namespace: string; pod: string };
    const result = await deletePod(conn, namespace, pod);
    res.status(result.ok ? 202 : 500).json({ ok: result.ok });
  }
);

router.post("/:id/namespaces/:namespace/deployments/:name/scale", requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace, name } = req.params as { namespace: string; name: string };
  const { replicas } = req.body as { replicas: number };
  if (typeof replicas !== "number" || replicas < 0) return res.status(400).json({ ok: false, error: "replicas must be >= 0" });
  const data = await scaleDeployment(conn, namespace, name, replicas);
  res.status(data.scaled ? 202 : 500).json({ ok: data.scaled, data });
});

router.post("/:id/namespaces/:namespace/deployments/:name/pause", requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace, name } = req.params as { namespace: string; name: string };
  const data = await pauseResumeDeployment(conn, namespace, name, true);
  res.status(data.ok ? 202 : 500).json({ ok: data.ok, data });
});

router.post("/:id/namespaces/:namespace/deployments/:name/resume", requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace, name } = req.params as { namespace: string; name: string };
  const data = await pauseResumeDeployment(conn, namespace, name, false);
  res.status(data.ok ? 202 : 500).json({ ok: data.ok, data });
});

router.post("/:id/namespaces/:namespace/deployments/:name/restart", requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace, name } = req.params as { namespace: string; name: string };
  const data = await restartDeployment(conn, namespace, name);
  res.status(data.ok ? 202 : 500).json({ ok: data.ok, data });
});

export default router;










