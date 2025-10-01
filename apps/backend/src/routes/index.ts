import { Router } from "express";
import authRoutes from "./auth.routes";
import complianceRoutes from "./compliance.routes";
import clusterCoreRoutes from "./cluster.routes";
import clusterConnectionsRoutes from "./clusters.routes";
import healthRoutes from "./health.routes";
import { ensureAuthenticated, ensureActiveCompanyMember } from "../middleware/auth";

const router = Router();

router.use("/auth", authRoutes);
router.use("/system", healthRoutes);
router.use("/cluster", ensureAuthenticated, clusterCoreRoutes);
router.use("/clusters", ensureAuthenticated, ensureActiveCompanyMember, clusterConnectionsRoutes);
router.use("/compliance", ensureAuthenticated, complianceRoutes);

export default router;
