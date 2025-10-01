import type { Response } from "express";
import type { RequestWithUser } from "../types";
import {
  addIncidentNote,
  generateComplianceReport,
  getComplianceSummary,
  getIncidentWarRoomData
} from "../services/compliance.service";

export function fetchComplianceSummary(_req: RequestWithUser, res: Response) {
  const summary = getComplianceSummary();
  res.json({ ok: true, data: summary });
}

export function fetchWarRoomData(_req: RequestWithUser, res: Response) {
  const warRoom = getIncidentWarRoomData();
  res.json({ ok: true, data: warRoom });
}

export function createWarRoomNote(req: RequestWithUser, res: Response) {
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const author =
    typeof req.body?.author === "string" && req.body.author.trim().length > 0
      ? req.body.author
      : req.user?.name;

  try {
    const warRoom = addIncidentNote({ content, author });
    res.status(201).json({ ok: true, data: warRoom });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    res.status(400).json({ ok: false, error: message });
  }
}

export function exportComplianceReport(_req: RequestWithUser, res: Response) {
  const report = generateComplianceReport();
  const payload = JSON.stringify(report, null, 2);
  const safeTimestamp = report.generatedAt.replace(/[:.]/g, "-");

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="compliance-report-${safeTimestamp}.json"`
  );
  res.status(200).send(payload);
}
