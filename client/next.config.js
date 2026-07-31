/** @type {import('next').NextConfig} */

// Backend origin used by rewrites. Uploaded images are stored by the backend
// as relative paths like "/uploads/xxx.jpg", so they must be proxied to the
// API server from the client origin in order to display.
const BACKEND_ORIGIN = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${BACKEND_ORIGIN}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
