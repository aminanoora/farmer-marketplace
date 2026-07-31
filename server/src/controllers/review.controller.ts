import { Request, Response } from "express";
import Review from "../models/Review";
import { AuthRequest } from "../middleware/auth.middleware";

/**
 * Add a review (consumer only)
 */
export const addReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { product, farmer, rating, comment } = req.body;

    const existingReview = await Review.findOne({
      consumer: req.user?._id,
      product,
    });

    if (existingReview) {
      res.status(400).json({ message: "You have already reviewed this product" });
      return;
    }

    const review = new Review({
      consumer: req.user?._id,
      product,
      farmer,
      rating,
      comment,
    });

    await review.save();
    res.status(201).json({ review });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get reviews (public — filterable by farmer or product)
 */
export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { farmer, product } = req.query;
    const filter: Record<string, any> = {};
    if (farmer) filter.farmer = farmer;
    if (product) filter.product = product;

    const reviews = await Review.find(filter)
      .populate("consumer", "name avatar")
      .sort("-createdAt");

    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      averageRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    }

    res.json({ reviews, averageRating, total: reviews.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
