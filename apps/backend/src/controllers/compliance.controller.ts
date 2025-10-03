import type { Response } from "express";
import type { RequestWithUser } from "../types";
import {
  addIncidentNote,
  generateComplianceReport,
  getComplianceSummary,
  getIncidentWarRoomData,
  getZeroTrustSnapshot
} from "../services/compliance.service";
import { getCompanyCluster, listCompanyClusters } from "../services/cluster-registry";
import type { ClusterConnection } from "../services/cluster-registry";

async function resolveClusterFromRequest(req: RequestWithUser): Promise<{ cluster: ClusterConnection | null; requestedId?: string }> {
  const companyId = req.user!.company.id;
  const requestedId = (req.query.clusterId ?? req.body?.clusterId ?? req.headers["x-cluster-id"]) as string | undefined;

  if (requestedId) {
    const cluster = await getCompanyCluster(companyId, requestedId);
    return { cluster, requestedId };
  }

  const clusters = await listCompanyClusters(companyId);
  return { cluster: clusters[0] ?? null };
}

export async function fetchComplianceSummary(req: RequestWithUser, res: Response) {
  const { cluster, requestedId } = await resolveClusterFromRequest(req);
  if (!cluster && requestedId) {
    res.status(404).json({ ok: false, error: "Cluster niet gevonden" });
    return;
  }
  const summary = await getComplianceSummary(cluster);
  res.json({ ok: true, data: summary });
}

export async function fetchWarRoomData(req: RequestWithUser, res: Response) {
  const { cluster, requestedId } = await resolveClusterFromRequest(req);
  if (!cluster && requestedId) {
    res.status(404).json({ ok: false, error: "Cluster niet gevonden" });
    return;
  }
  const warRoom = await getIncidentWarRoomData(cluster);
  res.json({ ok: true, data: warRoom });
}

export async function createWarRoomNote(req: RequestWithUser, res: Response) {
  const { cluster, requestedId } = await resolveClusterFromRequest(req);
  if (!cluster && requestedId) {
    res.status(404).json({ ok: false, error: "Cluster niet gevonden" });
    return;
  }

  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const author =
    typeof req.body?.author === "string" && req.body.author.trim().length > 0
      ? req.body.author
      : req.user?.name;

  try {
    const warRoom = await addIncidentNote(cluster, { content, author });
    res.status(201).json({ ok: true, data: warRoom });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    res.status(400).json({ ok: false, error: message });
  }
}

export async function exportComplianceReport(req: RequestWithUser, res: Response) {
  const { cluster, requestedId } = await resolveClusterFromRequest(req);
  if (!cluster && requestedId) {
    res.status(404).json({ ok: false, error: "Cluster niet gevonden" });
    return;
  }

  const report = await generateComplianceReport(cluster);
  const payload = JSON.stringify(report, null, 2);
  const safeTimestamp = report.generatedAt.replace(/[:.]/g, "-");

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="compliance-report-${safeTimestamp}.json"`
  );
  res.status(200).send(payload);
}

export async function fetchZeroTrustSnapshot(req: RequestWithUser, res: Response) {
  const { cluster, requestedId } = await resolveClusterFromRequest(req);
  if (!cluster && requestedId) {
    res.status(404).json({ ok: false, error: "Cluster niet gevonden" });
    return;
  }
  const snapshot = await getZeroTrustSnapshot(cluster);
  res.json({ ok: true, data: snapshot });
}
