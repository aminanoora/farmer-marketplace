import { Request, Response } from "express";
import User from "../models/User";
import Category from "../models/Category";
import Product from "../models/Product";
import Review from "../models/Review";
import Newsletter from "../models/Newsletter";

/**
 * Get all homepage data in a single request
 */
export const getHomepage = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [categories, featuredFarmers, recentProducts] = await Promise.all([
      Category.find({ isActive: true }).sort("name").lean(),
      User.find({
        role: "farmer",
        verificationStatus: "verified",
      })
        .select("name farmName farmLocation cropTypes farmingMethod avatar verificationStatus")
        .sort("-createdAt")
        .limit(6)
        .lean(),
      Product.find({ isAvailable: true, approvalStatus: "approved" })
        .populate("farmer", "name farmName avatar")
        .populate("category", "name slug")
        .sort("-createdAt")
        .limit(8)
        .lean(),
    ]);

    res.json({
      categories,
      featuredFarmers,
      recentProducts,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all active farmers (public)
 */
export const getFarmers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "20", search } = req.query;
    const filter: Record<string, any> = {
      role: "farmer",
      verificationStatus: "verified",
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { farmName: { $regex: search, $options: "i" } },
        { "farmLocation.village": { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [farmers, total] = await Promise.all([
      User.find(filter)
        .select("name farmName farmLocation cropTypes farmingMethod avatar verificationStatus createdAt")
        .sort("-createdAt")
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      farmers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single farmer profile with products and reviews (public)
 * Returns:
 *   - farmer details
 *   - all products (available first, then out of stock)
 *   - reviews with average rating and counts
 *   - product count stats
 */
export const getFarmer = async (req: Request, res: Response): Promise<void> => {
  try {
    const farmer = await User.findOne({
      _id: req.params.id,
      role: "farmer",
      verificationStatus: "verified",
    }).select("name farmName farmLocation cropTypes farmingMethod avatar verificationStatus createdAt");

    if (!farmer) {
      res.status(404).json({ message: "Farmer not found" });
      return;
    }

    const [products, reviews] = await Promise.all([
      Product.find({ farmer: farmer._id, approvalStatus: "approved" })
        .populate("category", "name slug")
        .sort("-isAvailable -createdAt")
        .lean(),
      Review.find({ farmer: farmer._id })
        .populate("consumer", "name avatar")
        .sort("-createdAt")
        .lean(),
    ]);

    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    }

    // Build rating distribution: [5-star, 4-star, 3-star, 2-star, 1-star]
    const ratingDistribution = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const idx = Math.min(Math.floor(r.rating) - 1, 4);
      if (idx >= 0) ratingDistribution[idx]++;
    });

    res.json({
      farmer,
      products,
      reviews,
      averageRating,
      totalReviews: reviews.length,
      ratingDistribution,
      stats: {
        totalProducts: products.length,
        availableProducts: products.filter((p) => p.isAvailable).length,
        totalReviews: reviews.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get featured/top-rated farmers for homepage
 */
export const getFeaturedFarmers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const farmers = await User.find({
      role: "farmer",
      verificationStatus: "verified",
    })
      .select("name farmName farmLocation cropTypes farmingMethod avatar verificationStatus createdAt")
      .sort("-createdAt")
      .limit(6)
      .lean();

    res.json({ farmers });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Search products and farmers
 * Supports full-text search, pagination, category/organic/price filters, and sorting.
 *
 * Query params:
 *   q           — search term (required for meaningful results)
 *   page        — page number (default 1)
 *   limit       — results per page (default 10, max 50)
 *   category    — category ID to filter products
 *   isOrganic   — "true" / "false" to filter products
 *   minPrice    — minimum price filter
 *   maxPrice    — maximum price filter
 *   sort        — "relevance", "price_asc", "price_desc", "newest" (default "relevance")
 */
export const searchAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      q,
      page = "1",
      limit = "10",
      category,
      isOrganic,
      minPrice,
      maxPrice,
      sort = "relevance",
    } = req.query;

    // Return empty if no query
    if (!q || typeof q !== "string" || !q.trim()) {
      res.json({ products: [], farmers: [], productsTotal: 0, farmersTotal: 0 });
      return;
    }

    const query = q.trim();
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    /* ─── Product filter ───────────────────── */
    const productFilter: Record<string, any> = {
      isAvailable: true,
      approvalStatus: "approved",
    };

    // Full-text search on product name & description
    productFilter.$text = { $search: query };

    if (category) productFilter.category = category;
    if (isOrganic !== undefined) productFilter.isOrganic = isOrganic === "true";
    if (minPrice || maxPrice) {
      productFilter.price = {};
      if (minPrice) productFilter.price.$gte = Number(minPrice);
      if (maxPrice) productFilter.price.$lte = Number(maxPrice);
    }

    // Product sort
    let productSort: Record<string, any> = { score: { $meta: "textScore" } };
    if (sort === "price_asc") productSort = { price: 1 };
    else if (sort === "price_desc") productSort = { price: -1 };
    else if (sort === "newest") productSort = { createdAt: -1 };

    /* ─── Farmer filter ────────────────────── */
    // Use regex for farmer search (covers name, farm, location, crop types)
    const farmerFilter: Record<string, any> = {
      role: "farmer",
      verificationStatus: "verified",
      $or: [
        { name: { $regex: query, $options: "i" } },
        { farmName: { $regex: query, $options: "i" } },
        { "farmLocation.village": { $regex: query, $options: "i" } },
        { "farmLocation.district": { $regex: query, $options: "i" } },
        { "farmLocation.state": { $regex: query, $options: "i" } },
      ],
    };

    /* ─── Execute queries ──────────────────── */
    // Try text-score projection for products (only works with $text query)
    const productsHaveTextSearch = sort === "relevance";

    const productQuery = Product.find(productFilter);
    if (productsHaveTextSearch) {
      productQuery.select({ score: { $meta: "textScore" } });
    }

    const [products, productsTotal, farmers, farmersTotal] = await Promise.all([
      productQuery
        .populate("farmer", "name farmName")
        .populate("category", "name slug")
        .sort(productsHaveTextSearch ? { score: { $meta: "textScore" } } : { createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(productFilter),
      User.find(farmerFilter)
        .select("name farmName avatar farmLocation cropTypes farmingMethod")
        .sort("-createdAt")
        .lean(),
      User.countDocuments(farmerFilter),
    ]);

    res.json({
      products,
      farmers,
      productsTotal,
      farmersTotal,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: productsTotal,
        pages: Math.ceil(productsTotal / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Subscribe to newsletter
 */
export const subscribeToNewsletter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    // Check if already subscribed
    const existing = await Newsletter.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.isActive) {
        res.status(200).json({ message: "You're already subscribed!" });
        return;
      }
      // Re-activate
      existing.isActive = true;
      existing.unsubscribedAt = undefined;
      await existing.save();
      res.json({ message: "Welcome back! You've been re-subscribed." });
      return;
    }

    await Newsletter.create({ email: email.toLowerCase() });
    res.status(201).json({ message: "Thank you for subscribing! Stay tuned for fresh updates." });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
