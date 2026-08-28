import app from "./app";
import { connectDatabase } from "./config/database";

const PORT = process.env.PORT || 5000;

// ─── Start Server ───────────────────────────────
// Long-running listener for local dev and traditional hosts.
// On Vercel this file is NOT used — `api/index.ts` exports the app as a
// serverless function instead.
const start = async () => {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`🌾 Krishi Market server running on port ${PORT}`);
  });
};

start();

export default app;
