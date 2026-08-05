"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { farmerAPI } from "@/lib/api";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
interface ProductDetail {
  _id: string;
  name: string;
  description?: string;
  category: { _id: string; name: string; slug?: string; icon?: string; description?: string } | null;
  farmer: {
    _id: string;
    name: string;
    farmName?: string;
    farmLocation?: string;
    farmingMethod?: string;
    avatar?: string;
    phone?: string;
    email?: string;
  } | null;
  price: number;
  unit: string;
  quantity: number;
  images: string[];
  harvestDate?: string;
  isOrganic: boolean;
  isAvailable: boolean;
  discountPrice?: number;
  isFeatured: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return "\u20B9" + amount.toLocaleString("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────
// Detail Row Component
// ─────────────────────────────────────────────────
function DetailRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between py-3 border-b border-outline-variant/50 last:border-b-0 ${className || ""}`}>
      <span className="text-on-surface-variant font-label-sm text-label-sm">{label}</span>
      <span className="text-on-surface font-label-md text-label-md text-right max-w-[60%]">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Product Detail Page
// ─────────────────────────────────────────────────
export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    if (!productId) return;

    setLoading(true);
    setError(null);

    farmerAPI
      .getProduct(productId)
      .then((res) => {
        const p = res.data.product;
        setProduct(p);
        setIsAvailable(p.isAvailable);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError("Product not found. It may have been deleted.");
        } else {
          setError(err?.response?.data?.message || err?.message || "Failed to load product details.");
        }
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const handleToggleAvailability = async () => {
    if (!product) return;
    setTogglingStatus(true);
    try {
      await farmerAPI.updateProduct(product._id, { isAvailable: !isAvailable });
      setIsAvailable((prev) => !prev);
    } catch {
      alert("Failed to update product status.");
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;
    try {
      await farmerAPI.deleteProduct(product._id);
      router.push("/farmer/products");
    } catch {
      alert("Failed to delete product.");
    }
  };

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading product details...</p>
        </div>
      </div>
    );
  }

  // ─── Error State ───
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-2">Product not found</h2>
          <p className="text-on-surface-variant font-body-md mb-8">{error}</p>
          <Link
            href="/farmer/products"
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const discountPercent =
    product.discountPrice && product.discountPrice < product.price
      ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
      : 0;

  const images = product.images.length > 0 ? product.images : [""];

  return (
    <div className="max-w-6xl mx-auto">
      {/* ─── Breadcrumb + Back ─── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Link href="/farmer/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/farmer/products" className="hover:text-primary transition-colors">Products</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface font-bold truncate max-w-[150px]">{product.name}</span>
        </div>
        <Link
          href="/farmer/products"
          className="inline-flex items-center gap-1 text-primary font-label-md hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All Products
        </Link>
      </div>

      {/* ─── Main Content Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ─── Left: Image Gallery (3 cols) ─── */}
        <div className="lg:col-span-3">
          {/* Main Image */}
          <div className="relative bg-white rounded-2xl border border-outline-variant overflow-hidden mb-4 aspect-[4/3]">
            {images[selectedImage] ? (
              <Image
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                src={images[selectedImage]}
                alt={product.name}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-container-high">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[64px] text-outline">image</span>
                  <p className="text-on-surface-variant font-label-sm mt-2">No image available</p>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto hide-scrollbar">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === selectedImage
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-outline-variant hover:border-primary/50"
                  }`}
                >
                  <Image fill sizes="80px" src={img} alt={`${product.name} ${idx + 1}`} className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Right: Product Info (2 cols) ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-outline-variant p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-surface-container-high px-2.5 py-0.5 rounded-full text-[11px] font-bold text-on-surface-variant">
                    {product.category?.name || "Uncategorized"}
                  </span>
                  {product.isOrganic && (
                    <span className="bg-primary-fixed text-on-primary-fixed-variant px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                      Organic
                    </span>
                  )}
                </div>
                <h1 className="font-headline-md text-headline-md text-primary mt-2">{product.name}</h1>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  SKU: KM-{product._id.slice(-6).toUpperCase()}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleToggleAvailability}
                  disabled={togglingStatus}
                  className={`p-2 rounded-lg transition-all ${
                    isAvailable
                      ? "bg-primary-fixed text-primary hover:bg-primary hover:text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-primary hover:text-on-primary"
                  }`}
                  title={isAvailable ? "Mark as Hidden" : "Mark as Active"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isAvailable ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-display-lg text-display-lg text-primary">
                {formatCurrency(product.discountPrice || product.price)}
              </span>
              <span className="text-on-surface-variant">/ {product.unit}</span>
              {discountPercent > 0 && (
                <span className="text-lg text-on-surface-variant line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
              {discountPercent > 0 && (
                <span className="bg-error-container text-error text-[12px] font-bold px-2 py-0.5 rounded-full">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            {/* Stock Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-surface-container-high">
                <span
                  className={`w-2 h-2 rounded-full ${
                    product.quantity <= 0 ? "bg-error" : product.quantity <= 20 ? "bg-on-tertiary-container" : "bg-primary"
                  }`}
                />
                {product.quantity <= 0
                  ? "Out of Stock"
                  : product.quantity <= 20
                  ? `Low Stock: ${product.quantity} ${product.unit} remaining`
                  : `In Stock: ${product.quantity} ${product.unit} available`}
              </div>

              {/* Approval Status Badge */}
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${
                product.approvalStatus === "approved"
                  ? "bg-primary-fixed text-on-primary-fixed-variant"
                  : product.approvalStatus === "rejected"
                  ? "bg-error-container text-error"
                  : "bg-tertiary-fixed text-on-tertiary-fixed-variant"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  product.approvalStatus === "approved"
                    ? "bg-primary"
                    : product.approvalStatus === "rejected"
                    ? "bg-error"
                    : "bg-on-tertiary-container"
                }`} />
                {product.approvalStatus === "approved"
                  ? "Approved"
                  : product.approvalStatus === "rejected"
                  ? "Rejected"
                  : "Pending Approval"}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl border border-outline-variant p-6">
            <h2 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px]">info</span>
              Product Details
            </h2>
            <div className="space-y-0">
              <DetailRow label="Price" value={formatCurrency(product.price)} />
              <DetailRow label="Unit" value={product.unit} />
              <DetailRow label="Stock Quantity" value={`${product.quantity} ${product.unit}`} />
              {product.discountPrice && (
                <DetailRow label="Discount Price" value={formatCurrency(product.discountPrice)} />
              )}
              <DetailRow label="Category" value={product.category?.name || "---"} />
              <DetailRow label="Organic" value={product.isOrganic ? "Yes" : "No"} />
              <DetailRow label="Visibility" value={
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isAvailable ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-surface-container-high text-on-surface-variant"
                }`}>
                  {isAvailable ? "Active" : "Hidden"}
                </span>
              } />
              <DetailRow label="Approval Status" value={
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  product.approvalStatus === "approved"
                    ? "bg-primary-fixed text-on-primary-fixed-variant"
                    : product.approvalStatus === "rejected"
                    ? "bg-error-container text-error"
                    : "bg-tertiary-fixed text-on-tertiary-fixed-variant"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    product.approvalStatus === "approved"
                      ? "bg-primary"
                      : product.approvalStatus === "rejected"
                      ? "bg-error"
                      : "bg-on-tertiary-container"
                  }`} />
                  {product.approvalStatus === "approved"
                    ? "Approved"
                    : product.approvalStatus === "rejected"
                    ? "Rejected"
                    : "Pending Approval"}
                </span>
              } />
              <DetailRow label="Harvest Date" value={product.harvestDate ? formatDate(product.harvestDate) : "Not specified"} />
              <DetailRow label="Created" value={formatDateTime(product.createdAt)} />
              <DetailRow label="Last Updated" value={formatDateTime(product.updatedAt)} />
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="bg-white rounded-2xl border border-outline-variant p-6">
              <h2 className="font-headline-md text-headline-md text-primary mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">description</span>
                Description
              </h2>
              <p className="text-on-surface font-body-md leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Farmer Info */}
          {product.farmer && (
            <div className="bg-white rounded-2xl border border-outline-variant p-6">
              <h2 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">person</span>
                Farmer Details
              </h2>
              <div className="space-y-0">
                {product.farmer.name && <DetailRow label="Name" value={product.farmer.name} />}
                {product.farmer.farmName && <DetailRow label="Farm Name" value={product.farmer.farmName} />}
                {product.farmer.farmLocation && <DetailRow label="Location" value={product.farmer.farmLocation} />}
                {product.farmer.farmingMethod && <DetailRow label="Farming Method" value={product.farmer.farmingMethod} />}
                {product.farmer.phone && <DetailRow label="Phone" value={product.farmer.phone} />}
                {product.farmer.email && <DetailRow label="Email" value={product.farmer.email} />}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-sm">
              <span className="material-symbols-outlined text-[20px]">edit</span>
              Edit Product
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-error-container text-error font-label-md rounded-xl hover:bg-error hover:text-on-error active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
              Delete Product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
