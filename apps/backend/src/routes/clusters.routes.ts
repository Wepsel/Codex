import { Router } from "express";
import { ensureAuthenticated } from "../middleware/auth";
import { createCluster, deleteCluster, getCluster, listClusters } from "../controllers/clusters.controller";
import { getUserCluster } from "../services/cluster-registry";
import { getAlertsFor, getAuditFor, getClusterSummaryFor, getEventsFor, getLogsFor, getWorkloadsFor, scaleDeployment, pauseResumeDeployment, restartDeployment } from "../services/cluster-client";

const router = Router();

router.use(ensureAuthenticated);

router.post("/", createCluster);
router.get("/", listClusters);
router.get("/:id", getCluster);
router.delete("/:id", deleteCluster);

// proxied data endpoints per cluster
router.get("/:id/cluster/summary", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const data = await getClusterSummaryFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/workloads", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const data = await getWorkloadsFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/events", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const data = await getEventsFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/alerts", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const data = await getAlertsFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/audit", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const data = await getAuditFor(conn);
  res.json({ ok: true, data });
});

router.get("/:id/namespaces/:namespace/pods/:pod/logs", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const { namespace, pod } = req.params as { namespace: string; pod: string };
  const { container } = req.query as { container?: string };
  const data = await getLogsFor(conn, namespace, pod, container);
  res.json({ ok: true, data });
});

router.post("/:id/namespaces/:namespace/deployments/:name/scale", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const { namespace, name } = req.params as { namespace: string; name: string };
  const { replicas } = req.body as { replicas: number };
  if (typeof replicas !== "number" || replicas < 0) return res.status(400).json({ ok: false, error: "replicas must be >= 0" });
  const data = await scaleDeployment(conn, namespace, name, replicas);
  res.status(data.scaled ? 202 : 500).json({ ok: data.scaled, data });
});

router.post("/:id/namespaces/:namespace/deployments/:name/pause", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const { namespace, name } = req.params as { namespace: string; name: string };
  const data = await pauseResumeDeployment(conn, namespace, name, true);
  res.status(data.ok ? 202 : 500).json({ ok: data.ok, data });
});

router.post("/:id/namespaces/:namespace/deployments/:name/resume", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const { namespace, name } = req.params as { namespace: string; name: string };
  const data = await pauseResumeDeployment(conn, namespace, name, false);
  res.status(data.ok ? 202 : 500).json({ ok: data.ok, data });
});

router.post("/:id/namespaces/:namespace/deployments/:name/restart", async (req, res) => {
  const conn = getUserCluster(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ ok: false, error: "Not found" });
  const { namespace, name } = req.params as { namespace: string; name: string };
  const data = await restartDeployment(conn, namespace, name);
  res.status(data.ok ? 202 : 500).json({ ok: data.ok, data });
});

export default router;


