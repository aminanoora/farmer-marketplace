"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { consumerAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import SiteHeader from "@/components/site-header";
import { CategoryIcon } from "@/components/category-icon";

/* ─── Types ──────────────────────────────────── */
interface CategoryItem {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface FarmerInfo {
  _id: string;
  name: string;
  farmName: string;
  farmLocation?: { village: string; district: string; state: string };
  farmingMethod?: string;
  avatar?: string;
}

interface ProductItem {
  _id: string;
  name: string;
  description?: string;
  price: number;
  unit: string;
  quantity: number;
  images: string[];
  isOrganic: boolean;
  isAvailable: boolean;
  discountPrice?: number;
  isFeatured: boolean;
  farmer: FarmerInfo;
  category: { _id: string; name: string; slug: string };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/* ─── Helpers ────────────────────────────────── */
function getProductFallbackIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("millet") || lower.includes("rice") || lower.includes("wheat") || lower.includes("flour")) return "grass";
  if (lower.includes("honey")) return "dark_mode";
  if (lower.includes("oil")) return "water_drop";
  if (lower.includes("ghee") || lower.includes("milk") || lower.includes("egg")) return "egg";
  return "eco";
}

export default function MarketplacePage() {
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const { toggleItem, isFavorite } = useWishlist();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [sortBy, setSortBy] = useState("Popularity");
  const [currentPage, setCurrentPage] = useState(1);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Data states
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    consumerAPI
      .getCategories()
      .then((res) => {
        setCategories(res.data.categories || []);
      })
      .catch(() => {
        // Silently fail — categories will just be empty
      })
      .finally(() => {/* categories loaded */});
  }, []);

  // Fetch products when filters change
  useEffect(() => {
    setLoading(true);
    setError(null);

    const params: Record<string, string | number> = {
      page: currentPage,
      limit: 12,
    };

    if (activeCategoryId) params.category = activeCategoryId;
    if (submittedSearch.trim()) params.search = submittedSearch.trim();

    // Map sort selection to API sort param
    if (sortBy === "Price: Low to High") params.sort = "price_asc";
    else if (sortBy === "Price: High to Low") params.sort = "price_desc";
    // Default (Popularity/Newest) uses server default: -createdAt

    consumerAPI
      .getProducts(params)
      .then((res) => {
        setProducts(res.data.products || []);
        setPagination(res.data.pagination || null);
      })
      .catch((err) => {
        console.error("Failed to load products:", err);
        setError("Could not load products. Please try again.");
        setProducts([]);
        setPagination(null);
      })
      .finally(() => setLoading(false));
  }, [activeCategoryId, sortBy, currentPage, submittedSearch]);

  const handleCategoryClick = useCallback((categoryId: string | null) => {
    setActiveCategoryId(categoryId);
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortBy(value);
    setCurrentPage(1);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    setSubmittedSearch(searchQuery.trim());
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearchSubmit();
    }
  }, [handleSearchSubmit]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && pagination && page <= pagination.pages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination]);

  // Build page numbers array
  const getPageNumbers = (): (number | "...")[] => {
    if (!pagination) return [];
    const { page: current, pages: total } = pagination;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
  };

  const allCategories = [{ _id: "", name: "All Products", slug: "all" }, ...categories];

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SiteHeader activePage="marketplace" />

      <main className="flex-grow w-full max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl">
        {/* ─── Hero Search Area ──────────────── */}
        <div className="mb-xl text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Search Bar */}
            <div className="relative group">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors z-10">
                  search
                </span>
                <input
                  className="w-full pl-12 pr-28 py-5 bg-surface-container-low border-2 border-surface-variant rounded-2xl font-body-lg focus:border-primary focus:ring-0 transition-all shadow-sm group-focus-within:shadow-md text-on-surface"
                  placeholder="Search for fresh heirloom tomatoes, organic milk, farm-raised grains..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                <button
                  onClick={handleSearchSubmit}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 transition-all active:scale-95"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="relative">
              <div
                ref={categoryScrollRef}
                className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar scroll-smooth"
              >
                {allCategories.map((cat) => (
                  <button
                    key={cat._id || "all"}
                    onClick={() => handleCategoryClick(cat._id || null)}
                    className={`px-6 py-2.5 rounded-full font-label-md whitespace-nowrap shadow-sm transition-all flex items-center gap-2 ${
                      activeCategoryId === (cat._id || null)
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container border border-surface-variant text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    <CategoryIcon icon={cat.icon} name={cat.name} className="text-[16px]" />
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-surface-container-lowest to-transparent pointer-events-none md:hidden" />
            </div>
          </div>
        </div>

        {/* ─── Results Area ──────────────────── */}
        <section>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-lg">
            <div>
              <h2 className="font-headline-lg text-headline-lg mb-1 text-primary">
                Available Produce
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {loading ? "Loading..." : pagination ? `Showing ${pagination.total} items from local farms` : ""}
              </p>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <span className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap">
                Sort By
              </span>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="flex-grow sm:flex-grow-0 bg-surface-container-lowest border border-surface-variant rounded-lg px-4 py-2 font-body-md focus:ring-primary text-on-surface"
              >
                <option>Popularity</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Newest</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors md:hidden">
                <span className="material-symbols-outlined text-[20px]">
                  filter_list
                </span>
                <span className="font-label-md">Filters</span>
              </button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-lg">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-surface-variant" />
                  <div className="p-lg space-y-3">
                    <div className="h-5 w-3/4 bg-surface-variant rounded" />
                    <div className="h-4 w-1/2 bg-surface-variant rounded" />
                    <div className="h-12 w-full bg-surface-variant rounded-lg" />
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="col-span-full text-center py-16">
                <span className="material-symbols-outlined text-[48px] text-error mb-4">
                  error_outline
                </span>
                <p className="text-on-surface-variant text-body-lg mb-4">{error}</p>
                <button
                  onClick={() => setCurrentPage(1)}
                  className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all"
                >
                  Try Again
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <span className="material-symbols-outlined text-[48px] text-outline mb-4">
                  search_off
                </span>
                <p className="text-on-surface-variant text-body-lg">
                  No products found{submittedSearch ? ` for &quot;${submittedSearch}&quot;` : ""}.
                </p>
                <p className="text-label-md text-outline mt-2">
                  Try adjusting your filters or search.
                </p>
              </div>
            ) : (
              products.map((product) => {
                const isLowStock = product.quantity < 20;
                const farmName = product.farmer?.farmName || product.farmer?.name || "Local Farmer";
                const imageSrc = product.images?.[0] || "";
                return (
                  <Link
                    href={`/marketplace/${product._id}`}
                    key={product._id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden group flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  >
                    {/* Image Container */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-surface-container-high">
                      {imageSrc ? (
                        <Image
                          fill
                          sizes="(max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          alt={product.name}
                          src={imageSrc}
                          onError={(e) => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = "1"; el.src = `https://placehold.co/600x450/e4e2dd/414844.png?text=${encodeURIComponent(product.name)}`; } }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[64px] text-outline">
                            {getProductFallbackIcon(product.name)}
                          </span>
                        </div>
                      )}
                      {/* Favorite Button */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleItem({ productId: product._id, name: product.name, price: product.price, unit: product.unit, image: product.images?.[0] || "", farmerName: product.farmer?.farmName || product.farmer?.name || "Local Farmer", isOrganic: product.isOrganic, farmerId: product.farmer?._id }); }}
                        className="absolute top-3 left-3 w-9 h-9 bg-surface-container-lowest/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm z-10"
                        title={isFavorite(product._id) ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isFavorite(product._id) ? "'FILL' 1" : "'FILL' 0", color: isFavorite(product._id) ? "#dc2626" : "#6b7280" }}>favorite</span>
                      </button>
                      {/* Badges */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2">
                        <span className="bg-primary text-on-primary font-label-sm text-label-sm px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                          <span className="material-symbols-outlined text-[14px]">
                            verified
                          </span>
                          Direct
                        </span>
                        {product.isOrganic && (
                          <span className="bg-surface-container-lowest/90 text-primary font-label-sm text-label-sm px-3 py-1 rounded-full flex items-center gap-1 border border-primary/20 shadow-sm">
                            <span className="material-symbols-outlined text-[14px]">
                              eco
                            </span>
                            Organic
                          </span>
                        )}
                      </div>
                      {isLowStock && (
                        <span className="absolute bottom-3 left-3 bg-error text-on-error font-label-sm text-label-sm px-3 py-1 rounded-full shadow-sm">
                          Low Stock
                        </span>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-lg flex flex-col flex-grow">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className="font-headline-md text-[20px] leading-tight text-primary group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        <div className="text-on-tertiary-container font-bold text-headline-md whitespace-nowrap">
                          ₹{product.price}
                          <span className="text-label-sm font-normal text-on-surface-variant">
                            /{product.unit}
                          </span>
                        </div>
                      </div>
                      <span className="font-label-md text-label-md text-secondary mb-4 inline-flex items-center gap-1">
                        {farmName}{" "}
                        <span className="material-symbols-outlined text-[14px]">
                          open_in_new
                        </span>
                      </span>
                      <div className="mt-auto pt-4" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <button
                          onClick={() => {
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
                              farmerId: product.farmer?._id || "",
                              farmerName: product.farmer?.farmName || product.farmer?.name || "Local Farmer",
                              isOrganic: product.isOrganic,
                              isAvailable: product.isAvailable,
                              maxQuantity: product.quantity,
                            });
                          }}
                          className="w-full bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-label-md text-label-md py-3 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.97]"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            add_shopping_cart
                          </span>
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="mt-xl flex flex-col items-center gap-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    chevron_left
                  </span>
                </button>
                {getPageNumbers().map((page, idx) =>
                  page === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-on-surface-variant font-label-md">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg font-label-md text-label-sm transition-colors ${
                        page === currentPage
                          ? "bg-primary text-on-primary"
                          : "border border-outline-variant hover:bg-surface-variant text-on-surface"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination || currentPage >= pagination.pages}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ─── Bottom Navigation (Mobile) ──────── */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 md:hidden shadow-lg z-50 rounded-t-xl border-t border-outline-variant/30 bg-surface-container-lowest">
        <Link
          href="/marketplace"
          className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-2xl px-6 py-2 active:scale-90 transition-transform duration-150"
        >
          <span className="material-symbols-outlined">storefront</span>
          <span className="font-label-sm text-label-sm">Shop</span>
        </Link>
        <Link
          href="/"
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

      {/* ─── Footer ─────────────────────────── */}
      <footer className="hidden md:block bg-surface-container-high border-t border-outline-variant mt-12">
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-desktop py-xl max-w-max-width mx-auto gap-8">
          <div className="max-w-md">
            <h2 className="font-headline-md text-headline-md text-primary mb-4">
              Krishi Market
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Bridging the gap between the rural heartland and your kitchen.
              Connecting urban consumers with independent farmers for a
              sustainable future.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-4">
            <div className="flex flex-col gap-3">
              <span className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
                Explore
              </span>
              <a
                href="#"
                className="font-body-md text-body-md text-on-surface hover:text-primary transition-colors"
              >
                Our Mission
              </a>
              <a
                href="#"
                className="font-body-md text-body-md text-on-surface hover:text-primary transition-colors"
              >
                Seasonal Picks
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
                Support
              </span>
              <a
                href="#"
                className="font-body-md text-body-md text-on-surface hover:text-primary transition-colors"
              >
                Farmer Resources
              </a>
              <a
                href="#"
                className="font-body-md text-body-md text-on-surface hover:text-primary transition-colors"
              >
                Shipping Policy
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
                Connect
              </span>
              <a
                href="#"
                className="font-body-md text-body-md text-on-surface hover:text-primary transition-colors"
              >
                Sustainability
              </a>
              <a
                href="#"
                className="font-body-md text-body-md text-on-surface hover:text-primary transition-colors"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>
        <div className="w-full px-margin-desktop py-8 border-t border-outline-variant max-w-max-width mx-auto flex justify-between items-center text-label-sm text-on-surface-variant">
          <span>Built with integrity for the earth.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
