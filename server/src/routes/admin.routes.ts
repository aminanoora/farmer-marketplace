import { Router } from "express";
import {
  adminLogin,
  getAdminMe,
  getDashboard,
  getDashboardOverview,
  getDashboardTransactions,
  getFarmers,
  getUserById,
  toggleUserStatus,
  approveFarmer,
  rejectFarmer,
  createCategory,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderDetails,
  getProducts,
  getProductById,
  toggleProductStatus,
  approveProduct,
  rejectProduct,
  getAnalytics,
  getSettings,
  updateSettings,
} from "../controllers/admin.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

// Admin login — no auth required
router.post("/login", authLimiter, adminLogin);

// All other admin routes require authentication and admin role
router.use(authenticate, authorize("admin"));

router.get("/me", getAdminMe);
router.get("/dashboard", getDashboard);
router.get("/dashboard/overview", getDashboardOverview);
router.get("/dashboard/transactions", getDashboardTransactions);
router.get("/farmers", getFarmers);
router.get("/farmers/:id", getUserById);
router.patch("/farmers/:id/status", toggleUserStatus);
router.patch("/farmers/:id/approve", approveFarmer);
router.patch("/farmers/:id/reject", rejectFarmer);
router.post("/categories", createCategory);
router.get("/products", getProducts);
router.get("/products/:id", getProductById);
router.patch("/products/:id/status", toggleProductStatus);
router.patch("/products/:id/approve", approveProduct);
router.patch("/products/:id/reject", rejectProduct);
router.get("/orders", getOrders);
router.get("/orders/:id", getOrderById);
router.patch("/orders/:id/status", updateOrderStatus);
router.patch("/orders/:id/details", updateOrderDetails);
router.get("/analytics", getAnalytics);

// Platform settings
router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

export default router;
