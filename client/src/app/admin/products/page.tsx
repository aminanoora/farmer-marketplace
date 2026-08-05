"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI } from "@/lib/api";

/* ─── Types ────────────────────────────────── */

interface ProductFarmer { _id: string; name: string; farmName?: string; }
interface ProductCategory { _id: string; name: string; }

interface ApprovalProduct {
  _id: string; name: string; description?: string;
  price: number; unit: string; quantity: number;
  isAvailable: boolean; isOrganic: boolean; images: string[];
  farmer: ProductFarmer; category: ProductCategory;
  approvalStatus: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface ApprovalStats { totalProducts: number; pendingCount: number; approvedCount: number; rejectedCount: number; }
interface PaginationInfo { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean; }

interface ProductsResponse { products: ApprovalProduct[]; stats: ApprovalStats; categories: ProductCategory[]; pagination: PaginationInfo; }

const STATUS_TABS = [
  { key: "all", label: "All Products", icon: "inventory_2" },
  { key: "pending", label: "Pending", icon: "hourglass_empty" },
  { key: "approved", label: "Approved", icon: "check_circle" },
  { key: "rejected", label: "Rejected", icon: "cancel" },
] as const;

const SORT_OPTIONS = [
  { value: "-createdAt", label: "Newest First" },
  { value: "createdAt", label: "Oldest First" },
  { value: "-price", label: "Highest Price" },
  { value: "price", label: "Lowest Price" },
  { value: "name", label: "Name A-Z" },
] as const;

const APPROVAL_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  pending:  { label: "Pending",  bg: "bg-amber-50", text: "text-amber-700", icon: "hourglass_empty" },
  approved: { label: "Approved", bg: "bg-green-50", text: "text-green-700", icon: "check_circle" },
  rejected: { label: "Rejected", bg: "bg-red-50",    text: "text-red-700",  icon: "cancel" },
};

function formatDate(iso: string) {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(amount: number) {
  return "\u20B9" + amount.toLocaleString("en-IN");
}

function getTimeAgo(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d ago";
  return formatDate(iso);
}

export default function AdminProductApprovalsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const catMenuRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);

  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [actionUpdating, setActionUpdating] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [sendSearch, setSendSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusTab, setStatusTab] = useState("pending");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showCatMenu, setShowCatMenu] = useState(false);
  const [sortBy, setSortBy] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [confirmAction, setConfirmAction] = useState<{ productId: string; action: "approve" | "reject" } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<ApprovalProduct | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSendSearch(searchInput); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [sendSearch, statusTab, catFilter]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) setShowCatMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (toastMessage) { const t = setTimeout(() => setToastMessage(null), 3000); return () => clearTimeout(t); }
  }, [toastMessage]);
  useEffect(() => {
    if (toastError) { const t = setTimeout(() => setToastError(null), 4000); return () => clearTimeout(t); }
  }, [toastError]);

  const fetchProducts = useCallback(() => {
    if (!isAuthenticated || user?.role !== "admin") return;
    const id = ++fetchIdRef.current;
    setLoading(true); setError(null);
    const params: Record<string, string> = { page: String(page), limit: String(perPage), sort: sortBy };
    if (statusTab !== "all") params.approvalStatus = statusTab;
    if (catFilter !== "all") params.category = catFilter;
    if (sendSearch.trim()) params.search = sendSearch.trim();
    adminAPI.getProducts(params)
      .then((res) => { if (id === fetchIdRef.current) setData(res.data); })
      .catch((err) => { if (id === fetchIdRef.current) setError(err?.response?.data?.message || err?.message || "Failed to load products."); })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }, [isAuthenticated, user?.role, page, sortBy, statusTab, catFilter, sendSearch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleApprove = async (productId: string) => {
    setActionUpdating(productId);
    try {
      const res = await adminAPI.approveProduct(productId);
      setToastMessage(res.data.message || "Product approved successfully!");
      if (data) {
        const updated = data.products.map((p) =>
          p._id === productId ? { ...p, approvalStatus: "approved" as const, isAvailable: true } : p
        );
        setData({ ...data, products: updated });
      }
      setConfirmAction(null);
    } catch (err: any) {
      setToastError(err?.response?.data?.message || "Failed to approve product.");
    } finally { setActionUpdating(null); }
  };

  const handleReject = async (productId: string) => {
    setActionUpdating(productId);
    try {
      const res = await adminAPI.rejectProduct(productId);
      setToastMessage(res.data.message || "Product has been rejected.");
      if (data) {
        const updated = data.products.map((p) =>
          p._id === productId ? { ...p, approvalStatus: "rejected" as const, isAvailable: false } : p
        );
        setData({ ...data, products: updated });
      }
      setConfirmAction(null);
    } catch (err: any) {
      setToastError(err?.response?.data?.message || "Failed to reject product.");
    } finally { setActionUpdating(null); }
  };

  if (authLoading || (loading && !data)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Loading product approvals...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  if (error && !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[40px] text-red-500">error</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Failed to load products</h2>
          <p className="text-gray-500 mb-8">{error}</p>
          <button onClick={fetchProducts} className="px-8 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:opacity-90 transition-all">Try Again</button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const pag = data?.pagination;
  const products = data?.products || [];
  const categories = data?.categories || [];
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";
  const hasActiveFilters = sendSearch || catFilter !== "all" || statusTab !== "all";

  const pageButtons: { pageNum: number }[] = [];
  if (pag) {
    const maxBtns = Math.min(pag.totalPages, 5);
    const startPage = Math.max(1, Math.min(pag.page - 2, pag.totalPages - maxBtns));
    for (let i = 0; i < maxBtns; i++) {
      const pn = startPage + i;
      if (pn > pag.totalPages) break;
      pageButtons.push({ pageNum: pn });
    }
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Top Nav */}
      <header className="flex justify-between items-center w-full px-6 md:px-12 h-16 sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center gap-8">
          <Link href="/admin/dashboard" className="text-xl font-bold text-emerald-900">Krishi Market</Link>
          <div className="hidden md:flex items-center gap-4">
            <nav className="flex gap-6">
              <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium">Dashboard</Link>
              <Link href="/admin/orders" className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium">Orders</Link>
            </nav>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setProfileOpen((p) => !p)} className="flex items-center gap-2 ml-2">
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold border border-gray-200">{userInitial}</div>
              <span className="hidden md:block text-sm font-medium text-gray-900">Admin</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <div className="py-1">
                  <button onClick={() => { logout(); router.push("/admin/login"); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors text-sm">
                    <span className="material-symbols-outlined text-lg">logout</span>Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <nav className="flex flex-col gap-1">
            <Link href="/admin/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors text-sm">
              <span className="material-symbols-outlined text-lg">dashboard</span>Overview
            </Link>
            <Link href="/admin/orders" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors text-sm">
              <span className="material-symbols-outlined text-lg">shopping_cart</span>Orders
            </Link>
            <Link href="/admin/farmers" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors text-sm">
              <span className="material-symbols-outlined text-lg">group</span>Users
            </Link>
            <Link href="/admin/inventory" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors text-sm">
              <span className="material-symbols-outlined text-lg">inventory_2</span>Inventory
            </Link>
            <Link href="/admin/products" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold transition-colors text-sm">
              <span className="material-symbols-outlined text-lg">rate_review</span>
              <span>Approvals</span>
              {stats && stats.pendingCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{stats.pendingCount > 99 ? "99+" : stats.pendingCount}</span>
              )}
            </Link>
            <Link href="/admin/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors text-sm">
              <span className="material-symbols-outlined text-lg">settings</span>Settings
            </Link>
          </nav>
          <div className="mt-auto pt-6">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Review Queue</p>
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mb-2">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: stats && stats.totalProducts > 0 ? ((stats.pendingCount / stats.totalProducts) * 100) + "%" : "0%" }} />
              </div>
              <p className="text-[10px] text-gray-500">
                {stats ? stats.pendingCount + " of " + stats.totalProducts + " pending" : "No products"}
                {stats && stats.rejectedCount > 0 ? " (" + stats.rejectedCount + " rejected)" : ""}
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="p-6 lg:p-12 max-w-7xl mx-auto">

            {/* Page Header */}
            <header className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold text-emerald-900 mb-1">Product Approvals</h2>
                  <p className="text-gray-500">Review and manage product listings submitted by farmers.</p>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={fetchProducts} disabled={loading}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors text-xs font-medium disabled:opacity-50">
                    <span className="material-symbols-outlined text-lg" style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>refresh</span>
                    Refresh
                  </button>
                </div>
              </div>
            </header>

            {/* Stats Cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total", count: stats?.totalProducts, icon: "inventory_2", bg: "bg-gray-100", text: "text-gray-900" },
                { label: "Pending", count: stats?.pendingCount, icon: "hourglass_empty", bg: "bg-amber-50", text: "text-amber-700" },
                { label: "Approved", count: stats?.approvedCount, icon: "check_circle", bg: "bg-green-50", text: "text-green-700" },
                { label: "Rejected", count: stats?.rejectedCount, icon: "cancel", bg: "bg-red-50", text: "text-red-700" },
              ].map((card) => (
                <div key={card.label} className="bg-white border border-gray-200 p-5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">{card.label}</span>
                    <div className={card.bg + " p-1.5 rounded-lg"}>
                      <span className={"material-symbols-outlined text-lg " + card.text}>{card.icon}</span>
                    </div>
                  </div>
                  <p className={"text-2xl font-bold " + card.text}>{card.count !== undefined ? card.count.toLocaleString("en-IN") : "---"}</p>
                </div>
              ))}
            </section>

            {/* Toasts */}
            {toastMessage && (
              <div className="mb-6 p-4 rounded-xl bg-green-50 text-green-800 flex items-center gap-3 shadow-md border border-green-200">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-sm font-medium flex-1">{toastMessage}</span>
                <button onClick={() => setToastMessage(null)} className="material-symbols-outlined text-lg opacity-50 hover:opacity-100">close</button>
              </div>
            )}
            {toastError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-800 flex items-center gap-3 shadow-md border border-red-200">
                <span className="material-symbols-outlined text-lg">error</span>
                <span className="text-sm font-medium flex-1">{toastError}</span>
                <button onClick={() => setToastError(null)} className="material-symbols-outlined text-lg opacity-50 hover:opacity-100">close</button>
              </div>
            )}

            {/* Filters Bar */}
            <div className="bg-gray-50 p-4 rounded-t-xl border-x border-t border-gray-200">
              {/* Status Tabs */}
              <div className="flex gap-1 p-0.5 bg-gray-100 rounded-xl mb-4 overflow-x-auto">
                {STATUS_TABS.map((tab) => {
                  const isActive = statusTab === tab.key;
                  const counts = tab.key === "all" ? stats?.totalProducts
                    : tab.key === "pending" ? stats?.pendingCount
                    : tab.key === "approved" ? stats?.approvedCount
                    : stats?.rejectedCount;
                  return (
                    <button key={tab.key} onClick={() => { setStatusTab(tab.key); setPage(1); }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        isActive ? "bg-white text-emerald-700 shadow-sm font-bold" : "text-gray-500 hover:text-emerald-700 hover:bg-white/50"
                      }`}>
                      <span className="material-symbols-outlined text-base">{tab.icon}</span>
                      <span>{tab.label}</span>
                      {counts !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? tab.key === "pending" ? "bg-amber-100 text-amber-700"
                            : tab.key === "rejected" ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-500"
                        }`}>{counts}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Dropdown filters */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative" ref={catMenuRef}>
                    <button onClick={() => setShowCatMenu((p) => !p)}
                      className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
                      <span className="material-symbols-outlined text-lg">category</span>
                      <span>Category: {catFilter === "all" ? "All" : categories.find((c) => c._id === catFilter)?.name || "All"}</span>
                      <span className="material-symbols-outlined text-lg">expand_more</span>
                    </button>
                    {showCatMenu && (
                      <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                        <button onClick={() => { setCatFilter("all"); setShowCatMenu(false); }}
                          className={"w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors " + (catFilter === "all" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-700")}>All Categories</button>
                        {categories.map((c) => (
                          <button key={c._id} onClick={() => { setCatFilter(c._id); setShowCatMenu(false); }}
                            className={"w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors " + (catFilter === c._id ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-700")}>{c.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Sort:</span>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                      className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer">
                      {SORT_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                </div>
                <div className="w-full md:w-auto relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                  <input className="w-full md:w-64 bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    placeholder="Search products..." type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white border border-gray-200 rounded-b-xl overflow-hidden shadow-sm">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loading && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider font-medium">Product &amp; Farmer</th>
                        <th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider font-medium hidden md:table-cell">Details</th>
                        <th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider font-medium hidden lg:table-cell">Submitted</th>
                        <th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider font-medium">Status</th>
                        <th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products.length > 0 ? (
                        products.map((p) => {
                          const badge = APPROVAL_BADGES[p.approvalStatus] || APPROVAL_BADGES.pending;
                          return (
                            <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                                    {p.images?.[0] ? (
                                      <Image fill sizes="48px" src={p.images[0]} alt={p.name} className="object-cover"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                    ) : (
                                      <span className="material-symbols-outlined text-gray-400 text-xl">image</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{p.name}</p>
                                    <p className="text-xs text-gray-500">{p.farmer?.name || "---"}{p.farmer?.farmName ? " | " + p.farmer.farmName : ""}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      {p.isOrganic && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Organic</span>}
                                      <span className="font-bold text-emerald-700 text-xs">{formatCurrency(p.price)}<span className="text-gray-400 font-normal">/{p.unit}</span></span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 hidden md:table-cell">
                                <div className="space-y-0.5">
                                  <p className="text-sm text-gray-700"><span className="font-medium">{p.quantity}</span> {p.unit}</p>
                                  <span className="inline-block bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-500">{p.category?.name || "Uncategorized"}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-500" title={formatDateTime(p.createdAt)}>{getTimeAgo(p.createdAt)}</td>
                              <td className="px-6 py-4">
                                <span className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold " + badge.bg + " " + badge.text}>
                                  <span className="material-symbols-outlined text-sm">{badge.icon}</span>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => setDetailProduct(p)}
                                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="View Details">
                                    <span className="material-symbols-outlined text-lg">visibility</span>
                                  </button>
                                  {p.approvalStatus === "pending" && (
                                    <>
                                      <button onClick={() => setConfirmAction({ productId: p._id, action: "approve" })}
                                        disabled={actionUpdating === p._id}
                                        className="p-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50" title="Approve">
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                      </button>
                                      <button onClick={() => setConfirmAction({ productId: p._id, action: "reject" })}
                                        disabled={actionUpdating === p._id}
                                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50" title="Reject">
                                        <span className="material-symbols-outlined text-lg">cancel</span>
                                      </button>
                                    </>
                                  )}
                                  {p.approvalStatus !== "pending" && (
                                    <button onClick={() => setConfirmAction({ productId: p._id, action: p.approvalStatus === "approved" ? "reject" : "approve" })}
                                      disabled={actionUpdating === p._id}
                                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                        p.approvalStatus === "approved" ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-700 hover:bg-green-100"
                                      }`}
                                      title={p.approvalStatus === "approved" ? "Reject" : "Approve"}>
                                      <span className="material-symbols-outlined text-lg">{p.approvalStatus === "approved" ? "block" : "check_circle"}</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-gray-300">
                                  {statusTab === "pending" ? "hourglass_empty" : statusTab === "rejected" ? "cancel" : "inventory_2"}
                                </span>
                              </div>
                              <p className="text-xl font-semibold text-gray-900">No products found</p>
                              <p className="text-gray-500 text-sm max-w-sm">
                                {statusTab === "pending" ? "All caught up! No products are pending review."
                                : statusTab === "rejected" ? "No rejected products match your current filters."
                                : hasActiveFilters ? "Try adjusting your filters or search terms."
                                : "No products have been submitted by farmers yet."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pag && pag.totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Showing {(pag.page - 1) * pag.limit + 1} to {Math.min(pag.page * pag.limit, pag.total)} of {pag.total}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!pag.hasPrev}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    {pageButtons.map((b) => (
                      <button key={b.pageNum} onClick={() => setPage(b.pageNum)}
                        className={"w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors " + (pag.page === b.pageNum ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50")}>
                        {b.pageNum}
                      </button>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(pag.totalPages, p + 1))} disabled={!pag.hasNext}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Detail Side Panel */}
      {detailProduct && (() => {
        const p = detailProduct;
        const badge = APPROVAL_BADGES[p.approvalStatus] || APPROVAL_BADGES.pending;
        return (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDetailProduct(null)} />
            <div className="relative bg-white w-full max-w-lg shadow-2xl border-l border-gray-200 overflow-y-auto animate-slideInRight">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                    {p.images?.[0] ? <Image fill sizes="40px" src={p.images[0]} alt={p.name} className="object-cover" /> : <span className="material-symbols-outlined text-gray-400">image</span>}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
                    <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold " + badge.bg + " " + badge.text}>
                      <span className="material-symbols-outlined text-sm">{badge.icon}</span>{badge.label}
                    </span>
                  </div>
                </div>
                <button onClick={() => setDetailProduct(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {p.images && p.images.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Images</p>
                    <div className="grid grid-cols-2 gap-2">
                      {p.images.map((img, idx) => (
                        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                          <Image fill sizes="(max-width: 768px) 100vw, 300px" src={img} alt={p.name} className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Price", value: formatCurrency(p.price) + "/" + p.unit },
                    { label: "Stock", value: p.quantity + " " + p.unit },
                    { label: "Category", value: p.category?.name || "---" },
                    { label: "Organic", value: p.isOrganic ? "Yes" : "No" },
                  ].map((d) => (
                    <div key={d.label} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{d.label}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{d.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Submitted By</p>
                  <p className="text-sm font-medium text-gray-900">{p.farmer?.name || "---"}</p>
                  {p.farmer?.farmName && <p className="text-xs text-gray-500">{p.farmer.farmName}</p>}
                </div>

                {p.description && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Description</p>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">{p.description}</p>
                  </div>
                )}

                <div className="flex justify-between text-xs text-gray-400">
                  <span>Created: {formatDateTime(p.createdAt)}</span>
                  <span>ID: #{p._id.slice(-6).toUpperCase()}</span>
                </div>

                {p.approvalStatus === "pending" && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button onClick={() => { setDetailProduct(null); setConfirmAction({ productId: p._id, action: "reject" }); }}
                      className="flex-1 px-6 py-3 border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-lg">close</span>Reject
                    </button>
                    <button onClick={() => { setDetailProduct(null); setConfirmAction({ productId: p._id, action: "approve" }); }}
                      className="flex-1 px-6 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm text-sm">
                      <span className="material-symbols-outlined text-lg">check</span>Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modal */}
      {confirmAction && (() => {
        const prod = products.find((p) => p._id === confirmAction.productId);
        if (!prod) return null;
        const isApprove = confirmAction.action === "approve";
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 max-w-md w-full mx-4 animate-slideDown">
              <div className="flex flex-col items-center text-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isApprove ? "bg-green-50" : "bg-red-50"}`}>
                  <span className={`material-symbols-outlined text-4xl ${isApprove ? "text-green-600" : "text-red-600"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {isApprove ? "check_circle" : "cancel"}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{isApprove ? "Approve Product" : "Reject Product"}</h3>
                  <p className="text-gray-500 text-sm mt-2">
                    {isApprove ? 'This will approve "' + prod.name + '" and make it visible on the marketplace. Are you sure?'
                    : 'This will reject "' + prod.name + '" and hide it from the marketplace. Are you sure?'}
                  </p>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl w-full">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                    {prod.images?.[0] ? <Image fill sizes="40px" src={prod.images[0]} alt="" className="object-cover" /> : null}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{prod.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(prod.price)} / {prod.unit}</p>
                  </div>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button onClick={() => setConfirmAction(null)} disabled={actionUpdating === prod._id}
                    className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm">
                    Cancel
                  </button>
                  <button onClick={() => { if (isApprove) handleApprove(prod._id); else handleReject(prod._id); }}
                    disabled={actionUpdating === prod._id}
                    className={`flex-1 px-6 py-3 rounded-xl font-medium text-white transition-all disabled:opacity-50 text-sm ${isApprove ? "bg-emerald-700 hover:opacity-90" : "bg-red-600 hover:bg-red-700"}`}>
                    {actionUpdating === prod._id ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...
                      </span>
                    ) : ("Yes, " + (isApprove ? "Approve" : "Reject"))}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slideInRight { animation: slideInRight 0.3s ease-out; }
      `}</style>
    </div>
  );
}
