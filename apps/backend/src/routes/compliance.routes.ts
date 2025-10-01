import { Router } from "express";
import { ensureActiveCompanyMember, requireCompanyAdmin } from "../middleware/auth";
import {
  createWarRoomNote,
  exportComplianceReport,
  fetchComplianceSummary,
  fetchWarRoomData
} from "../controllers/compliance.controller";

const router = Router();

router.use(ensureActiveCompanyMember);

router.get("/summary", fetchComplianceSummary);
router.get("/war-room", fetchWarRoomData);
router.post("/war-room/notes", requireCompanyAdmin, createWarRoomNote);
router.get("/report", exportComplianceReport);

export default router;