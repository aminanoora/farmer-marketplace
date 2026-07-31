"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI } from "@/lib/api";

/* ─── Types ────────────────────────────────── */

interface FarmLocation {
  village?: string; district?: string; state?: string;
}

interface UserDetail {
  _id: string; name: string; email: string; phone?: string;
  role: "farmer" | "consumer" | "admin";
  avatar?: string; isActive: boolean;
  farmName?: string; farmLocation?: FarmLocation;
  cropTypes?: string[]; farmingMethod?: string;
  verificationStatus: string;
  createdAt: string; updatedAt: string;
}

interface ProductItem {
  _id: string; name: string; price: number; unit: string;
  quantity: number; isAvailable: boolean;
  isOrganic: boolean; images: string[];
  category?: { _id: string; name: string };
  createdAt: string;
}

interface UserDetailResponse {
  user: UserDetail; products: ProductItem[]; orderCount: number;
}

const ROLE_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  farmer:   { label: "Farmer",   bg: "bg-primary-fixed",      text: "text-primary",           icon: "eco" },
  consumer: { label: "Consumer", bg: "bg-secondary-fixed",    text: "text-secondary",         icon: "shopping_basket" },
  admin:    { label: "Admin",    bg: "bg-inverse-surface",    text: "text-inverse-on-surface", icon: "verified_user" },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:    { label: "Active",    bg: "bg-primary-fixed",    text: "text-primary",            dot: "bg-primary" },
  pending:   { label: "Pending",   bg: "bg-tertiary-fixed",   text: "text-on-tertiary-fixed-variant", dot: "bg-tertiary-container" },
  suspended: { label: "Suspended", bg: "bg-error-container",  text: "text-on-error-container", dot: "bg-error" },
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

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatCurrency(amount: number) {
  return "\u20B9" + amount.toLocaleString("en-IN");
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [productUpdating, setProductUpdating] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "block" | null>(null);
  const [confirmProductId, setConfirmProductId] = useState<string | null>(null);
  const [productPage, setProductPage] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const PRODUCTS_PER_PAGE = 5;

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || !id || user?.role !== "admin") return;
    setLoading(true); setError(null);
    adminAPI.getUser(id)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err?.response?.status === 404) setError("User not found.");
        else setError(err?.response?.data?.message || err?.message || "Failed to load user.");
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, id, user?.role]);

  /* Reset product pagination when products data or search changes */
  useEffect(() => {
    setProductPage(1);
  }, [data?.products?.length, productSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function showSuccess(msg: string) { setStatusMessage(msg); setTimeout(() => setStatusMessage(null), 3000); }
  function showError(msg: string) { setStatusError(msg); setTimeout(() => setStatusError(null), 4000); }

  const handleToggleStatus = async () => {
    if (!data) return;
    setStatusUpdating(true); setStatusError(null); setStatusMessage(null);
    try {
      const res = await adminAPI.toggleUserStatus(data.user._id, !data.user.isActive);
      setData({ ...data, user: res.data.user });
      showSuccess(res.data.message);
      setConfirmAction(null);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to update user status.");
    } finally { setStatusUpdating(false); }
  };

  const handleApproveFarmer = async () => {
    if (!data) return;
    setStatusUpdating(true); setStatusError(null); setStatusMessage(null);
    try {
      await adminAPI.approveFarmer(data.user._id);
      const res = await adminAPI.getUser(id);
      setData(res.data);
      showSuccess("Farmer has been approved and verified.");
      setConfirmAction(null);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to approve farmer.");
    } finally { setStatusUpdating(false); }
  };

  const handleRejectFarmer = async () => {
    if (!data) return;
    setStatusUpdating(true); setStatusError(null); setStatusMessage(null);
    try {
      await adminAPI.rejectFarmer(data.user._id);
      const res = await adminAPI.getUser(id);
      setData(res.data);
      showSuccess("Farmer verification has been rejected.");
      setConfirmAction(null);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to reject farmer.");
    } finally { setStatusUpdating(false); }
  };

  const handleToggleProduct = async (productId: string, currentlyAvailable: boolean) => {
    setProductUpdating(productId); setStatusError(null); setStatusMessage(null);
    try {
      const res = await adminAPI.toggleProductStatus(productId, !currentlyAvailable);
      if (data) {
        const updatedProducts = data.products.map((p) =>
          p._id === productId ? { ...p, isAvailable: !currentlyAvailable } : p
        );
        setData({ ...data, products: updatedProducts });
      }
      showSuccess(res.data.message);
      setConfirmProductId(null);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to update product.");
    } finally { setProductUpdating(null); }
  };

  // ── Render states ──
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading user details...</p>
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
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">User not found</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <Link href="/admin/farmers" className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back to Users
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const targetUser = data.user;
  const products = data.products || [];
  const roleBadge = ROLE_BADGES[targetUser.role] || ROLE_BADGES.consumer;
  const userStatus = !targetUser.isActive ? "suspended" : targetUser.verificationStatus === "pending" ? "pending" : "active";
  const statusBadge = STATUS_BADGES[userStatus] || STATUS_BADGES.active;
  /* Client-side product search by name */
  const filteredProducts = !productSearch.trim()
    ? products
    : products.filter((p) =>
        p.name.toLowerCase().includes(productSearch.trim().toLowerCase())
      );
  const approvedProducts = filteredProducts.filter((p) => p.isAvailable);
  const pendingProducts = filteredProducts.filter((p) => !p.isAvailable);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(productPage, totalPages);
  const paginatedProducts = filteredProducts.slice((safePage - 1) * PRODUCTS_PER_PAGE, safePage * PRODUCTS_PER_PAGE);
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";
  const targetInitials = getInitials(targetUser.name);

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface">
      {/* Top Nav */}
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
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-outline-variant p-md sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <nav className="flex flex-col gap-xs">
            <Link href="/admin/dashboard" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">dashboard</span><span className="font-label-md">Overview</span>
            </Link>
            <Link href="/admin/orders" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">shopping_cart</span><span className="font-label-md">Orders</span>
            </Link>
            <Link href="/admin/farmers" className="flex items-center gap-md px-md py-sm rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span><span className="font-label-md">Users</span>
            </Link>
            <Link href="/admin/inventory" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">inventory_2</span><span className="font-label-md">Inventory</span>
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

        {/* Main Content */}
        <main className="flex-1 p-lg lg:p-margin-desktop max-w-max-width mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-6">
            <Link href="/admin/farmers" className="hover:text-primary transition-colors">Users</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-on-surface">{targetUser.name}</span>
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            {/* Left: User Profile Card */}
            <div className="lg:col-span-8 space-y-gutter">
              {/* Profile Header */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-on-primary font-bold text-2xl border-2 border-primary-fixed">{targetInitials}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="font-headline-lg text-headline-lg text-primary">{targetUser.name}</h2>
                      <span className={"inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-sm text-label-sm " + statusBadge.bg + " " + statusBadge.text}>
                        <span className={"w-2 h-2 rounded-full " + statusBadge.dot + (userStatus === "pending" ? " animate-pulse" : "")}></span>
                        {statusBadge.label}
                      </span>
                      <span className={"inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-sm text-label-sm " + roleBadge.bg + " " + roleBadge.text}>
                        <span className="material-symbols-outlined text-[14px]">{roleBadge.icon}</span>
                        {roleBadge.label}
                      </span>
                    </div>
                    <p className="text-on-surface-variant font-body-md mt-1">
                      Joined {formatDate(targetUser.createdAt)}
                      {data.orderCount > 0 ? " \u00B7 " + data.orderCount + " order" + (data.orderCount > 1 ? "s" : "") : ""}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setConfirmAction("block")}
                      className={"px-6 py-3 rounded-lg font-label-md text-white transition-all flex items-center gap-2 shadow-lg " + (targetUser.isActive ? "bg-error hover:bg-error/90 shadow-error/20" : "bg-primary hover:opacity-90")}>
                      <span className="material-symbols-outlined text-[20px]">{targetUser.isActive ? "block" : "check_circle"}</span>
                      {targetUser.isActive ? "Block User" : "Activate User"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Contact & Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-primary mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">mail</span>
                      <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Email</p><p className="text-body-md text-on-surface">{targetUser.email}</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">call</span>
                      <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Phone</p><p className="text-body-md text-on-surface">{targetUser.phone || "Not provided"}</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">badge</span>
                      <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">User ID</p><p className="text-body-md text-on-surface text-xs font-mono">{targetUser._id}</p></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-primary mb-4">Account Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">calendar_today</span>
                      <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Joined</p><p className="text-body-md text-on-surface">{formatDateTime(targetUser.createdAt)}</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">update</span>
                      <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Last Updated</p><p className="text-body-md text-on-surface">{formatDateTime(targetUser.updatedAt)}</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">verified_user</span>
                      <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Verification</p><p className="text-body-md text-on-surface">{targetUser.verificationStatus === "verified" ? "Verified" : targetUser.verificationStatus === "rejected" ? "Rejected" : "Pending"}</p></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Farmer-specific: Farm Info */}
              {targetUser.role === "farmer" && (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                  <h3 className="font-headline-md text-headline-md text-primary mb-4">Farm Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">store</span>
                      <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Farm Name</p><p className="text-body-md text-on-surface">{targetUser.farmName || "Not set"}</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">grass</span>
                      <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Farming Method</p><p className="text-body-md text-on-surface capitalize">{targetUser.farmingMethod || "Not specified"}</p></div>
                    </div>
                    {targetUser.farmLocation && (
                      <div className="flex items-start gap-3 md:col-span-2">
                        <span className="material-symbols-outlined text-on-surface-variant">location_on</span>
                        <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Location</p><p className="text-body-md text-on-surface">{[targetUser.farmLocation.village, targetUser.farmLocation.district, targetUser.farmLocation.state].filter(Boolean).join(", ") || "Not specified"}</p></div>
                      </div>
                    )}
                    {targetUser.cropTypes && targetUser.cropTypes.length > 0 && (
                      <div className="flex items-start gap-3 md:col-span-2">
                        <span className="material-symbols-outlined text-on-surface-variant">eco</span>
                        <div><p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Crop Types</p><div className="flex flex-wrap gap-1 mt-1">{targetUser.cropTypes.map((c, i) => (<span key={i} className="px-2 py-0.5 bg-primary-fixed text-primary text-label-sm rounded-full">{c}</span>))}</div></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Products Section (if farmer) */}
              {targetUser.role === "farmer" && (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline-variant flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center justify-between w-full md:w-auto">
                      <h3 className="font-headline-md text-headline-md text-primary">Products ({filteredProducts.length})</h3>
                      <div className="flex gap-2 md:hidden">
                        <span className="px-3 py-1 bg-primary-fixed text-primary text-label-sm rounded-full font-bold">{approvedProducts.length} Approved</span>
                        {pendingProducts.length > 0 && (
                          <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant text-label-sm rounded-full font-bold">{pendingProducts.length} Pending</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-xs">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Search products by name..."
                          className="w-full pl-10 pr-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                        {productSearch && (
                          <button onClick={() => setProductSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-higher transition-all">
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        )}
                      </div>
                      <div className="hidden md:flex gap-2 flex-shrink-0">
                        <span className="px-3 py-1 bg-primary-fixed text-primary text-label-sm rounded-full font-bold">{approvedProducts.length} Approved</span>
                        {pendingProducts.length > 0 && (
                          <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant text-label-sm rounded-full font-bold">{pendingProducts.length} Pending</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {filteredProducts.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead><tr className="bg-surface-container-low text-left text-on-surface-variant text-label-sm uppercase tracking-wider">
                            <th className="px-6 py-3">Product</th>
                            <th className="px-6 py-3">Price</th>
                            <th className="px-6 py-3">Qty</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Action</th>
                          </tr></thead>
                          <tbody className="divide-y divide-outline-variant">
                            {paginatedProducts.map((p) => (
                              <tr key={p._id} className="hover:bg-surface-container-lowest transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container flex items-center justify-center flex-shrink-0">
                                      {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-on-surface-variant text-[18px]">agriculture</span>}
                                    </div>
                                    <div><p className="font-label-md text-on-surface">{p.name}</p>{p.category?.name && <p className="text-label-sm text-on-surface-variant">{p.category.name}</p>}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4"><span className="font-bold text-primary">{formatCurrency(p.price)}</span><span className="text-label-sm text-on-surface-variant">/{p.unit}</span></td>
                                <td className="px-6 py-4"><span>{p.quantity}</span><span className="text-label-sm text-on-surface-variant"> {p.unit}</span></td>
                                <td className="px-6 py-4">
                                  {p.isAvailable ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-fixed text-primary text-label-sm rounded-full font-bold"><span className="material-symbols-outlined text-[14px]">check_circle</span>Approved</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed-variant text-label-sm rounded-full font-bold"><span className="material-symbols-outlined text-[14px]">hourglass_empty</span>Pending</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <button onClick={() => setConfirmProductId(p._id)} disabled={productUpdating === p._id}
                                    className={"flex items-center gap-1 px-3 py-1.5 rounded-lg font-label-sm text-xs transition-colors " + (p.isAvailable ? "bg-error-container text-on-error-container hover:bg-error/20" : "bg-primary-fixed text-primary hover:opacity-80") + (productUpdating === p._id ? " opacity-50" : "")}>
                                    {productUpdating === p._id ? "..." : <><span className="material-symbols-outlined text-[14px]">{p.isAvailable ? "visibility_off" : "visibility"}</span>{p.isAvailable ? "Hide" : "Approve"}</>}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="px-6 py-3 bg-surface-container-low border-t border-outline-variant flex items-center justify-between">
                          <p className="text-label-sm text-on-surface-variant">
                            Showing {(safePage - 1) * PRODUCTS_PER_PAGE + 1}-{Math.min(safePage * PRODUCTS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} product{filteredProducts.length > 1 ? "s" : ""}
                          </p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setProductPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
                              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                              let pageNum: number;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (safePage <= 3) {
                                pageNum = i + 1;
                              } else if (safePage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = safePage - 2 + i;
                              }
                              return (
                                <button key={pageNum} onClick={() => setProductPage(pageNum)}
                                  className={"w-8 h-8 flex items-center justify-center rounded-lg font-label-md text-label-sm transition-colors " + (safePage === pageNum ? "bg-primary text-on-primary" : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high")}>
                                  {pageNum}
                                </button>
                              );
                            })}
                            <button onClick={() => setProductPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
                              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <div className="w-16 h-16 mx-auto bg-surface-container-high rounded-full flex items-center justify-center mb-md">
                        <span className="material-symbols-outlined text-[36px] text-outline">{productSearch ? "search_off" : "inventory_2"}</span></div>
                      <p className="font-headline-md text-headline-md text-primary">{productSearch ? "No products match" : "No products yet"}</p>
                      <p className="text-on-surface-variant font-body-md">{productSearch ? "Try a different search term or clear the filter." : "This farmer hasn\'t listed any products."}</p>
                      {productSearch && (
                        <button onClick={() => setProductSearch("")} className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity">Clear Search</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-4 space-y-gutter">
              {/* Quick Actions */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  {targetUser.role === "farmer" && targetUser.verificationStatus !== "verified" && (
                    <button onClick={() => setConfirmAction("approve")} disabled={statusUpdating}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity disabled:opacity-50">
                      <span className="material-symbols-outlined text-[20px]">verified</span>Approve Farmer
                    </button>
                  )}
                  {targetUser.role === "farmer" && targetUser.verificationStatus !== "rejected" && (
                    <button onClick={() => setConfirmAction("reject")} disabled={statusUpdating}
                      className="w-full flex items-center gap-3 px-4 py-3 border-2 border-error text-error rounded-lg font-label-md hover:bg-error-container transition-colors disabled:opacity-50">
                      <span className="material-symbols-outlined text-[20px]">close</span>Reject Verification
                    </button>
                  )}
                  <Link href={"/admin/orders?search=" + targetUser.email} className="w-full flex items-center gap-3 px-4 py-3 border border-outline-variant text-on-surface-variant rounded-lg font-label-md hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-[20px]">receipt_long</span>View Orders
                  </Link>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface-container-low rounded-lg text-center">
                    <p className="font-headline-md text-headline-md text-primary">{data.orderCount}</p>
                    <p className="text-label-sm text-on-surface-variant">Orders</p>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg text-center">
                    <p className="font-headline-md text-headline-md text-primary">{products.length}</p>
                    <p className="text-label-sm text-on-surface-variant">Products</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Confirmation Modal */}
      {/* Confirmation Modal — User Actions */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-8 max-w-md w-full mx-4 animate-slideDown">
            <div className="flex flex-col items-center text-center gap-4">
              <div className={"w-16 h-16 rounded-full flex items-center justify-center " + ((confirmAction === "approve" || (confirmAction === "block" && !targetUser.isActive)) ? "bg-primary-fixed" : "bg-error-container")}>
                <span className={"material-symbols-outlined text-[36px] " + ((confirmAction === "approve" || (confirmAction === "block" && !targetUser.isActive)) ? "text-primary" : "text-error")} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {confirmAction === "approve" ? "verified" : confirmAction === "reject" ? "gpp_bad" : "block"}
                </span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-primary">
                  {confirmAction === "approve" ? "Approve Farmer" : confirmAction === "reject" ? "Reject Verification" : targetUser.isActive ? "Block User" : "Activate User"}
                </h3>
                <p className="text-on-surface-variant font-body-md mt-2">
                  {confirmAction === "approve"
                    ? "This will verify the farmer\'s account and allow them to list products on the platform. Are you sure?"
                    : confirmAction === "reject"
                    ? "This will reject the farmer\'s verification status. They will not be able to list products until approved. Are you sure?"
                    : targetUser.isActive
                    ? "This will block this user from accessing the platform. They will not be able to log in or place orders until reactivated. Are you sure?"
                    : "This will reactivate this user\'s account and restore their access to the platform. Are you sure?"}
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => setConfirmAction(null)} disabled={statusUpdating}
                  className="flex-1 px-6 py-3 border-2 border-outline-variant text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container transition-colors">
                  Cancel
                </button>
                <button onClick={confirmAction === "approve" ? handleApproveFarmer : confirmAction === "reject" ? handleRejectFarmer : handleToggleStatus} disabled={statusUpdating}
                  className={"flex-1 px-6 py-3 rounded-xl font-label-md text-white transition-all disabled:opacity-50 " + ((confirmAction === "approve" || (confirmAction === "block" && !targetUser.isActive)) ? "bg-primary hover:opacity-90" : "bg-error hover:bg-error/90")}>
                  {statusUpdating ? "Processing..." : "Yes, " + (confirmAction === "approve" ? "Approve" : confirmAction === "reject" ? "Reject" : targetUser.isActive ? "Block" : "Activate")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal — Product Approve/Hide */}
      {confirmProductId && (() => {
        const prod = products.find((p) => p._id === confirmProductId);
        if (!prod) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmProductId(null)} />
            <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-8 max-w-md w-full mx-4 animate-slideDown">
              <div className="flex flex-col items-center text-center gap-4">
                <div className={"w-16 h-16 rounded-full flex items-center justify-center " + (prod.isAvailable ? "bg-error-container" : "bg-primary-fixed")}>
                  <span className={"material-symbols-outlined text-[36px] " + (prod.isAvailable ? "text-error" : "text-primary")} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {prod.isAvailable ? "visibility_off" : "visibility"}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-primary">
                    {prod.isAvailable ? "Hide Product" : "Approve Product"}
                  </h3>
                  <p className="text-on-surface-variant font-body-md mt-2">
                    {prod.isAvailable
                      ? "This will hide \"" + prod.name + "\" from the marketplace. Customers will no longer be able to purchase it. Are you sure?"
                      : "This will approve \"" + prod.name + "\" and make it visible on the marketplace for customers to purchase. Are you sure?"}
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button onClick={() => setConfirmProductId(null)} disabled={productUpdating === prod._id}
                    className="flex-1 px-6 py-3 border-2 border-outline-variant text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => handleToggleProduct(prod._id, prod.isAvailable)} disabled={productUpdating === prod._id}
                    className={"flex-1 px-6 py-3 rounded-xl font-label-md text-white transition-all disabled:opacity-50 " + (prod.isAvailable ? "bg-error hover:bg-error/90" : "bg-primary hover:opacity-90")}>
                    {productUpdating === prod._id ? "Processing..." : "Yes, " + (prod.isAvailable ? "Hide" : "Approve")}
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