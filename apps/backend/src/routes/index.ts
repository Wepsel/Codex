import { Router } from "express";
import authRoutes from "./auth.routes";
import complianceRoutes from "./compliance.routes";
import clusterRoutes from "./cluster.routes";
import healthRoutes from "./health.routes";
import { ensureAuthenticated } from "../middleware/auth";

const router = Router();

router.use("/auth", authRoutes);
router.use("/system", healthRoutes);
router.use("/cluster", ensureAuthenticated, clusterRoutes);
router.use("/compliance", ensureAuthenticated, complianceRoutes);

export default router;
