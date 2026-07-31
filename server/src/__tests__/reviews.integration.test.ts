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

type ExpressApp = ReturnType<typeof createTestApp>;

// ─────────────────────────────────────────────────
// Shared test data
// ─────────────────────────────────────────────────
const farmerData = {
  name: "Test Farmer",
  email: "farmer@test.com",
  password: "password123",
  role: "farmer" as const,
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

let app: ExpressApp;
let mongoServer: MongoMemoryServer;

let farmerId: string;
let productId: string;
let consumerToken: string;
let otherConsumerToken: string;
let farmerToken: string;

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

  const farmer = await User.create(farmerData);
  farmerId = farmer._id.toString();

  await User.create(consumerData);
  await User.create(otherConsumerData);

  const category = await Category.create({
    name: "Fruits",
    slug: "fruits",
    description: "Fresh fruits",
    icon: "eco",
  });

  const product = await Product.create({
    farmer: farmer._id,
    name: "Fresh Mangoes",
    description: "Sweet Alphonso mangoes",
    category: category._id,
    price: 200,
    unit: "kg",
    quantity: 50,
    isAvailable: true,
    approvalStatus: "approved",
  });
  productId = product._id.toString();

  consumerToken = await getTokenForUser(consumerData.email);
  otherConsumerToken = await getTokenForUser(otherConsumerData.email);
  farmerToken = await getTokenForUser(farmerData.email);
});

// ═════════════════════════════════════════════════
// POST /api/reviews
// ═════════════════════════════════════════════════
describe("POST /api/reviews", () => {
  it("should return 401 when no token is provided", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ product: productId, farmer: farmerId, rating: 5, comment: "Great!" })
      .expect(401);
    expect(res.body.message).toBe("Access denied. No token provided.");
  });

  it("should return 403 when a farmer tries to add a review", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ product: productId, farmer: farmerId, rating: 5 })
      .expect(403);
    expect(res.body.message).toBe("You do not have permission to perform this action.");
  });

  it("should create a review successfully", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ product: productId, farmer: farmerId, rating: 5, comment: "Amazing quality!" })
      .expect(201);

    expect(res.body.review).toBeDefined();
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.comment).toBe("Amazing quality!");
    expect(res.body.review.product).toBe(productId);
    expect(res.body.review.farmer).toBe(farmerId);
  });

  it("should reject a duplicate review from the same consumer on the same product", async () => {
    await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ product: productId, farmer: farmerId, rating: 5 })
      .expect(201);

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ product: productId, farmer: farmerId, rating: 3 })
      .expect(400);

    expect(res.body.message).toBe("You have already reviewed this product");
  });

  it("should allow a different consumer to review the same product", async () => {
    await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ product: productId, farmer: farmerId, rating: 5 })
      .expect(201);

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${otherConsumerToken}`)
      .send({ product: productId, farmer: farmerId, rating: 4 })
      .expect(201);

    expect(res.body.review.rating).toBe(4);
  });
});

// ═════════════════════════════════════════════════
// GET /api/reviews
// ═════════════════════════════════════════════════
describe("GET /api/reviews", () => {
  beforeEach(async () => {
    // Two consumers review the same product
    await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ product: productId, farmer: farmerId, rating: 5, comment: "Five stars" })
      .expect(201);
    await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${otherConsumerToken}`)
      .send({ product: productId, farmer: farmerId, rating: 3, comment: "Okay" })
      .expect(201);
  });

  it("should list all reviews publicly", async () => {
    const res = await request(app).get("/api/reviews").expect(200);

    expect(res.body.reviews).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("should compute the average rating", async () => {
    const res = await request(app).get("/api/reviews").expect(200);

    // (5 + 3) / 2 = 4
    expect(res.body.averageRating).toBe(4);
  });

  it("should filter reviews by product", async () => {
    const res = await request(app)
      .get("/api/reviews")
      .query({ product: productId })
      .expect(200);

    expect(res.body.reviews).toHaveLength(2);
  });

  it("should filter reviews by farmer", async () => {
    const res = await request(app)
      .get("/api/reviews")
      .query({ farmer: farmerId })
      .expect(200);

    expect(res.body.reviews).toHaveLength(2);
    res.body.reviews.forEach((r: any) => {
      expect(r.farmer.toString()).toBe(farmerId);
    });
  });

  it("should return empty list for a farmer with no reviews", async () => {
    const res = await request(app)
      .get("/api/reviews")
      .query({ farmer: "507f1f77bcf86cd799439011" })
      .expect(200);

    expect(res.body.reviews).toHaveLength(0);
    expect(res.body.averageRating).toBe(0);
    expect(res.body.total).toBe(0);
  });

  it("should populate the consumer name", async () => {
    const res = await request(app).get("/api/reviews").expect(200);

    // Reviews are sorted by -createdAt, so match by unique comment to avoid
    // depending on insertion-order timing between the two consumers.
    const fiveStar = res.body.reviews.find((r: any) => r.comment === "Five stars");
    expect(fiveStar).toBeDefined();
    expect(fiveStar.consumer).toBeDefined();
    expect(fiveStar.consumer.name).toBe("Test Consumer");

    const names = res.body.reviews.map((r: any) => r.consumer?.name);
    expect(names).toContain("Other Consumer");
  });
});
