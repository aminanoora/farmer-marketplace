import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import routes from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ──────────────────────────────
app.use("/uploads", express.static("uploads"));

// ─── Routes ─────────────────────────────────────
app.get("/", (_req, res) => {
  const clientUrl = env.clientUrl;

  if (env.nodeEnv === "production") {
    return res.json({
      server: "🌾 Krishi Market API",
      version: "1.0.0",
      health: "/health",
      endpoints: {
        auth: "/api/auth",
        products: "/api/products",
        farmers: "/api/farmers",
        categories: "/api/categories",
        orders: "/api/orders",
        reviews: "/api/reviews",
        admin: "/api/admin",
        homepage: "/api/homepage",
        search: "/api/search",
        featuredFarmers: "/api/featured-farmers",
      },
      frontend: clientUrl,
    });
  }

  // In development, redirect to the Next.js frontend
  res.redirect(302, clientUrl);
});

app.use("/api", routes);

// ─── Health Check ───────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Error Handler ──────────────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────
const start = async () => {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`🌾 Krishi Market server running on port ${PORT}`);
  });
};

start();

export default app;
