import { Router } from "express";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/address.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, getAddresses);
router.post("/", authenticate, createAddress);
router.put("/:id", authenticate, updateAddress);
router.delete("/:id", authenticate, deleteAddress);
router.patch("/:id/default", authenticate, setDefaultAddress);

export default router;
