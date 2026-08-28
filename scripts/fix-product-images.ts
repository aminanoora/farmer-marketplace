/**
 * One-off migration: repair product/farmer images that used Google's
 * ephemeral `lh3.googleusercontent.com/aida-public/...` URLs (which have
 * since expired and return HTTP 400), and mark previously-seeded products
 * as approved so they show up in the public marketplace.
 *
 * Run: npm run fix:product-images
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/krishi_market";

// Stable Unsplash CDN links (same set used by scripts/seed.ts)
const IMAGES = {
  potatoes:
    "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=800&q=80",
  carrots:
    "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=800&q=80",
  bananas:
    "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=800&q=80",
  peas:
    "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80",
  tomatoes:
    "https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?auto=format&fit=crop&w=800&q=80",
  spinach:
    "https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=800&q=80",
  apples:
    "https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=800&q=80",
  wheat:
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80",
  rice:
    "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
  milk:
    "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80",
};

const AVATARS = {
  ramesh:
    "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=400&q=80",
  sunita:
    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80",
  harpreet:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80",
};

// Map legacy product names to the correct replacement image.
// Lookup is case-insensitive (e.g. "tomato" → IMAGES.tomatoes).
const PRODUCT_IMAGE_BY_NAME: Record<string, string> = {
  "farm fresh potatoes": IMAGES.potatoes,
  "fresh spinach bundle": IMAGES.spinach,
  "organic tomatoes": IMAGES.tomatoes,
  "crunchy carrots": IMAGES.carrots,
  "sweet green peas": IMAGES.peas,
  "fresh apples": IMAGES.apples,
  "seasonal bananas": IMAGES.bananas,
  "whole wheat flour": IMAGES.wheat,
  "basmati rice": IMAGES.rice,
  "fresh milk": IMAGES.milk,
  tomato: IMAGES.tomatoes,
};

const AVATAR_BY_NAME: Record<string, string> = {
  "Ramesh Kumar": AVATARS.ramesh,
  "Sunita Devi": AVATARS.sunita,
  "Harpreet Singh": AVATARS.harpreet,
};

// Expired Google ephemeral URLs
const OLD_PREFIX = "https://lh3.googleusercontent.com/aida-public/";
// Legacy relative paths from the pre-Blob local-disk uploads. The /uploads
// proxy was removed from next.config.js when uploads moved to Vercel Blob,
// so these relative URLs 404 on the client and must be migrated too.
const UPLOADS_PREFIX = "/uploads/";

async function fix() {
  await mongoose.connect(MONGODB_URI);
  console.log("📦 Connected to MongoDB");

  const db = mongoose.connection.db;

  // ── Products: fix image URLs + approval status ──
  const products = await db.collection("products").find({}).toArray();
  let imagesFixed = 0;
  let approved = 0;

  for (const p of products) {
    const images = Array.isArray(p.images) ? p.images : [];
    const hadOldImage = images.some((img: string) =>
      String(img).startsWith(OLD_PREFIX)
    );
    const hadUploadsImage = images.some((img: string) =>
      String(img).startsWith(UPLOADS_PREFIX)
    );

    const hadEmptyImages = images.length === 0;

    if (hadOldImage || hadUploadsImage || hadEmptyImages) {
      const replacement = PRODUCT_IMAGE_BY_NAME[String(p.name).toLowerCase()];
      if (replacement) {
        await db.collection("products").updateOne(
          { _id: p._id },
          { $set: { images: [replacement] } }
        );
        imagesFixed++;
        console.log(`  🖼️  ${p.name} → fixed image`);
      } else {
        console.log(`  ⚠️  ${p.name} → no replacement mapped`);
      }

      // Only approve products this migration actually repaired (seeded data
      // that was missing approvalStatus), never pending farmer uploads.
      if (p.approvalStatus !== "approved") {
        await db.collection("products").updateOne(
          { _id: p._id },
          { $set: { approvalStatus: "approved" } }
        );
        approved++;
        console.log(`  ✅ ${p.name} → approved`);
      }
    }
  }

  // ── Farmers: fix avatar URLs ──
  const farmers = await db
    .collection("users")
    .find({ role: "farmer" })
    .toArray();
  let avatarsFixed = 0;
  for (const f of farmers) {
    if (f.avatar && String(f.avatar).startsWith(OLD_PREFIX)) {
      const replacement = AVATAR_BY_NAME[f.name];
      if (replacement) {
        await db
          .collection("users")
          .updateOne({ _id: f._id }, { $set: { avatar: replacement } });
        avatarsFixed++;
        console.log(`  👤 ${f.name} → avatar fixed`);
      }
    }
  }

  console.log(
    `\n✅ Done — products image-fixed: ${imagesFixed}, approved: ${approved}, avatars fixed: ${avatarsFixed}`
  );
  const remainingUploads = await db
    .collection("products")
    .countDocuments({ images: { $elemMatch: { $regex: "^/uploads/" } } });
  console.log(
    remainingUploads > 0
      ? `⚠️  ${remainingUploads} product(s) still have /uploads/ images (no name mapping).`
      : "🧹 No products with legacy /uploads/ images remain."
  );
  await mongoose.disconnect();
  process.exit(0);
}

fix().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
