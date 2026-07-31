/**
 * Seed script to populate the database with sample data
 * Run: npm run seed
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/krishi_market";

// Material Symbols icon names for categories (used in the UI)
const CATEGORY_ICONS = {
  vegetables: "eco",
  fruits: "spa",
  dairy: "egg",
  grains: "grass",
};

// Stable Unsplash CDN links (the previous Google aida-public links expired).
const FARMER_AVATARS = {
  ramesh:
    "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=400&q=80",
  sunita:
    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80",
  harpreet:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80",
};

const PRODUCT_IMAGES = {
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

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("📦 Connected to MongoDB");

    // Import models after connection
    const User = (await import("../server/src/models/User")).default;
    const Category = (await import("../server/src/models/Category")).default;
    const Product = (await import("../server/src/models/Product")).default;
    const Newsletter = (await import("../server/src/models/Newsletter")).default;

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Newsletter.deleteMany({}),
      (await import("../server/src/models/Order")).default.deleteMany({}),
      (await import("../server/src/models/Address")).default.deleteMany({}),
    ]);
    console.log("🧹 Cleared existing data");

    // ────────────────────────────────────────────
    // 1. Create Admin
    // ────────────────────────────────────────────
    const admin = new User({
      name: "Admin",
      email: "admin@gmail.com",
      password: "admin#123",
      role: "admin",
    });
    await admin.save();
    console.log("👤 Admin created (admin@gmail.com / admin#123)");

    // ────────────────────────────────────────────
    // 2. Create Categories
    // ────────────────────────────────────────────
    const categories = await Category.insertMany([
      {
        name: "Vegetables",
        slug: "vegetables",
        description: "Fresh, seasonal vegetables straight from the farm",
        icon: CATEGORY_ICONS.vegetables,
        isActive: true,
      },
      {
        name: "Fruits",
        slug: "fruits",
        description: "Juicy, ripe fruits harvested at their peak",
        icon: CATEGORY_ICONS.fruits,
        isActive: true,
      },
      {
        name: "Dairy",
        slug: "dairy",
        description: "Pure dairy products from grass-fed cattle",
        icon: CATEGORY_ICONS.dairy,
        isActive: true,
      },
      {
        name: "Grains",
        slug: "grains",
        description: "Nutritious grains, lentils, and pulses",
        icon: CATEGORY_ICONS.grains,
        isActive: true,
      },
    ]);
    console.log("📂 Categories created");

    // ────────────────────────────────────────────
    // 3. Create Farmers
    // ────────────────────────────────────────────
    const farmerRamesh = new User({
      name: "Ramesh Kumar",
      email: "ramesh@farm.com",
      password: "farmer123",
      role: "farmer",
      phone: "9876543210",
      avatar: FARMER_AVATARS.ramesh,
      farmName: "Green Acres Farm",
      farmLocation: {
        village: "Puranpur",
        district: "Saharanpur",
        state: "Uttar Pradesh",
      },
      cropTypes: ["Vegetables", "Potatoes", "Leafy Greens"],
      farmingMethod: "organic",
      verificationStatus: "verified",
    });
    await farmerRamesh.save();

    const farmerSunita = new User({
      name: "Sunita Devi",
      email: "sunita@farm.com",
      password: "farmer123",
      role: "farmer",
      phone: "9876543211",
      avatar: FARMER_AVATARS.sunita,
      farmName: "Sunrise Orchards",
      farmLocation: {
        village: "Naggar",
        district: "Kullu",
        state: "Himachal Pradesh",
      },
      cropTypes: ["Fruits", "Vegetables", "Herbs"],
      farmingMethod: "organic",
      verificationStatus: "verified",
    });
    await farmerSunita.save();

    const farmerHarpreet = new User({
      name: "Harpreet Singh",
      email: "harpreet@farm.com",
      password: "farmer123",
      role: "farmer",
      phone: "9876543212",
      avatar: FARMER_AVATARS.harpreet,
      farmName: "Golden Plains Farm",
      farmLocation: {
        village: "Gobindgarh",
        district: "Ludhiana",
        state: "Punjab",
      },
      cropTypes: ["Grains", "Bananas", "Wheat"],
      farmingMethod: "both",
      verificationStatus: "verified",
    });
    await farmerHarpreet.save();

    console.log("🧑‍🌾 3 Farmers created");

    // ────────────────────────────────────────────
    // 4. Create Products
    // ────────────────────────────────────────────
    const vegCategory = categories[0]._id;
    const fruitCategory = categories[1]._id;
    const dairyCategory = categories[2]._id;
    const grainCategory = categories[3]._id;

    // Ramesh's products
    await Product.insertMany([
      {
        farmer: farmerRamesh._id,
        name: "Farm Fresh Potatoes",
        description:
          "Organic red-skinned potatoes with rich, dark earth still clinging to them. Perfect for curries and roasting.",
        category: vegCategory,
        price: 45,
        unit: "kg",
        quantity: 200,
        images: [PRODUCT_IMAGES.potatoes],
        isOrganic: true,
        isAvailable: true,
        approvalStatus: "approved",
        harvestDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        farmer: farmerRamesh._id,
        name: "Fresh Spinach Bundle",
        description: "Vibrant green spinach leaves, freshly picked and full of iron.",
        category: vegCategory,
        price: 25,
        unit: "bundle",
        quantity: 80,
        images: [PRODUCT_IMAGES.spinach],
        isOrganic: true,
        isAvailable: true,
        approvalStatus: "approved",
        harvestDate: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000),
      },
      {
        farmer: farmerRamesh._id,
        name: "Organic Tomatoes",
        description: "Plump, juicy tomatoes bursting with flavor.",
        category: vegCategory,
        price: 40,
        unit: "kg",
        quantity: 60,
        images: [PRODUCT_IMAGES.tomatoes],
        isOrganic: true,
        isAvailable: true,
        approvalStatus: "approved",
      },
    ]);

    // Sunita's products
    await Product.insertMany([
      {
        farmer: farmerSunita._id,
        name: "Crunchy Carrots",
        description:
          "Vibrant orange carrots with long green leafy tops, recently pulled from the ground.",
        category: vegCategory,
        price: 30,
        unit: "kg",
        quantity: 100,
        images: [PRODUCT_IMAGES.carrots],
        isOrganic: true,
        isAvailable: true,
        approvalStatus: "approved",
        harvestDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        farmer: farmerSunita._id,
        name: "Sweet Green Peas",
        description:
          "Perfectly round, sweet green peas glowing with natural goodness.",
        category: vegCategory,
        price: 80,
        unit: "kg",
        quantity: 50,
        images: [PRODUCT_IMAGES.peas],
        isOrganic: true,
        isAvailable: true,
        approvalStatus: "approved",
        harvestDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        farmer: farmerSunita._id,
        name: "Fresh Apples",
        description: "Crisp, juicy apples from the orchards of Himachal.",
        category: fruitCategory,
        price: 120,
        unit: "kg",
        quantity: 75,
        images: [PRODUCT_IMAGES.apples],
        isOrganic: true,
        isAvailable: true,
        approvalStatus: "approved",
      },
    ]);

    // Harpreet's products
    await Product.insertMany([
      {
        farmer: farmerHarpreet._id,
        name: "Seasonal Bananas",
        description:
          "Bright yellow bananas with smooth, perfect skin. Naturally sweet.",
        category: fruitCategory,
        price: 60,
        unit: "dozen",
        quantity: 150,
        images: [PRODUCT_IMAGES.bananas],
        isOrganic: false,
        isAvailable: true,
        approvalStatus: "approved",
      },
      {
        farmer: farmerHarpreet._id,
        name: "Whole Wheat Flour",
        description: "Stone-ground whole wheat atta from premium Punjab wheat.",
        category: grainCategory,
        price: 35,
        unit: "kg",
        quantity: 300,
        images: [PRODUCT_IMAGES.wheat],
        isOrganic: false,
        isAvailable: true,
        approvalStatus: "approved",
      },
      {
        farmer: farmerHarpreet._id,
        name: "Basmati Rice",
        description: "Premium aged basmati rice with aromatic fragrance.",
        category: grainCategory,
        price: 90,
        unit: "kg",
        quantity: 200,
        images: [PRODUCT_IMAGES.rice],
        isOrganic: false,
        isAvailable: true,
        approvalStatus: "approved",
      },
      {
        farmer: farmerHarpreet._id,
        name: "Fresh Milk",
        description: "Pure, fresh milk from grass-fed cows.",
        category: dairyCategory,
        price: 60,
        unit: "litre",
        quantity: 40,
        images: [PRODUCT_IMAGES.milk],
        isOrganic: true,
        isAvailable: true,
        approvalStatus: "approved",
      },
    ]);

    console.log("📦 Products created");

    // ────────────────────────────────────────────
    // 5. Create Consumer
    // ────────────────────────────────────────────
    const consumer = new User({
      name: "Priya Sharma",
      email: "priya@example.com",
      password: "consumer123",
      role: "consumer",
      phone: "9988776655",
    });
    await consumer.save();
    console.log("👤 Consumer created");

    // ────────────────────────────────────────────
    // 6. Create Addresses for Consumer
    // ────────────────────────────────────────────
    const Address = (await import("../server/src/models/Address")).default;
    await Address.insertMany([
      {
        user: consumer._id,
        label: "Home",
        phone: "9988776655",
        street: "42, Green Park Colony",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110016",
        isDefault: true,
      },
      {
        user: consumer._id,
        label: "Work",
        phone: "9988776655",
        street: "5th Floor, Tower B, Cyber Hub",
        city: "Gurugram",
        state: "Haryana",
        pincode: "122002",
        isDefault: false,
      },
      {
        user: consumer._id,
        label: "Farm",
        phone: "9876543210",
        street: "Village Purana Qila, NH-44",
        city: "Sonipat",
        state: "Haryana",
        pincode: "131001",
        isDefault: false,
      },
    ]);
    console.log("📍 3 Addresses created");

    // ────────────────────────────────────────────
    // 7. Create Orders for Consumer
    // ────────────────────────────────────────────
    const Order = (await import("../server/src/models/Order")).default;

    // Fetch the actual products and farmers for order items
    const allProducts = await Product.find({}).populate("farmer", "name farmName");

    // Group products by farmer
    const farmerProducts: Record<string, any[]> = {};
    for (const p of allProducts) {
      const fid = p.farmer._id.toString();
      if (!farmerProducts[fid]) farmerProducts[fid] = [];
      farmerProducts[fid].push(p);
    }

    const farmerIds = Object.keys(farmerProducts);
    const deliveryDaysAgo = (days: number) =>
      new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Helper to create order items from products (pick first 1-2 from a farmer)
    function makeItems(products: any[], count = 2) {
      const picked = products.slice(0, count);
      return picked.map((p: any) => ({
        product: p._id,
        name: p.name,
        price: p.price,
        quantity: Math.floor(Math.random() * 3) + 1,
        unit: p.unit,
      }));
    }

    const ordersData = [
      // Delivered order — Ramesh's products (COD, paid)
      {
        consumer: consumer._id,
        farmer: farmerIds[0],
        items: makeItems(farmerProducts[farmerIds[0]] || [], 2),
        status: "delivered" as const,
        paymentMethod: "cod" as const,
        paymentStatus: "paid" as const,
        deliveryAddress: {
          fullName: "Priya Sharma",
          phone: "9988776655",
          street: "42, Green Park Colony",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110016",
        },
        deliverySlot: {
          date: deliveryDaysAgo(7),
          timeSlot: "08:00-10:00",
        },
        createdAt: deliveryDaysAgo(7),
      },
      // Out for delivery — Sunita's products (online, paid)
      {
        consumer: consumer._id,
        farmer: farmerIds[1],
        items: makeItems(farmerProducts[farmerIds[1]] || [], 2),
        status: "out-for-delivery" as const,
        paymentMethod: "online" as const,
        paymentStatus: "paid" as const,
        deliveryAddress: {
          fullName: "Priya Sharma",
          phone: "9988776655",
          street: "5th Floor, Tower B, Cyber Hub",
          city: "Gurugram",
          state: "Haryana",
          pincode: "122002",
        },
        deliverySlot: {
          date: new Date(),
          timeSlot: "14:00-16:00",
        },
        createdAt: deliveryDaysAgo(1),
      },
      // Processing — Harpreet's products (COD, pending)
      {
        consumer: consumer._id,
        farmer: farmerIds[2],
        items: makeItems(farmerProducts[farmerIds[2]] || [], 2),
        status: "confirmed" as const,
        paymentMethod: "cod" as const,
        paymentStatus: "pending" as const,
        deliveryAddress: {
          fullName: "Priya Sharma",
          phone: "9988776655",
          street: "42, Green Park Colony",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110016",
        },
        createdAt: deliveryDaysAgo(2),
      },
      // Cancelled — Ramesh's products (online, refunded)
      {
        consumer: consumer._id,
        farmer: farmerIds[0],
        items: makeItems(farmerProducts[farmerIds[0]] || [], 1),
        status: "cancelled" as const,
        paymentMethod: "online" as const,
        paymentStatus: "refunded" as const,
        deliveryAddress: {
          fullName: "Priya Sharma",
          phone: "9988776655",
          street: "42, Green Park Colony",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110016",
        },
        createdAt: deliveryDaysAgo(14),
      },
    ];

    // Calculate totalAmount for each order
    for (const o of ordersData) {
      (o as any).totalAmount = o.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
    }

    await Order.insertMany(ordersData);
    console.log("📦 4 Orders created");

    // ────────────────────────────────────────────
    // 7. Summary
    // ────────────────────────────────────────────
    console.log("\n✅ Seed completed successfully!");
    console.log("\n📋 Login Credentials:");
    console.log("   Admin:    admin@gmail.com / admin#123");
    console.log("   Farmer:   ramesh@farm.com / farmer123");
    console.log("   Farmer:   sunita@farm.com / farmer123");
    console.log("   Farmer:   harpreet@farm.com / farmer123");
    console.log("   Consumer: priya@example.com / consumer123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
