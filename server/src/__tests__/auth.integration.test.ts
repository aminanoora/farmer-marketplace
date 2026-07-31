import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createTestApp, startMemoryServer, stopMemoryServer, clearDatabase } from "./helpers/setup";
import User from "../models/User";

let app: ReturnType<typeof createTestApp>;
let mongoServer: MongoMemoryServer;

// ─────────────────────────────────────────────────
// Test user data
// ─────────────────────────────────────────────────
const testConsumer = {
  name: "Test Consumer",
  email: "consumer@test.com",
  password: "password123",
  role: "consumer",
};

const testFarmer = {
  name: "Test Farmer",
  email: "farmer@test.com",
  password: "password123",
  role: "farmer",
  phone: "9876543210",
  farmName: "Test Farm",
};

const testAdmin = {
  name: "Admin User",
  email: "admin@test.com",
  password: "admin123",
  role: "admin",
};

// ─────────────────────────────────────────────────
// Lifecycle hooks
// ─────────────────────────────────────────────────
beforeAll(async () => {
  mongoServer = await startMemoryServer();
  app = createTestApp();
}, 60000);

afterAll(async () => {
  await stopMemoryServer(mongoServer);
}, 30000);

beforeEach(async () => {
  await clearDatabase();
});

// ─────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  it("should register a new consumer", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testConsumer)
      .expect(201);

    expect(res.body.message).toBe("Registration successful");
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe("Test Consumer");
    expect(res.body.user.email).toBe("consumer@test.com");
    expect(res.body.user.role).toBe("consumer");
    // Password must not leak
    expect(res.body.user.password).toBeUndefined();
  });

  it("should register a new farmer with farm details", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testFarmer)
      .expect(201);

    expect(res.body.user.role).toBe("farmer");
    expect(res.body.user.farmName).toBe("Test Farm");
    expect(res.body.user.phone).toBe("9876543210");
  });

  it("should reject duplicate email", async () => {
    await request(app)
      .post("/api/auth/register")
      .send(testConsumer)
      .expect(201);

    const res = await request(app)
      .post("/api/auth/register")
      .send(testConsumer)
      .expect(400);

    expect(res.body.message).toBe("Email already registered.");
  });

  it("should register with consumer role when explicitly provided", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Default", email: "default@test.com", password: "password123", role: "consumer" })
      .expect(201);

    expect(res.body.user.role).toBe("consumer");
  });

  it("should validate required fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "No Email" })
      .expect(400);

    // Validation middleware should return errors array
    expect(res.body.errors).toBeDefined();
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    // Create a consumer to log in with
    await request(app).post("/api/auth/register").send(testConsumer);
  });

  it("should login with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testConsumer.email, password: testConsumer.password })
      .expect(200);

    expect(res.body.message).toBe("Login successful");
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("consumer@test.com");
    expect(res.body.user.password).toBeUndefined();
  });

  it("should reject wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testConsumer.email, password: "wrongpassword" })
      .expect(401);

    expect(res.body.message).toBe("Invalid email or password.");
  });

  it("should reject non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "password123" })
      .expect(401);

    expect(res.body.message).toBe("Invalid email or password.");
  });

  it("should reject inactive users", async () => {
    // Deactivate the user directly in DB
    await User.findOneAndUpdate({ email: testConsumer.email }, { isActive: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testConsumer.email, password: testConsumer.password })
      .expect(403);

    expect(res.body.message).toContain("deactivated");
  });

  it("should return 400 for missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "missing@pw.com" })
      .expect(400);

    expect(res.body.errors || res.body.message).toBeDefined();
  });
});

// ─────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────
describe("GET /api/auth/me", () => {
  let authToken: string;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testConsumer);
    authToken = res.body.token;
  });

  it("should return the current user when authenticated", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.user.email).toBe("consumer@test.com");
    expect(res.body.user.name).toBe("Test Consumer");
  });

  it("should reject requests without a token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .expect(401);

    expect(res.body.message).toBe("Access denied. No token provided.");
  });

  it("should reject requests with an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalidtoken123")
      .expect(401);

    expect(res.body.message).toBe("Invalid or expired token.");
  });

  it("should reject requests with a malformed Authorization header", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "NotBearer token123")
      .expect(401);

    expect(res.body.message).toBe("Access denied. No token provided.");
  });
});

// ─────────────────────────────────────────────────
// POST /api/admin/login
// ─────────────────────────────────────────────────
describe("POST /api/admin/login", () => {
  beforeEach(async () => {
    // Create an admin user directly (register only creates farmer/consumer)
    const admin = new User({
      name: testAdmin.name,
      email: testAdmin.email,
      password: testAdmin.password,
      role: "admin",
    });
    await admin.save();
  });

  it("should login admin with valid credentials", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: testAdmin.email, password: testAdmin.password })
      .expect(200);

    expect(res.body.message).toBe("Admin login successful");
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe("admin");
  });

  it("should reject non-admin users from admin login", async () => {
    // Create a consumer first
    await request(app).post("/api/auth/register").send(testConsumer);

    // Try to login as consumer via admin endpoint
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: testConsumer.email, password: testConsumer.password })
      .expect(403);

    expect(res.body.message).toContain("Access denied");
  });

  it("should reject admin login with wrong password", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: testAdmin.email, password: "wrongpassword" })
      .expect(401);

    expect(res.body.message).toBe("Invalid admin credentials.");
  });
});

// ─────────────────────────────────────────────────
// Role-based access (authorize middleware)
// ─────────────────────────────────────────────────
describe("Role-based access control", () => {
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    // Create admin
    const admin = new User({
      name: "Admin",
      email: "admin2@test.com",
      password: "admin123",
      role: "admin",
    });
    await admin.save();

    // Login as admin
    const adminRes = await request(app)
      .post("/api/admin/login")
      .send({ email: "admin2@test.com", password: "admin123" });
    adminToken = adminRes.body.token;

    // Create and login as regular user
    const userRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Regular User",
        email: "user@test.com",
        password: "password123",
        role: "consumer",
      });
    userToken = userRes.body.token;
  });

  it("should allow admin to access admin routes", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Dashboard should return stats
    expect(res.body.stats).toBeDefined();
  });

  it("should deny regular users from accessing admin routes", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);

    expect(res.body.message).toBe("You do not have permission to perform this action.");
  });

  it("should allow admin to access /api/admin/me", async () => {
    const res = await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.user.role).toBe("admin");
    expect(res.body.user.email).toBe("admin2@test.com");
  });

  it("should deny regular users from /api/admin/me", async () => {
    const res = await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);

    expect(res.body.message).toBe("You do not have permission to perform this action.");
  });
});

// ─────────────────────────────────────────────────
// Token separation strategy verification
// ─────────────────────────────────────────────────
describe("Admin / User token separation", () => {
  it("should issue different tokens for admin and user logins", async () => {
    // Create admin
    const admin = new User({
      name: "Admin",
      email: "sep-admin@test.com",
      password: "admin123",
      role: "admin",
    });
    await admin.save();

    const adminRes = await request(app)
      .post("/api/admin/login")
      .send({ email: "sep-admin@test.com", password: "admin123" })
      .expect(200);

    const userRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Sep User",
        email: "sep-user@test.com",
        password: "password123",
        role: "consumer",
      })
      .expect(201);

    // Tokens should be different strings
    expect(adminRes.body.token).not.toBe(userRes.body.token);

    // Admin token should work on admin routes
    await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${adminRes.body.token}`)
      .expect(200);

    // User token should fail on admin routes
    await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${userRes.body.token}`)
      .expect(403);

    // User token should work on regular routes
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${userRes.body.token}`)
      .expect(200);

    // Admin token should also work on /auth/me (it's a valid user in the system)
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminRes.body.token}`)
      .expect(200);
  });
});
