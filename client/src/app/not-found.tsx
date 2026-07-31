import Link from "next/link";

// Skip static prerendering to avoid Next.js internal 404 page conflicts
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-6 py-12">
        <div className="w-24 h-24 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-[48px]">🌾</span>
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Page not found</h2>
        <p className="text-gray-600 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-3 bg-green-700 text-white font-medium rounded-xl hover:bg-green-800 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
