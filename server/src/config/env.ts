import dotenv from "dotenv";
dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  clientUrl: string;
  maxFileSize: number;
  resendApiKey?: string;
}

const validateEnv = (): EnvConfig => {
  const required = ["JWT_SECRET", "MONGODB_URI"];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "5000", 10),
    mongoUri: process.env.MONGODB_URI!,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
    // 4 MB default — Vercel serverless functions cap the total request body
    // at 4.5 MB, so a larger per-file limit would never be reachable.
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "4194304", 10),
    resendApiKey: process.env.RESEND_API_KEY,
  };
};

export const env = validateEnv();
