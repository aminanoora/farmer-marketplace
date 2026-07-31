// Test environment setup
// JWT_SECRET must be set before importing any modules that use it
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/krishi_market_test";
