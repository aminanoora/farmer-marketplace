/** @type {import('next').NextConfig} */

// Backend origin used by rewrites. In production this must be the deployed
// API URL (e.g. https://your-api.vercel.app) — set `BACKEND_URL` on the Vercel
// project BEFORE building, since rewrites are baked in at build time.
//
// Uploaded product images are stored on Vercel Blob as absolute public URLs,
// so no /uploads proxy is needed anymore.
const path = require("path");

const BACKEND_ORIGIN = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig = {
  // Monorepo root. Without this, Next.js infers the workspace root from nearby
  // lockfiles (on this machine it can pick a stray package-lock.json in the
  // user's home directory) and prints a warning. Setting it explicitly also
  // makes output file tracing cover the whole repo during `next build`.
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      // Dev-only safety net: legacy local image URLs (http://localhost:5000/...)
      // from pre-Blob data stay optimizable locally (https is covered above).
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
