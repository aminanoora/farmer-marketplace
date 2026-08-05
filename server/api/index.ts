/**
 * Vercel serverless entrypoint.
 *
 * Vercel's zero-config Node.js runtime compiles this file (and everything it
 * imports) automatically. `vercel.json` rewrites every request to this
 * function; the Express app receives the original request path, so its
 * `/api/*` routes match as usual.
 *
 * Env vars required at runtime (set in the Vercel project):
 *   - MONGODB_URI, JWT_SECRET   (validated at boot by src/config/env.ts)
 *   - BLOB_READ_WRITE_TOKEN     (Vercel Blob store token — image uploads)
 *   - CLIENT_URL                (frontend origin for CORS)
 */
import app from "../src/app";

export default app;
