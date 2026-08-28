import { Response } from "express";
import Order from "../models/Order";
import Product from "../models/Product";
import Transaction from "../models/Transaction";
import PlatformSettings from "../models/PlatformSettings";
import { AuthRequest } from "../middleware/auth.middleware";
import { getErrorMessage } from "../utils/response";
import { sendOrderPlacedEmails } from "../utils/email";
import User from "../models/User";

/**
 * Place a new order (consumer)
 */
export const placeOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, deliverySlot, deliveryAddress, notes, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      res.status(400).json({ message: "Order must contain at least one item" });
      return;
    }

    // Batch-fetch all products in a single query instead of N individual lookups
    const productIds = items.map((item: { productId: string }) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // Validate all products and calculate total
    let totalAmount = 0;
    const orderItems = [];
    const farmerIds = new Set<string>();

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        res.status(404).json({ message: `Product ${item.productId} not found` });
        return;
      }
      if (product.quantity < item.quantity) {
        res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.quantity}`,
        });
        return;
      }
      farmerIds.add(product.farmer.toString());
      totalAmount += product.price * item.quantity;
      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        unit: product.unit,
      });
    }

    if (farmerIds.size > 1) {
      res.status(400).json({ message: "All items must be from the same farmer" });
      return;
    }

    const farmerId = Array.from(farmerIds)[0];

    // Duplicate order prevention: reject if the same consumer placed an
    // identical order within the last 60 seconds.
    const recentCutoff = new Date(Date.now() - 60 * 1000);
    const recentDuplicate = await Order.findOne({
      consumer: req.user?._id,
      farmer: farmerId,
      createdAt: { $gte: recentCutoff },
      items: {
        $size: orderItems.length,
        $all: orderItems.map((item) => ({
          $elemMatch: {
            product: item.product,
            quantity: item.quantity,
            price: item.price,
          },
        })),
      },
    });

    if (recentDuplicate) {
      res.status(409).json({
        message: "A duplicate order was detected. Please wait a moment before placing the same order again.",
      });
      return;
    }

    const order = new Order({
      consumer: req.user?._id,
      farmer: farmerId,
      items: orderItems,
      totalAmount,
      deliverySlot,
      deliveryAddress,
      notes,
      paymentMethod: paymentMethod || "cod",
      paymentStatus: "pending",
    });

    await order.save();

    // Decrement product quantities in a single bulk operation
    await Product.bulkWrite(
      items.map((item: { productId: string; quantity: number }) => ({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { quantity: -item.quantity } },
        },
      }))
    );

    // Create commission transaction
    try {
      const settings = await PlatformSettings.findOne().sort("-createdAt").lean();
      const commissionPercent = settings?.commissionPercent ?? 5;
      const commissionAmount = Math.round((totalAmount * commissionPercent) / 100);
      const farmerPayout = totalAmount - commissionAmount;

      await Transaction.create({
        order: order._id,
        farmer: farmerId,
        consumer: req.user?._id,
        subtotal: totalAmount,
        commissionPercent,
        commissionAmount,
        farmerPayout,
        status: "pending",
      });    } catch (txError) {
      // Log the error but don't fail the order — transaction can be reconciled later
      console.error("[Order] Failed to create transaction record:", txError);
    }

    // Send order placed emails (best-effort — don't block the response)
    try {
      const consumer = await User.findById(req.user?._id).select("name email");
      const farmer = await User.findById(farmerId).select("name email");
      if (consumer && farmer) {
        await sendOrderPlacedEmails({
          orderId: order._id.toString(),
          consumerName: consumer.name,
          consumerEmail: consumer.email,
          farmerName: farmer.name,
          farmerEmail: farmer.email,
          items: orderItems.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity, unit: i.unit })),
          totalAmount,
          deliveryAddress: deliveryAddress ? `${deliveryAddress.street}, ${deliveryAddress.city}` : undefined,
        });
      }
    } catch (emailError) {
      console.error("[Order] Failed to send order placed emails:", emailError);
    }

    res.status(201).json({ order });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Cancel an order (consumer only — only pending or confirmed orders)
 */
export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // Verify ownership
    if (order.consumer.toString() !== req.user?._id.toString()) {
      res.status(403).json({ message: "You can only cancel your own orders." });
      return;
    }

    // Only allow cancellation if status is pending or confirmed
    if (!["pending", "confirmed"].includes(order.status)) {
      res.status(400).json({
        message: `Order cannot be cancelled because it is "${order.status}". Only pending or confirmed orders can be cancelled.`,
      });
      return;
    }

    order.status = "cancelled";
    await order.save();

    // Restore product quantities in a single bulk operation
    await Product.bulkWrite(
      order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { quantity: item.quantity } },
        },
      }))
    );

    // Notify farmer of cancellation (best-effort)
    try {
      const farmer = await User.findById(order.farmer).select("name email");
      const consumer = await User.findById(req.user?._id).select("name");
      if (farmer && consumer) {
        const { sendOrderCancelledByConsumerEmail } = await import("../utils/email");
        await sendOrderCancelledByConsumerEmail(
          farmer.email,
          farmer.name,
          order._id.toString(),
          consumer.name
        );
      }
    } catch (emailError) {
      console.error("[Order] Failed to send cancellation email:", emailError);
    }

    res.json({ order });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Get consumer's orders
 */
export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ consumer: req.user?._id })
      .populate("farmer", "name farmName")
      .sort("-createdAt");
    res.json({ orders });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Get payment methods history for the authenticated user
 */
export const getPaymentMethods = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ consumer: req.user?._id })
      .select("paymentMethod paymentStatus totalAmount createdAt")
      .sort("-createdAt")
      .limit(50)
      .lean();

    // Aggregate unique payment methods with their usage stats
    const methodMap = new Map<string, {
      method: string;
      count: number;
      totalSpent: number;
      successfulCount: number;
      lastUsed: Date | null;
      orders: Array<{
        _id: string;
        totalAmount: number;
        paymentStatus: string;
        createdAt: Date;
      }>;
    }>();

    for (const order of orders) {
      const key = order.paymentMethod;
      if (!methodMap.has(key)) {
        methodMap.set(key, {
          method: key,
          count: 0,
          totalSpent: 0,
          successfulCount: 0,
          lastUsed: null,
          orders: [],
        });
      }
      const entry = methodMap.get(key)!;
      entry.count++;
      entry.totalSpent += order.totalAmount;
      if (order.paymentStatus === "paid") entry.successfulCount++;
      if (!entry.lastUsed || new Date(order.createdAt) > new Date(entry.lastUsed)) {
        entry.lastUsed = order.createdAt;
      }
      entry.orders.push({
        _id: order._id.toString(),
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      });
    }

    const methods = Array.from(methodMap.values()).map((m) => ({
      ...m,
      orders: m.orders.slice(0, 5), // last 5 orders per method
    }));

    res.json({ methods, totalOrders: orders.length });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Get single order
 */
export const getOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("farmer", "name farmName phone")
      .populate("consumer", "name phone")
      .populate("items.product", "name images");

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // Verify ownership — consumer & farmer may be populated (documents with _id)
    // or raw ObjectIds depending on the populate() above.
    const userId = req.user?._id.toString();
    const getRefId = (ref: unknown): string => {
      if (ref && typeof ref === "object" && "toString" in ref) {
        const obj = ref as { _id?: { toString(): string }; toString(): string };
        return obj._id?.toString?.() ?? obj.toString();
      }
      return "";
    };

    if (
      getRefId(order.consumer) !== userId &&
      getRefId(order.farmer) !== userId &&
      req.user?.role !== "admin"
    ) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    res.json({ order });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};
