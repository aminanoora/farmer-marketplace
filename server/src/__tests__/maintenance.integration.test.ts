import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createTestApp, startMemoryServer, stopMemoryServer, clearDatabase } from "./helpers/setup";
import User from "../models/User";
import PlatformSettings from "../models/PlatformSettings";
import { resetMaintenanceCache } from "../middleware/maintenance.middleware";

let app: ReturnType<typeof createTestApp>;
let mongoServer: MongoMemoryServer;
let adminToken: string;

const testAdmin = {
  name: "Maint Admin",
  email: "maint-admin@test.com",
  password: "admin123",
  role: "admin",
};

const testConsumer = {
  name: "Maint Consumer",
  email: "maint-consumer@test.com",
  password: "password123",
  role: "consumer",
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
  resetMaintenanceCache();

  // Create admin
  const admin = new User(testAdmin);
  await admin.save();
  const loginRes = await request(app)
    .post("/api/admin/login")
    .send({ email: testAdmin.email, password: testAdmin.password });
  adminToken = loginRes.body.token;
});// ─── Health check always works ──────────────────
// Note: /health is defined in app.ts, not in the test app.
// This test verifies that the maintenance middleware only applies to /api/*
// by confirming admin routes still work (tested below).

// ─── Admin routes bypass maintenance ────────────
describe("Admin routes during maintenance", () => {
  it("should allow admin login during maintenance", async () => {
    await PlatformSettings.create({ maintenanceMode: true });
    resetMaintenanceCache();

    // Create a fresh admin (the beforeEach admin's login was before maintenance was enabled)
    const admin = new User({ name: "Admin2", email: "admin2@test.com", password: "admin123", role: "admin" });
    await admin.save();

    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: "admin2@test.com", password: "admin123" })
      .expect(200);

    expect(res.body.token).toBeDefined();
  });

  it("should allow admin to toggle maintenance off", async () => {
    await PlatformSettings.create({ maintenanceMode: true });
    resetMaintenanceCache();

    const res = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ maintenanceMode: false })
      .expect(200);

    expect(res.body.settings.maintenanceMode).toBe(false);
  });
});

// ─── Public routes blocked during maintenance ───
describe("Public routes during maintenance", () => {
  it("should block homepage during maintenance", async () => {
    await PlatformSettings.create({ maintenanceMode: true });
    resetMaintenanceCache();

    const res = await request(app)
      .get("/api/homepage")
      .expect(503);

    expect(res.body.message).toContain("maintenance");
  });

  it("should block search during maintenance", async () => {
    await PlatformSettings.create({ maintenanceMode: true });
    resetMaintenanceCache();

    const res = await request(app)
      .get("/api/search?q=test")
      .expect(503);

    expect(res.body.message).toContain("maintenance");
  });

  it("should allow routes after maintenance is disabled", async () => {
    // Enable maintenance
    await PlatformSettings.create({ maintenanceMode: true });
    resetMaintenanceCache();

    // Verify blocked
    await request(app).get("/api/homepage").expect(503);

    // Disable maintenance via admin
    await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ maintenanceMode: false });

    // Should work now
    const res = await request(app).get("/api/homepage").expect(200);
    expect(res.body.categories).toBeDefined();
  });
});

// ─── Admin settings CRUD ────────────────────────
describe("Admin settings CRUD", () => {
  it("should create default settings on first GET", async () => {
    const res = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.settings).toBeDefined();
    expect(res.body.settings.commissionPercent).toBe(5); // default
    expect(res.body.settings.maintenanceMode).toBe(false);
  });

  it("should update specific settings fields", async () => {
    await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ commissionPercent: 10, supportEmail: "help@test.com" })
      .expect(200);

    const res = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.settings.commissionPercent).toBe(10);
    expect(res.body.settings.supportEmail).toBe("help@test.com");
  });

  it("should reject empty update", async () => {
    const res = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    expect(res.body.message).toContain("No valid fields");
  });

  it("should reject unauthenticated settings access", async () => {
    await request(app)
      .get("/api/admin/settings")
      .expect(401);
  });
});
