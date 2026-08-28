import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createTestApp, startMemoryServer, stopMemoryServer, clearDatabase } from "./helpers/setup";
import User from "../models/User";

let app: ReturnType<typeof createTestApp>;
let mongoServer: MongoMemoryServer;
let consumerToken: string;
let farmerToken: string;

const testConsumer = {
  name: "Address Consumer",
  email: "addr-consumer@test.com",
  password: "password123",
  role: "consumer",
};

const testFarmer = {
  name: "Address Farmer",
  email: "addr-farmer@test.com",
  password: "password123",
  role: "farmer",
};

const testAddress = {
  label: "Home",
  phone: "9876543210",
  street: "123 Farm Lane",
  city: "Ludhiana",
  state: "Punjab",
  pincode: "141001",
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

  // Create consumer and get token
  const consumerRes = await request(app)
    .post("/api/auth/register")
    .send(testConsumer);
  consumerToken = consumerRes.body.token;

  // Create farmer and get token
  const farmerRes = await request(app)
    .post("/api/auth/register")
    .send(testFarmer);
  farmerToken = farmerRes.body.token;
});

// ─── POST /api/addresses ─────────────────────────
describe("POST /api/addresses", () => {
  it("should create a new address", async () => {
    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(testAddress)
      .expect(201);

    expect(res.body.address).toBeDefined();
    expect(res.body.address.street).toBe("123 Farm Lane");
    expect(res.body.address.city).toBe("Ludhiana");
    expect(res.body.address.state).toBe("Punjab");
    expect(res.body.address.pincode).toBe("141001");
    expect(res.body.address.label).toBe("Home");
    expect(res.body.address.isDefault).toBe(false);
  });

  it("should reject missing required fields", async () => {
    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ label: "Work" })
      .expect(400);

    expect(res.body.message).toContain("required");
  });

  it("should reject unauthenticated requests", async () => {
    await request(app)
      .post("/api/addresses")
      .send(testAddress)
      .expect(401);
  });

  it("should set address as default when isDefault is true", async () => {
    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ ...testAddress, isDefault: true })
      .expect(201);

    expect(res.body.address.isDefault).toBe(true);
  });
});

// ─── GET /api/addresses ──────────────────────────
describe("GET /api/addresses", () => {
  it("should return empty array when no addresses exist", async () => {
    const res = await request(app)
      .get("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    expect(res.body.addresses).toEqual([]);
  });

  it("should return consumer's addresses", async () => {
    // Create an address
    await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(testAddress);

    const res = await request(app)
      .get("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    expect(res.body.addresses).toHaveLength(1);
    expect(res.body.addresses[0].street).toBe("123 Farm Lane");
  });

  it("should not return other consumers' addresses", async () => {
    // Create address as consumer
    await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(testAddress);

    // Create another consumer
    const otherRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "Other", email: "other@test.com", password: "password123", role: "consumer" });
    const otherToken = otherRes.body.token;

    const res = await request(app)
      .get("/api/addresses")
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(200);

    expect(res.body.addresses).toHaveLength(0);
  });

  it("should reject unauthenticated requests", async () => {
    await request(app)
      .get("/api/addresses")
      .expect(401);
  });
});

// ─── PUT /api/addresses/:id ──────────────────────
describe("PUT /api/addresses/:id", () => {
  let addressId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(testAddress);
    addressId = res.body.address._id;
  });

  it("should update an address", async () => {
    const res = await request(app)
      .put(`/api/addresses/${addressId}`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ city: "Chandigarh", street: "456 New Street" })
      .expect(200);

    expect(res.body.address.city).toBe("Chandigarh");
    expect(res.body.address.street).toBe("456 New Street");
  });

  it("should return 404 for non-existent address", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    await request(app)
      .put(`/api/addresses/${fakeId}`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ city: "Test" })
      .expect(404);
  });

  it("should not allow updating another consumer's address", async () => {
    const otherRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "Other", email: "other2@test.com", password: "password123", role: "consumer" });
    const otherToken = otherRes.body.token;

    await request(app)
      .put(`/api/addresses/${addressId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ city: "Hacked" })
      .expect(404);
  });
});

// ─── DELETE /api/addresses/:id ───────────────────
describe("DELETE /api/addresses/:id", () => {
  let addressId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(testAddress);
    addressId = res.body.address._id;
  });

  it("should delete an address", async () => {
    await request(app)
      .delete(`/api/addresses/${addressId}`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    // Verify it's gone
    const res = await request(app)
      .get("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    expect(res.body.addresses).toHaveLength(0);
  });

  it("should return 404 for non-existent address", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    await request(app)
      .delete(`/api/addresses/${fakeId}`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(404);
  });
});

// ─── PATCH /api/addresses/:id/default ────────────
describe("PATCH /api/addresses/:id/default", () => {
  it("should set one address as default and unset others", async () => {
    // Create two addresses
    const res1 = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send(testAddress);
    const res2 = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .send({ ...testAddress, label: "Work", street: "789 Office Rd" });

    const addr1 = res1.body.address._id;
    const addr2 = res2.body.address._id;

    // Set first as default
    await request(app)
      .patch(`/api/addresses/${addr1}/default`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    // Verify first is default, second is not
    const list = await request(app)
      .get("/api/addresses")
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(200);

    const defaultAddr = list.body.addresses.find((a: { _id: string }) => a._id === addr1);
    const otherAddr = list.body.addresses.find((a: { _id: string }) => a._id === addr2);
    expect(defaultAddr.isDefault).toBe(true);
    expect(otherAddr.isDefault).toBe(false);
  });

  it("should return 404 for non-existent address", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    await request(app)
      .patch(`/api/addresses/${fakeId}/default`)
      .set("Authorization", `Bearer ${consumerToken}`)
      .expect(404);
  });
});
