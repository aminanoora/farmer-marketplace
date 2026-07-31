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

// Map legacy product names to the correct replacement image
const PRODUCT_IMAGE_BY_NAME: Record<string, string> = {
  "Farm Fresh Potatoes": IMAGES.potatoes,
  "Fresh Spinach Bundle": IMAGES.spinach,
  "Organic Tomatoes": IMAGES.tomatoes,
  "Crunchy Carrots": IMAGES.carrots,
  "Sweet Green Peas": IMAGES.peas,
  "Fresh Apples": IMAGES.apples,
  "Seasonal Bananas": IMAGES.bananas,
  "Whole Wheat Flour": IMAGES.wheat,
  "Basmati Rice": IMAGES.rice,
  "Fresh Milk": IMAGES.milk,
  Tomato: IMAGES.tomatoes,
};

const AVATAR_BY_NAME: Record<string, string> = {
  "Ramesh Kumar": AVATARS.ramesh,
  "Sunita Devi": AVATARS.sunita,
  "Harpreet Singh": AVATARS.harpreet,
};

const OLD_PREFIX = "https://lh3.googleusercontent.com/aida-public/";

async function fix() {
  await mongoose.connect(MONGODB_URI);
  console.log("📦 Connected to MongoDB");

  const db = mongoose.connection.db;

  // ── Products: fix image URLs + approval status ──
  const products = await db.collection("products").find({}).toArray();
  let imagesFixed = 0;
  let approved = 0;

  for (const p of products) {
    const hadOldImage =
      Array.isArray(p.images) &&
      p.images.some((img: string) => String(img).startsWith(OLD_PREFIX));

    const hadEmptyImages =
      !Array.isArray(p.images) || p.images.length === 0;

    if (hadOldImage || hadEmptyImages) {
      const replacement = PRODUCT_IMAGE_BY_NAME[p.name];
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
  await mongoose.disconnect();
  process.exit(0);
}

fix().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
