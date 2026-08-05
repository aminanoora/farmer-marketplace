import mongoose from "mongoose";

/**
 * Serverless-safe MongoDB connection helper (Vercel-ready).
 *
 * - Memoizes the connection so warm function instances reuse the existing
 *   TCP/TLS socket instead of opening a fresh connection per request
 *   (which would exhaust MongoDB Atlas connection limits).
 * - `bufferCommands: false` makes Mongoose fail fast when disconnected
 *   instead of silently queueing commands.
 * - `serverSelectionTimeoutMS` keeps cold starts bounded instead of hanging.
 * - Never calls `process.exit()` — in a serverless function that would kill
 *   the container mid-request.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as unknown as {
  krishiMongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalForMongoose.krishiMongoose ?? { conn: null, promise: null };

globalForMongoose.krishiMongoose = cached;

export const connectDatabase = async (): Promise<typeof mongoose> => {
  if (cached.conn) return cached.conn;

  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/krishi_market";

  if (!cached.promise) {
    mongoose.set("bufferCommands", false);
    cached.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      // Keep the pool small: many concurrent serverless instances × a large
      // pool would exhaust Atlas M0's connection limit (500).
      maxPoolSize: 10,
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB runtime error:", err);
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    // Reset the promise so the next request can retry instead of caching a
    // permanently-rejected connection.
    cached.promise = null;
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};
