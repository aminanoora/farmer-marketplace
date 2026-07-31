import { Request, Response } from "express";
import Product from "../models/Product";
import Review from "../models/Review";

/**
 * Get all available products (public — for consumers)
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      farmer,
      isOrganic,
      minPrice,
      maxPrice,
      search,
      page = "1",
      limit = "20",
    } = req.query;

    const filter: Record<string, any> = {
      isAvailable: true,
      // Only admin-approved products are visible on the public marketplace
      approvalStatus: "approved",
    };

    if (category) filter.category = category;
    if (farmer) filter.farmer = farmer;
    if (isOrganic !== undefined) filter.isOrganic = isOrganic === "true";
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$text = { $search: search as string };
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (req.query.sort === "price_asc") sortObj = { price: 1 };
    else if (req.query.sort === "price_desc") sortObj = { price: -1 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("farmer", "name farmName farmLocation farmingMethod avatar")
        .populate("category", "name slug")
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.json({
      products,
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
 * Get single product by ID — returns comprehensive details including
 * reviews, average rating, rating distribution, and related products.
 */
export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // First fetch the product (we need its category for related products)
    const product = await Product.findById(id)
      .populate("farmer", "name farmName farmLocation farmingMethod avatar")
      .populate("category", "name slug");

    if (!product || product.approvalStatus !== "approved") {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // Now fetch reviews and related products in parallel using the product's category
    const categoryId = product.category?._id;
    const [reviews, relatedProducts] = await Promise.all([
      Review.find({ product: id })
        .populate("consumer", "name avatar")
        .sort("-createdAt"),

      Product.find({
        _id: { $ne: id },
        ...(categoryId ? { category: categoryId } : {}),
        isAvailable: true,
        approvalStatus: "approved",
      })
        .populate("farmer", "name farmName")
        .limit(4)
        .sort("-createdAt"),
    ]);

    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      averageRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    }

    // Build rating distribution: [5-star, 4-star, 3-star, 2-star, 1-star]
    const ratingDistribution = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const idx = Math.min(Math.floor(r.rating) - 1, 4);
      if (idx >= 0) ratingDistribution[idx]++;
    });

    res.json({
      product,
      reviews,
      averageRating,
      totalReviews: reviews.length,
      ratingDistribution,
      relatedProducts,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
