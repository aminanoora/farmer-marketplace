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
const adminData = {
  name: "Admin User",
  email: "admin@test.com",
  password: "admin123",
  role: "admin" as const,
};

const farmerData = {
  name: "Test Farmer",
  email: "farmer@test.com",
  password: "password123",
  role: "farmer" as const,
  phone: "9876543210",
  farmName: "Green Valley Farm",
};

const consumerData = {
  name: "Test Consumer",
  email: "consumer@test.com",
  password: "password123",
  role: "consumer" as const,
};

let app: ExpressApp;
let mongoServer: MongoMemoryServer;

let adminToken: string;
let farmerId: string;
let productId: string;

const deliveryAddress = {
  fullName: "Test Consumer",
  phone: "9876543210",
  street: "123 Market Street",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001",
};

async function loginAdmin(): Promise<string> {
  const res = await request(app)
    .post("/api/admin/login")
    .send({ email: adminData.email, password: adminData.password });
  if (!res.body.token) throw new Error("Failed to login admin");
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

  // Seed admin
  await User.create(adminData);

  // Seed farmer + consumer
  const farmer = await User.create(farmerData);
  farmerId = farmer._id.toString();
  await User.create(consumerData);

  // Seed a category + product (pending approval by default)
  const category = await Category.create({
    name: "Dairy",
    slug: "dairy",
    description: "Fresh dairy",
    icon: "egg",
  });
  const product = await Product.create({
    farmer: farmer._id,
    name: "Organic Milk",
    description: "Fresh farm milk",
    category: category._id,
    price: 60,
    unit: "L",
    quantity: 30,
    isAvailable: true,
    approvalStatus: "pending",
  });
  productId = product._id.toString();

  adminToken = await loginAdmin();
});

// ═════════════════════════════════════════════════
// POST /api/admin/categories
// ═════════════════════════════════════════════════
describe("POST /api/admin/categories", () => {
  it("should return 401 without a token", async () => {
    const res = await request(app)
      .post("/api/admin/categories")
      .send({ name: "Grains", slug: "grains" })
      .expect(401);
    expect(res.body.message).toBe("Access denied. No token provided.");
  });

  it("should create a category as admin", async () => {
    const res = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Grains", slug: "grains", description: "Whole grains", icon: "grass" })
      .expect(201);

    expect(res.body.category).toBeDefined();
    expect(res.body.category.name).toBe("Grains");
    expect(res.body.category.slug).toBe("grains");
    expect(res.body.category.isActive).toBe(true);
  });

  it("should list the new category publicly", async () => {
    await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Grains", slug: "grains" })
      .expect(201);

    const res = await request(app).get("/api/categories").expect(200);
    expect(res.body.categories).toHaveLength(2); // Dairy (seeded) + Grains
    expect(res.body.categories.map((c: any) => c.name)).toContain("Grains");
  });

  it("should hide inactive categories from the public list", async () => {
    await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Grains", slug: "grains" })
      .expect(201);

    // Deactivate the seeded Dairy category
    await Category.updateOne({ slug: "dairy" }, { isActive: false });

    const res = await request(app).get("/api/categories").expect(200);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].name).toBe("Grains");
  });
});

// ═════════════════════════════════════════════════
// PATCH /api/admin/farmers/:id/approve & /reject
// ═════════════════════════════════════════════════
describe("Farmer approval workflow", () => {
  it("should approve a farmer", async () => {
    const res = await request(app)
      .patch(`/api/admin/farmers/${farmerId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.message).toBe("Farmer approved successfully");
    expect(res.body.farmer.verificationStatus).toBe("verified");
  });

  it("should reject a farmer", async () => {
    const res = await request(app)
      .patch(`/api/admin/farmers/${farmerId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.message).toBe("Farmer rejected");
    expect(res.body.farmer.verificationStatus).toBe("rejected");
  });

  it("should return 404 for a non-existent farmer", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .patch(`/api/admin/farmers/${fakeId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
    expect(res.body.message).toBe("Farmer not found");
  });

  it("should list pending farmers for review", async () => {
    const res = await request(app)
      .get("/api/admin/farmers")
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.users.length).toBeGreaterThan(0);
    res.body.users.forEach((u: any) => {
      expect(u.role).toBe("farmer");
      expect(u.verificationStatus).toBe("pending");
    });
  });
});

// ═════════════════════════════════════════════════
// Product approval workflow
// ═════════════════════════════════════════════════
describe("Product approval workflow", () => {
  it("should list pending products", async () => {
    const res = await request(app)
      .get("/api/admin/products")
      .query({ approvalStatus: "pending" })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe("Organic Milk");
    expect(res.body.stats.pendingCount).toBe(1);
  });

  it("should approve a product and make it publicly visible", async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${productId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.message).toContain("approved");
    expect(res.body.product.approvalStatus).toBe("approved");
    expect(res.body.product.isAvailable).toBe(true);

    // Now visible on the public marketplace
    const publicRes = await request(app).get("/api/products").expect(200);
    expect(publicRes.body.products).toHaveLength(1);
    expect(publicRes.body.products[0]._id).toBe(productId);
  });

  it("should reject a product and hide it from the marketplace", async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${productId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.message).toContain("rejected");
    expect(res.body.product.approvalStatus).toBe("rejected");

    const publicRes = await request(app).get("/api/products").expect(200);
    expect(publicRes.body.products).toHaveLength(0);
  });

  // ── Regression: approving from the Inventory page (status toggle) ──
  // The admin Inventory page calls PATCH /products/:id/status with isAvailable.
  // This must also update approvalStatus so the farmer view is in sync.
  it("should approve a pending product via the visibility status toggle", async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${productId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isAvailable: true })
      .expect(200);

    expect(res.body.product.isAvailable).toBe(true);
    expect(res.body.product.approvalStatus).toBe("approved");

    // Visible on the public marketplace
    const publicRes = await request(app).get("/api/products").expect(200);
    expect(publicRes.body.products).toHaveLength(1);
    expect(publicRes.body.products[0]._id).toBe(productId);

    // No longer pending in the admin review queue
    const pendingRes = await request(app)
      .get("/api/admin/products")
      .query({ approvalStatus: "pending" })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(pendingRes.body.products).toHaveLength(0);

    // The farmer's product view reflects the approval (original bug symptom)
    const farmerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: farmerData.email, password: farmerData.password });
    const farmerRes = await request(app)
      .get("/api/farmers/products")
      .set("Authorization", `Bearer ${farmerLogin.body.token}`)
      .expect(200);
    expect(farmerRes.body.products[0].approvalStatus).toBe("approved");
  });

  it("should keep approvalStatus when merely hiding an approved product", async () => {
    // First approve it via the official approve endpoint
    await request(app)
      .patch(`/api/admin/products/${productId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Hiding via the status toggle should NOT revert approvalStatus
    const res = await request(app)
      .patch(`/api/admin/products/${productId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isAvailable: false })
      .expect(200);

    expect(res.body.product.isAvailable).toBe(false);
    expect(res.body.product.approvalStatus).toBe("approved");
  });
});

// ═════════════════════════════════════════════════
// Admin order management
// ═════════════════════════════════════════════════
describe("Admin order management", () => {
  let orderId: string;

  beforeEach(async () => {
    // Farmer must be verified + product approved before ordering
    await User.findByIdAndUpdate(farmerId, { verificationStatus: "verified" });
    await Product.findByIdAndUpdate(productId, { approvalStatus: "approved" });

    const consumerRes = await request(app)
      .post("/api/auth/login")
      .send({ email: consumerData.email, password: consumerData.password });
    const consumerToken = consumerRes.body.token;

    const placed = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({
        items: [{ productId, quantity: 2 }],
        deliveryAddress,
        paymentMethod: "cod",
      })
      .expect(201);
    orderId = placed.body.order._id;
  });

  it("should list all orders with stats", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.orders).toHaveLength(1);
    expect(res.body.stats.totalOrders).toBe(1);
    expect(res.body.orders[0].consumer.email).toBe(consumerData.email);
    expect(res.body.orders[0].farmer.farmName).toBe("Green Valley Farm");
  });

  it("should filter orders by status", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].status).toBe("pending");
  });

  it("should update order status", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" })
      .expect(200);

    expect(res.body.order.status).toBe("confirmed");
    expect(res.body.order.consumer.name).toBe("Test Consumer");
  });

  it("should reject invalid order status", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "shipped-anyway" })
      .expect(400);

    expect(res.body.message).toBe("Invalid status value.");
  });

  it("should get a single order by id", async () => {
    const res = await request(app)
      .get(`/api/admin/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.order._id).toBe(orderId);
    expect(res.body.order.items[0].name).toBe("Organic Milk");
  });
});

// ═════════════════════════════════════════════════
// GET /api/admin/dashboard/overview & analytics
// ═════════════════════════════════════════════════
describe("Admin dashboard & analytics", () => {
  it("should return overview stats", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard/overview")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.stats.totalFarmers).toBe(1);
    expect(res.body.stats.totalConsumers).toBe(1);
    expect(res.body.stats.totalProducts).toBe(1);
    expect(res.body.stats.totalOrders).toBe(0);
    expect(res.body.stats.pendingVerifications).toBe(1);
    expect(res.body.stats.totalRevenue).toBe(0);
    expect(Array.isArray(res.body.latestOrders)).toBe(true);
  });

  it("should return analytics with revenue and distribution", async () => {
    const res = await request(app)
      .get("/api/admin/analytics")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.totalRevenue).toBe(0);
    expect(Array.isArray(res.body.topFarmers)).toBe(true);
    expect(Array.isArray(res.body.categoryDistribution)).toBe(true);
  });
});
