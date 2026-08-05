"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI } from "@/lib/api";

/* ─── Types ────────────────────────────────── */

interface ProductFarmer {
  _id: string; name: string; farmName?: string; avatar?: string;
  phone?: string; email?: string; farmLocation?: { village?: string; district?: string; state?: string };
  verificationStatus?: string; isActive?: boolean;
}

interface ProductCategory {
  _id: string; name: string; slug?: string; icon?: string; description?: string;
}

interface ProductDetail {
  _id: string; farmer: ProductFarmer; name: string; description?: string;
  category: ProductCategory; price: number; unit: string; quantity: number;
  images: string[]; harvestDate?: string; isOrganic: boolean;
  isAvailable: boolean; discountPrice?: number; isFeatured: boolean;
  seoDescription?: string; approvalStatus: "pending" | "approved" | "rejected";
  createdAt: string; updatedAt: string;
}

interface ProductDetailResponse {
  product: ProductDetail;
  reviews: { count: number; avgRating: number };
  orders: { timesOrdered: number; totalOrders: number; revenue: number };
}

const APPROVAL_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  approved: { label: "Approved", bg: "bg-primary-fixed", text: "text-primary", icon: "check_circle" },
  pending:  { label: "Pending",  bg: "bg-tertiary-fixed", text: "text-on-tertiary-fixed-variant", icon: "hourglass_empty" },
  rejected: { label: "Rejected", bg: "bg-error-container", text: "text-on-error-container", icon: "cancel" },
};

function formatDate(iso: string) {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  if (!iso) return "---";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + " at " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(amount: number) {
  return "₹" + amount.toLocaleString("en-IN");
}

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-on-surface-variant text-[20px] mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">{label}</p>
        <div className="text-body-md text-on-surface break-words">{value}</div>
      </div>
    </div>
  );
}

export default function AdminInventoryProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "hide" | "reject" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || !id || user?.role !== "admin") return;
    setLoading(true); setError(null);
    adminAPI.getProduct(id)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err?.response?.status === 404) setError("Product not found. It may have been deleted or the link is incorrect.");
        else setError(err?.response?.data?.message || err?.message || "Failed to load product.");
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, id, user?.role]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function showSuccess(msg: string) { setStatusMessage(msg); setTimeout(() => setStatusMessage(null), 3000); }
  function showError(msg: string) { setStatusError(msg); setTimeout(() => setStatusError(null), 4000); }

  const handleToggleAvailability = async () => {
    if (!data) return;
    setStatusUpdating(true); setStatusError(null); setStatusMessage(null);
    try {
      const res = await adminAPI.toggleProductStatus(data.product._id, !data.product.isAvailable);
      setData({ ...data, product: { ...data.product, isAvailable: res.data.product.isAvailable, approvalStatus: res.data.product.approvalStatus } });
      showSuccess(res.data.message);
      setConfirmAction(null);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to update product.");
    } finally { setStatusUpdating(false); }
  };

  const handleApprove = async () => {
    if (!data) return;
    setStatusUpdating(true); setStatusError(null); setStatusMessage(null);
    try {
      const res = await adminAPI.approveProduct(data.product._id);
      setData({ ...data, product: { ...data.product, approvalStatus: res.data.product.approvalStatus, isAvailable: res.data.product.isAvailable } });
      showSuccess(res.data.message);
      setConfirmAction(null);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to approve product.");
    } finally { setStatusUpdating(false); }
  };

  const handleReject = async () => {
    if (!data) return;
    setStatusUpdating(true); setStatusError(null); setStatusMessage(null);
    try {
      const res = await adminAPI.rejectProduct(data.product._id);
      setData({ ...data, product: { ...data.product, approvalStatus: res.data.product.approvalStatus, isAvailable: res.data.product.isAvailable } });
      showSuccess(res.data.message);
      setConfirmAction(null);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to reject product.");
    } finally { setStatusUpdating(false); }
  };

  // ── Render states ──
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-margin-mobile">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Product not found</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <Link href="/admin/inventory" className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const product = data.product;
  const badge = APPROVAL_BADGES[product.approvalStatus] || APPROVAL_BADGES.pending;
  const farmer = product.farmer || {} as ProductFarmer;
  const farmerStatus = !farmer.isActive ? "Inactive" : farmer.verificationStatus === "verified" ? "Verified" : farmer.verificationStatus === "rejected" ? "Rejected" : "Pending";
  const farmerStatusClass =
    !farmer.isActive ? "bg-error-container text-on-error-container" :
    farmer.verificationStatus === "verified" ? "bg-primary-fixed text-primary" : "bg-tertiary-fixed text-on-tertiary-fixed-variant";
  const stockValue = product.price * product.quantity;
  const effectivePrice = product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price
    ? product.discountPrice : null;
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";
  const images = product.images && product.images.length > 0 ? product.images : [];
  const safeImage = images[Math.min(activeImage, Math.max(0, images.length - 1))];
  const farmerInitials = getInitials(farmer.name);
  const rating = data.reviews.avgRating;

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface">

      {/* ── Top Nav ── */}
      <header className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop h-16 sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-xl">
          <Link href="/admin/dashboard" className="font-headline-md text-headline-md text-primary font-bold">Krishi Market</Link>
          <div className="hidden md:flex items-center gap-md">
            <nav className="flex gap-lg">
              <Link href="/admin/dashboard" className="text-on-surface-variant hover:bg-surface-container-low transition-colors py-2">Dashboard</Link>
              <Link href="/marketplace" className="text-on-surface-variant hover:bg-surface-container-low transition-colors py-2">Marketplace</Link>
              <Link href="/orders" className="text-on-surface-variant hover:bg-surface-container-low transition-colors py-2">Logistics</Link>
            </nav>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <button className="material-symbols-outlined p-sm rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors">notifications</button>
          <button className="material-symbols-outlined p-sm rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors">help</button>
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setProfileOpen((p) => !p)} className="flex items-center gap-sm ml-sm">
              <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold border border-outline-variant">{userInitial}</div>
              <span className="hidden md:block font-label-md text-label-md text-on-surface">Admin Portal</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant/50">
                  <p className="font-label-md text-primary truncate">{user.name}</p>
                  <p className="text-label-sm text-on-surface-variant truncate">{user.email}</p>
                </div>
                <div className="py-1">
                  <button onClick={() => { logout(); router.push("/admin/login"); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error/5 transition-colors font-body-md">
                    <span className="material-symbols-outlined text-[20px]">logout</span>Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* ── Sidebar ── */}
        <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-outline-variant p-md sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <nav className="flex flex-col gap-xs">
            <Link href="/admin/dashboard" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">dashboard</span><span className="font-label-md">Overview</span>
            </Link>
            <Link href="/admin/orders" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">shopping_cart</span><span className="font-label-md">Orders</span>
            </Link>
            <Link href="/admin/farmers" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">group</span><span className="font-label-md">Users</span>
            </Link>
            <Link href="/admin/inventory" className="flex items-center gap-md px-md py-sm rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span><span className="font-label-md">Inventory</span>
            </Link>
            <Link href="/admin/settings" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">settings</span><span className="font-label-md">Settings</span>
            </Link>
          </nav>
          <div className="mt-auto pt-lg">
            <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant">
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-xs">Storage Usage</p>
              <div className="w-full bg-outline-variant h-1 rounded-full overflow-hidden mb-xs"><div className="bg-primary h-full w-[65%]" /></div>
              <p className="text-[10px] text-on-surface-variant">6.5 GB of 10 GB used</p>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 p-lg lg:p-margin-desktop max-w-max-width mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-6">
            <Link href="/admin/inventory" className="hover:text-primary transition-colors">Inventory</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-on-surface truncate max-w-[220px]">{product.name}</span>
          </nav>

          {/* Status Messages */}
          {statusMessage && (
            <div className="mb-6 p-md rounded-xl bg-primary-fixed text-on-primary-fixed-variant flex items-center gap-3 animate-slideDown">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="font-label-md">{statusMessage}</span>
            </div>
          )}
          {statusError && (
            <div className="mb-6 p-md rounded-xl bg-error-container text-on-error-container flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span className="font-label-md">{statusError}</span>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              {/* Icon behind, image overlaid — a broken image URL reveals the icon */}
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-surface-container flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-[24px]">agriculture</span>
                {safeImage && (
                  <Image
                    fill
                    sizes="56px"
                    src={safeImage}
                    alt={product.name}
                    className="object-cover"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.dataset.fb) return;
                      el.dataset.fb = "1";
                      el.onerror = null;
                      el.style.display = "none";
                    }}
                  />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-headline-lg text-headline-lg text-primary">{product.name}</h2>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-sm text-label-sm ${badge.bg} ${badge.text}`}>
                    <span className="material-symbols-outlined text-[14px]">{badge.icon}</span>
                    {badge.label}
                  </span>
                </div>
                <p className="text-on-surface-variant font-body-md mt-0.5">
                  Listed {formatDate(product.createdAt)} · Category: {product.category?.name || "Uncategorized"}
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setConfirmAction("reject")} disabled={statusUpdating || product.approvalStatus === "rejected"}
                className="px-5 py-2.5 border-2 border-error text-error rounded-lg font-label-md hover:bg-error-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">gpp_bad</span>Reject
              </button>
              <button onClick={() => setConfirmAction(product.isAvailable ? "hide" : "approve")} disabled={statusUpdating}
                className={"px-5 py-2.5 rounded-lg font-label-md text-white transition-all flex items-center gap-2 shadow-lg " + (product.isAvailable ? "bg-error hover:bg-error/90 shadow-error/20" : "bg-primary hover:opacity-90 shadow-primary/20")}>
                <span className="material-symbols-outlined text-[18px]">{product.isAvailable ? "visibility_off" : "visibility"}</span>
                {product.isAvailable ? "Hide Product" : "Approve Product"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">

            {/* ── Left column ── */}
            <div className="lg:col-span-8 space-y-gutter">

              {/* Image Gallery */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">photo_library</span>Photos
                </h3>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1 aspect-[4/3] rounded-xl overflow-hidden bg-surface-container flex items-center justify-center border border-outline-variant">
                    {safeImage ? (
                      <Image
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        src={safeImage}
                        alt={product.name}
                        className="object-cover"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (el.dataset.fb) return;
                          el.dataset.fb = "1";
                          el.onerror = null;
                          el.style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant text-[56px]">agriculture</span>
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="flex md:flex-col gap-2 flex-shrink-0">
                      {images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImage(i)}
                          className={"relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all " + (i === Math.min(activeImage, images.length - 1) ? "border-primary shadow-md" : "border-outline-variant opacity-60 hover:opacity-100")}
                        >
                          <Image fill sizes="64px" src={img} alt={product.name + " " + (i + 1)} className="object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {images.length === 0 && (
                  <p className="text-on-surface-variant font-body-md mt-3">This product has no photos uploaded.</p>
                )}
              </div>

              {/* Description */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">description</span>Description
                </h3>
                <p className="text-body-md text-on-surface leading-relaxed whitespace-pre-wrap">{product.description || "No description provided by the farmer."}</p>
                {product.seoDescription && (
                  <div className="mt-4 pt-4 border-t border-outline-variant">
                    <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">SEO Description</p>
                    <p className="text-body-md text-on-surface-variant">{product.seoDescription}</p>
                  </div>
                )}
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-primary mb-4">Pricing</h3>
                  <div className="space-y-4">
                    <InfoRow icon="sell" label="Selling Price" value={<span className="font-bold text-primary text-lg">{formatCurrency(product.price)}<span className="text-sm font-normal text-on-surface-variant">/{product.unit}</span></span>} />
                    {effectivePrice && (
                      <InfoRow icon="local_offer" label="Discounted Price" value={<span className="font-bold text-primary text-lg">{formatCurrency(effectivePrice)}<span className="text-sm font-normal text-on-surface-variant">/{product.unit}</span></span>} />
                    )}
                    {effectivePrice && (
                      <InfoRow icon="percent" label="Discount" value={Math.round(((product.price - effectivePrice) / product.price) * 100) + "% off"} />
                    )}
                  </div>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-primary mb-4">Stock</h3>
                  <div className="space-y-4">
                    <InfoRow icon="inventory_2" label="Available Quantity" value={product.quantity + " " + product.unit} />
                    <InfoRow icon="payments" label="Stock Value" value={formatCurrency(stockValue)} />
                    <div>
                      <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Stock Level</p>
                      {product.quantity <= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-bold text-label-sm"><span className="material-symbols-outlined text-[14px]">block</span>Out of Stock</span>
                      ) : product.quantity <= 20 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-bold text-label-sm"><span className="material-symbols-outlined text-[14px]">warning</span>Low Stock</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-bold text-label-sm"><span className="material-symbols-outlined text-[14px]">check_circle</span>In Stock</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Attributes */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">tune</span>Attributes
                </h3>
                <div className="flex flex-wrap gap-3">
                  <span className={"inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-label-sm " + (product.isOrganic ? "bg-primary-fixed text-primary" : "bg-surface-container-high text-on-surface-variant")}>
                    <span className="material-symbols-outlined text-[16px]">eco</span>{product.isOrganic ? "Organic" : "Conventional"}
                  </span>
                  <span className={"inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-label-sm " + (product.isFeatured ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" : "bg-surface-container-high text-on-surface-variant")}>
                    <span className="material-symbols-outlined text-[16px]">star</span>{product.isFeatured ? "Featured" : "Not Featured"}
                  </span>
                  <span className={"inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-label-sm " + (product.isAvailable ? "bg-primary-fixed text-primary" : "bg-error-container text-on-error-container")}>
                    <span className="material-symbols-outlined text-[16px]">{product.isAvailable ? "visibility" : "visibility_off"}</span>{product.isAvailable ? "Visible on Marketplace" : "Hidden from Marketplace"}
                  </span>
                </div>
                {product.harvestDate && (
                  <div className="mt-4 pt-4 border-t border-outline-variant">
                    <InfoRow icon="calendar_month" label="Harvest Date" value={formatDate(product.harvestDate)} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="lg:col-span-4 space-y-gutter">

              {/* Quick Actions */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  {product.approvalStatus !== "approved" && (
                    <button onClick={() => setConfirmAction("approve")} disabled={statusUpdating}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity disabled:opacity-50">
                      <span className="material-symbols-outlined text-[20px]">verified</span>Approve & Publish
                    </button>
                  )}
                  {product.isAvailable && (
                    <button onClick={() => setConfirmAction("hide")} disabled={statusUpdating}
                      className="w-full flex items-center gap-3 px-4 py-3 border border-outline-variant text-on-surface-variant rounded-lg font-label-md hover:bg-surface-container transition-colors disabled:opacity-50">
                      <span className="material-symbols-outlined text-[20px]">visibility_off</span>Hide from Marketplace
                    </button>
                  )}
                  {product.approvalStatus !== "rejected" && (
                    <button onClick={() => setConfirmAction("reject")} disabled={statusUpdating}
                      className="w-full flex items-center gap-3 px-4 py-3 border-2 border-error text-error rounded-lg font-label-md hover:bg-error-container transition-colors disabled:opacity-50">
                      <span className="material-symbols-outlined text-[20px]">gpp_bad</span>Reject Product
                    </button>
                  )}
                  <Link href={"/admin/farmers/" + farmer._id} className="w-full flex items-center gap-3 px-4 py-3 border border-outline-variant text-on-surface-variant rounded-lg font-label-md hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-[20px]">person</span>View Farmer Profile
                  </Link>
                </div>
              </div>

              {/* Farmer */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Farmer</h3>
                <div className="flex items-center gap-4 mb-5">
                  {/* Initials render beneath; the avatar overlays it and reveals the
                      initials if the image URL is broken (dataset.fb guards loops). */}
                  <div className="relative w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-lg flex-shrink-0">
                    <span>{farmerInitials}</span>
                    {farmer.avatar && (
                      <Image
                        fill
                        sizes="56px"
                        src={farmer.avatar}
                        alt={farmer.name}
                        className="object-cover rounded-full"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (el.dataset.fb) return;
                          el.dataset.fb = "1";
                          el.onerror = null;
                          el.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-label-md text-on-surface truncate">{farmer.name || "Unknown Farmer"}</p>
                    {farmer.farmName && <p className="text-label-sm text-on-surface-variant truncate">{farmer.farmName}</p>}
                    <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] mt-1 " + farmerStatusClass}>
                      <span className="material-symbols-outlined text-[12px]">{farmerStatus === "Verified" ? "verified" : farmerStatus === "Pending" ? "hourglass_empty" : "cancel"}</span>
                      {farmerStatus}
                    </span>
                  </div>
                </div>
                <div className="space-y-4 border-t border-outline-variant pt-4">
                  <InfoRow icon="call" label="Phone" value={farmer.phone || "Not provided"} />
                  <InfoRow icon="mail" label="Email" value={farmer.email || "Not provided"} />
                  {farmer.farmLocation && (
                    <InfoRow icon="location_on" label="Location" value={[farmer.farmLocation.village, farmer.farmLocation.district, farmer.farmLocation.state].filter(Boolean).join(", ") || "Not specified"} />
                  )}
                </div>
              </div>

              {/* Performance Stats */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Performance</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-surface-container-low rounded-lg text-center">
                    <p className="font-headline-md text-headline-md text-primary">{data.orders.totalOrders}</p>
                    <p className="text-label-sm text-on-surface-variant">Orders</p>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-lg text-center">
                    <p className="font-headline-md text-headline-md text-primary">{data.orders.timesOrdered}</p>
                    <p className="text-label-sm text-on-surface-variant">Units Sold</p>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-lg text-center">
                    <p className="font-headline-md text-headline-md text-primary">{formatCurrency(data.orders.revenue)}</p>
                    <p className="text-label-sm text-on-surface-variant">Revenue</p>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-lg text-center">
                    <p className="font-headline-md text-headline-md text-primary flex items-center justify-center gap-1">
                      {rating > 0 ? rating.toFixed(1) : "—"}
                      {rating > 0 && <span className="material-symbols-outlined text-[18px] text-tertiary">star</span>}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">{data.reviews.count} Review{data.reviews.count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Details</h3>
                <div className="space-y-4">
                  <InfoRow icon="category" label="Category" value={product.category?.name || "Uncategorized"} />
                  <InfoRow icon="badge" label="Product ID" value={<span className="text-xs font-mono">{product._id}</span>} />
                  <InfoRow icon="calendar_today" label="Listed On" value={formatDateTime(product.createdAt)} />
                  <InfoRow icon="update" label="Last Updated" value={formatDateTime(product.updatedAt)} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (() => {
        const isHide = confirmAction === "hide";
        const isReject = confirmAction === "reject";
        const icon = isReject ? "gpp_bad" : isHide ? "visibility_off" : "verified";
        const title = isReject ? "Reject Product" : isHide ? "Hide Product" : "Approve Product";
        const description = isReject
          ? 'This will reject "' + product.name + '" and remove it from the marketplace. The farmer will be notified. Are you sure?'
          : isHide
          ? 'This will hide "' + product.name + '" from the marketplace. Customers will no longer be able to purchase it. Are you sure?'
          : 'This will approve "' + product.name + '" and make it visible on the marketplace for customers to purchase. Are you sure?';
        const isDanger = isHide || isReject;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !statusUpdating && setConfirmAction(null)} />
            <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-8 max-w-md w-full mx-4 animate-slideDown">
              <div className="flex flex-col items-center text-center gap-4">
                <div className={"w-16 h-16 rounded-full flex items-center justify-center " + (isDanger ? "bg-error-container" : "bg-primary-fixed")}>
                  <span className={"material-symbols-outlined text-[36px] " + (isDanger ? "text-error" : "text-primary")} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {icon}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-primary">{title}</h3>
                  <p className="text-on-surface-variant font-body-md mt-2">{description}</p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button onClick={() => setConfirmAction(null)} disabled={statusUpdating}
                    className="flex-1 px-6 py-3 border-2 border-outline-variant text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={isReject ? handleReject : isHide ? handleToggleAvailability : handleApprove}
                    disabled={statusUpdating}
                    className={"flex-1 px-6 py-3 rounded-xl font-label-md text-white transition-all disabled:opacity-50 " + (isDanger ? "bg-error hover:bg-error/90" : "bg-primary hover:opacity-90")}>
                    {statusUpdating ? "Processing..." : "Yes, " + (isReject ? "Reject" : isHide ? "Hide" : "Approve")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
