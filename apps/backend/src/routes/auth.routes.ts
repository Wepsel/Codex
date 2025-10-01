import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createCompanyInvite,
  createSession,
  decideJoinRequest,
  destroySession,
  getCompanyAdminOverview,
  getCompanyProfile,
  listCompanyInvites,
  listCompanyJoinRequests,
  registerUser,
  removeCompanyMember,
  resetCompanyMemberPassword,
  searchCompanies,
  updateCompanyMemberRole,
  validateCredentials
} from "../services/auth.service";
import { ensureAuthenticated, ensureActiveCompanyMember, requireCompanyAdmin } from "../middleware/auth";
import type { RequestWithUser } from "../types";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const companyCreateSchema = z.object({
  mode: z.literal("create"),
  name: z.string().min(2),
  description: z.string().max(280).optional(),
  inviteOnly: z.boolean().optional()
});

const companyJoinSchema = z.object({
  mode: z.literal("join"),
  companyId: z.string().uuid()
});

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  company: z.discriminatedUnion("mode", [companyCreateSchema, companyJoinSchema])
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
  expiresAt: z.string().optional()
});

const reviewSchema = z.object({
  decision: z.enum(["approve", "reject"])
});

const memberRoleSchema = z.object({
  role: z.enum(["admin", "member"])
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

router.get("/companies", async (req: Request, res: Response) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const results = await searchCompanies(query);
  res.json({ ok: true, data: results });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  try {
    const user = await validateCredentials(parsed.data.username, parsed.data.password);
    const sessionToken = await createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.json({ ok: true, data: user });
  } catch (error) {
    res.status(401).json({ ok: false, error: (error as Error).message });
  }
});

router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  try {
    const user = await registerUser(parsed.data);
    const sessionToken = await createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.status(201).json({ ok: true, data: user });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    await destroySession(token);
  }
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

router.get("/me", (req: RequestWithUser, res: Response) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  res.json({ ok: true, data: req.user });
});

router.get("/company/profile", ensureAuthenticated, ensureActiveCompanyMember, async (req: RequestWithUser, res: Response) => {
  const companyId = req.user!.company.id;
  const profile = await getCompanyProfile(companyId);
  if (!profile) {
    res.status(404).json({ ok: false, error: "Company not found" });
    return;
  }
  res.json({ ok: true, data: profile });
});

router.get("/company/admin", ensureAuthenticated, requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const user = req.user!;
  try {
    const overview = await getCompanyAdminOverview(user.company.id);
    res.json({ ok: true, data: overview });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

router.get("/company/invites", ensureAuthenticated, requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const user = req.user!;
  try {
    const invites = await listCompanyInvites(user.company.id);
    res.json({ ok: true, data: invites });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

router.post("/company/invite", ensureAuthenticated, requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const user = req.user!;
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  try {
    const invite = await createCompanyInvite({
      companyId: user.company.id,
      invitedBy: user.id,
      email: parsed.data.email,
      role: parsed.data.role,
      expiresAt: parsed.data.expiresAt
    });
    res.status(201).json({ ok: true, data: invite });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

router.get("/company/requests", ensureAuthenticated, requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const user = req.user!;
  try {
    const requests = await listCompanyJoinRequests(user.company.id);
    res.json({ ok: true, data: requests });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

router.post("/company/requests/:id/decision", ensureAuthenticated, requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const user = req.user!;
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  try {
    const request = await decideJoinRequest({
      requestId: req.params.id,
      approverId: user.id,
      decision: parsed.data.decision
    });
    res.json({ ok: true, data: request });
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "Join request not found" || message === "Company not found" ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

router.patch("/company/members/:id", ensureAuthenticated, requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const user = req.user!;
  const parsed = memberRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  try {
    const member = await updateCompanyMemberRole({
      companyId: user.company.id,
      targetUserId: req.params.id,
      role: parsed.data.role,
      actorId: user.id
    });
    res.json({ ok: true, data: member });
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "User not found" ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

router.delete("/company/members/:id", ensureAuthenticated, requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const user = req.user!;
  try {
    await removeCompanyMember({
      companyId: user.company.id,
      targetUserId: req.params.id,
      actorId: user.id
    });
    res.status(204).end();
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "User not found" ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

router.post("/company/members/:id/reset-password", ensureAuthenticated, requireCompanyAdmin, async (req: RequestWithUser, res: Response) => {
  const user = req.user!;
  try {
    const result = await resetCompanyMemberPassword({
      companyId: user.company.id,
      targetUserId: req.params.id,
      actorId: user.id
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "User not found" ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

export default router;
