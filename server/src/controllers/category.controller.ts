import { Request, Response } from "express";
import Category from "../models/Category";

/**
 * Get all active categories (public)
 */
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({ isActive: true }).sort("name");
    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
