"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { consumerAPI } from "@/lib/api";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import SiteHeader from "@/components/site-header";

/* ─── Types ──────────────────────────────────── */
interface FarmerDetail {
  _id: string;
  name: string;
  farmName?: string;
  farmLocation?: { village: string; district: string; state: string };
  cropTypes?: string[];
  farmingMethod?: "organic" | "conventional" | "both";
  avatar?: string;
  verificationStatus: "pending" | "verified" | "rejected";
  createdAt: string;
}

interface FarmerProduct {
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
  category: { _id: string; name: string; slug: string };
}

/* ─── Helpers ────────────────────────────────── */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
  });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMonths =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  if (diffMonths < 1) return "Less than a month";
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""}`;
  const years = Math.floor(diffMonths / 12);
  return `${years} year${years > 1 ? "s" : ""}`;
}

function getFarmerBadges(farmer: FarmerDetail): { label: string; variant: "primary" | "tertiary"; icon: string }[] {
  const badges: { label: string; variant: "primary" | "tertiary"; icon: string }[] = [];
  if (farmer.farmingMethod === "organic" || farmer.farmingMethod === "both") {
    badges.push({ label: "Organic Farmer", variant: "primary", icon: "eco" });
  }
  if (farmer.verificationStatus === "verified") {
    badges.push({ label: "Verified", variant: "tertiary", icon: "verified" });
  }
  return badges;
}

/* ─── Page Component ─────────────────────────── */
export default function FarmerDetailPage() {
  const params = useParams();
  const farmerId = params.id as string;
  const { addItem } = useCart();
  const { toggleItem, isFavorite } = useWishlist();

  const [farmer, setFarmer] = useState<FarmerDetail | null>(null);
  const [products, setProducts] = useState<FarmerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedStates, setAddedStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!farmerId) return;
    setLoading(true);
    setError(null);
    consumerAPI
      .getFarmer(farmerId)
      .then((res) => {
        setFarmer(res.data.farmer);
        setProducts(res.data.products || []);
      })
      .catch(() => {
        setError("Could not load farmer profile. They may have been removed.");
      })
      .finally(() => setLoading(false));
  }, [farmerId]);

  /* ─── Loading State ────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest">
        <SiteHeader />
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl">
          <div className="animate-pulse space-y-8">
            {/* Breadcrumb skeleton */}
            <div className="h-4 w-48 bg-surface-variant rounded" />
            {/* Profile skeleton */}
            <div className="bg-white rounded-2xl border border-outline-variant p-lg">
              <div className="flex flex-col md:flex-row items-center gap-lg">
                <div className="w-28 h-28 rounded-full bg-surface-variant" />
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <div className="h-8 w-48 bg-surface-variant rounded mx-auto md:mx-0" />
                  <div className="h-5 w-32 bg-surface-variant rounded mx-auto md:mx-0" />
                  <div className="h-4 w-56 bg-surface-variant rounded mx-auto md:mx-0" />
                </div>
              </div>
            </div>
            {/* Products skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-outline-variant overflow-hidden">
                  <div className="aspect-[4/3] bg-surface-variant" />
                  <div className="p-md space-y-3">
                    <div className="h-5 w-3/4 bg-surface-variant rounded" />
                    <div className="h-4 w-1/2 bg-surface-variant rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Error State ──────────────────────────── */
  if (error || !farmer) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <span className="material-symbols-outlined text-[64px] text-error mb-6">error_outline</span>
          <h1 className="font-headline-lg text-headline-lg text-primary mb-3">Farmer Not Found</h1>
          <p className="text-on-surface-variant mb-8">{error || "This farmer doesn't exist or has been removed."}</p>
          <Link href="/marketplace" className="inline-flex px-8 py-3 bg-primary text-on-primary font-label-md rounded-full">
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Data ─────────────────────────────────── */
  const badges = getFarmerBadges(farmer);
  const locationStr = farmer.farmLocation
    ? [farmer.farmLocation.village, farmer.farmLocation.district, farmer.farmLocation.state]
        .filter(Boolean)
        .join(", ")
    : "";
  const memberSince = timeAgo(farmer.createdAt);
  const inStockProducts = products.filter((p) => p.isAvailable);
  const outOfStockProducts = products.filter((p) => !p.isAvailable);
  const allProducts = [...inStockProducts, ...outOfStockProducts];

  const handleAddToCart = (product: FarmerProduct) => {
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.images?.[0] || "",
      farmerId: farmer._id,
      farmerName: farmer.farmName || farmer.name,
      isOrganic: product.isOrganic,
      isAvailable: product.isAvailable,
      maxQuantity: product.quantity,
    });
    setAddedStates((prev) => ({ ...prev, [product._id]: true }));
    setTimeout(() => {
      setAddedStates((prev) => ({ ...prev, [product._id]: false }));
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest selection:bg-primary-fixed-dim selection:text-primary">
      <SiteHeader />

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl pb-24 md:pb-12">
        {/* ─── Breadcrumbs ────────────────────── */}
        <nav className="flex items-center gap-xs text-on-surface-variant mb-lg font-label-sm text-label-sm flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/marketplace" className="hover:text-primary transition-colors">Marketplace</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">{farmer.farmName || farmer.name}</span>
        </nav>

        {/* ─── Farmer Profile Hero ─────────────── */}
        <section className="bg-white rounded-2xl border border-outline-variant overflow-hidden mb-xl shadow-sm">
          {/* Banner Area */}
          <div className="h-32 md:h-48 bg-gradient-to-r from-primary/80 via-primary to-tertiary/60 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white" />
              <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full bg-white" />
            </div>
          </div>

          {/* Profile Info */}
          <div className="px-lg pb-lg relative">
            {/* Avatar */}
            <div className="flex justify-center md:justify-start -mt-16 mb-md relative z-10">
              <div className="relative w-28 h-28 rounded-full border-4 border-white overflow-hidden shadow-lg bg-surface-container">
                {farmer.avatar ? (
                  <Image
                    fill
                    sizes="112px"
                    className="object-cover"
                    alt={farmer.name}
                    src={farmer.avatar}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="material-symbols-outlined text-[48px] text-primary">agriculture</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-lg">
              <div className="text-center md:text-left flex-1">
                <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
                  <h1 className="font-headline-lg text-headline-lg text-primary">
                    {farmer.farmName || farmer.name}
                  </h1>
                  {farmer.verificationStatus === "verified" && (
                    <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  )}
                </div>
                <p className="font-headline-md text-[18px] text-on-surface-variant mt-1">
                  {farmer.name}
                </p>
                {locationStr && (
                  <p className="font-body-md text-on-surface-variant mt-2 flex items-center gap-1 justify-center md:justify-start">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    {locationStr}
                  </p>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                  {badges.map((badge) => (
                    <span
                      key={badge.label}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        badge.variant === "primary"
                          ? "bg-primary/10 text-primary"
                          : "bg-tertiary/10 text-tertiary"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {badge.icon}
                      </span>
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 md:gap-8 justify-center md:justify-end mt-4 md:mt-0">
                <div className="text-center">
                  <p className="font-headline-md text-headline-md text-primary">{allProducts.length}</p>
                  <p className="font-label-sm text-on-surface-variant">Products</p>
                </div>
                <div className="w-px bg-outline-variant self-stretch" />
                <div className="text-center">
                  <p className="font-headline-md text-headline-md text-primary">{memberSince}</p>
                  <p className="font-label-sm text-on-surface-variant">on Krishi</p>
                </div>
                {farmer.farmingMethod && (
                  <>
                    <div className="w-px bg-outline-variant self-stretch" />
                    <div className="text-center">
                      <p className="font-headline-md text-headline-md text-primary capitalize">
                        {farmer.farmingMethod === "both" ? "Mixed" : farmer.farmingMethod}
                      </p>
                      <p className="font-label-sm text-on-surface-variant">Farming</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ─── About Section ───────────────────── */}
        {farmer.cropTypes && farmer.cropTypes.length > 0 && (
          <section className="bg-white rounded-2xl border border-outline-variant p-lg mb-xl shadow-sm">
            <h2 className="font-headline-md text-headline-md text-primary mb-md">About the Farm</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div className="space-y-md">
                <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Crops Grown</h3>
                <div className="flex flex-wrap gap-2">
                  {farmer.cropTypes.map((crop) => (
                    <span
                      key={crop}
                      className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded-lg font-label-sm text-label-sm"
                    >
                      {crop}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-md">
                <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Farming Philosophy</h3>
                <p className="font-body-md text-on-surface-variant leading-relaxed">
                  {farmer.farmingMethod === "organic"
                    ? "Dedicated to organic farming practices. No synthetic pesticides or fertilizers — just pure, natural goodness from farm to table."
                    : farmer.farmingMethod === "both"
                    ? "Blending traditional wisdom with modern sustainable practices. Offering both organic and conventionally grown produce with transparency."
                    : "Committed to providing fresh, quality produce using sustainable farming methods that respect the land and the community."}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ─── Products Section ───────────────── */}
        <section>
          <div className="flex items-center justify-between mb-lg">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary">
                Products from {farmer.farmName || farmer.name}
              </h2>
              <p className="font-body-md text-on-surface-variant mt-1">
                {inStockProducts.length} product{inStockProducts.length !== 1 ? "s" : ""} available
              </p>
            </div>
            <Link
              href={`/marketplace?farmer=${farmerId}`}
              className="hidden md:flex items-center gap-1 text-primary font-label-md hover:underline"
            >
              View All <span className="material-symbols-outlined text-[18px]">east</span>
            </Link>
          </div>

          {allProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-outline-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-4">eco</span>
              <h3 className="font-headline-md text-headline-md text-primary mb-2">No Products Yet</h3>
              <p className="text-on-surface-variant max-w-md mx-auto">
                This farmer hasn&apos;t listed any products yet. Check back soon for fresh produce!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg">
              {allProducts.map((product) => {
                const imageSrc = product.images?.[0] || "";
                const isAdded = addedStates[product._id];
                const isLowStock = product.quantity < 20 && product.quantity > 0;
                return (
                  <div
                    key={product._id}
                    className="bg-white rounded-xl border border-outline-variant overflow-hidden group flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    {/* Image */}
                    <Link href={`/marketplace/${product._id}`} className="relative aspect-[4/3] overflow-hidden bg-surface-container-high block">
                      {imageSrc ? (
                        <Image
                          fill
                          sizes="(max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          alt={product.name}
                          src={imageSrc}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[48px] text-outline">eco</span>
                        </div>
                      )}
                      {product.isOrganic && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 bg-primary/90 text-on-primary text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1 backdrop-blur-sm">
                          <span className="material-symbols-outlined text-[12px]">eco</span>
                          Organic
                        </span>
                      )}
                      {!product.isAvailable && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="px-4 py-2 bg-surface-container-lowest/90 text-on-surface font-label-md rounded-lg">
                            Out of Stock
                          </span>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleItem({
                            productId: product._id,
                            name: product.name,
                            price: product.price,
                            unit: product.unit,
                            image: product.images?.[0] || "",
                            farmerName: farmer.farmName || farmer.name,
                            isOrganic: product.isOrganic,
                            farmerId: farmer._id,
                          });
                        }}
                        className="absolute top-3 right-3 w-8 h-8 bg-surface-container-lowest/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                      >
                        <span
                          className="material-symbols-outlined text-[18px]"
                          style={{
                            fontVariationSettings: isFavorite(product._id) ? "'FILL' 1" : "'FILL' 0",
                            color: isFavorite(product._id) ? "#dc2626" : "#6b7280",
                          }}
                        >
                          favorite
                        </span>
                      </button>
                      {isLowStock && (
                        <span className="absolute bottom-3 left-3 bg-error text-on-error font-label-sm text-label-sm px-2.5 py-1 rounded-full shadow-sm">
                          Low Stock
                        </span>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="p-md flex flex-col flex-grow">
                      <Link href={`/marketplace/${product._id}`}>
                        <h3 className="font-headline-md text-[18px] text-primary group-hover:text-primary transition-colors mb-1">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="text-label-sm text-on-surface-variant mb-3 line-clamp-2">
                        {product.description || `${product.category?.name || "Farm"} produce`}
                      </p>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/50">
                        <span className="font-headline-md text-[20px] text-on-tertiary-container">
                          ₹{product.price}
                          <span className="text-label-sm font-normal text-on-surface-variant">/{product.unit}</span>
                        </span>
                        <button
                          disabled={!product.isAvailable}
                          onClick={() => handleAddToCart(product)}
                          className={`px-4 py-2 rounded-lg font-label-md text-label-sm transition-all flex items-center gap-1.5 active:scale-95 ${
                            isAdded
                              ? "bg-[#166534] text-white"
                              : product.isAvailable
                              ? "bg-primary text-on-primary hover:bg-primary/90"
                              : "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
                          }`}
                        >
                          {isAdded ? (
                            <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Added</>
                          ) : (
                            <><span className="material-symbols-outlined text-[16px]">add_shopping_cart</span> Add</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ─── Bottom Navigation (Mobile) ──────── */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 md:hidden shadow-lg z-50 rounded-t-xl border-t border-outline-variant/30 bg-surface-container-lowest">
        <Link href="/marketplace" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined text-[22px]">storefront</span>
          <span className="font-label-sm text-[10px]">Shop</span>
        </Link>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined text-[22px]">agriculture</span>
          <span className="font-label-sm text-[10px]">Farms</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined text-[22px]">local_shipping</span>
          <span className="font-label-sm text-[10px]">Orders</span>
        </a>
        <Link href="/auth/login" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="font-label-sm text-[10px]">Profile</span>
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
              <h4 className="font-label-md text-on-primary">Quick Links</h4>
              <Link href="/marketplace" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">
                Marketplace
              </Link>
              <a href="#" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">About Us</a>
              <a href="#" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">Contact</a>
            </div>
            <div className="space-y-sm">
              <h4 className="font-label-md text-on-primary">Support</h4>
              <a href="#" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">FAQ</a>
              <a href="#" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">Delivery Info</a>
              <a href="#" className="block font-body-md text-on-primary/80 hover:text-on-primary transition-colors">Privacy Policy</a>
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
