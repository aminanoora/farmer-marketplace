import { Router } from "express";
import { addReview, getReviews } from "../controllers/review.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticate, authorize("consumer"), addReview);
router.get("/", getReviews);

export default router;
