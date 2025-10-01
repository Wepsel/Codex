import type { NextFunction, Response } from "express";
import { getUserBySession } from "../services/auth.service";
import type { RequestWithUser } from "../types";

const COOKIE_NAME = "nebula_session";

export function authenticateUser(req: RequestWithUser, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    next();
    return;
  }
  getUserBySession(token)
    .then(user => {
      if (user) {
        req.user = user;
      }
      next();
    })
    .catch(error => {
      next(error);
    });
}

export function ensureAuthenticated(req: RequestWithUser, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  next();
}

export function ensureActiveCompanyMember(req: RequestWithUser, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  if (req.user.company.status !== "active") {
    res.status(403).json({ ok: false, error: "Company membership is not active" });
    return;
  }
  next();
}

export function requireCompanyAdmin(req: RequestWithUser, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  if (req.user.company.status !== "active") {
    res.status(403).json({ ok: false, error: "Company membership is not active" });
    return;
  }
  if (req.user.company.role !== "admin") {
    res.status(403).json({ ok: false, error: "Admin role required" });
    return;
  }
  next();
}
