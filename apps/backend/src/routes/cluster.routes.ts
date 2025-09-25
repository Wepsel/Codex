import { Router } from "express";
import {
  copilotInterpret,
  deployManifest,
  fetchAlerts,
  fetchAuditLog,
  fetchClusterSummary,
  fetchEvents,
  fetchPodLogs,
  listNamespaces,
  listWorkloads,
  planDeployment
} from "../controllers/cluster.controller";

const router = Router();

router.get("/summary", fetchClusterSummary);
router.get("/namespaces", listNamespaces);
router.get("/workloads", listWorkloads);
router.get("/alerts", fetchAlerts);
router.get("/audit", fetchAuditLog);
router.get("/events", fetchEvents);
router.get("/namespaces/:namespace/pods/:pod/logs", fetchPodLogs);
router.post("/deployments", deployManifest);
router.post("/deployments/plan", planDeployment);
router.post("/copilot/interpret", copilotInterpret);

export default router;
