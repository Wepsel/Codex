import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createSession,
  destroySession,
  getUserBySession,
  registerUser,
  toUserProfile,
  validateCredentials
} from "../services/auth.service";
import type { RequestWithUser } from "../types";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6)
});

const COOKIE_NAME = "nebula_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE * 1000,
    path: "/"
  });
}

router.post("/login", (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  try {
    const user = validateCredentials(parsed.data.username, parsed.data.password);
    const sessionToken = createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.json({ ok: true, data: toUserProfile(user) });
  } catch (error) {
    res.status(401).json({ ok: false, error: (error as Error).message });
  }
});

router.post("/register", (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  try {
    const user = registerUser(parsed.data);
    const sessionToken = createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.status(201).json({ ok: true, data: toUserProfile(user) });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    destroySession(token);
  }
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

router.get("/me", (req: RequestWithUser, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  const user = getUserBySession(token);
  if (!user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  res.json({ ok: true, data: user });
});

export default router;
