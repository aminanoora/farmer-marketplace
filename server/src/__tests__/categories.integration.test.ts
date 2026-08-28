import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createTestApp, startMemoryServer, stopMemoryServer, clearDatabase } from "./helpers/setup";
import User from "../models/User";
import Category from "../models/Category";

let app: ReturnType<typeof createTestApp>;
let mongoServer: MongoMemoryServer;
let adminToken: string;

const testAdmin = {
  name: "Category Admin",
  email: "cat-admin@test.com",
  password: "admin123",
  role: "admin",
};

beforeAll(async () => {
  mongoServer = await startMemoryServer();
  app = createTestApp();
}, 60000);

afterAll(async () => {
  await stopMemoryServer(mongoServer);
}, 30000);

beforeEach(async () => {
  await clearDatabase();

  // Create admin and get token
  const admin = new User(testAdmin);
  await admin.save();

  const loginRes = await request(app)
    .post("/api/admin/login")
    .send({ email: testAdmin.email, password: testAdmin.password });
  adminToken = loginRes.body.token;
});

// ─── GET /api/categories ─────────────────────────
describe("GET /api/categories (public)", () => {
  it("should return empty array when no categories exist", async () => {
    const res = await request(app)
      .get("/api/categories")
      .expect(200);

    expect(res.body.categories).toEqual([]);
  });

  it("should return only active categories", async () => {
    await Category.create([
      { name: "Vegetables", slug: "vegetables", isActive: true },
      { name: "Inactive", slug: "inactive", isActive: false },
    ]);

    const res = await request(app)
      .get("/api/categories")
      .expect(200);

    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].slug).toBe("vegetables");
  });

  it("should return categories sorted by name", async () => {
    await Category.create([
      { name: "Fruits", slug: "fruits", isActive: true },
      { name: "Dairy", slug: "dairy", isActive: true },
      { name: "Grains", slug: "grains", isActive: true },
    ]);

    const res = await request(app)
      .get("/api/categories")
      .expect(200);

    expect(res.body.categories).toHaveLength(3);
    expect(res.body.categories[0].name).toBe("Dairy");
    expect(res.body.categories[1].name).toBe("Fruits");
    expect(res.body.categories[2].name).toBe("Grains");
  });
});

// ─── POST /api/admin/categories ──────────────────
describe("POST /api/admin/categories", () => {
  it("should create a new category as admin", async () => {
    const res = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Vegetables", slug: "vegetables" })
      .expect(201);

    expect(res.body.category).toBeDefined();
    expect(res.body.category.name).toBe("Vegetables");
    expect(res.body.category.slug).toBe("vegetables");
  });

  it("should reject unauthenticated requests", async () => {
    await request(app)
      .post("/api/admin/categories")
      .send({ name: "Test" })
      .expect(401);
  });

  it("should reject non-admin users", async () => {
    const consumerRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "Consumer", email: "cat-consumer@test.com", password: "password123", role: "consumer" });

    await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${consumerRes.body.token}`)
      .send({ name: "Test" })
      .expect(403);
  });
});
