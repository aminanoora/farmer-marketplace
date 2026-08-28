import { Request, Response } from "express";
import Review from "../models/Review";
import { AuthRequest } from "../middleware/auth.middleware";
import { getErrorMessage } from "../utils/response";

/**
 * Add a review (consumer only)
 */
export const addReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { product, farmer, rating, comment } = req.body;

    // Require a product — prevents farmer-only review spam.
    // The unique index on {consumer, product} is sparse, so reviews
    // without a product bypass the uniqueness constraint entirely.
    if (!product) {
      res.status(400).json({ message: "A product ID is required to submit a review." });
      return;
    }

    if (!farmer) {
      res.status(400).json({ message: "A farmer ID is required to submit a review." });
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ message: "Rating must be between 1 and 5." });
      return;
    }

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
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Get reviews (public — filterable by farmer or product)
 */
export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { farmer, product } = req.query;
    const filter: Record<string, unknown> = {};
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
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};
