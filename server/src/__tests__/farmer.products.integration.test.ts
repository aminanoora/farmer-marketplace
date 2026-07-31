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

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
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
};

let app: ExpressApp;
let mongoServer: MongoMemoryServer;

// Tokens
let farmerToken: string;
let otherFarmerToken: string;
let consumerToken: string;

// IDs
let testCategoryId: string;
let testProductIds: string[] = [];
let otherFarmersProductId: string;

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function createProductData(overrides: Partial<Record<string, any>> = {}) {
  return {
    name: "Fresh Organic Apples",
    description: "Crisp and juicy apples straight from the orchard.",
    category: testCategoryId,
    price: 120,
    unit: "kg",
    quantity: 100,
    isOrganic: true,
    isAvailable: true,
    ...overrides,
  };
}

async function seedInitialData() {
  // Create category
  const category = await Category.create({
    name: "Fruits",
    slug: "fruits",
    description: "Fresh fruits",
    icon: "apple",
  });
  testCategoryId = category._id.toString();

  // Create users
  const farmer = await User.create(farmerData);

  const otherFarmer = await User.create(otherFarmerData);

  const consumer = await User.create(consumerData);

  // Create farmer's products (6 products with varying properties, unique descriptions)
  const productsData = [
    createProductData({ name: "Fresh Organic Apples",   price: 120, quantity: 100, isAvailable: true, isOrganic: true,  description: "Crisp and juicy apples straight from the orchard." }),
    createProductData({ name: "Red Grapes",              price: 80,  quantity: 50,  isAvailable: true, isOrganic: false, description: "Sweet seedless red grapes, perfect for snacking." }),
    createProductData({ name: "Mangoes - Alphonso",     price: 200, quantity: 10,  isAvailable: true, isOrganic: true,  description: "Premium Alphonso mangoes, king of fruits." }),
    createProductData({ name: "Fresh Oranges",          price: 60,  quantity: 0,   isAvailable: false, isOrganic: false, description: "Juicy Nagpur oranges, rich in vitamin C." }),
    createProductData({ name: "Pomegranate",             price: 150, quantity: 5,  isAvailable: true, isOrganic: true,  description: "Freshly harvested ruby red pomegranates." }),
    createProductData({ name: "Bananas - Organic",      price: 40,  quantity: 200, isAvailable: true, isOrganic: true,  description: "Naturally ripened organic bananas from Kerala." }),
  ];

  const products = await Product.insertMany(
    productsData.map((p) => ({ ...p, farmer: farmer._id }))
  );
  testProductIds = products.map((p) => p._id.toString());

  // Create a product for the other farmer
  const otherProduct = await Product.create({
    name: "Other Farmer Wheat",
    description: "Premium wheat grains",
    category: testCategoryId,
    farmer: otherFarmer._id,
    price: 35,
    unit: "kg",
    quantity: 500,
    isOrganic: false,
    isAvailable: true,
  });
  otherFarmersProductId = otherProduct._id.toString();
}

// Generate auth token if the model doesn't have the method
// Some setups use jwt sign directly
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
  await seedInitialData();

  // Get fresh tokens via login (in case user password gets rehashed)
  farmerToken = await getTokenForUser(farmerData.email);
  consumerToken = await getTokenForUser(consumerData.email);
  otherFarmerToken = await getTokenForUser(otherFarmerData.email);
});

// ═════════════════════════════════════════════════
// GET /api/farmers/products
// ═════════════════════════════════════════════════
describe("GET /api/farmers/products", () => {
  // ── Auth & Authorization ──
  describe("authentication & authorization", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .expect(401);

      expect(res.body.message).toBe("Access denied. No token provided.");
    });

    it("should return 401 with an invalid token", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .set("Authorization", "Bearer invalidtoken")
        .expect(401);

      expect(res.body.message).toBe("Invalid or expired token.");
    });

    it("should return 403 when a consumer tries to access farmer products", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .set("Authorization", `Bearer ${consumerToken}`)
        .expect(403);

      expect(res.body.message).toBe("You do not have permission to perform this action.");
    });
  });

  // ── Basic listing ──
  describe("basic listing", () => {
    it("should return all products for the authenticated farmer", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products).toBeDefined();
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.products.length).toBe(6);
    });

    it("should return stats with correct counts", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.totalProducts).toBe(6);
      // 5 products have isAvailable: true (only Oranges has isAvailable: false)
      expect(res.body.stats.activeProducts).toBe(5);
      // Low stock: alphonso mangoes (qty 10 <= 20) and pomegranate (qty 5 <= 20)
      expect(res.body.stats.lowStockProducts).toBe(2);
      // Out of stock: oranges (qty 0)
      expect(res.body.stats.outOfStockProducts).toBe(1);
    });

    it("should return pagination info", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20); // default limit
      expect(res.body.pagination.total).toBe(6);
      expect(res.body.pagination.totalPages).toBe(1);
    });

    it("should not include other farmers' products", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .set("Authorization", `Bearer ${otherFarmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].name).toBe("Other Farmer Wheat");
      expect(res.body.stats.totalProducts).toBe(1);
    });

    it("should return product with populated category", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      const product = res.body.products[0];
      expect(product.category).toBeDefined();
      expect(product.category._id).toBe(testCategoryId);
      expect(product.category.name).toBe("Fruits");
      expect(product.category.slug).toBe("fruits");
    });
  });

  // ── Search ──
  describe("search", () => {
    it("should filter products by name (case-insensitive)", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ search: "organic" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(2);
      res.body.products.forEach((p: any) => {
        const matchesName = p.name.toLowerCase().includes("organic");
        const matchesDesc = (p.description || "").toLowerCase().includes("organic");
        expect(matchesName || matchesDesc).toBe(true);
      });
    });

    it("should filter products by description", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ search: "orchard" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].description).toContain("orchard");
    });

    it("should return empty array for non-matching search", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ search: "nonexistentproduct" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(0);
      expect(res.body.stats.totalProducts).toBe(6);
    });
  });

  // ── Category filter ──
  describe("category filter", () => {
    it("should filter by category ID", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ category: testCategoryId })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(6); // All products are in this category
      res.body.products.forEach((p: any) => {
        const catId = typeof p.category === "object" ? p.category._id : p.category;
        expect(catId).toBe(testCategoryId);
      });
    });

    it("should return empty array for non-existent category", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ category: fakeId })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(0);
    });
  });

  // ── Status filter ──
  describe("status filter", () => {
    it("should filter by status=active (isAvailable: true)", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ status: "active" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(5);
      res.body.products.forEach((p: any) => {
        expect(p.isAvailable).toBe(true);
      });
    });

    it("should filter by status=inactive (isAvailable: false)", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ status: "inactive" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].isAvailable).toBe(false);
      expect(res.body.products[0].name).toBe("Fresh Oranges");
    });

    it("should filter by status=lowStock (0 < qty <= 20 and available)", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ status: "lowStock" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(2);
      res.body.products.forEach((p: any) => {
        expect(p.isAvailable).toBe(true);
        expect(p.quantity).toBeGreaterThan(0);
        expect(p.quantity).toBeLessThanOrEqual(20);
      });
    });

    it("should filter by status=outOfStock (quantity <= 0)", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ status: "outOfStock" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].quantity).toBe(0);
    });
  });

  // ── Sorting ──
  describe("sorting", () => {
    it("should sort by price ascending", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ sort: "price" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      const prices = res.body.products.map((p: any) => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it("should sort by price descending", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ sort: "-price" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      const prices = res.body.products.map((p: any) => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });

    it("should sort by name alphabetically", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ sort: "name" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      const names = res.body.products.map((p: any) => p.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it("should sort by quantity descending", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ sort: "-quantity" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      const quantities = res.body.products.map((p: any) => p.quantity);
      for (let i = 1; i < quantities.length; i++) {
        expect(quantities[i]).toBeLessThanOrEqual(quantities[i - 1]);
      }
    });
  });

  // ── Pagination ──
  describe("pagination", () => {
    it("should respect the page and limit params", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ page: "1", limit: "2" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    it("should return page 2 correctly", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ page: "2", limit: "2" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(2);
      expect(res.body.pagination.page).toBe(2);
    });

    it("should return empty array when page exceeds total pages", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ page: "100", limit: "10" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBe(0);
      expect(res.body.pagination.page).toBe(100);
      expect(res.body.pagination.total).toBe(6);
    });

    it("should not allow limit above 50", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ limit: "100" })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.products.length).toBeLessThanOrEqual(50);
      expect(res.body.pagination.limit).toBe(50);
    });
  });

  // ── Combined filters ──
  describe("combined filters", () => {
    it("should combine search, category, and status filters", async () => {
      const res = await request(app)
        .get("/api/farmers/products")
        .query({ search: "organic", status: "active", category: testCategoryId })
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      // Should only return products that match all three conditions
      expect(res.body.products.length).toBeGreaterThan(0);
      res.body.products.forEach((p: any) => {
        expect(p.isAvailable).toBe(true);
        const matchesName = p.name.toLowerCase().includes("organic");
        const matchesDesc = (p.description || "").toLowerCase().includes("organic");
        expect(matchesName || matchesDesc).toBe(true);
      });
    });
  });
});

// ═════════════════════════════════════════════════
// GET /api/farmers/products/:id
// ═════════════════════════════════════════════════
describe("GET /api/farmers/products/:id", () => {
  // ── Auth & Authorization ──
  describe("authentication & authorization", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[0]}`)
        .expect(401);

      expect(res.body.message).toBe("Access denied. No token provided.");
    });

    it("should return 401 with an invalid token", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[0]}`)
        .set("Authorization", "Bearer invalidtoken")
        .expect(401);

      expect(res.body.message).toBe("Invalid or expired token.");
    });

    it("should return 403 when a consumer tries to access", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[0]}`)
        .set("Authorization", `Bearer ${consumerToken}`)
        .expect(403);

      expect(res.body.message).toBe("You do not have permission to perform this action.");
    });
  });

  // ── Product existence & ownership ──
  describe("product existence & ownership", () => {
    it("should return 404 when product does not exist", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const res = await request(app)
        .get(`/api/farmers/products/${fakeId}`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(404);

      expect(res.body.message).toBe("Product not found");
    });

    it("should return 404 when product belongs to another farmer", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${otherFarmersProductId}`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(404);

      expect(res.body.message).toBe("Product not found");
    });
  });

  // ── Success ──
  describe("successful retrieval", () => {
    it("should return the product with all fields", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[0]}`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.product).toBeDefined();
      const product = res.body.product;

      expect(product._id).toBe(testProductIds[0]);
      expect(product.name).toBe("Fresh Organic Apples");
      expect(product.description).toBe("Crisp and juicy apples straight from the orchard.");
      expect(product.price).toBe(120);
      expect(product.unit).toBe("kg");
      expect(product.quantity).toBe(100);
      expect(product.isOrganic).toBe(true);
      expect(product.isAvailable).toBe(true);
    });

    it("should populate category information", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[0]}`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      const category = res.body.product.category;
      expect(category).toBeDefined();
      expect(category._id).toBe(testCategoryId);
      expect(category.name).toBe("Fruits");
      expect(category.slug).toBe("fruits");
      expect(category.description).toBe("Fresh fruits");
      expect(category.icon).toBe("apple");
    });

    it("should populate farmer information", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[0]}`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      const farmer = res.body.product.farmer;
      expect(farmer).toBeDefined();
      expect(farmer.name).toBe("Test Farmer");
      expect(farmer.farmName).toBe("Green Valley Farm");
    });

    it("should return a low-stock product correctly", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[2]}`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.product.name).toBe("Mangoes - Alphonso");
      expect(res.body.product.quantity).toBe(10);
      expect(res.body.product.price).toBe(200);
    });

    it("should return an unavailable product correctly", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[3]}`)
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(200);

      expect(res.body.product.name).toBe("Fresh Oranges");
      expect(res.body.product.isAvailable).toBe(false);
      expect(res.body.product.quantity).toBe(0);
    });
  });

  // ── Edge cases ──
  describe("edge cases", () => {
    it("should return 500 for malformed product ID", async () => {
      const res = await request(app)
        .get("/api/farmers/products/not-a-valid-id")
        .set("Authorization", `Bearer ${farmerToken}`)
        .expect(500);

      expect(res.body.message).toBeDefined();
    });

    it("should return 404 for ObjectId with correct format but no match", async () => {
      const res = await request(app)
        .get(`/api/farmers/products/${testProductIds[0]}`)
        .set("Authorization", `Bearer ${otherFarmerToken}`)
        .expect(404);

      expect(res.body.message).toBe("Product not found");
    });
  });
});

// ═════════════════════════════════════════════════
// POST /api/farmers/products — approval gate
// ═════════════════════════════════════════════════
describe("POST /api/farmers/products (approval gate)", () => {
  it("should return 403 when the farmer is pending verification", async () => {
    // Seeded farmers default to verificationStatus "pending"
    const res = await request(app)
      .post("/api/farmers/products")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send(createProductData())
      .expect(403);

    expect(res.body.message).toMatch(/pending admin approval/i);
  });

  it("should return 403 when the farmer is rejected", async () => {
    await User.updateOne(
      { email: farmerData.email },
      { verificationStatus: "rejected" }
    );

    const res = await request(app)
      .post("/api/farmers/products")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send(createProductData())
      .expect(403);

    expect(res.body.message).toMatch(/rejected/i);
  });

  it("should allow a verified farmer to add a product (starts pending)", async () => {
    await User.updateOne(
      { email: farmerData.email },
      { verificationStatus: "verified" }
    );

    const res = await request(app)
      .post("/api/farmers/products")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send(createProductData())
      .expect(201);

    expect(res.body.product).toBeDefined();
    expect(res.body.product.approvalStatus).toBe("pending");
  });

  it("should also gate updates for unverified farmers", async () => {
    await User.updateOne(
      { email: farmerData.email },
      { verificationStatus: "pending" }
    );

    const res = await request(app)
      .put(`/api/farmers/products/${testProductIds[0]}`)
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ price: 99 })
      .expect(403);

    expect(res.body.message).toMatch(/pending admin approval/i);
  });
});

// ═════════════════════════════════════════════════
// GET /api/products — public visibility only after approval
// ═════════════════════════════════════════════════
describe("GET /api/products (public visibility gate)", () => {
  it("should not show pending products on the public marketplace", async () => {
    // Seeded products default to approvalStatus "pending"
    const res = await request(app)
      .get("/api/products")
      .expect(200);

    expect(res.body.products).toBeDefined();
    expect(res.body.products.length).toBe(0);
  });

  it("should show a product only after it is approved", async () => {
    // Approve exactly one product and confirm it appears
    await Product.updateOne(
      { _id: testProductIds[0] },
      { approvalStatus: "approved" }
    );

    const res = await request(app)
      .get("/api/products")
      .expect(200);

    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0]._id).toBe(testProductIds[0]);
  });

  it("should exclude rejected products from the public marketplace", async () => {
    await Product.updateOne(
      { _id: testProductIds[0] },
      { approvalStatus: "approved" }
    );
    await Product.updateOne(
      { _id: testProductIds[1] },
      { approvalStatus: "rejected" }
    );

    const res = await request(app)
      .get("/api/products")
      .expect(200);

    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0]._id).toBe(testProductIds[0]);
  });
});
