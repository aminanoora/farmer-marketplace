import { Router } from "express";
import {
  getHomepage,
  getFeaturedFarmers,
  searchAll,
  subscribeToNewsletter,
} from "../controllers/public.controller";

const router = Router();

router.get("/homepage", getHomepage);
router.get("/featured-farmers", getFeaturedFarmers);
router.get("/search", searchAll);
router.post("/newsletter/subscribe", subscribeToNewsletter);

export default router;
