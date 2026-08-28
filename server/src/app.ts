import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { errorHandler } from "./middleware/error.middleware";
import { sanitizeInput } from "./middleware/sanitize.middleware";
import { maintenanceMode } from "./middleware/maintenance.middleware";
import routes from "./routes";

const app = express();

// ─── Middleware ───────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Input Sanitization (XSS prevention) ──────
app.use(sanitizeInput);

// ─── Maintenance Mode ─────────────────────────
// Blocks non-admin API routes when PlatformSettings.maintenanceMode is true.
// Admin routes bypass this so admins can still log in and toggle it off.
// Health check and root are always accessible.
app.use("/api", (req, res, next) => {
  // Skip maintenance check for admin routes — admins must be able to
  // log in and disable maintenance mode from the dashboard.
  if (req.path.startsWith("/admin")) {
    next();
    return;
  }
  maintenanceMode(req, res, next);
});

// ─── Root & Health (no DB required) ─────────────
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Lazy MongoDB connection ─────────────────────
// Memoized inside connectDatabase — warm serverless instances reuse the
// cached connection; only the first request on a cold start pays the cost.
app.use(async (_req, _res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

// ─── API Routes ─────────────────────────────────
app.use("/api", routes);

// ─── Error Handler ──────────────────────────────
app.use(errorHandler);

export default app;
