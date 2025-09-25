import { Router } from "express";
import { fetchComplianceSummary, fetchWarRoomData } from "../controllers/compliance.controller";

const router = Router();

router.get("/summary", fetchComplianceSummary);
router.get("/war-room", fetchWarRoomData);

export default router;
