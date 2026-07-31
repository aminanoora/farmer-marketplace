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
import Transaction from "../models/Transaction";

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

const otherConsumerData = {
  name: "Other Consumer",
  email: "otherconsumer@test.com",
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
let otherConsumerToken: string;

let categoryId: string;
let productId: string;
let otherFarmersProductId: string;

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
  await User.create(otherConsumerData);
  await User.create(otherFarmerData);

  // Seed category
  const category = await Category.create({
    name: "Vegetables",
    slug: "vegetables",
    description: "Fresh vegetables",
    icon: "eco",
  });
  categoryId = category._id.toString();

  // Seed products (approved so they are orderable)
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

  const otherProduct = await Product.create({
    farmer: (await User.findOne({ email: otherFarmerData.email }))!._id,
    name: "Other Farmer Wheat",
    description: "Premium wheat",
    category: categoryId,
    price: 40,
    unit: "kg",
    quantity: 200,
    isAvailable: true,
    approvalStatus: "approved",
  });
  otherFarmersProductId = otherProduct._id.toString();

  // Get fresh tokens
  farmerToken = await getTokenForUser(farmerData.email);
  consumerToken = await getTokenForUser(consumerData.email);
  otherConsumerToken = await getTokenForUser(otherConsumerData.email);
});

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

// ═════════════════════════════════════════════════
// POST /api/orders
// ═════════════════════════════════════════════════
describe("POST /api/orders", () => {
  it("should return 401 when no token is provided", async () => {
    const res = await request(app).post("/api/orders").send(orderPayload()).expect(401);
    expect(res.body.message).toBe("Access denied. No token provided.");
  });

  it("should return 403 when a farmer tries to place an order", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send(orderPayload())
      .expect(403);

    expect(res.body.message).toBe("You do not have permission to perform this action.");
  });

  it("should reject an order with no items", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload({ items: [] }))
      .expect(400);

    expect(res.body.message).toBe("Order must contain at least one item");
  });

  it("should reject an order with a non-existent product", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload({ items: [{ productId: fakeId, quantity: 1 }] }))
      .expect(404);

    expect(res.body.message).toContain("not found");
  });

  it("should reject an order exceeding available stock", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload({ items: [{ productId, quantity: 500 }] }))
      .expect(400);

    expect(res.body.message).toContain("Insufficient stock");
  });

  it("should reject orders with items from different farmers", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(
        orderPayload({
          items: [
            { productId, quantity: 1 },
            { productId: otherFarmersProductId, quantity: 1 },
          ],
        })
      )
      .expect(400);

    expect(res.body.message).toBe("All items must be from the same farmer");
  });

  it("should place an order successfully and decrement stock", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    expect(res.body.order).toBeDefined();
    expect(res.body.order.totalAmount).toBe(100); // 2 × ₹50
    expect(res.body.order.status).toBe("pending");
    expect(res.body.order.paymentMethod).toBe("cod");
    expect(res.body.order.items[0].name).toBe("Fresh Tomatoes");
    expect(res.body.order.consumer).toBeDefined();

    // Stock should be decremented: 100 - 2 = 98
    const updatedProduct = await Product.findById(productId);
    expect(updatedProduct!.quantity).toBe(98);

    // A transaction record should be created
    const tx = await Transaction.findOne({ order: res.body.order._id });
    expect(tx).not.toBeNull();
    expect(tx!.subtotal).toBe(100);
    expect(tx!.commissionPercent).toBe(5);
    expect(tx!.commissionAmount).toBe(5);
    expect(tx!.farmerPayout).toBe(95);
  });
});

// ═════════════════════════════════════════════════
// GET /api/orders
// ═════════════════════════════════════════════════
describe("GET /api/orders", () => {
  it("should return 401 when no token is provided", async () => {
    const res = await request(app).get("/api/orders").expect(401);
    expect(res.body.message).toBe("Access denied. No token provided.");
  });

  it("should return only the consumer's own orders", async () => {
    // Consumer places an order
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].totalAmount).toBe(100);

    // Other consumer should not see this order
    const otherRes = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${otherConsumerToken}`)
      .expect(200);
    expect(otherRes.body.orders).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════
// GET /api/orders/:id
// ═════════════════════════════════════════════════
describe("GET /api/orders/:id", () => {
  let orderId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);
    orderId = res.body.order._id;
  });

  it("should return 404 for a non-existent order", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .get(`/api/orders/${fakeId}`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(404);
    expect(res.body.message).toBe("Order not found");
  });

  it("should return 403 for a consumer who does not own the order", async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${otherConsumerToken}`)
      .expect(403);
    expect(res.body.message).toBe("Access denied");
  });

  it("should allow the farmer to view the order", async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .expect(200);
    expect(res.body.order._id).toBe(orderId);
    expect(res.body.order.farmer).toBeDefined();
  });

  it("should return the order to its owner with populated fields", async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    expect(res.body.order._id).toBe(orderId);
    expect(res.body.order.items[0].name).toBe("Fresh Tomatoes");
    expect(res.body.order.farmer.farmName).toBe("Green Valley Farm");
    expect(res.body.order.consumer.name).toBe("Test Consumer");
  });
});

// ═════════════════════════════════════════════════
// PATCH /api/orders/:id/cancel
// ═════════════════════════════════════════════════
describe("PATCH /api/orders/:id/cancel", () => {
  it("should cancel a pending order and restore stock", async () => {
    const placed = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    const orderId = placed.body.order._id;
    expect((await Product.findById(productId))!.quantity).toBe(98);

    const res = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    expect(res.body.order.status).toBe("cancelled");

    // Stock restored to 100
    const restored = await Product.findById(productId);
    expect(restored!.quantity).toBe(100);
  });

  it("should return 403 when another consumer tries to cancel", async () => {
    const placed = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    const res = await request(app)
      .patch(`/api/orders/${placed.body.order._id}/cancel`)
      .set("Authorization", `Bearer ${otherConsumerToken}`)
      .expect(403);

    expect(res.body.message).toBe("You can only cancel your own orders.");
  });

  it("should reject cancelling a delivered order", async () => {
    const placed = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);

    // Mark delivered directly
    await Order.findByIdAndUpdate(placed.body.order._id, { status: "delivered" });

    const res = await request(app)
      .patch(`/api/orders/${placed.body.order._id}/cancel`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(400);

    expect(res.body.message).toContain("cannot be cancelled");
  });

  it("should return 404 for a non-existent order", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .patch(`/api/orders/${fakeId}/cancel`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(404);
    expect(res.body.message).toBe("Order not found");
  });
});

// ═════════════════════════════════════════════════
// GET /api/orders/payment-methods/summary
// ═════════════════════════════════════════════════
describe("GET /api/orders/payment-methods/summary", () => {
  it("should return empty methods when the user has no orders", async () => {
    const res = await request(app)
      .get("/api/orders/payment-methods/summary")
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    expect(res.body.methods).toEqual([]);
    expect(res.body.totalOrders).toBe(0);
  });

  it("should aggregate payment methods with usage stats", async () => {
    // Two COD orders + one online order
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload())
      .expect(201);
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(orderPayload({ paymentMethod: "online" }))
      .expect(201);

    const res = await request(app)
      .get("/api/orders/payment-methods/summary")
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    expect(res.body.totalOrders).toBe(3);

    const cod = res.body.methods.find((m: any) => m.method === "cod");
    const online = res.body.methods.find((m: any) => m.method === "online");
    expect(cod).toBeDefined();
    expect(cod.count).toBe(2);
    expect(cod.totalSpent).toBe(200);
    expect(online).toBeDefined();
    expect(online.count).toBe(1);
    expect(online.totalSpent).toBe(100);
  });
});
