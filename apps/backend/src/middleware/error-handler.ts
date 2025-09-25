import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ ok: false, error: `Route ${req.originalUrl} not found` });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  logger.error("unhandled error", { error });
  res.status(500).json({ ok: false, error: "Internal server error" });
}
