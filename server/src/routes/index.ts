import { Router } from "express";
import authRoutes from "./auth.routes";
import farmerRoutes from "./farmer.routes";
import productRoutes from "./product.routes";
import orderRoutes from "./order.routes";
import reviewRoutes from "./review.routes";
import categoryRoutes from "./category.routes";
import adminRoutes from "./admin.routes";
import addressRoutes from "./address.routes";
import publicRoutes from "./public.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/farmers", farmerRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/reviews", reviewRoutes);
router.use("/categories", categoryRoutes);
router.use("/admin", adminRoutes);
router.use("/addresses", addressRoutes);
router.use("/", publicRoutes);

export default router;
