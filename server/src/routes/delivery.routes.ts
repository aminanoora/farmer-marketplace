import { Router } from "express";
import {
  createDelivery,
  getDeliveries,
  getDelivery,
  updateDeliveryStatus,
  updateDeliveryDetails,
  deleteDelivery,
  getOrderDelivery,
} from "../controllers/delivery.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

// ── Admin delivery management ─────────────────────
router.post("/", authenticate, authorize("admin"), createDelivery);
router.get("/", authenticate, authorize("admin"), getDeliveries);
router.get("/:id", authenticate, authorize("admin"), getDelivery);
router.patch("/:id/status", authenticate, authorize("admin"), updateDeliveryStatus);
router.patch("/:id/details", authenticate, authorize("admin"), updateDeliveryDetails);
router.delete("/:id", authenticate, authorize("admin"), deleteDelivery);

// ── Order-based delivery tracking (consumer/farmer) ──
router.get("/order/:orderId", authenticate, getOrderDelivery);

export default router;
