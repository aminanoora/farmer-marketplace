"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { consumerAPI } from "@/lib/api";
import SiteHeader from "@/components/site-header";

/* ─── Types ──────────────────────────────────── */
interface Farmer {
  _id: string;
  name: string;
  farmName?: string;
  farmLocation?: { village: string; district: string; state: string };
  cropTypes?: string[];
  farmingMethod?: "organic" | "conventional" | "both";
  avatar?: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/* ─── Helpers ────────────────────────────────── */
function timeOnPlatform(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMonths =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  if (diffMonths < 1) return "New";
  if (diffMonths < 12) return `${diffMonths} mo`;
  const years = Math.floor(diffMonths / 12);
  return `${years} yr`;
}

function getLocation(farmer: Farmer): string {
  if (!farmer.farmLocation) return "";
  return [farmer.farmLocation.village, farmer.farmLocation.district, farmer.farmLocation.state]
    .filter(Boolean)
    .join(", ");
}

/* ─── Page Component ─────────────────────────── */
export default function FarmersPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchFarmers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: 12 };
      if (submittedSearch.trim()) params.search = submittedSearch.trim();
      const res = await consumerAPI.getFarmers(params);
      setFarmers(res.data.farmers || []);
      setPagination(res.data.pagination || null);
    } catch (err) {
      console.error("Failed to load farmers:", err);
      setError("Could not load farmers. Please try again.");
      setFarmers([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, submittedSearch]);

  useEffect(() => {
    fetchFarmers();
  }, [fetchFarmers]);

  const handleSearchSubmit = () => {
    setSubmittedSearch(searchQuery.trim());
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    if (p >= 1 && pagination && p <= pagination.pages) {
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SiteHeader activePage="farmers" />

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl pb-24 md:pb-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-lg">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Farmers</span>
        </nav>

        {/* Header */}
        <div className="mb-xl">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-2">
            Meet Our Farmers
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-xl mb-lg">
            Browse the verified farmers who grow the produce on your table — straight from their soil to you.
          </p>

          {/* Search */}
          <div className="relative max-w-xl group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors z-10">
              search
            </span>
            <input
              className="w-full pl-12 pr-28 py-4 bg-surface-container-low border-2 border-surface-variant rounded-2xl font-body-lg focus:border-primary focus:ring-0 transition-all shadow-sm text-on-surface"
              placeholder="Search by name, farm, or village..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchSubmit();
              }}
            />
            <button
              onClick={handleSearchSubmit}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 transition-all active:scale-95"
            >
              Search
            </button>
          </div>
        </div>

        {/* Results count */}
        <p className="font-body-md text-on-surface-variant mb-lg">
          {loading ? "Loading farmers..." : pagination ? `${pagination.total} verified farmer${pagination.total !== 1 ? "s" : ""} on Krishi Market` : ""}
        </p>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg animate-pulse">
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-surface-variant mb-4" />
                  <div className="h-5 w-32 bg-surface-variant rounded mb-2" />
                  <div className="h-4 w-24 bg-surface-variant rounded mb-4" />
                  <div className="h-10 w-full bg-surface-variant rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-[48px] text-error mb-4">error_outline</span>
            <p className="text-on-surface-variant text-body-lg mb-4">{error}</p>
            <button
              onClick={() => setPage(1)}
              className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all"
            >
              Try Again
            </button>
          </div>
        ) : farmers.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-[48px] text-outline mb-4">agriculture</span>
            <p className="text-on-surface-variant text-body-lg">
              No farmers found{submittedSearch ? ` for "${submittedSearch}"` : ""}.
            </p>
            <p className="text-label-md text-outline mt-2">
              Try a different search term.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
              {farmers.map((farmer) => {
                const location = getLocation(farmer);
                return (
                  <Link
                    key={farmer._id}
                    href={`/farmers/${farmer._id}`}
                    className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg flex flex-col items-center text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group"
                  >
                    {/* Avatar */}
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-container-high border-2 border-surface-variant mb-4 group-hover:border-primary transition-colors">
                      {farmer.avatar ? (
                        <img className="w-full h-full object-cover" src={farmer.avatar} alt={farmer.name} loading="lazy" decoding="async" onError={(e) => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = "1"; el.src = `https://placehold.co/400x300/e4e2dd/414844?text=${encodeURIComponent(farmer.name.charAt(0))}`; } }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10">
                          <span className="material-symbols-outlined text-[40px] text-primary">agriculture</span>
                        </div>
                      )}
                    </div>

                    <h2 className="font-headline-md text-[20px] text-primary mb-1">
                      {farmer.farmName || farmer.name}
                    </h2>
                    {farmer.farmName && farmer.farmName !== farmer.name && (
                      <p className="font-label-md text-label-md text-on-surface-variant mb-2">{farmer.name}</p>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 justify-center mb-3">
                      {farmer.farmingMethod === "organic" || farmer.farmingMethod === "both" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[11px] font-bold uppercase tracking-wider">
                          <span className="material-symbols-outlined text-[14px]">eco</span>Organic
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-[11px] font-bold uppercase tracking-wider">
                          <span className="material-symbols-outlined text-[14px]">spa</span>Natural
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-tertiary/10 text-tertiary rounded-full text-[11px] font-bold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[14px]">verified</span>Verified
                      </span>
                    </div>

                    {location && (
                      <p className="font-body-md text-on-surface-variant flex items-center gap-1 mb-2">
                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                        {location}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center justify-center gap-4 mt-auto pt-3 border-t border-outline-variant/50 w-full">
                      {farmer.cropTypes && farmer.cropTypes.length > 0 && (
                        <span className="font-label-sm text-on-surface-variant">
                          {farmer.cropTypes.length} crop{farmer.cropTypes.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="w-px h-4 bg-outline-variant" />
                      <span className="font-label-sm text-on-surface-variant">
                        {timeOnPlatform(farmer.createdAt)} on Krishi
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-xl flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                {(() => {
                  const total = pagination.pages;
                  const current = page;
                  const buttons: (number | "...")[] = [];
                  if (total <= 7) {
                    return Array.from({ length: total }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg font-label-md text-label-sm transition-colors ${
                          p === current ? "bg-primary text-on-primary" : "border border-outline-variant hover:bg-surface-variant text-on-surface"
                        }`}
                      >
                        {p}
                      </button>
                    ));
                  }
                  buttons.push(1);
                  if (current > 3) buttons.push("...");
                  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
                    buttons.push(i);
                  }
                  if (current < total - 2) buttons.push("...");
                  buttons.push(total);
                  return buttons.map((p, idx) =>
                    p === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-on-surface-variant font-label-md">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg font-label-md text-label-sm transition-colors ${
                          p === current ? "bg-primary text-on-primary" : "border border-outline-variant hover:bg-surface-variant text-on-surface"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!pagination || page >= pagination.pages}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── Bottom Navigation (Mobile) ──────── */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 md:hidden shadow-lg z-50 rounded-t-xl border-t border-outline-variant/30 bg-surface-container-lowest">
        <Link href="/marketplace" className="flex flex-col items-center justify-center text-on-surface-variant px-6 py-2 hover:bg-surface-variant transition-all active:scale-90 duration-150">
          <span className="material-symbols-outlined">storefront</span>
          <span className="font-label-sm text-label-sm">Shop</span>
        </Link>
        <Link href="/farmers" className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-2xl px-6 py-2 active:scale-90 transition-transform duration-150">
          <span className="material-symbols-outlined">agriculture</span>
          <span className="font-label-sm text-label-sm">Farms</span>
        </Link>
        <Link href="/orders" className="flex flex-col items-center justify-center text-on-surface-variant px-6 py-2 hover:bg-surface-variant transition-all active:scale-90 duration-150">
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="font-label-sm text-label-sm">Orders</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center justify-center text-on-surface-variant px-6 py-2 hover:bg-surface-variant transition-all active:scale-90 duration-150">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </Link>
      </nav>

      {/* ─── Footer ──────────────────────────── */}
      <footer className="hidden md:block bg-primary mt-12">
        <div className="max-w-max-width mx-auto px-margin-desktop py-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <div className="space-y-md">
              <div className="font-headline-md text-headline-md text-on-primary">Krishi Market</div>
              <p className="font-body-md text-body-md text-on-primary/80">
                Connecting you directly to the roots. Fresh, honest, and local.
              </p>
            </div>
            <div className="space-y-sm">
              <h4 className="font-label-md text-on-primary">Explore</h4>
              <Link href="/marketplace" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">
                Marketplace
              </Link>
              <Link href="/farmers" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">
                Our Farmers
              </Link>
            </div>
            <div className="space-y-sm">
              <h4 className="font-label-md text-on-primary">Support</h4>
              <Link href="/" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">Home</Link>
              <Link href="/marketplace" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">Shop</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-on-primary/20 text-center text-on-primary/60 font-label-sm">
            &copy; 2024 Krishi Market. Rooted in community, grown for you.
          </div>
        </div>
      </footer>
    </div>
  );
}
