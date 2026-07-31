import dotenv from "dotenv";
dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  clientUrl: string;
  uploadDir: string;
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
    uploadDir: process.env.UPLOAD_DIR || "uploads",
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880", 10),
    resendApiKey: process.env.RESEND_API_KEY,
  };
};

export const env = validateEnv();
