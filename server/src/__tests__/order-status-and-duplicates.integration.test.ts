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
import { validateStatusTransition } from "../utils/orderStatus";

type ExpressApp = ReturnType<typeof createTestApp>;

// ─────────────────────────────────────────────────
// Test data
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

const otherConsumerData = {
  name: "Other Consumer",
  email: "otherconsumer@test.com",
  password: "password123",
  role: "consumer" as const,
};

const adminData = {
  name: "Admin User",
  email: "admin@test.com",
  password: "password123",
  role: "admin" as const,
};

const deliveryAddress = {
  fullName: "Test Consumer",
  phone: "9876543210",
  street: "123 Market Street",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001",
};

let app: ExpressApp;
let mongoServer: MongoMemoryServer;

let farmerToken: string;
let consumerToken: string;
let otherConsumerToken: string;
let adminToken: string;

let productId: string;

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

beforeAll(async () => {
  mongoServer = await startMemoryServer();
  app = createTestApp();
}, 60000);

afterAll(async () => {
  await stopMemoryServer(mongoServer);
}, 30000);

beforeEach(async () => {
  await clearDatabase();

  await User.create(farmerData);
  await User.create(consumerData);
  await User.create(otherConsumerData);
  await User.create(adminData);

  const category = await Category.create({
    name: "Vegetables",
    slug: "vegetables",
    description: "Fresh vegetables",
    icon: "eco",
  });

  const product = await Product.create({
    farmer: (await User.findOne({ email: farmerData.email }))!._id,
    name: "Fresh Tomatoes",
    description: "Juicy red tomatoes",
    category: category._id,
    price: 50,
    unit: "kg",
    quantity: 100,
    isAvailable: true,
    approvalStatus: "approved",
  });
  productId = product._id.toString();

  farmerToken = await getTokenForUser(farmerData.email);
  consumerToken = await getTokenForUser(consumerData.email);
  otherConsumerToken = await getTokenForUser(otherConsumerData.email);
  adminToken = await getTokenForUser(adminData.email);
});

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId, quantity: 2 }],
    deliveryAddress,
    deliverySlot: { date: "2026-08-05", timeSlot: "10:00 AM - 12:00 PM" },
    paymentMethod: "cod",
    notes: "Leave at the gate",
    ...overrides,
  };
}

// ═════════════════════════════════════════════════
// Unit tests — validateStatusTransition
// ═════════════════════════════════════════════════
describe("validateStatusTransition (unit)", () => {
  it("allows same status (no-op)", () => {
    expect(validateStatusTransition("pending", "pending", "admin")).toBeNull();
    expect(validateStatusTransition("pending", "pending", "farmer")).toBeNull();
  });

  it("rejects transitions from terminal statuses", () => {
    expect(validateStatusTransition("delivered", "pending", "admin")).toContain("terminal");
    expect(validateStatusTransition("cancelled", "confirmed", "admin")).toContain("terminal");
    expect(validateStatusTransition("delivered", "preparing", "farmer")).toContain("terminal");
    expect(validateStatusTransition("cancelled", "out-for-delivery", "farmer")).toContain("terminal");
  });

  // ── Admin transitions ──
  describe("admin transitions", () => {
    it("allows forward progression through the full pipeline", () => {
      expect(validateStatusTransition("pending", "confirmed", "admin")).toBeNull();
      expect(validateStatusTransition("confirmed", "preparing", "admin")).toBeNull();
      expect(validateStatusTransition("preparing", "out-for-delivery", "admin")).toBeNull();
      expect(validateStatusTransition("out-for-delivery", "delivered", "admin")).toBeNull();
    });

    it("allows cancelling from any non-terminal status", () => {
      expect(validateStatusTransition("pending", "cancelled", "admin")).toBeNull();
      expect(validateStatusTransition("confirmed", "cancelled", "admin")).toBeNull();
      expect(validateStatusTransition("preparing", "cancelled", "admin")).toBeNull();
      expect(validateStatusTransition("out-for-delivery", "cancelled", "admin")).toBeNull();
    });

    it("rejects backwards transitions", () => {
      expect(validateStatusTransition("confirmed", "pending", "admin")).toContain("cannot");
      expect(validateStatusTransition("preparing", "confirmed", "admin")).toContain("cannot");
      expect(validateStatusTransition("delivered", "pending", "admin")).toContain("terminal");
    });

    it("rejects skipping steps", () => {
      expect(validateStatusTransition("pending", "preparing", "admin")).toContain("cannot");
      expect(validateStatusTransition("pending", "delivered", "admin")).toContain("cannot");
      expect(validateStatusTransition("confirmed", "out-for-delivery", "admin")).toContain("cannot");
    });
  });

  // ── Farmer transitions ──
  describe("farmer transitions", () => {
    it("allows forward progression through the full pipeline", () => {
      expect(validateStatusTransition("pending", "confirmed", "farmer")).toBeNull();
      expect(validateStatusTransition("confirmed", "preparing", "farmer")).toBeNull();
      expect(validateStatusTransition("preparing", "out-for-delivery", "farmer")).toBeNull();
      expect(validateStatusTransition("out-for-delivery", "delivered", "farmer")).toBeNull();
    });

    it("allows cancelling a pending order", () => {
      expect(validateStatusTransition("pending", "cancelled", "farmer")).toBeNull();
    });

    it("rejects cancelling confirmed/preparing/out-for-delivery orders", () => {
      expect(validateStatusTransition("confirmed", "cancelled", "farmer")).toContain("cannot");
      expect(validateStatusTransition("preparing", "cancelled", "farmer")).toContain("cannot");
      expect(validateStatusTransition("out-for-delivery", "cancelled", "farmer")).toContain("cannot");
    });

    it("rejects backwards transitions", () => {
      expect(validateStatusTransition("confirmed", "pending", "farmer")).toContain("cannot");
      expect(validateStatusTransition("preparing", "confirmed", "farmer")).toContain("cannot");
    });

    it("rejects skipping steps", () => {
      expect(validateStatusTransition("pending", "preparing", "farmer")).toContain("cannot");
      expect(validateStatusTransition("confirmed", "delivered", "farmer")).toContain("cannot");
    });
  });
});

// ═════════════════════════════════════════════════
// Integration — duplicate order prevention
// ═════════════════════════════════════════════════
describe("Duplicate order prevention", () => {
  it("should reject an identical order from the same consumer within 60 seconds", async () => {
    // First order — should succeed
    const res1 = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    expect(res1.body.order).toBeDefined();

    // Second identical order — should be rejected
    const res2 = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(409);

    expect(res2.body.message).toContain("duplicate order");
  });

  it("should allow an identical order from a different consumer", async () => {
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    // Different consumer, same items — should succeed
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${otherConsumerToken}`)
      .send(orderPayload())
      .expect(201);
  });

  it("should allow a different order from the same consumer within 60 seconds", async () => {
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload({ items: [{ productId, quantity: 1 }] }))
      .expect(201);

    // Same consumer, different quantity — should succeed
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload({ items: [{ productId, quantity: 3 }] }))
      .expect(201);
  });

  it("should allow the same order after the 60-second window", async () => {
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    // Backdate the first order's createdAt so it falls outside the 60-second
    // window.  Use the native collection to bypass Mongoose timestamps middleware
    // which could re-overwrite the value.
    const consumer = await User.findOne({ email: consumerData.email });
    await Order.collection.updateOne(
      { consumer: consumer!._id },
      { $set: { createdAt: new Date(Date.now() - 120 * 1000) } }
    );

    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);
  });
});

// ═════════════════════════════════════════════════
// Integration — admin order status transitions
// ═════════════════════════════════════════════════
describe("Admin order status transitions", () => {
  let orderId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);
    orderId = res.body.order._id;
  });

  it("should transition pending → confirmed", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" })
      .expect(200);

    expect(res.body.order.status).toBe("confirmed");
  });

  it("should transition through the full pipeline: pending → confirmed → preparing → out-for-delivery → delivered", async () => {
    const transitions = ["confirmed", "preparing", "out-for-delivery", "delivered"];
    let currentOrderId = orderId;

    for (const status of transitions) {
      const res = await request(app)
        .patch(`/api/admin/orders/${currentOrderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status })
        .expect(200);
      expect(res.body.order.status).toBe(status);
    }
  });

  it("should reject backwards transition: confirmed → pending", async () => {
    await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" })
      .expect(200);

    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "pending" })
      .expect(400);

    expect(res.body.message).toContain("cannot");
  });

  it("should reject skipping steps: pending → preparing", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "preparing" })
      .expect(400);

    expect(res.body.message).toContain("cannot");
  });

  it("should reject transition from delivered status", async () => {
    await Order.findByIdAndUpdate(orderId, { status: "delivered" });

    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "pending" })
      .expect(400);

    expect(res.body.message).toContain("terminal");
  });

  it("should restore stock when admin cancels an order", async () => {
    // Stock was decremented on order placement: 100 - 2 = 98
    const before = await Product.findById(productId);
    expect(before!.quantity).toBe(98);

    await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "cancelled" })
      .expect(200);

    const after = await Product.findById(productId);
    expect(after!.quantity).toBe(100);
  });

  it("should reject invalid status values", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "invalid_status" })
      .expect(400);

    expect(res.body.message).toContain("Invalid status");
  });

  it("should return 404 for a non-existent order", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    await request(app)
      .patch(`/api/admin/orders/${fakeId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" })
      .expect(404);
  });

  it("should allow admin to cancel from any non-terminal status", async () => {
    // Move to confirmed first
    await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" })
      .expect(200);

    // Now cancel from confirmed — should succeed
    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "cancelled" })
      .expect(200);

    expect(res.body.order.status).toBe("cancelled");
  });
});

// ═════════════════════════════════════════════════
// Integration — farmer order status transitions
// ═════════════════════════════════════════════════
describe("Farmer order status transitions", () => {
  let orderId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);
    orderId = res.body.order._id;
  });

  it("should transition pending → confirmed", async () => {
    const res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "confirmed" })
      .expect(200);

    expect(res.body.order.status).toBe("confirmed");
  });

  it("should transition through the full farmer pipeline", async () => {
    const transitions = ["confirmed", "preparing", "out-for-delivery", "delivered"];

    for (const status of transitions) {
      const res = await request(app)
        .patch(`/api/farmers/orders/${orderId}`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .send({ status })
        .expect(200);
      expect(res.body.order.status).toBe(status);
    }
  });

  it("should reject backwards transition: confirmed → pending", async () => {
    await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "confirmed" })
      .expect(200);

    const res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "pending" })
      .expect(400);

    expect(res.body.message).toContain("cannot");
  });

  it("should allow farmer cancelling a pending order and restore stock", async () => {
    // Stock was decremented on order placement: 100 - 2 = 98
    const before = await Product.findById(productId);
    expect(before!.quantity).toBe(98);

    const res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "cancelled" })
      .expect(200);

    expect(res.body.order.status).toBe("cancelled");

    // Stock restored to 100
    const after = await Product.findById(productId);
    expect(after!.quantity).toBe(100);
  });

  it("should reject farmer cancelling a confirmed order (too late)", async () => {
    await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "confirmed" })
      .expect(200);

    const res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "cancelled" })
      .expect(400);

    expect(res.body.message).toContain("cannot");
  });

  it("should reject skipping steps: pending → preparing", async () => {
    const res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "preparing" })
      .expect(400);

    expect(res.body.message).toContain("cannot");
  });

  it("should reject transition from delivered status", async () => {
    await Order.findByIdAndUpdate(orderId, { status: "delivered" });

    const res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "pending" })
      .expect(400);

    expect(res.body.message).toContain("terminal");
  });

  it("should return 404 for a non-existent order", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    await request(app)
      .patch(`/api/farmers/orders/${fakeId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "confirmed" })
      .expect(404);
  });

  it("should reject invalid status values", async () => {
    const res = await request(app)
      .patch(`/api/farmers/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ status: "garbage" })
      .expect(400);

    expect(res.body.message).toContain("Invalid status");
  });
});
