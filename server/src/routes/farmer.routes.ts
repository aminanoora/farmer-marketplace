import { Router } from "express";
import {
  getProfile,
  updateProfile,
  getProducts,
  getProduct,
  addProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderStatus,
  confirmOrder,
  cancelOrder,
  getEarnings,
  changePassword,
} from "../controllers/farmer.controller";
import { getFarmer, getFarmers } from "../controllers/public.controller";
import { getOrder } from "../controllers/order.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import { validate } from "../middleware/validate.middleware";
import { productValidator } from "../validators/product.validator";

const router = Router();

// ── Public routes ─────────────────────────────
router.get("/", getFarmers);

// ── Protected farmer routes (must be before /:id) ──
// These match the client's farmerAPI paths exactly:
//   GET  /farmers/me         → getProfile
//   PUT  /farmers/me         → updateProfile
//   GET  /farmers/products   → getProducts
//   POST /farmers/products   → addProduct
//   PUT  /farmers/products/:id  → updateProduct
//   DEL  /farmers/products/:id  → deleteProduct
//   GET  /farmers/orders     → getOrders
//   PATCH /farmers/orders/:id   → updateOrderStatus
//   GET  /farmers/earnings   → getEarnings

router.get("/me", authenticate, authorize("farmer"), getProfile);
router.put("/me", authenticate, authorize("farmer"), updateProfile);
router.get("/products", authenticate, authorize("farmer"), getProducts);
router.get("/products/:id", authenticate, authorize("farmer"), getProduct);
router.post("/products", authenticate, authorize("farmer"), upload.array("images", 4), productValidator, validate, addProduct);
router.put("/products/:id", authenticate, authorize("farmer"), upload.array("images", 4), updateProduct);
router.delete("/products/:id", authenticate, authorize("farmer"), deleteProduct);
router.get("/orders", authenticate, authorize("farmer"), getOrders);
router.get("/orders/:id", authenticate, authorize("farmer"), getOrder);
router.patch("/orders/:id", authenticate, authorize("farmer"), updateOrderStatus);
router.patch("/orders/:id/confirm", authenticate, authorize("farmer"), confirmOrder);
router.patch("/orders/:id/cancel", authenticate, authorize("farmer"), cancelOrder);
router.get("/earnings", authenticate, authorize("farmer"), getEarnings);
router.post("/change-password", authenticate, authorize("farmer"), changePassword);

// ── Catch-all farmer route (must be last) ─────
router.get("/:id", getFarmer);

export default router;
