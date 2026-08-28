import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  createTestApp,
  startMemoryServer,
  stopMemoryServer,
  clearDatabase,
} from "./helpers/setup";
import User from "../models/User";
import Product from "../models/Product";
import Category from "../models/Category";
import Order from "../models/Order";

type ExpressApp = ReturnType<typeof createTestApp>;

// ─────────────────────────────────────────────────
// Shared test data
// ─────────────────────────────────────────────────
const farmerData = {
  name: "Test Farmer",
  email: "farmer@test.com",
  password: "password123",
  role: "farmer" as const,
  phone: "9876543210",
  farmName: "Green Valley Farm",
  verificationStatus: "verified",
};

const consumerData = {
  name: "Test Consumer",
  email: "consumer@test.com",
  password: "password123",
  role: "consumer" as const,
};

const otherFarmerData = {
  name: "Another Farmer",
  email: "otherfarmer@test.com",
  password: "password123",
  role: "farmer" as const,
  farmName: "Sunrise Orchard",
  verificationStatus: "verified",
};

let app: ExpressApp;
let mongoServer: MongoMemoryServer;

let farmerToken: string;
let consumerToken: string;
let otherFarmerToken: string;

let categoryId: string;
let productId: string;

const deliveryAddress = {
  fullName: "Test Consumer",
  phone: "9876543210",
  street: "123 Market Street",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001",
};

async function getTokenForUser(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" });
  if (!res.body.token) {
    throw new Error(
      `Failed to get token for ${email}: ${res.body.message || "unknown error"}`
    );
  }
  return res.body.token;
}

function orderPayload(overrides: Record<string, any> = {}) {
  return {
    items: [{ productId, quantity: 2 }],
    deliveryAddress,
    deliverySlot: { date: "2026-08-05", timeSlot: "10:00 AM - 12:00 PM" },
    paymentMethod: "cod",
    notes: "Leave at the gate",
    ...overrides,
  };
}

beforeAll(async () => {
  mongoServer = await startMemoryServer();
  app = createTestApp();
}, 60000);

afterAll(async () => {
  await stopMemoryServer(mongoServer);
}, 30000);

beforeEach(async () => {
  await clearDatabase();

  // Seed users
  await User.create(farmerData);
  await User.create(consumerData);
  await User.create(otherFarmerData);

  // Seed category
  const category = await Category.create({
    name: "Vegetables",
    slug: "vegetables",
    description: "Fresh vegetables",
    icon: "eco",
  });
  categoryId = category._id.toString();

  // Seed product (approved so it's orderable)
  const product = await Product.create({
    farmer: (await User.findOne({ email: farmerData.email }))!._id,
    name: "Fresh Tomatoes",
    description: "Juicy red tomatoes",
    category: categoryId,
    price: 50,
    unit: "kg",
    quantity: 100,
    isAvailable: true,
    approvalStatus: "approved",
  });
  productId = product._id.toString();

  // Get fresh tokens
  farmerToken = await getTokenForUser(farmerData.email);
  consumerToken = await getTokenForUser(consumerData.email);
  otherFarmerToken = await getTokenForUser(otherFarmerData.email);
});

// ═════════════════════════════════════════════════
// PATCH /api/farmers/orders/:id/confirm
// ═════════════════════════════════════════════════
describe("PATCH /api/farmers/orders/:id/confirm", () => {
  // ── Auth & Authorization ──
  describe("authentication & authorization", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await request(app)
        .patch("/api/farmers/orders/507f1f77bcf86cd799439011/confirm")
        .expect(401);

      expect(res.body.message).toBe("Access denied. No token provided.");
    });

    it("should return 401 with an invalid token", async () => {
      const res = await request(app)
        .patch("/api/farmers/orders/507f1f77bcf86cd799439011/confirm")
        .set("Authorization", "Bearer invalidtoken")
        .expect(401);

      expect(res.body.message).toBe("Invalid or expired token.");
    });

    it("should return 403 when a consumer tries to confirm", async () => {
      const res = await request(app)
        .patch("/api/farmers/orders/507f1f77bcf86cd799439011/confirm")
        .set("Authorization", `Bearer ${consumerToken}`)
        .expect(403);

      expect(res.body.message).toBe("You do not have permission to perform this action.");
    });
  });

  // ── Order existence & ownership ──
  describe("order existence & ownership", () => {
    it("should return 404 when order does not exist", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const res = await request(app)
        .patch(`/api/farmers/orders/${fakeId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(404);

      expect(res.body.message).toBe("Order not found");
    });

    it("should return 404 when order belongs to another farmer", async () => {
      // Place an order that belongs to the test farmer
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Other farmer tries to confirm
      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${otherFarmerToken}`)
        .expect(404);

      expect(res.body.message).toBe("Order not found");
    });
  });

  // ── Confirm pending order ──
  describe("confirming a pending order", () => {
    it("should confirm a pending order successfully", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;
      expect(placed.body.order.status).toBe("pending");

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.order.status).toBe("confirmed");
      expect(res.body.message).toBe("Order confirmed successfully.");

      // Verify in database
      const order = await Order.findById(orderId);
      expect(order!.status).toBe("confirmed");
    });

    it("should allow confirming a confirmed order (no-op)", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // First confirm
      await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      // No-op: confirming again returns 200 (same status)
      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.order.status).toBe("confirmed");
    });

    it("should not allow confirming a delivered order", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Mark as delivered directly
      await Order.findByIdAndUpdate(orderId, { status: "delivered" });

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(400);

      expect(res.body.message).toContain("terminal");
    });

    it("should not allow confirming a cancelled order", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Mark as cancelled directly
      await Order.findByIdAndUpdate(orderId, { status: "cancelled" });

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(400);

      expect(res.body.message).toContain("terminal");
    });

    it("should not change product stock when confirming", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Stock was decremented by placing the order: 100 - 2 = 98
      const stockBefore = (await Product.findById(productId))!.quantity;
      expect(stockBefore).toBe(98);

      await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      // Stock should remain the same after confirming
      const stockAfter = (await Product.findById(productId))!.quantity;
      expect(stockAfter).toBe(98);
    });
  });

  // ── Confirm prepared / preparing orders ──
  describe("confirming orders in other states", () => {
    it("should not allow confirming a preparing order", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Move to confirmed → preparing
      await Order.findByIdAndUpdate(orderId, { status: "preparing" });

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(400);

      expect(res.body.message).toContain("preparing");
    });

    it("should not allow confirming an out-for-delivery order", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Move to out-for-delivery
      await Order.findByIdAndUpdate(orderId, { status: "out-for-delivery" });

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(400);

      expect(res.body.message).toContain("out-for-delivery");
    });
  });
});

// ═════════════════════════════════════════════════
// PATCH /api/farmers/orders/:id/cancel
// ═════════════════════════════════════════════════
describe("PATCH /api/farmers/orders/:id/cancel", () => {
  // ── Auth & Authorization ──
  describe("authentication & authorization", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await request(app)
        .patch("/api/farmers/orders/507f1f77bcf86cd799439011/cancel")
        .expect(401);

      expect(res.body.message).toBe("Access denied. No token provided.");
    });

    it("should return 401 with an invalid token", async () => {
      const res = await request(app)
        .patch("/api/farmers/orders/507f1f77bcf86cd799439011/cancel")
        .set("Authorization", "Bearer invalidtoken")
        .expect(401);

      expect(res.body.message).toBe("Invalid or expired token.");
    });

    it("should return 403 when a consumer tries to cancel", async () => {
      const res = await request(app)
        .patch("/api/farmers/orders/507f1f77bcf86cd799439011/cancel")
        .set("Authorization", `Bearer ${consumerToken}`)
        .expect(403);

      expect(res.body.message).toBe("You do not have permission to perform this action.");
    });
  });

  // ── Order existence & ownership ──
  describe("order existence & ownership", () => {
    it("should return 404 when order does not exist", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const res = await request(app)
        .patch(`/api/farmers/orders/${fakeId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(404);

      expect(res.body.message).toBe("Order not found");
    });

    it("should return 404 when order belongs to another farmer", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${otherFarmerToken}`)
        .expect(404);

      expect(res.body.message).toBe("Order not found");
    });
  });

  // ── Cancel pending order ──
  describe("cancelling a pending order", () => {
    it("should cancel a pending order successfully", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;
      expect(placed.body.order.status).toBe("pending");

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.order.status).toBe("cancelled");
      expect(res.body.message).toBe("Order cancelled successfully.");

      // Verify in database
      const order = await Order.findById(orderId);
      expect(order!.status).toBe("cancelled");
    });

    it("should restore product stock when cancelling", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Stock was decremented: 100 - 2 = 98
      const stockBefore = (await Product.findById(productId))!.quantity;
      expect(stockBefore).toBe(98);

      await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      // Stock restored: 98 + 2 = 100
      const stockAfter = (await Product.findById(productId))!.quantity;
      expect(stockAfter).toBe(100);
    });
  });

  // ── Cancel confirmed order (not allowed for farmers) ──
  describe("cancelling a confirmed order", () => {
    it("should not allow cancelling a confirmed order (farmer can only cancel pending)", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Confirm first
      await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      const stockAfterConfirm = (await Product.findById(productId))!.quantity;
      expect(stockAfterConfirm).toBe(98);

      // Try to cancel — should fail for farmers
      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(400);

      expect(res.body.message).toContain("confirmed");

      // Stock should NOT be restored
      const stockAfterCancel = (await Product.findById(productId))!.quantity;
      expect(stockAfterCancel).toBe(98);
    });
  });

  // ── Cancel terminal orders ──
  describe("cancelling terminal orders", () => {
    it("should not allow cancelling a delivered order", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;
      await Order.findByIdAndUpdate(orderId, { status: "delivered" });

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(400);

      expect(res.body.message).toContain("terminal");
    });

    it("should allow cancelling an already cancelled order (no-op)", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Cancel once
      await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      // No-op: cancelling again returns 200 (same status)
      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.order.status).toBe("cancelled");
    });
  });

  // ── Cancel preparing / out-for-delivery orders (not allowed for farmers) ──
  describe("cancelling orders in later states", () => {
    it("should not allow cancelling a preparing order", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Move to preparing
      await Order.findByIdAndUpdate(orderId, { status: "preparing" });

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(400);

      expect(res.body.message).toContain("preparing");
    });

    it("should not allow cancelling an out-for-delivery order", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Move to out-for-delivery
      await Order.findByIdAndUpdate(orderId, { status: "out-for-delivery" });

      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(400);

      expect(res.body.message).toContain("out-for-delivery");
    });
  });

  // ── No-op transition ──
  describe("no-op transitions", () => {
    it("should allow confirming an already-confirmed order (no-op)", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Confirm once
      await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      // Confirm again (no-op — same status)
      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/confirm`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.order.status).toBe("confirmed");
    });

    it("should allow cancelling an already-cancelled order (no-op)", async () => {
      const placed = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${consumerToken}`)
        .send(orderPayload())
        .expect(201);

      const orderId = placed.body.order._id;

      // Cancel once
      await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      // Cancel again (no-op — same status)
      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.order.status).toBe("cancelled");
    });
  });
});

// ═════════════════════════════════════════════════
// PATCH /api/farmers/orders/:id (generic status)
// ═════════════════════════════════════════════════
describe("PATCH /api/farmers/orders/:id (generic status update)", () => {
  it("should advance order through full fulfillment pipeline", async () => {
    const placed = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    const orderId = placed.body.order._id;

    // pending → confirmed
    let res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "confirmed" })
      .expect(200);
    expect(res.body.order.status).toBe("confirmed");

    // confirmed → preparing
    res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "preparing" })
      .expect(200);
    expect(res.body.order.status).toBe("preparing");

    // preparing → out-for-delivery
    res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "out-for-delivery" })
      .expect(200);
    expect(res.body.order.status).toBe("out-for-delivery");

    // out-for-delivery → delivered
    res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "delivered" })
      .expect(200);
    expect(res.body.order.status).toBe("delivered");
  });

  it("should reject invalid status values", async () => {
    const placed = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    const res = await request(app)
      .patch(`/api/farmers/orders/${placed.body.order._id}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "shipped" })
      .expect(400);

    expect(res.body.message).toBe("Invalid status value.");
  });

  it("should reject skipping steps: pending → preparing", async () => {
    const placed = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    const res = await request(app)
      .patch(`/api/farmers/orders/${placed.body.order._id}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "preparing" })
      .expect(400);

    expect(res.body.message).toContain("preparing");
  });

  it("should reject transition from delivered status", async () => {
    const placed = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    await Order.findByIdAndUpdate(placed.body.order._id, { status: "delivered" });

    const res = await request(app)
      .patch(`/api/farmers/orders/${placed.body.order._id}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "preparing" })
      .expect(400);

    expect(res.body.message).toContain("terminal");
  });

  it("should return 404 for a non-existent order", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .patch(`/api/farmers/orders/${fakeId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "confirmed" })
      .expect(404);

    expect(res.body.message).toBe("Order not found");
  });
});
