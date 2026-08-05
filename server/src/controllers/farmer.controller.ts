import { Response } from "express";
import User from "../models/User";
import Product from "../models/Product";
import Order from "../models/Order";
import { AuthRequest } from "../middleware/auth.middleware";
import { uploadFilesToBlob, deleteBlobs } from "../middleware/upload.middleware";

/* ─── Profile ─────────────────────────────────── */
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const farmer = await User.findById(req.user?._id)
      .select("-password -resetPasswordToken -resetPasswordExpires");
    if (!farmer) {
      res.status(404).json({ message: "Farmer not found" });
      return;
    }
    res.json({ farmer: farmer.toJSON() });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = [
      "name", "phone", "farmName", "farmLocation",
      "cropTypes", "farmingMethod", "avatar",
      "description", "bankDetails", "payoutMethod",
      "notificationSettings",
    ];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const farmer = await User.findByIdAndUpdate(req.user?._id, updates, {
      new: true,
      runValidators: true,
    });

    if (!farmer) {
      res.status(404).json({ message: "Farmer not found" });
      return;
    }

    res.json({ farmer: farmer.toJSON() });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─── Products ────────────────────────────────── */

/**
 * Resolve the farmer and ensure they are allowed to manage products.
 * Only active, admin-verified farmers may add/update/delete products.
 * Returns the farmer document or sends a 403 and returns null.
 */
async function requireVerifiedFarmer(req: AuthRequest, res: Response) {
  const farmer = await User.findById(req.user?._id).select("verificationStatus isActive");
  if (!farmer || !farmer.isActive) {
    res.status(403).json({ message: "Your account is inactive. Please contact support." });
    return null;
  }
  if (farmer.verificationStatus !== "verified") {
    res.status(403).json({
      message:
        farmer.verificationStatus === "rejected"
          ? "Your farmer account was rejected. You cannot manage products."
          : "Your farmer account is pending admin approval. You can manage products once approved.",
    });
    return null;
  }
  return farmer;
}

export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      sort = "-createdAt",
      page = "1",
      limit = "20",
      status, // "active" | "inactive" | "lowStock" | "outOfStock"
      category,
    } = req.query;

    const filter: Record<string, any> = { farmer: req.user?._id };

    // Text search across name & description
    if (search && typeof search === "string" && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Category filter
    if (category && category !== "all") {
      filter.category = category;
    }

    // Stock status filter
    if (status === "active") filter.isAvailable = true;
    else if (status === "inactive") filter.isAvailable = false;
    else if (status === "lowStock") {
      filter.isAvailable = true;
      filter.quantity = { $gt: 0, $lte: 20 };
    }
    else if (status === "outOfStock") filter.quantity = 0;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      "-createdAt": { createdAt: -1 },
      "createdAt": { createdAt: 1 },
      "-price": { price: -1 },
      "price": { price: 1 },
      "name": { name: 1 },
      "-name": { name: -1 },
      "-quantity": { quantity: -1 },
      "quantity": { quantity: 1 },
    };
    const sortObj = sortMap[sort as string] || { createdAt: -1 };

    const [products, total, allProducts] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug icon")
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
      // Get all products for the farmer (for stats)
      Product.find({ farmer: req.user?._id }),
    ]);

    // Compute stats
    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter((p) => p.isAvailable);
    const lowStockProducts = allProducts.filter(
      (p) => p.isAvailable && p.quantity > 0 && p.quantity <= 20
    );
    const outOfStockProducts = allProducts.filter((p) => p.quantity <= 0);
    const pendingProducts = allProducts.filter(
      (p) => p.approvalStatus === "pending"
    );

    res.json({
      products,
      stats: {
        totalProducts,
        activeProducts: activeProducts.length,
        lowStockProducts: lowStockProducts.length,
        outOfStockProducts: outOfStockProducts.length,
        pendingProducts: pendingProducts.length,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      farmer: req.user?._id,
    })
      .populate("category", "name slug icon description")
      .populate("farmer", "name farmName farmLocation farmingMethod avatar phone email");

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.json({ product });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Only verified farmers may list products on the platform
    const farmer = await requireVerifiedFarmer(req, res);
    if (!farmer) return;

    const productData: Record<string, any> = { ...req.body };

    // Handle uploaded files — images are stored on Vercel Blob, so each entry
    // is an absolute public URL (serverless functions have no persistent disk).
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const files = req.files as Express.Multer.File[];
      productData.images = await uploadFilesToBlob(files);
    } else {
      // Never trust an "images" field in the request body — the only valid
      // source is multipart file uploads. Prevents confusing CastErrors like
      // `images.0: Cast to [string] failed for value "[ {}, {} ]"`.
      delete productData.images;
    }

    // Set approval status — new products start as pending
    productData.approvalStatus = "pending";

    // If isAvailable was sent, keep it (farmer might want to hide initially)
    // But pending products won't show on the public marketplace regardless

    const product = new Product({
      ...productData,
      farmer: req.user?._id,
    });
    await product.save();
    res.status(201).json({ product });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Only verified farmers may manage products
    const farmer = await requireVerifiedFarmer(req, res);
    if (!farmer) return;

    const product = await Product.findOne({
      _id: req.params.id,
      farmer: req.user?._id,
    });
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const updates: Record<string, any> = {};

    // Simple field updates
    const textFields = ["name", "description", "unit", "harvestDate", "seoDescription"];
    for (const field of textFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Numeric fields
    if (req.body.price !== undefined) updates.price = Number(req.body.price);
    if (req.body.quantity !== undefined) updates.quantity = Number(req.body.quantity);
    if (req.body.discountPrice !== undefined) updates.discountPrice = Number(req.body.discountPrice);

    // Boolean fields (handle both JSON boolean and FormData string)
    if (req.body.isOrganic !== undefined) {
      updates.isOrganic = typeof req.body.isOrganic === "boolean"
        ? req.body.isOrganic : req.body.isOrganic === "true";
    }
    if (req.body.isAvailable !== undefined) {
      updates.isAvailable = typeof req.body.isAvailable === "boolean"
        ? req.body.isAvailable : req.body.isAvailable === "true";
    }
    if (req.body.isFeatured !== undefined) {
      updates.isFeatured = typeof req.body.isFeatured === "boolean"
        ? req.body.isFeatured : req.body.isFeatured === "true";
    }

    // Category
    if (req.body.category !== undefined) updates.category = req.body.category;

    // Handle images
    let updatedImages: string[] = [];

    // Keep existing images that the user wants to keep
    if (req.body.existingImages) {
      try {
        const parsed = JSON.parse(req.body.existingImages);
        if (Array.isArray(parsed)) {
          updatedImages = parsed;
        }
      } catch {
        // If parsing fails, keep current images
        updatedImages = product.images || [];
      }
    } else {
      // If no existingImages sent, keep current images
      updatedImages = product.images || [];
    }

    // Add newly uploaded images (uploaded to Vercel Blob, absolute URLs)
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const files = req.files as Express.Multer.File[];
      const newImagePaths = await uploadFilesToBlob(files);
      updatedImages = [...updatedImages, ...newImagePaths].slice(0, 4);
    }

    updates.images = updatedImages;

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // Delete Blob objects for images the farmer removed (best-effort)
    const removedImages = (product.images || []).filter(
      (img) => !updatedImages.includes(img)
    );
    if (removedImages.length > 0) {
      await deleteBlobs(removedImages).catch((err) =>
        console.error("[Blob] Failed to delete removed images:", err)
      );
    }

    res.json({ product: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Only verified farmers may manage products
    const farmer = await requireVerifiedFarmer(req, res);
    if (!farmer) return;

    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      farmer: req.user?._id,
    });
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // Clean up the product's images on Vercel Blob (best-effort)
    if (product.images && product.images.length > 0) {
      await deleteBlobs(product.images).catch((err) =>
        console.error("[Blob] Failed to delete product images:", err)
      );
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─── Orders ──────────────────────────────────── */
export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ farmer: req.user?._id })
      .populate("consumer", "name phone")
      .sort("-createdAt");
    res.json({ orders });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, farmer: req.user?._id },
      { status },
      { new: true }
    );
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
/* ─── Change Password ─────────────────────────── */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current password and new password are required." });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters." });
      return;
    }

    const user = await User.findById(req.user?._id).select("+password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ message: "Current password is incorrect." });
      return;
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─── Earnings ────────────────────────────────── */
export const getEarnings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Use aggregation for fast server-side sum — no need to load all documents
    const [result] = await Order.aggregate([
      { $match: { farmer: req.user?._id, status: { $in: ["delivered", "out-for-delivery"] } } },
      { $group: { _id: null, earnings: { $sum: "$totalAmount" }, totalOrders: { $sum: 1 } } },
    ]);

    res.json({
      earnings: result?.earnings || 0,
      totalOrders: result?.totalOrders || 0,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
