import type { Response } from "express";
import type { RequestWithUser } from "../types";
import { getComplianceSummary, getIncidentWarRoomData } from "../services/compliance.service";

export function fetchComplianceSummary(_req: RequestWithUser, res: Response) {
  const summary = getComplianceSummary();
  res.json({ ok: true, data: summary });
}

export function fetchWarRoomData(_req: RequestWithUser, res: Response) {
  const warRoom = getIncidentWarRoomData();
  res.json({ ok: true, data: warRoom });
}
