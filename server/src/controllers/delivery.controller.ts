import { Response } from "express";
import Delivery from "../models/Delivery";
import Order from "../models/Order";
import { AuthRequest } from "../middleware/auth.middleware";
import { getErrorMessage } from "../utils/response";

/**
 * Delivery status transition map — only forward transitions allowed.
 */
const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  assigned: ["picked-up"],
  "picked-up": ["in-transit"],
  "in-transit": ["delivered", "failed"],
  delivered: [],
  failed: [],
};

/**
 * Admin: Create a delivery assignment for an order.
 */
export const createDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId, partnerName, partnerPhone, vehicleNumber, estimatedDelivery, pickupLocation } = req.body;

    if (!orderId || !partnerName || !partnerPhone || !estimatedDelivery) {
      res.status(400).json({ message: "orderId, partnerName, partnerPhone, and estimatedDelivery are required." });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: "Order not found." });
      return;
    }

    // Check if delivery already exists for this order
    const existing = await Delivery.findOne({ order: orderId });
    if (existing) {
      res.status(400).json({ message: "A delivery already exists for this order." });
      return;
    }

    const delivery = new Delivery({
      order: orderId,
      partnerName: partnerName.trim(),
      partnerPhone: partnerPhone.trim(),
      vehicleNumber: vehicleNumber?.trim(),
      estimatedDelivery: new Date(estimatedDelivery),
      pickupLocation: pickupLocation?.trim(),
      deliveryLocation: order.deliveryAddress,
      status: "assigned",
    });

    await delivery.save();

    // Update order with tracking ID
    order.trackingId = delivery._id.toString();
    await order.save();

    res.status(201).json({ delivery, message: "Delivery assigned successfully." });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Admin: Get all deliveries with filtering and pagination.
 */
export const getDeliveries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      search,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const matchedUsers = await import("../models/User").then((m) =>
        m.default.find({
          $or: [
            { name: { $regex: q, $options: "i" } },
          ],
        }).select("_id").lean()
      );
      const userIds = matchedUsers.map((u) => u._id);
      if (userIds.length > 0) {
        const orderIds = await Order.find({ $or: [{ consumer: { $in: userIds } }, { farmer: { $in: userIds } }] }).select("_id").lean();
        filter.order = { $in: orderIds.map((o) => o._id) };
      } else {
        filter.partnerName = { $regex: q, $options: "i" };
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [deliveries, total, statusCounts] = await Promise.all([
      Delivery.find(filter)
        .populate({
          path: "order",
          select: "totalAmount status consumer farmer deliveryAddress",
          populate: [
            { path: "consumer", select: "name phone" },
            { path: "farmer", select: "name farmName" },
          ],
        })
        .sort("-createdAt")
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Delivery.countDocuments(filter),
      Delivery.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const counts: Record<string, number> = { assigned: 0, "picked-up": 0, "in-transit": 0, delivered: 0, failed: 0 };
    statusCounts.forEach((s: { _id: string; count: number }) => { counts[s._id] = s.count; });

    res.json({
      deliveries,
      stats: { totalDeliveries: total, byStatus: counts },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Admin or Farmer: Get a single delivery by ID.
 */
export const getDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate({
        path: "order",
        populate: [
          { path: "consumer", select: "name phone email" },
          { path: "farmer", select: "name farmName phone" },
          { path: "items.product", select: "name images" },
        ],
      })
      .lean();

    if (!delivery) {
      res.status(404).json({ message: "Delivery not found." });
      return;
    }

    res.json({ delivery });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Admin: Update delivery status with transition validation.
 */
export const updateDeliveryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, trackingNotes, actualDelivery } = req.body;

    if (!status) {
      res.status(400).json({ message: "Status is required." });
      return;
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      res.status(404).json({ message: "Delivery not found." });
      return;
    }

    // Validate transition
    const allowed = DELIVERY_TRANSITIONS[delivery.status] || [];
    if (!allowed.includes(status)) {
      res.status(400).json({
        message: `Cannot transition from "${delivery.status}" to "${status}". Allowed: ${allowed.join(", ") || "(none — terminal state)"}`,
      });
      return;
    }

    delivery.status = status;
    if (trackingNotes) delivery.trackingNotes = trackingNotes;
    if (status === "delivered") {
      delivery.actualDelivery = actualDelivery ? new Date(actualDelivery) : new Date();
    }

    await delivery.save();

    // Sync order status based on delivery status
    const order = await Order.findById(delivery.order);
    if (order) {
      if (status === "picked-up" || status === "in-transit") {
        if (order.status === "confirmed" || order.status === "preparing") {
          order.status = "out-for-delivery";
          await order.save();
        }
      } else if (status === "delivered") {
        if (order.status !== "delivered") {
          order.status = "delivered";
          order.paymentStatus = "paid";
          await order.save();
        }
      } else if (status === "failed") {
        // Restore stock on failed delivery
        for (const item of order.items) {
          const product = await import("../models/Product").then((m) => m.default.findById(item.product));
          if (product) {
            product.quantity += item.quantity;
            await product.save();
          }
        }
      }
    }

    res.json({ delivery, message: `Delivery status updated to "${status}".` });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Admin: Update delivery details (partner info, estimated time, notes).
 */
export const updateDeliveryDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { partnerName, partnerPhone, vehicleNumber, estimatedDelivery, trackingNotes, pickupLocation } = req.body;

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      res.status(404).json({ message: "Delivery not found." });
      return;
    }

    if (partnerName !== undefined) delivery.partnerName = partnerName;
    if (partnerPhone !== undefined) delivery.partnerPhone = partnerPhone;
    if (vehicleNumber !== undefined) delivery.vehicleNumber = vehicleNumber;
    if (estimatedDelivery !== undefined) delivery.estimatedDelivery = new Date(estimatedDelivery);
    if (trackingNotes !== undefined) delivery.trackingNotes = trackingNotes;
    if (pickupLocation !== undefined) delivery.pickupLocation = pickupLocation;

    await delivery.save();
    res.json({ delivery, message: "Delivery details updated." });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Admin: Delete a delivery assignment.
 */
export const deleteDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const delivery = await Delivery.findByIdAndDelete(req.params.id);
    if (!delivery) {
      res.status(404).json({ message: "Delivery not found." });
      return;
    }
    res.json({ message: "Delivery deleted successfully." });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Consumer or Farmer: Get delivery status for an order (public tracking).
 */
export const getOrderDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const delivery = await Delivery.findOne({ order: req.params.orderId })
      .select("status partnerName vehicleNumber estimatedDelivery actualDelivery trackingNotes createdAt")
      .lean();

    if (!delivery) {
      res.status(404).json({ message: "No delivery tracking found for this order." });
      return;
    }

    res.json({ delivery });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};
