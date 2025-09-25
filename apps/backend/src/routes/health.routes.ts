import { Router } from "express";

const router = Router();

router.get("/healthz", (_req, res) => {
  res.json({ ok: true, status: "healthy", timestamp: new Date().toISOString() });
});

router.get("/readiness", (_req, res) => {
  res.json({ ok: true, status: "ready" });
});

export default router;
