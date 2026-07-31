import { Router } from "express";
import {
  placeOrder,
  getOrders,
  getOrder,
  cancelOrder,
  getPaymentMethods,
} from "../controllers/order.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticate, authorize("consumer"), placeOrder);
router.get("/", authenticate, getOrders);
router.get("/:id", authenticate, getOrder);
router.patch("/:id/cancel", authenticate, authorize("consumer"), cancelOrder);
router.get("/payment-methods/summary", authenticate, getPaymentMethods);

export default router;
