import { Router } from "express";
import {
  getHomepage,
  getFeaturedFarmers,
  searchAll,
  subscribeToNewsletter,
} from "../controllers/public.controller";
import { newsletterLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.get("/homepage", getHomepage);
router.get("/featured-farmers", getFeaturedFarmers);
router.get("/search", searchAll);
router.post("/newsletter/subscribe", newsletterLimiter, subscribeToNewsletter);

export default router;
