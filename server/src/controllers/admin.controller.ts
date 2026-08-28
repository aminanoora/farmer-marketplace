import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { env } from "../config/env";
import Product from "../models/Product";
import Order from "../models/Order";
import Review from "../models/Review";
import Category from "../models/Category";
import Transaction from "../models/Transaction";
import { AuthRequest } from "../middleware/auth.middleware";
import { validateStatusTransition, OrderStatus } from "../utils/orderStatus";
import { getErrorMessage } from "../utils/response";
import { escapeRegex } from "../utils/sanitize";
import PlatformSettings from "../models/PlatformSettings";
import { resetMaintenanceCache } from "../middleware/maintenance.middleware";

/* ─── Get Admin User (for session restoration) ── */
export const getAdminMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    res.json({ user: user.toJSON() });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Admin Login ─────────────────────────────── */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required." });
      return;
    }

    const user = await User.findOne({ email: email.trim() });
    if (!user) {
      res.status(401).json({ message: "Invalid admin credentials." });
      return;
    }

    if (user.role !== "admin") {
      res.status(403).json({ message: "Access denied. Admin privileges required." });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: "Account has been deactivated." });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid admin credentials." });
      return;
    }

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn } as jwt.SignOptions
    );

    res.json({
      message: "Admin login successful",
      token,
      user: user.toJSON(),
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) || "Admin login failed" });
  }
};

/* ─── Dashboard ───────────────────────────────── */
export const getDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalFarmers, totalConsumers, totalProducts, totalOrders] =
      await Promise.all([
        User.countDocuments({ role: "farmer" }),
        User.countDocuments({ role: "consumer" }),
        Product.countDocuments(),
        Order.countDocuments(),
      ]);

    const pendingVerifications = await User.countDocuments({
      role: "farmer",
      verificationStatus: "pending",
    });

    res.json({
      stats: {
        totalFarmers,
        totalConsumers,
        totalProducts,
        totalOrders,
        pendingVerifications,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Dashboard Overview (consolidated) ──────── */
export const getDashboardOverview = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalFarmers,
      totalConsumers,
      totalProducts,
      totalOrders,
      pendingVerifications,
      newFarmersThisMonth,
      totalRevenueResult,
      latestOrders,
    ] = await Promise.all([
      User.countDocuments({ role: "farmer" }),
      User.countDocuments({ role: "consumer" }),
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments({ role: "farmer", verificationStatus: "pending" }),
      // Farmers registered this month
      User.countDocuments({
        role: "farmer",
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      }),
      // Total revenue from delivered orders
      Order.aggregate([
        { $match: { status: "delivered" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      // Latest 6 orders with consumer and farmer populated
      Order.find()
        .populate("consumer", "name email")
        .populate("farmer", "name farmName")
        .sort("-createdAt")
        .limit(6)
        .lean(),
    ]);

    const totalRevenue = totalRevenueResult[0]?.total || 0;
    const activeOrders = await Order.countDocuments({
      status: { $in: ["confirmed", "preparing", "out-for-delivery"] },
    });

    res.json({
      stats: {
        totalFarmers,
        totalConsumers,
        totalProducts,
        totalOrders,
        pendingVerifications,
        newFarmersThisMonth,
        totalRevenue,
        activeOrders,
      },
      latestOrders,
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Dashboard Transactions (payout overview) ── */
export const getDashboardTransactions = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalCommissionResult,
      processedResult,
      pendingResult,
      recentTransactions,
      topFarmersByPayout,
    ] = await Promise.all([
      // Total commission earned across all transactions
      Transaction.aggregate([
        { $group: { _id: null, total: { $sum: "$commissionAmount" }, count: { $sum: 1 } } },
      ]),
      // Processed payouts
      Transaction.aggregate([
        { $match: { status: "processed" } },
        { $group: { _id: null, total: { $sum: "$farmerPayout" }, count: { $sum: 1 } } },
      ]),
      // Pending payouts
      Transaction.aggregate([
        { $match: { status: "pending" } },
        { $group: { _id: null, total: { $sum: "$farmerPayout" }, count: { $sum: 1 } } },
      ]),
      // Recent 10 transactions with farmer info
      Transaction.find()
        .populate("farmer", "name farmName")
        .populate("consumer", "name")
        .sort("-createdAt")
        .limit(10)
        .lean(),
      // Top 5 farmers by pending payout
      Transaction.aggregate([
        { $match: { status: "pending" } },
        { $group: { _id: "$farmer", pendingPayout: { $sum: "$farmerPayout" }, orderCount: { $sum: 1 } } },
        { $sort: { pendingPayout: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: "$farmer" },
        {
          $project: {
            farmerName: "$farmer.name",
            farmName: "$farmer.farmName",
            pendingPayout: 1,
            orderCount: 1,
          },
        },
      ]),
    ]);

    const platformSettings = await PlatformSettings.findOne().lean();
    const commissionPercent = platformSettings?.commissionPercent ?? 5;

    res.json({
      summary: {
        totalCommission: totalCommissionResult[0]?.total || 0,
        totalTransactions: totalCommissionResult[0]?.count || 0,
        processedPayouts: processedResult[0]?.total || 0,
        processedCount: processedResult[0]?.count || 0,
        pendingPayouts: pendingResult[0]?.total || 0,
        pendingCount: pendingResult[0]?.count || 0,
        commissionPercent,
      },
      recentTransactions,
      topFarmersByPayout,
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Users Management (full search / filter / sort / paginate) ── */
export const getFarmers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      role,
      status,
      sort = "-createdAt",
      page = "1",
      limit = "10",
    } = req.query as Record<string, string>;

    // Build filter
    const filter: Record<string, unknown> = {};

    // Role filter — "all" or omitted means no role filter
    if (role && role !== "all") {
      filter.role = role;
    }

    // Status filter — "all" or omitted means no status filter
    if (status && status !== "all") {
      if (status === "active") {
        filter.isActive = true;
      } else if (status === "suspended") {
        filter.isActive = false;
      } else if (status === "pending" || status === "approved" || status === "rejected") {
        // Verification status only applies to farmers (consumers default to "pending")
        filter.role = "farmer";
        filter.verificationStatus =
          status === "approved" ? "verified" : status;
      }
    }

    // Search filter
    if (search && search.trim()) {
      const q = escapeRegex(search.trim());
      const searchRegex = { $regex: q, $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { farmName: searchRegex },
      ];
    }

    // Parse sort
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort) {
      const sortField = sort.replace(/^[-+]/, "");
      const sortDir = sort.startsWith("-") ? -1 : 1;
      const allowedFields = ["createdAt", "name", "email", "role"];
      if (allowedFields.includes(sortField)) {
        sortObj = { [sortField]: sortDir };
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Run queries in parallel
    const [users, totalFiltered, totalUsers, activeFarmers, new24h] =
      await Promise.all([
        User.find(filter)
          .select("-password")
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(filter),
        User.countDocuments(),
        User.countDocuments({ role: "farmer", isActive: true }),
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
      ]);

    const totalPages = Math.ceil(totalFiltered / limitNum);

    res.json({
      users,
      stats: {
        totalUsers,
        activeFarmers,
        new24h,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFiltered,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const approveFarmer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const farmer = await User.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: "verified" },
      { new: true }
    );
    if (!farmer) {
      res.status(404).json({ message: "Farmer not found" });
      return;
    }
    res.json({ farmer: farmer.toJSON(), message: "Farmer approved successfully" });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const rejectFarmer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const farmer = await User.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: "rejected" },
      { new: true }
    );
    if (!farmer) {
      res.status(404).json({ message: "Farmer not found" });
      return;
    }
    res.json({ farmer: farmer.toJSON(), message: "Farmer rejected" });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Categories ──────────────────────────────── */
export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, slug, description, icon } = req.body;

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Category name is required." });
      return;
    }
    if (!slug || typeof slug !== "string" || !slug.trim()) {
      res.status(400).json({ message: "Category slug is required." });
      return;
    }

    // Validate slug format: lowercase alphanumeric with hyphens only
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug.trim())) {
      res.status(400).json({
        message: "Slug must be lowercase alphanumeric with hyphens (e.g., 'fresh-vegetables').",
      });
      return;
    }

    // Check for duplicate name or slug
    const existing = await Category.findOne({
      $or: [{ name: name.trim() }, { slug: slug.trim() }],
    });
    if (existing) {
      res.status(400).json({
        message: existing.name === name.trim()
          ? `Category "${name.trim()}" already exists.`
          : `Slug "${slug.trim()}" is already in use.`,
      });
      return;
    }

    const category = new Category({
      name: name.trim(),
      slug: slug.trim(),
      description: description?.trim() || undefined,
      icon: icon?.trim() || undefined,
    });
    await category.save();
    res.status(201).json({ category });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Orders (with full backend search/filter/sort/paginate) ── */
export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      dateFrom,
      dateTo,
      sort = "-createdAt",
      page = "1",
      limit = "10",
    } = req.query as Record<string, string>;

    // Build the base filter
    const filter: Record<string, unknown> = {};

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const dateRange: { $gte?: Date; $lte?: Date } = {};
      if (dateFrom) dateRange.$gte = new Date(dateFrom);
      if (dateTo) dateRange.$lte = new Date(dateTo);
      filter.createdAt = dateRange;
    }

    // Search filter — match customer name, farm name, or exact order ID.
    if (search && search.trim()) {
      const q = search.trim();
      // Find users whose name or farmName matches (case-insensitive)
      const safeQ = escapeRegex(q);
      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: safeQ, $options: "i" } },
          { farmName: { $regex: safeQ, $options: "i" } },
        ],
      }).select("_id").lean();

      const userIds = matchedUsers.map((u) => u._id);

      // Check if the search term is a valid 24-char hex string (ObjectId).
      // If so, allow an exact _id lookup — no regex, no ReDoS risk.
      const trimmedSearch = q.replace(/^#ORD-/i, "");
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(trimmedSearch);

      const orClauses: Record<string, unknown>[] = [];
      if (userIds.length > 0) {
        orClauses.push({ consumer: { $in: userIds } });
        orClauses.push({ farmer: { $in: userIds } });
      }
      if (isObjectId) {
        orClauses.push({ _id: trimmedSearch });
      }

      // If nothing matched, add an impossible condition so zero results
      // are returned instead of leaking all orders.
      if (orClauses.length === 0) {
        orClauses.push({ _id: null });
      }

      filter.$or = orClauses;
    }

    // Parse sort parameter
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort) {
      const sortField = sort.replace(/^[-+]/, "");
      const sortDir = sort.startsWith("-") ? -1 : 1;
      const allowedSortFields = ["createdAt", "totalAmount", "status"];
      if (allowedSortFields.includes(sortField)) {
        sortObj = { [sortField]: sortDir };
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Run queries in parallel
    const [orders, totalFiltered, totalOrders, pendingCount, revenueResult, urgentCount] =
      await Promise.all([
        Order.find(filter)
          .populate("consumer", "name email")
          .populate("farmer", "name farmName")
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Order.countDocuments(filter),
        Order.countDocuments(),
        Order.countDocuments({ status: { $in: ["pending", "confirmed", "preparing"] } }),
        Order.aggregate([
          { $match: { status: "delivered" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Order.countDocuments({
          status: "pending",
          createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        }),
      ]);

    const totalPages = Math.ceil(totalFiltered / limitNum);

    res.json({
      orders,
      stats: {
        totalOrders,
        pendingFulfillment: pendingCount,
        urgentCount,
        revenuePeriod: revenueResult[0]?.total || 0,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFiltered,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Update Order Status ──────────────────────── */
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const validStatuses: OrderStatus[] = ["pending", "confirmed", "preparing", "out-for-delivery", "delivered", "cancelled"];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ message: "Invalid status value." });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // Validate the transition
    const transitionError = validateStatusTransition(
      order.status as OrderStatus,
      status as OrderStatus,
      "admin"
    );
    if (transitionError) {
      res.status(400).json({ message: transitionError });
      return;
    }

    order.status = status;
    await order.save();

    // Restore stock when admin cancels an order
    if (status === "cancelled") {
      await Product.bulkWrite(
        order.items.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { quantity: item.quantity } },
          },
        }))
      );
    }

    // Populate the saved document in-place to avoid a second query
    await order.populate([
      { path: "farmer", select: "name farmName phone email" },
      { path: "consumer", select: "name phone email" },
      { path: "items.product", select: "name images" },
    ]);

    // Notify consumer of status change (best-effort)
    try {
      const { sendOrderStatusUpdateEmail, sendOrderCancelledByFarmerEmail } = await import("../utils/email");
      const populatedOrder = order as unknown as { consumer: { name: string; email: string }; farmer: { name: string } };
      if (populatedOrder.consumer?.email) {
        const farmerName = populatedOrder.farmer?.name || "Farmer";
        if (status === "cancelled") {
          await sendOrderCancelledByFarmerEmail(populatedOrder.consumer.email, populatedOrder.consumer.name, order._id.toString(), farmerName);
        } else {
          await sendOrderStatusUpdateEmail(populatedOrder.consumer.email, populatedOrder.consumer.name, order._id.toString(), status, farmerName);
        }
      }
    } catch (emailError) {
      console.error("[Admin] Failed to send order status email:", emailError);
    }

    res.json({ order });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Get Single Order ────────────────────────── */
export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("farmer", "name farmName phone email")
      .populate("consumer", "name phone email")
      .populate("items.product", "name images")
      .lean();

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.json({ order });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Get Single User (with products if farmer) ─── */
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    let products: Awaited<ReturnType<typeof Product.find>> = [];
    if (user.role === "farmer") {
      // Admin review view: return all of the farmer's products (pending/approved/rejected)
      products = await Product.find({ farmer: user._id })
        .populate("category", "name")
        .sort("-createdAt")
        .lean();
    }

    // Count user's orders
    const orderCount = await Order.countDocuments({
      $or: [{ consumer: user._id }, { farmer: user._id }],
    });

    res.json({ user, products, orderCount });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Toggle User Active Status (Block/Unblock) ── */
export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({ message: "isActive boolean field is required." });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Prevent deactivating admins
    if (user.role === "admin" && !isActive) {
      res.status(403).json({ message: "Cannot deactivate an admin account." });
      return;
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      user: user.toJSON(),
      message: isActive ? "User has been activated." : "User has been blocked/suspended.",
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Update Order Details (Tracking ID + Notes) ── */
export const updateOrderDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { trackingId, notes } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    if (trackingId !== undefined) order.trackingId = trackingId;
    if (notes !== undefined) order.notes = notes;

    await order.save();

    await order.populate([
      { path: "farmer", select: "name farmName phone email" },
      { path: "consumer", select: "name phone email" },
      { path: "items.product", select: "name images" },
    ]);

    res.json({ order });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Toggle Product Availability (Approve/Reject) ── */
export const toggleProductStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== "boolean") {
      res.status(400).json({ message: "isAvailable boolean field is required." });
      return;
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    product.isAvailable = isAvailable;

    // Making a product visible via the status toggle is an implicit approval:
    // resolve any pending/rejected approval status so the farmer view, admin
    // review queue, and marketplace visibility all stay in sync.
    if (isAvailable && product.approvalStatus !== "approved") {
      product.approvalStatus = "approved";
    }

    await product.save();

    res.json({
      product,
      message: isAvailable ? "Product approved and is now visible on the platform." : "Product has been hidden from the platform.",
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Products (full backend search/filter/sort/paginate) ── */
export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,      // "all" | "approved" | "pending" | "rejected"
      approvalStatus, // direct approvalStatus filter (pending/approved/rejected)
      category,
      sort = "-createdAt",
      page = "1",
      limit = "10",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    // Approval status filter (takes precedence over legacy status filter)
    if (approvalStatus && approvalStatus !== "all") {
      filter.approvalStatus = approvalStatus;
    } else if (status && status !== "all") {
      filter.approvalStatus = status === "approved" ? "approved" : "pending";
    }

    // Category filter
    if (category && category !== "all") {
      filter.category = category;
    }

    // Search by product name or farmer name (via lookup)
    if (search && search.trim()) {
      const q = escapeRegex(search.trim());
      const searchRegex = { $regex: q, $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
      ];
    }

    // Sort
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort) {
      const sortField = sort.replace(/^[-+]/, "");
      const sortDir = sort.startsWith("-") ? -1 : 1;
      const allowedSortFields = ["createdAt", "name", "price", "quantity"];
      if (allowedSortFields.includes(sortField)) {
        sortObj = { [sortField]: sortDir };
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Run queries in parallel
    const [products, totalFiltered, totalProducts, pendingCount, approvedCount, rejectedCount, categories] =
      await Promise.all([
        Product.find(filter)
          .populate("farmer", "name farmName")
          .populate("category", "name")
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(filter),
        Product.countDocuments(),
        Product.countDocuments({ approvalStatus: "pending" }),
        Product.countDocuments({ approvalStatus: "approved" }),
        Product.countDocuments({ approvalStatus: "rejected" }),
        Category.find().select("name").lean(),
      ]);

    const totalPages = Math.ceil(totalFiltered / limitNum);

    res.json({
      products,
      stats: {
        totalProducts,
        pendingCount,
        approvedCount,
        rejectedCount,
      },
      categories,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFiltered,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Get Single Product (admin detail view) ──── */
export const getProductById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("farmer", "name farmName avatar phone email farmLocation verificationStatus isActive")
      .populate("category", "name slug icon description")
      .lean();

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // Review stats for this product
    const [reviewAgg, orderAgg] = await Promise.all([
      Review.aggregate([
        { $match: { product: product._id } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgRating: { $avg: "$rating" },
          },
        },
      ]),
      Order.aggregate([
        { $match: { "items.product": product._id } },
        { $unwind: "$items" },
        { $match: { "items.product": product._id } },
        {
          $group: {
            _id: null,
            // Distinct order IDs (not item rows) — an order may contain
            // several lines of the same product.
            orderIds: { $addToSet: "$_id" },
            timesOrdered: { $sum: "$items.quantity" },
            revenue: {
              $sum: { $multiply: ["$items.price", "$items.quantity"] },
            },
          },
        },
      ]),
    ]);

    const orderStats = orderAgg[0];

    res.json({
      product,
      reviews: {
        count: reviewAgg[0]?.count || 0,
        avgRating: reviewAgg[0]?.avgRating || 0,
      },
      orders: {
        timesOrdered: orderStats?.timesOrdered || 0,
        totalOrders: orderStats?.orderIds?.length || 0,
        revenue: orderStats?.revenue || 0,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Approve Product ─────────────────────────── */
export const approveProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: "approved", isAvailable: true },
      { new: true }
    );
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json({
      product,
      message: "Product has been approved and is now visible on the platform.",
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Reject Product ──────────────────────────── */
export const rejectProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: "rejected", isAvailable: false },
      { new: true }
    );
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json({
      product,
      message: "Product has been rejected and is hidden from the platform.",
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Analytics ───────────────────────────────── */
export const getAnalytics = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalRevenueResult, topFarmersResult, categoryDistribution] =
      await Promise.all([
        Order.aggregate([
          { $match: { status: "delivered" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Order.aggregate([
          { $group: { _id: "$farmer", revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "farmer",
            },
          },
          { $unwind: "$farmer" },
          {
            $project: {
              farmerName: "$farmer.name",
              farmName: "$farmer.farmName",
              revenue: 1,
              orders: 1,
            },
          },
        ]),
        Product.aggregate([
          { $group: { _id: "$category", count: { $sum: 1 } } },
          {
            $lookup: {
              from: "categories",
              localField: "_id",
              foreignField: "_id",
              as: "category",
            },
          },
          { $unwind: "$category" },
          { $project: { categoryName: "$category.name", count: 1 } },
        ]),
      ]);

    res.json({
      totalRevenue: totalRevenueResult[0]?.total || 0,
      topFarmers: topFarmersResult,
      categoryDistribution,
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/* ─── Platform Settings ─────────────────────────── */

/** GET /api/admin/settings — retrieve platform settings */
export const getSettings = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = await PlatformSettings.create({});
    }
    res.json({ settings });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/** PATCH /api/admin/settings — update platform settings (partial) */
export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = [
      "commissionPercent",
      "minPayoutThreshold",
      "maxDeliveryRadiusKm",
      "supportEmail",
      "supportPhone",
      "aboutUs",
      "termsUrl",
      "privacyUrl",
      "isPlatformActive",
      "maintenanceMode",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No valid fields to update" });
      return;
    }

    updates.updatedBy = req.user?._id;

    const settings = await PlatformSettings.findOneAndUpdate({}, updates, {
      new: true,
      upsert: true,
    });

    // Reset maintenance mode cache so the change takes effect immediately
    if ("maintenanceMode" in updates) {
      resetMaintenanceCache();
    }

    res.json({ message: "Settings updated", settings });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};
