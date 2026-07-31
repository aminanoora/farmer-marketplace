/**
 * One-off migration script to replace URL-based category icons with
 * proper Material Symbols icon names.
 *
 * Run: npm run update:category-icons
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/krishi_market";

// Maps category slug/name to the Material Symbols icon name used in the UI.
// Keep in sync with client/src/app/marketplace/page.tsx (getCategoryIcon).
const CATEGORY_ICONS: Record<string, string> = {
  vegetables: "eco",
  fruits: "spa",
  dairy: "egg",
  grains: "grass",
};

const isUrl = (value: unknown): boolean =>
  typeof value === "string" && /^https?:\/\//i.test(value);

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const Category = (await import("../server/src/models/Category")).default;

    const categories = await Category.find({});
    console.log(`Found ${categories.length} categories`);

    let updated = 0;
    for (const cat of categories) {
      // Only touch categories whose icon is a URL
      if (!cat.icon || !isUrl(cat.icon)) continue;

      // Determine the icon name from the category name/slug (case-insensitive)
      const key = (cat.slug || cat.name).toLowerCase();
      const iconName = CATEGORY_ICONS[key] || "category";

      cat.icon = iconName;
      await cat.save();
      updated++;
      console.log(`  Updated "${cat.name}" (${cat.slug}): icon -> "${iconName}"`);
    }

    console.log(`Migration complete. Updated ${updated} category icons.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
