import { Router } from "express";
import type { Response } from "express";
import { ensureAuthenticated, ensureActiveCompanyMember, requireCompanyAdmin } from "../middleware/auth";
import { createCluster, deleteCluster, getCluster, listClusters } from "../controllers/clusters.controller";
import { getCompanyCluster } from "../services/cluster-registry";
import {
  getAlertsFor,
  getAuditFor,
  getClusterSummaryFor,
  getEventsFor,
  getLogsFor,
  getWorkloadsFor,
  scaleDeployment,
  pauseResumeDeployment,
  restartDeployment
} from "../services/cluster-client";
import type { RequestWithUser } from "../types";

const router = Router();

router.use(ensureAuthenticated);

router.post("/", requireCompanyAdmin, createCluster);
router.get("/", ensureActiveCompanyMember, listClusters);
router.get("/:id", ensureActiveCompanyMember, getCluster);
router.delete("/:id", requireCompanyAdmin, deleteCluster);

async function resolveCompanyCluster(req: RequestWithUser) {
  return getCompanyCluster(req.user!.company.id, req.params.id);
}

function clusterNotFound(res: Response) {
  res.status(404).json({ ok: false, error: "Not found" });
}

// proxied data endpoints per cluster
router.get("/:id/cluster/summary", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const data = await getClusterSummaryFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/workloads", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
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

router.get("/:id/alerts", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
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

router.get("/:id/namespaces/:namespace/pods/:pod/logs", ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const conn = await resolveCompanyCluster(req);
  if (!conn) return clusterNotFound(res);
  const { namespace, pod } = req.params as { namespace: string; pod: string };
  const { container } = req.query as { container?: string };
  const data = await getLogsFor(conn, namespace, pod, container);
  res.json({ ok: true, data });
});

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
