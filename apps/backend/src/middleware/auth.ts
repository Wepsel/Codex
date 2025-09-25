import type { NextFunction, Response } from "express";
import { getUserBySession } from "../services/auth.service";
import type { RequestWithUser } from "../types";

const COOKIE_NAME = "nebula_session";

export function authenticateUser(req: RequestWithUser, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  const user = getUserBySession(token);
  if (user) {
    req.user = user;
  }
  next();
}

export function ensureAuthenticated(req: RequestWithUser, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  next();
}
