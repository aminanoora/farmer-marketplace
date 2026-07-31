"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { consumerAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import SiteHeader from "@/components/site-header";

/* ─── Types ──────────────────────────────────── */
interface FarmerInfo {
  _id: string;
  name: string;
  farmName: string;
  farmLocation?: { village: string; district: string; state: string };
  farmingMethod?: string;
  avatar?: string;
}

interface CategoryInfo {
  _id: string;
  name: string;
  slug: string;
}

interface ProductDetail {
  _id: string;
  name: string;
  description?: string;
  price: number;
  unit: string;
  quantity: number;
  images: string[];
  harvestDate?: string;
  isOrganic: boolean;
  isAvailable: boolean;
  discountPrice?: number;
  farmer: FarmerInfo;
  category: CategoryInfo;
  createdAt: string;
}

interface ReviewItem {
  _id: string;
  consumer: { _id: string; name: string; avatar?: string };
  rating: number;
  comment?: string;
  createdAt: string;
}

/* ─── Utilities ──────────────────────────────── */
function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("krishi_token");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

/* ─── Star Rating Component ──────────────────── */
function StarRating({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        return (
          <span
            key={star}
            className="material-symbols-outlined"
            style={{
              fontSize: size,
              fontVariationSettings: `'FILL' ${filled ? 1 : 0}`,
              color: filled ? "#f78a00" : "#c1c8c2",
              transition: "color 0.2s",
            }}
          >
            star
          </span>
        );
      })}
    </div>
  );
}

function InteractiveStarRating({
  rating,
  onChange,
  size = 36,
}: {
  rating: number;
  onChange: (r: number) => void;
  size?: number;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = (hovered || rating) >= star;
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 -m-0.5 transition-transform hover:scale-125 active:scale-90"
            aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: size,
                fontVariationSettings: `'FILL' ${active ? 1 : 0}`,
                color: active ? "#f78a00" : "#c1c8c2",
                transition: "all 0.15s ease",
              }}
            >
              star
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Page Component ─────────────────────────── */
export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const { addItem } = useCart();
  const { toggleItem, isFavorite } = useWishlist();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Related products
  const [relatedProducts, setRelatedProducts] = useState<ProductDetail[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  // Reset review form state when navigating between products
  useEffect(() => {
    setReviewSubmitted(false);
    setShowReviewForm(false);
    setReviewRating(0);
    setReviewComment("");
    setReviewError(null);
    setSelectedImage(0);
    setQty(1);
    setAddedToCart(false);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
  }, [productId]);

  // Fetch complete product details (includes reviews, related products, etc.)
  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    consumerAPI
      .getProduct(productId)
      .then((res) => {
        const data = res.data;
        setProduct(data.product);
        // Set reviews data from the enriched endpoint
        setReviews(data.reviews || []);
        setAverageRating(data.averageRating || 0);
        setTotalReviews(data.totalReviews || 0);
        // Set related products from the enriched endpoint
        const related = data.relatedProducts || [];
        setRelatedProducts(related);
        setRelatedLoading(false);
        setReviewsLoading(false);
      })
      .catch(() => {
        setError("Could not load product details. It may have been removed.");
      })
      .finally(() => {
        setLoading(false);
        setReviewsLoading(false);
        setRelatedLoading(false);
      });
  }, [productId]);

  // Submit review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewRating === 0) {
      setReviewError("Please select a rating");
      return;
    }
    if (!isAuthenticated()) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      await consumerAPI.addReview({
        product: productId,
        farmer: product?.farmer?._id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewSubmitted(true);
      setReviewRating(0);
      setReviewComment("");
      setShowReviewForm(false);
      // Refetch product details to refresh reviews
      consumerAPI.getProduct(productId).then((res) => {
        const data = res.data;
        setReviews(data.reviews || []);
        setAverageRating(data.averageRating || 0);
        setTotalReviews(data.totalReviews || 0);
      });
    } catch (err: any) {
      if (err.response?.status === 400) {
        setReviewError(err.response.data.message || "You have already reviewed this product.");
      } else if (err.response?.status === 401) {
        window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      } else {
        setReviewError("Failed to submit review. Please try again.");
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  /* ─── Loading State ────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-background font-body-md">
        <SiteHeader activePage="marketplace" />
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl animate-pulse space-y-8">
          <div className="h-4 w-48 bg-surface-variant rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
            <div className="lg:col-span-7">
              <div className="aspect-[4/3] bg-surface-variant rounded-xl" />
              <div className="grid grid-cols-4 gap-md mt-md">
                {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-square bg-surface-variant rounded-lg" />)}
              </div>
            </div>
            <div className="lg:col-span-5 space-y-lg">
              <div className="h-6 w-24 bg-surface-variant rounded-full" />
              <div className="h-10 w-3/4 bg-surface-variant rounded" />
              <div className="h-8 w-1/3 bg-surface-variant rounded" />
              <div className="h-20 bg-surface-variant rounded-xl" />
              <div className="h-12 bg-surface-variant rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Error State ──────────────────────────── */
  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <span className="material-symbols-outlined text-[64px] text-error mb-6">error_outline</span>
          <h1 className="font-headline-lg text-headline-lg text-primary mb-3">Product Not Found</h1>
          <p className="text-on-surface-variant mb-8">{error || "This product doesn't exist or has been removed."}</p>
          <Link href="/marketplace" className="inline-flex px-8 py-3 bg-primary text-on-primary font-label-md rounded-full">
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Data ─────────────────────────────────── */
  const allImages = product.images.length > 0 ? product.images : [];
  const currentImage = allImages[selectedImage] || "";
  const isLowStock = product.quantity < 20 && product.quantity > 0;
  const farmName = product.farmer?.farmName || product.farmer?.name || "Local Farmer";
  const location = product.farmer?.farmLocation;
  const locationStr = location ? `${location.village}, ${location.district}, ${location.state}` : "";

  const ratingDistribution = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const idx = Math.min(Math.floor(r.rating) - 1, 4);
    if (idx >= 0) ratingDistribution[idx]++;
  });

  const related = relatedProducts.slice(0, 4);

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md selection:bg-primary-fixed-dim selection:text-primary">
      <SiteHeader activePage="marketplace" />

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl">
        {/* ─── Breadcrumbs ────────────────────── */}
        <nav className="flex items-center gap-xs text-on-surface-variant mb-lg font-label-sm text-label-sm flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/marketplace" className="hover:text-primary transition-colors">
            {product.category?.name || "Marketplace"}
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">{product.name}</span>
        </nav>

        {/* ─── Product Main Section ────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-xl mb-xl">
          {/* Image Gallery */}
          <div className="lg:col-span-7 space-y-md">
            <div className="aspect-[4/3] rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low relative group">
              {currentImage ? (
                <img
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  alt={product.name}
                  src={currentImage}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = "1"; el.src = `https://placehold.co/800x600/e4e2dd/414844?text=${encodeURIComponent(product.name)}`; } }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[96px] text-outline">eco</span>
                </div>
              )}
              {product.isOrganic && (
                <span className="absolute top-4 left-4 bg-primary/90 text-on-primary font-label-sm text-label-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    eco
                  </span>
                  Certified Organic
                </span>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="grid grid-cols-4 gap-md">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`aspect-square rounded-lg overflow-hidden transition-all duration-200 ${
                      idx === selectedImage
                        ? "border-2 border-primary ring-2 ring-primary/20"
                        : "border border-outline-variant hover:border-primary/50"
                    }`}
                  >
                    <img
                      className="w-full h-full object-cover"
                      alt={`${product.name} view ${idx + 1}`}
                      src={img}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = "1"; el.src = `https://placehold.co/300x300/e4e2dd/414844?text=${encodeURIComponent(product.name)}`; } }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details Sidebar */}
          <div className="lg:col-span-5 space-y-lg">
            {/* Badges */}
            <div className="flex gap-sm mb-base flex-wrap">
              {product.isOrganic && (
                <span className="inline-flex items-center gap-xs px-sm py-1 bg-[#dcfce7] text-[#166534] rounded-full font-label-sm text-label-sm">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    eco
                  </span>
                  Organic
                </span>
              )}
              <span className="inline-flex items-center gap-xs px-sm py-1 bg-surface-container text-on-surface-variant rounded-full font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                Direct from Farm
              </span>
            </div>

            {/* Title & Price */}
            <div className="flex items-center justify-between">
              <h1 className="font-headline-lg text-headline-lg lg:text-headline-lg text-primary">{product.name}</h1>
              <button
                onClick={() => toggleItem({
                  productId: product._id,
                  name: product.name,
                  price: product.price,
                  unit: product.unit,
                  image: product.images?.[0] || "",
                  farmerName: product.farmer?.farmName || product.farmer?.name || "Local Farmer",
                  isOrganic: product.isOrganic,
                  farmerId: product.farmer?._id,
                })}
                className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container transition-all active:scale-90"
                title={isFavorite(product._id) ? "Remove from wishlist" : "Add to wishlist"}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: isFavorite(product._id) ? "'FILL' 1" : "'FILL' 0", color: isFavorite(product._id) ? "#dc2626" : "#6b7280" }}>favorite</span>
              </button>
            </div>
            <div className="flex items-center gap-md flex-wrap">
              <span className="font-headline-md text-headline-md text-on-tertiary-container">
                ₹{product.price}
                <span className="text-label-sm font-normal text-on-surface-variant">/{product.unit}</span>
              </span>
              {product.discountPrice && (
                <span className="text-label-md text-on-surface-variant line-through">₹{product.discountPrice}</span>
              )}
              <div className="flex items-center gap-1">
                <StarRating rating={averageRating || 4} size={18} />
                <span className="ml-1 font-label-sm text-on-surface-variant">
                  ({totalReviews || 0} review{totalReviews !== 1 ? "s" : ""})
                </span>
              </div>
            </div>

            {/* Harvest / Stock Grid */}
            <div className="grid grid-cols-2 gap-md p-md bg-surface-container-low rounded-xl border border-outline-variant">
              <div className="space-y-xs">
                <span className="block text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  Harvest Date
                </span>
                <span className="block font-label-md text-label-md text-primary">
                  {product.harvestDate ? formatDate(product.harvestDate) : "—"}
                </span>
              </div>
              <div className="space-y-xs">
                <span className="block text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  Availability
                </span>
                <span className={`block font-label-md text-label-md ${isLowStock ? "text-error" : "text-primary"}`}>
                  {!product.isAvailable
                    ? "Out of Stock"
                    : isLowStock
                    ? `Only ${product.quantity} left`
                    : `In Stock (${product.quantity})`}
                </span>
              </div>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="space-y-md">
              <div className="flex items-center gap-lg">
                <label className="font-label-md text-label-md text-on-surface">Quantity ({product.unit})</label>
                <div className="flex items-center border border-outline-variant rounded-lg overflow-hidden bg-white">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="p-sm hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">remove</span>
                  </button>
                  <input
                    className="w-12 text-center border-none focus:ring-0 font-label-md text-on-surface"
                    type="number"
                    min={1}
                    value={qty}
                    readOnly
                  />
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="p-sm hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                  </button>
                </div>
              </div>
              <button
                disabled={!product.isAvailable}
                onClick={() => {
                  if (!isAuthenticated()) {
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
                  }, qty);
                  setAddedToCart(true);
                  if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
                  addedTimerRef.current = setTimeout(() => setAddedToCart(false), 2000);
                }}
                className={`w-full py-md rounded-lg font-label-md text-label-md transition-all flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
                  addedToCart ? "bg-[#166534] text-white" : "bg-primary text-white hover:bg-primary-container"
                }`}
              >
                {addedToCart ? (
                  <><span className="material-symbols-outlined">check_circle</span> Added to Cart!</>
                ) : (
                  <><span className="material-symbols-outlined">shopping_basket</span>{product.isAvailable ? "Add to Basket" : "Out of Stock"}</>
                )}
              </button>
            </div>

            {/* Sustainability Info */}
            <div className="pt-lg border-t border-outline-variant space-y-sm">
              <div className="flex items-center gap-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-primary">package_2</span>
                <span className="font-label-md text-label-md">Plastic-free packaging</span>
              </div>
              <div className="flex items-center gap-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-primary">co2</span>
                <span className="font-label-md text-label-md">Low carbon footprint</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Bento Tabs Section ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
          {/* Left Side: Detailed Info */}
          <div className="lg:col-span-8 space-y-xl">
            {/* About this Product */}
            <section className="p-lg bg-white rounded-xl border border-outline-variant" style={{ boxShadow: "0 4px 20px -2px rgba(119, 87, 77, 0.12)" }}>
              <h2 className="font-headline-md text-headline-md text-primary mb-md">About this Product</h2>
              <div className="space-y-md text-on-surface-variant font-body-md text-body-md leading-relaxed">
                <p>{product.description || "No description available for this product."}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mt-md">
                  <div className="flex gap-sm">
                    <span className="material-symbols-outlined text-on-tertiary-container">restaurant</span>
                    <div>
                      <h4 className="font-label-md text-label-md text-primary">Flavor Profile</h4>
                      <p className="text-label-sm text-on-surface-variant">
                        {product.category?.name
                          ? `Fresh, premium quality ${product.category.name.toLowerCase()} sourced directly from local farms.`
                          : "Complex, earthy sweetness with a balanced natural flavor."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-sm">
                    <span className="material-symbols-outlined text-on-tertiary-container">agriculture</span>
                    <div>
                      <h4 className="font-label-md text-label-md text-primary">Farming Practices</h4>
                      <p className="text-label-sm text-on-surface-variant">
                        {product.isOrganic
                          ? "Grown using regenerative agriculture that nourishes the soil without synthetic pesticides."
                          : "Sustainably farmed with care for the land and the community."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Customer Reviews */}
            <section className="p-lg bg-white rounded-xl border border-outline-variant" id="reviews" style={{ boxShadow: "0 4px 20px -2px rgba(119, 87, 77, 0.12)" }}>
              <div className="flex justify-between items-center mb-lg">
                <h2 className="font-headline-md text-headline-md text-primary">Customer Reviews</h2>
                {!reviewSubmitted && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="text-primary font-label-md hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">rate_review</span>
                    Write a review
                  </button>
                )}
              </div>

              {/* Review Form */}
              {reviewSubmitted ? (
                <div className="text-center py-8 bg-surface-container-low rounded-xl border border-primary/20 mb-6">
                  <span className="material-symbols-outlined text-[40px]" style={{ color: "#166534" }}>check_circle</span>
                  <h3 className="font-headline-md text-headline-md text-primary mb-1">Review Submitted!</h3>
                  <p className="text-on-surface-variant mb-4 text-sm">Thank you for sharing your experience!</p>
                  <button
                    onClick={() => { setReviewSubmitted(false); setShowReviewForm(true); }}
                    className="text-primary font-label-md hover:underline"
                  >
                    Write Another Review
                  </button>
                </div>
              ) : showReviewForm ? (
                <form onSubmit={handleSubmitReview} className="mb-6 p-md bg-surface-container-low rounded-xl border border-outline-variant">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-label-md text-label-md text-primary">Share Your Experience</h3>
                    <button type="button" onClick={() => setShowReviewForm(false)} className="text-on-surface-variant hover:text-primary p-1">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  <div className="mb-4">
                    <p className="font-label-sm text-on-surface-variant mb-2">Your Rating</p>
                    <InteractiveStarRating rating={reviewRating} onChange={setReviewRating} size={32} />
                    {reviewRating > 0 && (
                      <p className="text-label-sm text-on-surface-variant mt-1">{RATING_LABELS[reviewRating]}</p>
                    )}
                  </div>
                  <div className="mb-4">
                    <textarea
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Tell others about your experience..."
                      className="w-full px-4 py-3 bg-white border border-outline-variant rounded-lg font-body-md focus:border-primary focus:ring-0 transition-all resize-none text-on-surface placeholder:text-outline"
                      maxLength={500}
                    />
                    <p className="text-label-sm text-on-surface-variant text-right mt-1">{reviewComment.length}/500</p>
                  </div>
                  {reviewError && (
                    <div className="mb-4 px-4 py-3 bg-error-container text-on-error-container rounded-lg font-label-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      {reviewError}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={reviewSubmitting || reviewRating === 0}
                      className="px-6 py-2.5 bg-primary text-white font-label-md rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {reviewSubmitting ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
                      ) : (
                        "Submit Review"
                      )}
                    </button>
                    {!isAuthenticated() && (
                      <p className="text-label-sm text-on-surface-variant">You&apos;ll need to sign in first.</p>
                    )}
                  </div>
                </form>
              ) : null}

              {/* Review List */}
              {reviewsLoading ? (
                <div className="space-y-lg">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse space-y-sm pb-lg border-b border-outline-variant">
                      <div className="flex items-center gap-sm">
                        <div className="w-8 h-8 rounded-full bg-surface-variant" />
                        <div className="h-4 w-32 bg-surface-variant rounded" />
                      </div>
                      <div className="h-3 w-full bg-surface-variant rounded" />
                      <div className="h-3 w-3/4 bg-surface-variant rounded" />
                    </div>
                  ))}
                </div>
              ) : reviews.length > 0 ? (
                <div className="space-y-lg">
                  {reviews.map((review) => (
                    <div key={review._id} className="space-y-sm pb-lg border-b border-outline-variant last:border-b-0 last:pb-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-sm">
                          <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary text-sm uppercase">
                            {(review.consumer?.name || "A")[0]}
                          </div>
                          <span className="font-label-md text-primary">{review.consumer?.name || "Anonymous"}</span>
                        </div>
                        <StarRating rating={review.rating} size={16} />
                      </div>
                      {review.comment && (
                        <p className="font-body-md text-on-surface-variant text-sm leading-relaxed">{review.comment}</p>
                      )}
                      <p className="text-label-sm text-on-surface-variant">{formatDate(review.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[40px] mb-2">rate_review</span>
                  <p>No reviews yet. Be the first to review this product!</p>
                </div>
              )}
            </section>
          </div>

          {/* Right Side: Producer & Meta */}
          <div className="lg:col-span-4 space-y-xl">
            {/* Meet the Producer */}
            <section className="p-lg bg-primary rounded-xl text-white" style={{ boxShadow: "0 4px 20px -2px rgba(119, 87, 77, 0.12)" }}>
              <h2 className="font-headline-md text-headline-md mb-md">Meet the Producer</h2>
              <div className="aspect-video w-full rounded-lg overflow-hidden mb-md border border-on-primary/20">
                {product.farmer?.avatar ? (
                  <img
                    className="w-full h-full object-cover"
                    alt={farmName}
                    src={product.farmer.avatar}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary-container/50">
                    <span className="material-symbols-outlined text-[48px] text-primary-fixed-dim">agriculture</span>
                  </div>
                )}
              </div>
              <div className="space-y-sm">
                <div className="flex items-center gap-xs">
                  <h3 className="font-headline-md text-[20px]">{farmName}</h3>
                  <span
                    className="material-symbols-outlined text-[18px] text-primary-fixed-dim"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                </div>
                <div className="flex items-center gap-xs text-primary-fixed-dim font-label-sm">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {locationStr || "Local Farm"}
                </div>
                <p className="text-on-primary/80 font-body-md text-[14px] leading-relaxed">
                  {product.farmer?.name ? `${product.farmer.name} runs ${farmName}. ` : ""}
                  Dedicated to providing fresh, high-quality produce straight from the farm to your table.
                  {product.isOrganic ? " All products are grown using organic practices without synthetic inputs." : ""}
                </p>
                <Link href={`/farmers/${product.farmer?._id}`} className="mt-md text-primary-fixed-dim font-label-md hover:text-white transition-colors flex items-center gap-xs">
                  View Farmer Profile <span className="material-symbols-outlined text-[18px]">arrow_right_alt</span>
                </Link>
              </div>
            </section>

            {/* Quick Details */}
            <div className="p-lg bg-surface-container-high rounded-xl border border-outline-variant space-y-md">
              <h4 className="font-label-md text-label-md text-primary uppercase tracking-wider">Quick Details</h4>
              <ul className="space-y-sm text-label-sm font-label-sm">
                <li className="flex justify-between border-b border-outline-variant pb-base">
                  <span className="text-on-surface-variant">Category</span>
                  <span className="text-on-surface">{product.category?.name || "—"}</span>
                </li>
                <li className="flex justify-between border-b border-outline-variant pb-base">
                  <span className="text-on-surface-variant">Origin</span>
                  <span className="text-on-surface">{location?.state || "Local"}</span>
                </li>
                <li className="flex justify-between border-b border-outline-variant pb-base">
                  <span className="text-on-surface-variant">Storage</span>
                  <span className="text-on-surface">Cool & Dry</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-on-surface-variant">Unit</span>
                  <span className="text-on-surface">Per {product.unit}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ─── Related Products ────────────────── */}
        <section className="mt-xl">
          <div className="flex justify-between items-center mb-lg">
            <h2 className="font-headline-md text-headline-md text-primary">Related Products</h2>
            <Link href="/marketplace" className="text-primary font-label-md flex items-center gap-xs hover:underline">
              See All <span className="material-symbols-outlined text-[18px]">east</span>
            </Link>
          </div>
          {relatedLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md md:gap-lg">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse bg-white rounded-xl border border-outline-variant overflow-hidden">
                  <div className="aspect-[4/5] bg-surface-variant" />
                  <div className="p-md space-y-2">
                    <div className="h-4 w-3/4 bg-surface-variant rounded" />
                    <div className="h-3 w-1/2 bg-surface-variant rounded" />
                    <div className="h-5 w-1/3 bg-surface-variant rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : related.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md md:gap-lg">
              {related.map((rp) => {
                const rpFarm = rp.farmer?.farmName || rp.farmer?.name || "Local Farm";
                const rpImg = rp.images?.[0] || "";
                const rpOrg = rp.isOrganic;
                return (
                  <Link
                    key={rp._id}
                    href={`/marketplace/${rp._id}`}
                    className="group bg-white rounded-xl border border-[#E0DCD0] overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="aspect-[4/5] relative overflow-hidden">
                      {rpImg ? (
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          alt={rp.name}
                          src={rpImg}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = "1"; el.src = `https://placehold.co/400x500/e4e2dd/414844?text=${encodeURIComponent(rp.name)}`; } }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-variant">
                          <span className="material-symbols-outlined text-[48px] text-outline">eco</span>
                        </div>
                      )}
                      {rpOrg && (
                        <span className="absolute top-sm right-sm bg-white/90 px-sm py-0.5 rounded-full font-label-sm text-label-sm text-primary backdrop-blur-sm">
                          Organic
                        </span>
                      )}
                    </div>
                    <div className="p-md space-y-xs">
                      <h3 className="font-label-md text-label-md text-on-surface truncate">{rp.name}</h3>
                      <p className="font-label-sm text-on-surface-variant truncate">{rpFarm}</p>
                      <div className="flex justify-between items-end pt-sm">
                        <span className="font-headline-md text-[18px] text-on-tertiary-container">
                          ₹{rp.price}
                          <span className="text-label-sm font-normal text-on-surface-variant">/{rp.unit}</span>
                        </span>
                        <div className="bg-primary text-white p-sm rounded-lg hover:bg-primary-container transition-colors">
                          <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-on-surface-variant text-center py-8">No related products found.</p>
          )}
        </section>
      </main>

      {/* ─── Bottom Navigation (Mobile) ──────── */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pt-2 pb-2 md:hidden z-50 bg-surface border-t border-outline-variant">
        <Link
          href="/marketplace"
          className="flex flex-col items-center justify-center text-primary px-4 py-1"
        >
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
        <Link
          href="/auth/login"
          className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1"
        >
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="font-label-sm text-[10px]">Profile</span>
        </Link>
      </nav>

      {/* ─── Footer ──────────────────────────── */}
      <footer className="w-full mt-12 bg-primary md:block">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg px-margin-mobile md:px-margin-desktop py-xl max-w-max-width mx-auto">
          <div className="space-y-md">
            <div className="font-headline-md text-headline-md text-on-primary">Krishi Market</div>
            <p className="font-body-md text-body-md text-on-primary/80">
              &copy; 2024 Krishi Market. Rooted in community, grown for you.
            </p>
            <div className="flex gap-md">
              <span className="material-symbols-outlined text-on-primary cursor-pointer hover:opacity-80 transition-opacity">face_nod</span>
              <span className="material-symbols-outlined text-on-primary cursor-pointer hover:opacity-80 transition-opacity">alternate_email</span>
              <span className="material-symbols-outlined text-on-primary cursor-pointer hover:opacity-80 transition-opacity">radio</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-sm">
              <a href="#" className="block font-body-md text-body-md text-on-primary/80 hover:text-on-primary transition-opacity">
                Mission Statement
              </a>
              <a href="#" className="block font-body-md text-body-md text-on-primary/80 hover:text-on-primary transition-opacity">
                Farmer Resources
              </a>
              <a href="#" className="block font-body-md text-body-md text-on-primary/80 hover:text-on-primary transition-opacity">
                Sustainability
              </a>
            </div>
            <div className="space-y-sm">
              <a href="#" className="block font-body-md text-body-md text-on-primary/80 hover:text-on-primary transition-opacity">
                Contact Info
              </a>
              <a href="#" className="block font-body-md text-body-md text-on-primary/80 hover:text-on-primary transition-opacity">
                Privacy Policy
              </a>
              <a href="#" className="block font-body-md text-body-md text-on-primary/80 hover:text-on-primary transition-opacity">
                Terms of Service
              </a>
            </div>
          </div>
          <div className="space-y-md">
            <h4 className="font-label-md text-on-primary">Newsletter</h4>
            <div className="flex gap-xs">
              <input
                className="bg-on-primary/10 border-on-primary/20 text-white rounded-lg px-md py-sm focus:ring-primary-fixed-dim focus:border-primary-fixed-dim w-full placeholder:text-on-primary/40"
                placeholder="Your email"
                type="email"
              />
              <button className="bg-on-primary text-primary px-md py-sm rounded-lg font-label-md hover:bg-primary-fixed-dim transition-colors whitespace-nowrap">
                Join
              </button>
            </div>
            <p className="text-[12px] text-on-primary/60">Get weekly updates on fresh harvests and market news.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
