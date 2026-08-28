import { Request, Response } from "express";
import Category from "../models/Category";
import { getErrorMessage } from "../utils/response";

/**
 * Get all active categories (public)
 */
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({ isActive: true }).sort("name");
    res.json({ categories });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};
