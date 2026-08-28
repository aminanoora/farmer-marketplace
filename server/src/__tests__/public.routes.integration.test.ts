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
import Newsletter from "../models/Newsletter";

type ExpressApp = ReturnType<typeof createTestApp>;

// ─────────────────────────────────────────────────
// Shared test data
// ─────────────────────────────────────────────────
const farmerData = {
  name: "Ramesh Kumar",
  email: "farmer@test.com",
  password: "password123",
  role: "farmer" as const,
  farmName: "Green Acres Farm",
  farmLocation: { village: "Puranpur", district: "Saharanpur", state: "Uttar Pradesh" },
  verificationStatus: "verified",
};

let app: ExpressApp;
let mongoServer: MongoMemoryServer;

// ─────────────────────────────────────────────────
// Lifecycle hooks
// ─────────────────────────────────────────────────
beforeAll(async () => {
  mongoServer = await startMemoryServer();
  app = createTestApp();

  // Ensure the text index required by $text search exists before running
  // search assertions (mongoose builds it asynchronously on first use).
  await Product.init();
  await User.init();
  await Category.init();
  await Newsletter.init();
}, 60000);

afterAll(async () => {
  await stopMemoryServer(mongoServer);
}, 30000);

beforeEach(async () => {
  await clearDatabase();
});

// ═════════════════════════════════════════════════
// POST /api/newsletter/subscribe — email validation
// ═════════════════════════════════════════════════
describe("POST /api/newsletter/subscribe", () => {
  it("should reject an invalid email with 400", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "not-an-email" })
      .expect(400);

    expect(res.body.message).toBe("A valid email address is required");
  });

  it("should reject an email without a domain", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "user@localhost" })
      .expect(400);

    expect(res.body.message).toBe("A valid email address is required");
  });

  it("should reject a missing email with 400", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({})
      .expect(400);

    expect(res.body.message).toBe("A valid email address is required");
  });

  it("should reject a non-string email with 400", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: 12345 })
      .expect(400);

    expect(res.body.message).toBe("A valid email address is required");
  });

  it("should reject whitespace-only email with 400", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "   " })
      .expect(400);

    expect(res.body.message).toBe("A valid email address is required");
  });

  it("should accept a valid email with 201", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "consumer@test.com" })
      .expect(201);

    expect(res.body.message).toBe(
      "Thank you for subscribing! Stay tuned for fresh updates."
    );

    const saved = await Newsletter.findOne({ email: "consumer@test.com" });
    expect(saved).not.toBeNull();
    expect(saved!.isActive).toBe(true);
  });

  it("should trim and lowercase the stored email", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "  TEST@Example.COM  " })
      .expect(201);

    expect(res.body.message).toContain("Thank you for subscribing");

    // Stored normalized (trimmed + lowercase)
    const saved = await Newsletter.findOne({ email: "test@example.com" });
    expect(saved).not.toBeNull();
  });

  it("should return 200 when already subscribed", async () => {
    await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "consumer@test.com" })
      .expect(201);

    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "consumer@test.com" })
      .expect(200);

    expect(res.body.message).toBe("You're already subscribed!");
  });

  it("should treat case/whitespace variants as the same subscriber", async () => {
    await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "  Consumer@Test.COM " })
      .expect(201);

    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "consumer@test.com" })
      .expect(200);

    expect(res.body.message).toBe("You're already subscribed!");
  });

  it("should re-subscribe an unsubscribed user with a welcome-back message", async () => {
    await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "consumer@test.com" })
      .expect(201);

    // Simulate an unsubscribe (e.g. via a future admin tool / one-click link)
    await Newsletter.updateOne(
      { email: "consumer@test.com" },
      { isActive: false, unsubscribedAt: new Date() }
    );

    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "consumer@test.com" })
      .expect(200);

    expect(res.body.message).toBe("Welcome back! You've been re-subscribed.");

    const saved = await Newsletter.findOne({ email: "consumer@test.com" });
    expect(saved!.isActive).toBe(true);
    expect(saved!.unsubscribedAt).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════
// GET /api/search — sort behavior
// ═════════════════════════════════════════════════
describe("GET /api/search sort behavior", () => {
  let fruitCategoryId: string;

  async function seedProducts() {
    const farmer = await User.create(farmerData);
    const category = await Category.create({
      name: "Fruits",
      slug: "fruits",
      description: "Fresh fruits",
      icon: "eco",
    });
    fruitCategoryId = category._id.toString();

    // Distinct prices + distinct createdAt for deterministic assertions
    const products = [
      {
        farmer: farmer._id,
        name: "Fresh Apples",
        description: "Crisp and juicy apples straight from the orchard",
        category: category._id,
        price: 120,
        unit: "kg",
        quantity: 100,
        isAvailable: true,
        approvalStatus: "approved" as const,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        farmer: farmer._id,
        name: "Fresh Bananas",
        description: "Naturally sweet bananas perfect for snacking",
        category: category._id,
        price: 60,
        unit: "dozen",
        quantity: 80,
        isAvailable: true,
        approvalStatus: "approved" as const,
        createdAt: new Date("2026-07-05T00:00:00.000Z"),
      },
      {
        farmer: farmer._id,
        name: "Fresh Mangoes",
        description: "King of fruits, sweet Alphonso mangoes",
        category: category._id,
        price: 200,
        unit: "kg",
        quantity: 30,
        isAvailable: true,
        approvalStatus: "approved" as const,
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
      },
      {
        farmer: farmer._id,
        name: "Fresh Grapes",
        description: "Seedless green grapes with a crisp bite",
        category: category._id,
        price: 40,
        unit: "kg",
        quantity: 60,
        isAvailable: true,
        approvalStatus: "approved" as const,
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
      },
    ];
    await Product.insertMany(products);
  }

  beforeEach(async () => {
    await seedProducts();
  });

  it("should return empty results when no query is provided", async () => {
    const res = await request(app).get("/api/search").expect(200);

    expect(res.body.products).toEqual([]);
    expect(res.body.farmers).toEqual([]);
    expect(res.body.productsTotal).toBe(0);
    expect(res.body.farmersTotal).toBe(0);
  });

  it("should sort by price ascending when sort=price_asc", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "fresh", sort: "price_asc", limit: 50 })
      .expect(200);

    const prices = res.body.products.map((p: any) => p.price);
    expect(prices).toEqual([40, 60, 120, 200]);
  });

  it("should sort by price descending when sort=price_desc", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "fresh", sort: "price_desc", limit: 50 })
      .expect(200);

    const prices = res.body.products.map((p: any) => p.price);
    expect(prices).toEqual([200, 120, 60, 40]);
  });

  it("should sort by newest first when sort=newest", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "fresh", sort: "newest", limit: 50 })
      .expect(200);

    const names = res.body.products.map((p: any) => p.name);
    // Newest createdAt (Grapes 07-15) → oldest (Apples 07-01)
    expect(names).toEqual([
      "Fresh Grapes",
      "Fresh Mangoes",
      "Fresh Bananas",
      "Fresh Apples",
    ]);
  });

  it("should return all matching products with default relevance sort", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "fresh", limit: 50 })
      .expect(200);

    expect(res.body.productsTotal).toBe(4);
    expect(res.body.products).toHaveLength(4);
  });

  it("should handle an explicit sort=relevance the same as the default", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "fresh", sort: "relevance", limit: 50 })
      .expect(200);

    expect(res.body.productsTotal).toBe(4);
    expect(res.body.products).toHaveLength(4);
  });

  it("should fall back to relevance for an unknown sort value", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "fresh", sort: "bogus_sort", limit: 50 })
      .expect(200);

    expect(res.body.productsTotal).toBe(4);
    expect(res.body.products).toHaveLength(4);
  });

  it("should support pagination on search results", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "fresh", sort: "price_asc", page: 1, limit: 2 })
      .expect(200);

    expect(res.body.products).toHaveLength(2);
    expect(res.body.pagination.total).toBe(4);
    expect(res.body.pagination.pages).toBe(2);
    expect(res.body.products.map((p: any) => p.price)).toEqual([40, 60]);
  });

  it("should only include approved, available products", async () => {
    // Add a pending product and an unavailable product — both must be excluded
    const farmer = await User.findOne({ email: farmerData.email });
    const pending = await Product.create({
      farmer: farmer!._id,
      name: "Fresh Pending Item",
      description: "Awaiting admin approval fresh item",
      category: fruitCategoryId,
      price: 10,
      unit: "kg",
      quantity: 5,
      isAvailable: true,
      approvalStatus: "pending",
    });
    const unavailable = await Product.create({
      farmer: farmer!._id,
      name: "Fresh Unavailable Item",
      description: "Temporarily out of stock fresh item",
      category: fruitCategoryId,
      price: 15,
      unit: "kg",
      quantity: 0,
      isAvailable: false,
      approvalStatus: "approved",
    });
    expect(pending._id).toBeDefined();
    expect(unavailable._id).toBeDefined();

    const res = await request(app)
      .get("/api/search")
      .query({ q: "fresh", sort: "price_asc", limit: 50 })
      .expect(200);

    const names = res.body.products.map((p: any) => p.name);
    expect(names).not.toContain("Fresh Pending Item");
    expect(names).not.toContain("Fresh Unavailable Item");
    expect(res.body.productsTotal).toBe(4);
  });

  it("should include verified farmers matching the query", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "ramesh", limit: 50 })
      .expect(200);

    expect(res.body.farmersTotal).toBe(1);
    expect(res.body.farmers[0].name).toBe("Ramesh Kumar");
    // The term matches no product text, so the products side stays empty
    expect(res.body.productsTotal).toBe(0);
    expect(res.body.products).toHaveLength(0);
  });
});
