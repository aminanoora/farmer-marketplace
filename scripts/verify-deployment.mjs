#!/usr/bin/env node
/**
 * End-to-end deployment verification for Krishi Market.
 *
 * Usage:
 *   node scripts/verify-deployment.mjs                 # → http://localhost:5000
 *   node scripts/verify-deployment.mjs https://xxx.up.railway.app
 *
 * Runs the full chain: health → seeded data → farmer login → JWT auth →
 * image upload (Vercel Blob) → public image URL → admin approve →
 * marketplace visibility → cleanup.
 *
 * Env overrides (optional): E2E_FARMER_EMAIL, E2E_FARMER_PASSWORD,
 * E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD (defaults match scripts/seed.ts).
 */
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:5000").replace(/\/+$/, "");
const FARMER = {
  email: process.env.E2E_FARMER_EMAIL || "ramesh@farm.com",
  password: process.env.E2E_FARMER_PASSWORD || "farmer123",
};
const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || "admin@gmail.com",
  password: process.env.E2E_ADMIN_PASSWORD || "admin#123",
};

// 1x1 transparent PNG (known-good bytes)
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let passed = 0;
let failed = 0;
let skipped = 0;
let testProductId = null;
let farmerToken = null;

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  let body = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, ok: res.ok };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    if (detail && detail.skipped) {
      skipped++;
      log("⏭️", `${name} — skipped: ${detail.message}`);
    } else {
      passed++;
      log("✅", `${name} — ${detail || "ok"}`);
    }
  } catch (err) {
    failed++;
    log("❌", `${name} — ${err.message}`);
  }
}

console.log(`\n🔎 Krishi Market deployment verification → ${BASE}\n`);

// 1. Health
await check("Health endpoint", async () => {
  const r = await request("/health");
  if (r.status !== 200) throw new Error(`expected 200, got ${r.status}`);
  if (r.body?.status !== "ok") throw new Error(`expected status ok, got ${JSON.stringify(r.body)}`);
  return "server alive";
});

// 2. Homepage data (seeded DB)
await check("Homepage data (seeded DB)", async () => {
  const r = await request("/api/homepage");
  if (r.status !== 200) throw new Error(`expected 200, got ${r.status}`);
  const data = r.body;
  const cats = (data?.categories || []).length;
  const farmers = (data?.featuredFarmers || []).length;
  const products = (data?.recentProducts || []).length;
  if (cats === 0 && products === 0) {
    return {
      skipped: true,
      message: "database looks empty — run `npm run seed` first",
    };
  }
  return `${cats} categories, ${farmers} farmers, ${products} products`;
});

// 3. Farmer login
await check("Farmer login (JWT)", async () => {
  const r = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(FARMER),
  });
  if (r.status !== 200) throw new Error(`login failed (${r.status}): ${r.body?.message || r.body}`);
  if (!r.body?.token) throw new Error("no token in response");
  farmerToken = r.body.token;
  return `signed in as ${r.body?.user?.name || FARMER.email}`;
});

// 4. Auth check (protected route with token)
await check("Auth: GET /api/farmers/me", async () => {
  if (!farmerToken) return { skipped: true, message: "no farmer token (login failed)" };
  const r = await request("/api/farmers/me", {
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  if (r.status !== 200) throw new Error(`expected 200, got ${r.status}: ${r.body?.message || r.body}`);
  return `farmer: ${r.body?.farmer?.name}`;
});

// 5. Categories (need an id for the upload test)
let categoryId = null;
await check("Categories", async () => {
  const r = await request("/api/categories");
  if (r.status !== 200) throw new Error(`expected 200, got ${r.status}`);
  const cats = r.body?.categories || [];
  if (cats.length === 0) return { skipped: true, message: "no categories — seed the DB" };
  categoryId = cats[0]._id;
  return `${cats.length} categories (using "${cats[0].name}" for upload)`;
});

// 6. Image upload (multipart → Vercel Blob)
const productName = `E2E Test ${Date.now()}`;
await check("Upload product with image (multipart)", async () => {
  if (!farmerToken) throw new Error("no farmer token");
  if (!categoryId) throw new Error("no category id");
  const fd = new FormData();
  fd.append("name", productName);
  fd.append("category", categoryId);
  fd.append("price", "10");
  fd.append("unit", "kg");
  fd.append("quantity", "5");
  fd.append("isAvailable", "true");
  fd.append("isOrganic", "false");
  fd.append("description", "Temporary E2E verification product — safe to delete.");
  fd.append("images", new Blob([TEST_PNG], { type: "image/png" }), "e2e-test.png");

  const r = await request("/api/farmers/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${farmerToken}` },
    body: fd,
  });
  if (r.status !== 201) {
    const msg = r.body?.message || JSON.stringify(r.body);
    throw new Error(`upload failed (${r.status}): ${msg}${/BLOB|blob|token/i.test(msg) ? " — is BLOB_READ_WRITE_TOKEN set on the server?" : ""}`);
  }
  testProductId = r.body?.product?._id;
  const images = r.body?.product?.images || [];
  if (images.length === 0) throw new Error("product saved but no images returned");
  if (!/^https?:\/\//.test(images[0])) throw new Error(`image is not a URL: ${images[0]}`);
  if (!images[0].includes("blob.vercel-storage.com")) throw new Error(`image is not on Vercel Blob: ${images[0]}`);
  return `stored as ${images[0].replace(/^https:\/\/[^/]+\//, "…/")}`;
});

// 7. Public image URL is fetchable
await check("Uploaded image is publicly fetchable", async () => {
  if (!testProductId) throw new Error("no test product to check");
  const r = await request("/api/farmers/products/" + testProductId, {
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  const img = r.body?.product?.images?.[0];
  if (!img) throw new Error("product has no image");
  const res = await fetch(img);
  if (res.status !== 200) throw new Error(`image fetch got HTTP ${res.status}`);
  return `${res.headers.get("content-type") || "image"} (${res.headers.get("content-length") || "?"} bytes)`;
});

// 8. Admin login + approve
let adminToken = null;
await check("Admin login", async () => {
  const r = await request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  if (r.status !== 200) throw new Error(`admin login failed (${r.status}): ${r.body?.message || r.body}`);
  adminToken = r.body.token;
  return "signed in as admin";
});

await check("Admin approves product", async () => {
  if (!testProductId) throw new Error("no test product");
  if (!adminToken) throw new Error("no admin token");
  const r = await request(`/api/admin/products/${testProductId}/approve`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (r.status !== 200) throw new Error(`approve failed (${r.status}): ${r.body?.message || r.body}`);
  return "approved";
});

// 9. Marketplace visibility
await check("Product visible on marketplace", async () => {
  if (!testProductId) throw new Error("no test product");
  const r = await request(`/api/products?search=${encodeURIComponent(productName)}`);
  const found = (r.body?.products || []).some((p) => p._id === testProductId);
  if (!found) throw new Error("product not returned by public marketplace search");
  return "visible";
});

// 10. Cleanup — delete the test product (also deletes its Blob object)
await check("Cleanup: delete test product", async () => {
  if (!testProductId) throw new Error("nothing to clean up");
  if (!farmerToken) throw new Error("no farmer token");
  const r = await request(`/api/farmers/products/${testProductId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  if (r.status !== 200) throw new Error(`delete failed (${r.status}): ${r.body?.message || r.body}`);
  return "removed";
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
process.exit(failed > 0 ? 1 : 0);
