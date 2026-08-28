"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { homepageAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import SiteHeader from "@/components/site-header";

/* ─── Types ──────────────────────────────────── */
interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface Farmer {
  _id: string;
  name: string;
  farmName: string;
  farmLocation?: { village: string; district: string; state: string };
  cropTypes?: string[];
  farmingMethod?: string;
  avatar?: string;
  verificationStatus: string;
}

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  unit: string;
  images: string[];
  isOrganic: boolean;
  isAvailable: boolean;
  farmer: { _id: string; name: string; farmName?: string; avatar?: string };
  category: { _id: string; name: string; slug: string };
}

interface SearchResults {
  products: Product[];
  farmers: Farmer[];
  productsTotal: number;
  farmersTotal: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface HomepageData {
  categories: Category[];
  featuredFarmers: Farmer[];
  recentProducts: Product[];
}

/* ─── Helpers ────────────────────────────────── */
function getFarmerBadges(farmer: Farmer): { label: string; variant: "primary" | "tertiary" }[] {
  const badges: { label: string; variant: "primary" | "tertiary" }[] = [];
  if (farmer.farmingMethod === "organic" || farmer.farmingMethod === "both") {
    badges.push({ label: "Organic", variant: "primary" });
  }
  if (farmer.verificationStatus === "verified") {
    badges.push({ label: "Verified", variant: "tertiary" });
  }
  if (farmer.cropTypes && farmer.cropTypes.length > 2) {
    badges.push({ label: "Awarded", variant: "tertiary" });
  }
  return badges.length > 0 ? badges : [{ label: "Natural", variant: "primary" }];
}

function formatPrice(price: number, unit: string): string {
  return `₹${price}/${unit}`;
}

const FALLBACK_CATEGORIES: Category[] = [
  { _id: "1", name: "Vegetables", slug: "vegetables", icon: "" },
  { _id: "2", name: "Fruits", slug: "fruits", icon: "" },
  { _id: "3", name: "Dairy", slug: "dairy", icon: "" },
  { _id: "4", name: "Grains", slug: "grains", icon: "" },
];

// Category slug → representative image (stable Unsplash CDN URLs, verified).
// Keep in sync with the seeded categories (scripts/seed.ts).
const CATEGORY_IMAGE_MAP: Record<string, string> = {
  vegetables:
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80",
  fruits:
    "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=400&q=80",
  dairy:
    "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80",
  grains:
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=400&q=80",
};

// Resolve a category image by slug (then name). Unknown categories fall back to
// a neutral letter placeholder instead of a broken/empty image.
function getCategoryImage(cat: Category): string {
  const slug = cat.slug?.toLowerCase();
  if (slug && CATEGORY_IMAGE_MAP[slug]) return CATEGORY_IMAGE_MAP[slug];
  const name = cat.name?.toLowerCase();
  if (name && CATEGORY_IMAGE_MAP[name]) return CATEGORY_IMAGE_MAP[name];
  return `https://placehold.co/400x400/e4e2dd/414844.png?text=${encodeURIComponent(
    cat.name?.charAt(0) || "?"
  )}`;
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const { toggleItem, isFavorite } = useWishlist();
  const [data, setData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Search filter state
  const [searchCategory, setSearchCategory] = useState<string>("");
  const [searchOrganic, setSearchOrganic] = useState<boolean | undefined>(
    undefined
  );
  const [searchSort, setSearchSort] = useState<
    "relevance" | "price_asc" | "price_desc" | "newest"
  >("relevance");
  const [searchMinPrice, setSearchMinPrice] = useState<string>("");
  const [searchMaxPrice, setSearchMaxPrice] = useState<string>("");
  const [searchPage, setSearchPage] = useState(1);

  // Product grid filter state
  const [productFilter, setProductFilter] = useState<"all" | "organic" | "newest">("all");

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const homepageCategories = data?.categories || FALLBACK_CATEGORIES;

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = useCallback(
    async (pageNum: number) => {
      const q = searchQuery.trim();
      if (!q) {
        setShowSearchResults(false);
        return;
      }
      setSearching(true);
      setShowSearchResults(true);
      setSearchPage(pageNum);
      try {
        const res = await homepageAPI.searchAll({
          q,
          page: pageNum,
          limit: 8,
          category: searchCategory || undefined,
          isOrganic: searchOrganic,
          sort: searchSort,
          minPrice: searchMinPrice ? Number(searchMinPrice) : undefined,
          maxPrice: searchMaxPrice ? Number(searchMaxPrice) : undefined,
        });
        setSearchResults(res.data);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults({
          products: [],
          farmers: [],
          productsTotal: 0,
          farmersTotal: 0,
          pagination: { page: 1, limit: 8, total: 0, pages: 0 },
        });
      } finally {
        setSearching(false);
      }
    },
    [searchQuery, searchCategory, searchOrganic, searchSort, searchMinPrice, searchMaxPrice]
  );

  const handleSearch = useCallback(() => doSearch(1), [doSearch]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      setShowSearchResults(false);
      searchInputRef.current?.blur();
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setShowSearchResults(false);
    setSearchCategory("");
    setSearchOrganic(undefined);
    setSearchSort("relevance");
    setSearchMinPrice("");
    setSearchMaxPrice("");
    setSearchPage(1);
    searchInputRef.current?.focus();
  };

  const goToPage = useCallback((pageNum: number) => doSearch(pageNum), [doSearch]);

  useEffect(() => {
    // Fetch homepage data
    homepageAPI
      .getHomepage()
      .then((res) => {
        if (res.data) {
          setData({
            categories: res.data.categories || FALLBACK_CATEGORIES,
            featuredFarmers: res.data.featuredFarmers || [],
            recentProducts: res.data.recentProducts || [],
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load homepage data:", err);
        setError("Could not load fresh data. Showing available content.");
        setData({
          categories: FALLBACK_CATEGORIES,
          featuredFarmers: [],
          recentProducts: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubscribing(true);
    setNewsletterStatus(null);
    try {
      const res = await homepageAPI.subscribeToNewsletter(newsletterEmail);
      setNewsletterStatus({ type: "success", message: res.data.message });
      setNewsletterEmail("");
    } catch (err: unknown) {
      const axiosMsg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setNewsletterStatus({
        type: "error",
        message: axiosMsg || "Something went wrong. Please try again.",
      });
    } finally {
      setSubscribing(false);
    }
  };

  const categories = data?.categories || FALLBACK_CATEGORIES;
  const farmers = data?.featuredFarmers || [];
  const allProducts = data?.recentProducts || [];
  const products = productFilter === "organic"
    ? allProducts.filter((p) => p.isOrganic)
    : productFilter === "newest"
    ? [...allProducts].sort((a, b) => new Date(b._id).getTime() - new Date(a._id).getTime())
    : allProducts;

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SiteHeader activePage="" />

      <main className="pb-24 md:pb-12">
        {/* ─── Hero Section ─────────────────── */}
        <section className="relative h-[500px] md:h-[600px] flex items-center justify-center">
          <div className="absolute inset-0 z-0">
            <Image
              className="w-full h-full object-cover"
              alt="A sprawling, sun-drenched organic farm at sunrise with dew glistening on vibrant green lettuce rows."
              src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1600&q=80"
              fill
              sizes="100vw"
              priority
              style={{ objectFit: "cover" }}
            />
            <div className="absolute inset-0 bg-primary/20" />
          </div>
          <div className="relative z-10 w-full max-w-max-width px-margin-mobile md:px-margin-desktop text-center">
            <h2 className="font-display-lg text-[40px] md:text-display-lg text-surface-container-lowest mb-6 drop-shadow-lg">
              Find fresh local produce...
            </h2>
            <div className="max-w-2xl mx-auto relative group focus-within:scale-[1.02] transition-transform" ref={searchRef}>
              <input
                ref={searchInputRef}
                className="w-full h-14 md:h-16 px-6 pr-16 rounded-full bg-surface-container-lowest text-on-surface border-none shadow-xl focus:ring-4 focus:ring-primary/20 transition-all font-body-md text-body-md"
                placeholder="Search vegetables, fruits, or farmers..."
                type="text"
                aria-label="Search produce and farmers"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => {
                  if (searchResults || searchQuery.trim()) {
                    setShowSearchResults(true);
                  }
                }}
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-14 top-2 bottom-2 w-10 flex items-center justify-center text-outline hover:text-on-surface transition-colors"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
              <button
                onClick={handleSearch}
                className="absolute right-2 top-2 bottom-2 w-10 md:w-12 bg-primary text-on-primary rounded-full flex items-center justify-center transition-transform active:scale-90 hover:bg-primary/90"
                aria-label="Search"
              >
                <span className="material-symbols-outlined">search</span>
              </button>

              {/* ─── Search Results Dropdown ── */}
              {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant overflow-hidden z-50 max-h-[75vh] flex flex-col">
                  {/* ─── Filter Bar ──────────── */}
                  <div className="px-4 pt-3 pb-2 border-b border-outline-variant/50 flex flex-wrap items-center gap-2 bg-surface-container-low/50">
                    {/* Category filter */}
                    <select
                      value={searchCategory}
                      onChange={(e) => {
                        setSearchCategory(e.target.value);
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-outline-variant bg-white text-on-surface font-label-sm focus:ring-1 focus:ring-primary"
                    >
                      <option value="">All Categories</option>
                      {homepageCategories.map((cat) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    {/* Organic toggle */}
                    <button
                      onClick={() =>
                        setSearchOrganic(
                          searchOrganic === undefined
                            ? true
                            : undefined
                        )
                      }
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-label-sm transition-all flex items-center gap-1 ${
                        searchOrganic
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-outline-variant text-on-surface-variant hover:border-primary/50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">eco</span>
                      Organic
                    </button>

                    {/* Sort */}
                    <select
                      value={searchSort}
                      onChange={(e) =>
                        setSearchSort(
                          e.target.value as
                            | "relevance"
                            | "price_asc"
                            | "price_desc"
                            | "newest"
                        )
                      }
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-outline-variant bg-white text-on-surface font-label-sm focus:ring-1 focus:ring-primary"
                    >
                      <option value="relevance">Most Relevant</option>
                      <option value="price_asc">Price: Low → High</option>
                      <option value="price_desc">Price: High → Low</option>
                      <option value="newest">Newest First</option>
                    </select>

                    {/* Price range */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        placeholder="Min ₹"
                        value={searchMinPrice}
                        onChange={(e) => setSearchMinPrice(e.target.value)}
                        className="w-16 text-xs px-2 py-1.5 rounded-lg border border-outline-variant bg-white text-on-surface font-label-sm focus:ring-1 focus:ring-primary placeholder:text-outline"
                      />
                      <span className="text-on-surface-variant text-xs">—</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Max ₹"
                        value={searchMaxPrice}
                        onChange={(e) => setSearchMaxPrice(e.target.value)}
                        className="w-16 text-xs px-2 py-1.5 rounded-lg border border-outline-variant bg-white text-on-surface font-label-sm focus:ring-1 focus:ring-primary placeholder:text-outline"
                      />
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={() => handleSearch()}
                      className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg font-label-sm hover:bg-primary/90 transition-colors"
                    >
                      Apply
                    </button>
                  </div>

                  {/* ─── Results ─────────────── */}
                  <div className="overflow-y-auto flex-1">
                    {searching ? (
                      <div className="p-8 text-center text-on-surface-variant">
                        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                        Searching...
                      </div>
                    ) : (
                      <>
                        {/* Products */}
                        {searchResults?.products &&
                          searchResults.products.length > 0 && (
                            <div className="p-4">
                              <h4 className="font-label-md text-on-surface-variant mb-3 px-2">
                                Products (
                                {searchResults.productsTotal ||
                                  searchResults.products.length}
                                )
                              </h4>
                              <div className="space-y-2">
                                {searchResults.products.map((p) => (
                                  <Link
                                    key={p._id}
                                    href={`/marketplace/${p._id}`}
                                    onClick={() => clearSearch()}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-high transition-colors text-left"
                                  >
                                    <div className="relative w-12 h-12 rounded-lg bg-surface-variant overflow-hidden flex-shrink-0">
                                      <Image
                                        fill
                                        sizes="48px"
                                        className="object-cover"
                                        src={
                                          p.images?.[0] ||
                                          `https://placehold.co/100x100/e4e2dd/414844.png?text=${encodeURIComponent(
                                            p.name.charAt(0)
                                          )}`
                                        }
                                        alt={p.name}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-label-md text-primary truncate">
                                        {p.name}
                                      </p>
                                      <p className="text-label-sm text-on-surface-variant truncate">
                                        {typeof p.farmer === "object"
                                          ? p.farmer.name
                                          : p.farmer}{" "}
                                        · ₹{p.price}/{p.unit}
                                      </p>
                                    </div>
                                    {p.isOrganic && (
                                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase">
                                        Organic
                                      </span>
                                    )}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Farmers */}
                        {searchResults?.farmers &&
                          searchResults.farmers.length > 0 && (
                            <div className="p-4 pt-0 border-t border-outline-variant/50">
                              <h4 className="font-label-md text-on-surface-variant mb-3 px-2 pt-4">
                                Farmers (
                                {searchResults.farmersTotal ||
                                  searchResults.farmers.length}
                                )
                              </h4>
                              <div className="space-y-2">
                                {searchResults.farmers.map((f) => (
                                  <Link
                                    key={f._id}
                                    href={`/farmers/${f._id}`}
                                    onClick={() => clearSearch()}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-high transition-colors text-left"
                                  >
                                    <div className="relative w-12 h-12 rounded-full bg-surface-variant overflow-hidden flex-shrink-0">
                                      <Image
                                        fill
                                        sizes="48px"
                                        className="object-cover"
                                        src={
                                          f.avatar ||
                                          `https://placehold.co/100x100/e4e2dd/414844.png?text=${encodeURIComponent(
                                            f.name.charAt(0)
                                          )}`
                                        }
                                        alt={f.name}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-label-md text-primary truncate">
                                        {f.name}
                                      </p>
                                      <p className="text-label-sm text-on-surface-variant truncate">
                                        {f.farmName}
                                      </p>
                                    </div>
                                    <span className="material-symbols-filled text-primary text-[16px]">
                                      verified
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Pagination */}
                        {searchResults && searchResults.pagination && searchResults.pagination.pages > 1 && (
                          <div className="px-4 pb-4 pt-2 border-t border-outline-variant/50 flex items-center justify-center gap-2">
                            <button
                              onClick={() => goToPage(Math.max(1, searchPage - 1))}
                              disabled={searchPage <= 1}
                              className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-label-sm text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                            </button>
                            <span className="text-xs text-on-surface-variant">
                              Page {searchResults.pagination.page} of {searchResults.pagination.pages}
                            </span>
                            <button
                              onClick={() => goToPage(Math.min(searchResults.pagination.pages, searchPage + 1))}
                              disabled={searchPage >= searchResults.pagination.pages}
                              className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-label-sm text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                            </button>
                          </div>
                        )}

                        {/* Empty state */}
                        {!searching &&
                          searchResults &&
                          searchResults.products.length === 0 &&
                          searchResults.farmers.length === 0 && (
                            <div className="p-8 text-center">
                              <span className="material-symbols-outlined text-[36px] text-outline mb-2">
                                search_off
                              </span>
                              <p className="text-on-surface-variant">
                                No results found for &quot;{searchQuery}
                                &quot;
                              </p>
                              <p className="text-label-sm text-outline mt-1">
                                Try adjusting your filters or search
                                terms
                              </p>
                            </div>
                          )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button onClick={() => { setSearchQuery("Mangoes"); handleSearch(); }} className="px-4 py-2 bg-surface-container-low/90 text-primary font-label-md rounded-full shadow-sm hover:bg-surface-container-high transition-colors">
                Popular: Seasonal Mangoes
              </button>
              <button onClick={() => { setSearchQuery("Spinach"); handleSearch(); }} className="px-4 py-2 bg-surface-container-low/90 text-primary font-label-md rounded-full shadow-sm hover:bg-surface-container-high transition-colors">
                Fresh Spinach
              </button>
              <button onClick={() => { setSearchQuery("Honey"); handleSearch(); }} className="px-4 py-2 bg-surface-container-low/90 text-primary font-label-md rounded-full shadow-sm hover:bg-surface-container-high transition-colors">
                Local Honey
              </button>
            </div>
          </div>
        </section>

        {/* ─── Categories Section ───────────── */}
        <section className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-12">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline-md text-headline-md text-primary">
              Browse Categories
            </h3>
            <Link href="/marketplace" className="text-primary font-label-md hover:underline">
              See all categories
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <CategoryCard
                key={cat._id}
                title={cat.name}
                src={getCategoryImage(cat)}
                slug={cat.slug}
              />
            ))}
          </div>
        </section>

        {/* ─── Featured Farmers ─────────────── */}
        <section className="bg-surface-container-low py-16">
          <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="mb-10">
              <h3 className="font-headline-md text-headline-md text-primary mb-2">
                Featured Farmers
              </h3>
              <p className="text-on-surface-variant max-w-xl">
                Meet the people bringing fresh, honest food from their soil to
                your table.
              </p>
            </div>
            {farmers.length > 0 ? (
              <div className="flex overflow-x-auto gap-6 pb-6 custom-scrollbar scroll-smooth">
                {farmers.map((farmer) => {
                  const badges = getFarmerBadges(farmer);
                  return (
                    <FarmerCard
                      key={farmer._id}
                      id={farmer._id}
                      name={farmer.name}
                      farm={farmer.farmName || `${farmer.farmLocation?.village || ""} Farm`}
                      badges={badges}
                      avatar={farmer.avatar || `https://placehold.co/200x200/e4e2dd/414844.png?text=${farmer.name.charAt(0)}`}
                    />
                  );
                })}
              </div>
            ) : loading ? (
              <div className="flex gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex-none w-72 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant animate-pulse"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full bg-surface-variant mb-4" />
                      <div className="h-5 w-32 bg-surface-variant rounded mb-2" />
                      <div className="h-4 w-24 bg-surface-variant rounded mb-4" />
                      <div className="h-10 w-full bg-surface-variant rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-on-surface-variant text-center py-8">
                No farmers listed yet. Check back soon!
              </p>
            )}
          </div>
        </section>

        {/* ─── Product Grid ─────────────────── */}
        <section className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <h3 className="font-headline-md text-headline-md text-primary">
              Fresh Harvest Today
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0">
              <button onClick={() => setProductFilter("all")} className={`px-6 py-2 rounded-full font-label-md whitespace-nowrap transition-colors ${productFilter === "all" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"}`}>
                All Produce
              </button>
              <button onClick={() => setProductFilter("organic")} className={`px-6 py-2 rounded-full font-label-md whitespace-nowrap transition-colors ${productFilter === "organic" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"}`}>
                Organic Only
              </button>
              <button onClick={() => setProductFilter("newest")} className={`px-6 py-2 rounded-full font-label-md whitespace-nowrap transition-colors ${productFilter === "newest" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"}`}>
                Newly Added
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-surface-variant" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 w-3/4 bg-surface-variant rounded" />
                    <div className="h-4 w-1/2 bg-surface-variant rounded" />
                    <div className="h-10 w-full bg-surface-variant rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
                {products.map((product) => (
                  <div key={product._id} className="block">
                    <ProductCard
                      id={product._id}
                      name={product.name}
                      price={product.price}
                      priceLabel={formatPrice(product.price, product.unit)}
                      unit={product.unit}
                      farmer={
                        typeof product.farmer === "object"
                          ? product.farmer.name
                          : product.farmer
                      }
                      farmerId={typeof product.farmer === "object" ? product.farmer._id : ""}
                      organic={product.isOrganic}
                      inStock={product.isAvailable}
                      src={
                        product.images?.[0] ||
                        `https://placehold.co/600x450/e4e2dd/414844.png?text=${encodeURIComponent(product.name)}`
                      }
                      onToggleFavorite={() => toggleItem({
                        productId: product._id,
                        name: product.name,
                        price: product.price,
                        unit: product.unit,
                        image: product.images?.[0] || "",
                        farmerName: typeof product.farmer === "object" ? product.farmer.name : product.farmer,
                        isOrganic: product.isOrganic,
                        farmerId: typeof product.farmer === "object" ? product.farmer._id : "",
                      })}
                      isFavorited={isFavorite(product._id)}
                      onAddToCart={() => {
                        if (!isAuthenticated) {
                          window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
                          return;
                        }
                        addItem({
                          productId: product._id,
                          name: product.name,
                          price: product.price,
                          unit: product.unit,
                          image: product.images?.[0] || "",
                          farmerId: typeof product.farmer === "object" ? product.farmer._id : "",
                          farmerName: typeof product.farmer === "object" ? product.farmer.name : product.farmer,
                          isOrganic: product.isOrganic,
                          isAvailable: product.isAvailable,
                          maxQuantity: 100,
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-16 text-center">
                <Link
                  href="/marketplace"
                  className="inline-flex px-10 py-4 bg-surface-container-high text-primary font-label-md rounded-xl hover:bg-surface-variant transition-all items-center gap-2 mx-auto"
                >
                  Load More Products
                  <span className="material-symbols-outlined">expand_more</span>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-[48px] text-outline mb-4">
                eco
              </span>
              <p className="text-on-surface-variant text-body-lg">
                No products available yet. Our farmers are busy growing fresh
                produce for you!
              </p>
            </div>
          )}
        </section>

        {/* ─── Newsletter / Trust Banner ────── */}
        <section className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop mb-20">
          <div className="bg-primary-container rounded-3xl p-8 md:p-16 flex flex-col md:flex-row items-center gap-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="z-10 flex-1 text-center md:text-left">
              <h3 className="font-display-lg text-headline-lg-mobile md:text-headline-lg text-primary-fixed mb-4">
                Direct From Our Fields To Your Table
              </h3>
              <p className="text-on-primary-container text-body-lg mb-8 max-w-lg">
                Get weekly updates on seasonal harvests and meet your local
                farmers. Join 10,000+ conscious consumers.
              </p>
              <form
                onSubmit={handleNewsletterSubmit}
                className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto md:mx-0"
              >
                <input
                  className="flex-1 px-6 py-4 rounded-xl bg-surface/10 border border-primary-fixed/30 text-on-primary-fixed placeholder:text-on-primary-container/60 focus:ring-2 focus:ring-primary-fixed"
                  placeholder="Your email address"
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  required
                  aria-label="Email for newsletter subscription"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="px-8 py-4 bg-secondary-fixed text-on-secondary-fixed font-bold rounded-xl whitespace-nowrap active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {subscribing ? "Subscribing..." : "Subscribe"}
                </button>
              </form>
              {newsletterStatus && (
                <p
                  className={`mt-3 text-sm font-medium ${
                    newsletterStatus.type === "success"
                      ? "text-primary-fixed"
                      : "text-on-error-container"
                  }`}
                >
                  {newsletterStatus.message}
                </p>
              )}
            </div>
            <div className="flex-1 hidden lg:block">
              <Image
                className="w-full rounded-2xl shadow-2xl"
                alt="An artistic flat-lay of seasonal vegetables, herbs, and wooden utensils."
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80"
                width={600}
                height={400}
                loading="lazy"
              />
            </div>
          </div>
          {error && (
            <p className="mt-4 text-center text-sm text-on-tertiary-container">
              {error}
            </p>
          )}
        </section>
      </main>

      {/* ─── Bottom Navigation (Mobile) ────── */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 md:hidden shadow-lg z-50 rounded-t-xl border-t border-outline-variant/30 bg-surface-container-lowest">
        <Link
          href="/marketplace"
          className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-2xl px-6 py-2 active:scale-90 transition-transform duration-150"
        >
          <span className="material-symbols-outlined">storefront</span>
          <span className="font-label-sm text-label-sm">Shop</span>
        </Link>
        <Link
          href="/farmers"
          className="flex flex-col items-center justify-center text-on-surface-variant px-6 py-2 hover:bg-surface-variant transition-all active:scale-90 duration-150"
        >
          <span className="material-symbols-outlined">agriculture</span>
          <span className="font-label-sm text-label-sm">Farms</span>
        </Link>
        <Link
          href="/orders"
          className="flex flex-col items-center justify-center text-on-surface-variant px-6 py-2 hover:bg-surface-variant transition-all active:scale-90 duration-150"
        >
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="font-label-sm text-label-sm">Orders</span>
        </Link>
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant px-6 py-2 hover:bg-surface-variant transition-all active:scale-90 duration-150"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </Link>
      </nav>

      {/* ─── Footer (Desktop) ──────────────── */}
      <footer className="hidden md:block bg-surface-container py-12 border-t border-outline-variant">
        <div className="max-w-max-width mx-auto px-margin-desktop grid grid-cols-4 gap-12">
          <div>
            <h4 className="font-display-lg text-headline-md text-primary mb-6">
              Krishi Market
            </h4>
            <p className="text-on-surface-variant">
              Connecting you directly to the roots. Fresh, honest, and local.
            </p>
          </div>
          <div>
            <h5 className="font-label-md text-primary mb-4">Shop</h5>
            <ul className="space-y-2 text-on-surface-variant">
              <li><Link href="/marketplace" className="hover:text-primary">All Produce</Link></li>
              <li><Link href="/marketplace?category=dairy" className="hover:text-primary">Monthly Box</Link></li>
              <li><Link href="/wishlist" className="hover:text-primary">Gift Cards</Link></li>
              <li><Link href="/marketplace" className="hover:text-primary">Offers</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-label-md text-primary mb-4">About</h5>
            <ul className="space-y-2 text-on-surface-variant">
              <li><Link href="/" className="hover:text-primary">Our Story</Link></li>
              <li><Link href="/farmers" className="hover:text-primary">The Farmers</Link></li>
              <li><Link href="/marketplace?organic=true" className="hover:text-primary">Sustainability</Link></li>
              <li><Link href="/" className="hover:text-primary">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-label-md text-primary mb-4">Support</h5>
            <ul className="space-y-2 text-on-surface-variant">
              <li><a href="mailto:support@krishimarket.in" className="hover:text-primary">Contact Us</a></li>
              <li><Link href="/marketplace" className="hover:text-primary">Delivery Info</Link></li>
              <li><Link href="/" className="hover:text-primary">FAQ</Link></li>
              <li><Link href="/" className="hover:text-primary">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-max-width mx-auto px-margin-desktop mt-12 pt-8 border-t border-outline-variant text-center text-on-surface-variant font-label-sm">
          © 2026 Krishi Market. Supporting local agriculture.
        </div>
      </footer>
    </div>
  );
}

/* ─── Reusable Components ───────────────────── */

function CategoryCard({ title, src, slug }: { title: string; src: string; slug?: string }) {
  return (
    <Link href={`/marketplace?category=${encodeURIComponent(slug || title.toLowerCase())}`} className="group block">
      <div className="aspect-square rounded-2xl overflow-hidden mb-3 relative bg-surface-container">
        <Image
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          alt={title}
          src={src}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
          <span className="text-surface-container-lowest font-headline-md">
            {title}
          </span>
        </div>
      </div>
    </Link>
  );
}

function FarmerCard({
  id,
  name,
  farm,
  badges,
  avatar,
}: {
  id: string;
  name: string;
  farm: string;
  badges: { label: string; variant: "primary" | "tertiary" }[];
  avatar: string;
}) {
  return (
    <div className="flex-none w-72 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col items-center text-center">
        <div className="relative w-24 h-24 rounded-full overflow-hidden mb-4 border-2 border-primary-fixed">
          <Image
            fill
            sizes="96px"
            className="object-cover"
            alt={name}
            src={avatar}
          />
        </div>
        <div className="flex items-center gap-1 mb-1">
          <h4 className="font-headline-md text-[18px] text-primary">{name}</h4>
          <span className="material-symbols-filled text-primary text-[18px]">
            verified
          </span>
        </div>
        <p className="font-label-sm text-on-tertiary-fixed-variant mb-4">
          {farm}
        </p>
        <div className="flex gap-2 mb-6">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                badge.variant === "primary"
                  ? "bg-primary/10 text-primary"
                  : "bg-tertiary/10 text-tertiary"
              }`}
            >
              {badge.label}
            </span>
          ))}
        </div>
        <Link href={`/farmers/${id}`} className="block w-full py-2 border-2 border-secondary text-secondary font-label-md rounded-xl hover:bg-secondary-container transition-colors text-center">
          View Profile
        </Link>
      </div>
    </div>
  );
}

function ProductCard({
  id,
  name,
  price,
  priceLabel,
  unit,
  farmer,
  farmerId,
  organic,
  inStock,
  src,
  onAddToCart,
  onToggleFavorite,
  isFavorited,
}: {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  unit: string;
  farmer: string;
  farmerId?: string;
  organic: boolean;
  inStock: boolean;
  src: string;
  onAddToCart?: () => void;
  onToggleFavorite?: () => void;
  isFavorited?: boolean;
}) {
  const [added, setAdded] = useState(false);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    };
  }, []);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart();
      setAdded(true);
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
      addedTimerRef.current = setTimeout(() => setAdded(false), 2000);
    }
  };

  return (
    <Link href={`/marketplace/${id}`} className="block">
      <div className="flex flex-col group bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            fill
            sizes="(max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            alt={name}
            src={src}
            onError={(e) => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = "1"; el.src = `https://placehold.co/600x450/e4e2dd/414844.png?text=${encodeURIComponent(name)}`; } }}
          />
          {organic && (
            <span className="absolute top-3 left-3 px-3 py-1 bg-primary text-on-primary text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">eco</span>
              Organic
            </span>
          )}
          {inStock && (
            <span className="absolute top-3 right-12 px-2 py-1 bg-surface-container-lowest/90 text-primary text-[10px] font-bold rounded-md">
              In Stock
            </span>
          )}
          {/* Favorite Button */}
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(); }}
              className="absolute top-3 right-3 w-8 h-8 bg-surface-container-lowest/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
              title={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: isFavorited ? "'FILL' 1" : "'FILL' 0", color: isFavorited ? "#dc2626" : "#6b7280" }}>favorite</span>
            </button>
          )}
        </div>
        <div className="p-5 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-2">
            <h5 className="font-headline-md text-[18px] text-primary">{name}</h5>
            <span className="text-on-tertiary-container font-headline-md text-[20px]">
              {priceLabel}
            </span>
          </div>
          <p className="text-on-surface-variant font-label-sm mb-6 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">
              agriculture
            </span>
            {farmer}
          </p>
          <button
            onClick={handleAdd}
            disabled={!inStock}
            className={`mt-auto w-full py-3 font-label-md rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${
              added
                ? "bg-[#166534] text-white"
                : "bg-primary text-on-primary hover:opacity-90"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {added ? (
              <><span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Added!</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">add_shopping_cart</span> Add to Cart</>
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}
