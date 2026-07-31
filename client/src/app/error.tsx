"use client";

// Skip static prerendering to avoid Next.js internal error page conflicts
export const dynamic = "force-dynamic";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-6 py-12">
        <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-[48px]">⚠️</span>
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-2">500</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-8">
          An unexpected error occurred. Please try again later.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-8 py-3 bg-green-700 text-white font-medium rounded-xl hover:bg-green-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
