import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import authRoutes from "../../routes/auth.routes";
import adminRoutes from "../../routes/admin.routes";
import farmerRoutes from "../../routes/farmer.routes";
import productRoutes from "../../routes/product.routes";
import categoryRoutes from "../../routes/category.routes";
import orderRoutes from "../../routes/order.routes";
import reviewRoutes from "../../routes/review.routes";
import publicRoutes from "../../routes/public.routes";
import addressRoutes from "../../routes/address.routes";
import { maintenanceMode } from "../../middleware/maintenance.middleware";

/**
 * Create a minimal Express app with routes mounted at /api.
 * Useful for integration tests with Supertest.
 */
export function createTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  // Maintenance mode middleware — blocks non-admin API routes
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/admin")) {
      next();
      return;
    }
    maintenanceMode(req, res, next);
  });
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/farmers", farmerRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/addresses", addressRoutes);
  app.use("/api", publicRoutes);
  return app;
}

/**
 * Start an in-memory MongoDB instance via MongoMemoryServer
 * and connect mongoose to it.
 */
export async function startMemoryServer(): Promise<MongoMemoryServer> {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  return mongoServer;
}

/**
 * Disconnect mongoose and stop the in-memory MongoDB server.
 */
export async function stopMemoryServer(mongoServer: MongoMemoryServer): Promise<void> {
  await mongoose.disconnect();
  await mongoServer.stop();
}

/**
 * Clear all collections in the test database.
 * Call this between test suites to ensure isolation.
 */
export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}


