"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI } from "@/lib/api";

/* ─── Types ────────────────────────────────── */

interface InventoryFarmer { _id: string; name: string; farmName?: string; }
interface InventoryCategory { _id: string; name: string; }

interface InventoryProduct {
  _id: string; name: string; description?: string;
  price: number; unit: string; quantity: number;
  isAvailable: boolean; isOrganic: boolean; images: string[];
  farmer: InventoryFarmer; category: InventoryCategory;
  createdAt: string;
}

interface InventoryStats { totalProducts: number; approvedCount: number; pendingCount: number; rejectedCount?: number; }
interface PaginationInfo { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean; }

interface InventoryResponse { products: InventoryProduct[]; stats: InventoryStats; categories: InventoryCategory[]; pagination: PaginationInfo; }

const STATUS_OPTIONS = ["all", "approved", "pending"] as const;
const SORT_OPTIONS = [
  { value: "-createdAt", label: "Newest First" },
  { value: "createdAt", label: "Oldest First" },
  { value: "-price", label: "Highest Price" },
  { value: "price", label: "Lowest Price" },
  { value: "name", label: "Name A-Z" },
  { value: "-name", label: "Name Z-A" },
] as const;

function formatDate(iso: string) {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number) {
  return "\u20B9" + amount.toLocaleString("en-IN");
}

export default function AdminInventoryPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const catMenuRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);

  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [sendSearch, setSendSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCatMenu, setShowCatMenu] = useState(false);
  const [sortBy, setSortBy] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [confirmProductId, setConfirmProductId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  /* Debounce search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSendSearch(searchInput); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  /* Reset page on filter change */
  useEffect(() => { setPage(1); }, [sendSearch, statusFilter, catFilter]);

  const fetchProducts = useCallback(() => {
    if (!isAuthenticated || user?.role !== "admin") return;
    const id = ++fetchIdRef.current;
    setLoading(true); setError(null);
    const params: Record<string, string> = { page: String(page), limit: String(perPage), sort: sortBy, status: statusFilter };
    if (catFilter !== "all") params.category = catFilter;
    if (sendSearch.trim()) params.search = sendSearch.trim();
    adminAPI.getProducts(params)
      .then((res) => { if (id === fetchIdRef.current) setData(res.data); })
      .catch((err) => { if (id === fetchIdRef.current) setError(err?.response?.data?.message || err?.message || "Failed to load products."); })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }, [isAuthenticated, user?.role, page, sortBy, statusFilter, catFilter, sendSearch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  /* Click-outside handlers */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) setShowCatMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function showSuccess(msg: string) { setStatusMessage(msg); setTimeout(() => setStatusMessage(null), 3000); }
  function showError(msg: string) { setStatusError(msg); setTimeout(() => setStatusError(null), 4000); }

  const handleToggleProduct = async (productId: string, currentlyAvailable: boolean) => {
    setStatusUpdating(productId);
    try {
      const res = await adminAPI.toggleProductStatus(productId, !currentlyAvailable);
      if (data) {
        const updatedProducts = data.products.map((p) => p._id === productId ? { ...p, isAvailable: !currentlyAvailable } : p);
        setData({ ...data, products: updatedProducts });
      }
      showSuccess(res.data.message);
      setConfirmProductId(null);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to update product.");
    } finally { setStatusUpdating(null); }
  };

  // ── Render states ──
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading inventory...</p>
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
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Failed to load products</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <button onClick={fetchProducts} className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all">Try Again</button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const pag = data?.pagination;
  const products = data?.products || [];
  const categories = data?.categories || [];
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";

  /* Compute page number buttons */
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
        <main className="flex-1">
        <div className="p-lg lg:p-margin-desktop max-w-max-width mx-auto">
          <header className="mb-xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-primary mb-xs">Inventory Management</h2>
                <p className="font-body-md text-on-surface-variant">Manage all products listed across Krishi Market farms.</p>
              </div>
            </div>
          </header>

          {/* ── Summary Stats ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl">
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex flex-col gap-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-outline uppercase tracking-wider">Total Products</span>
                <div className="bg-primary-fixed text-primary p-2 rounded-lg"><span className="material-symbols-outlined">inventory_2</span></div>
              </div>
              <p className="font-display-lg text-display-lg text-primary">{stats ? stats.totalProducts.toLocaleString("en-IN") : "---"}</p>
              <p className="font-label-sm text-on-primary-fixed-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">inventory</span>
                {stats ? stats.approvedCount + " approved, " + stats.pendingCount + " pending" + (stats.rejectedCount ? ", " + stats.rejectedCount + " rejected" : "") : ""}
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex flex-col gap-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-outline uppercase tracking-wider">Approved</span>
                <div className="bg-primary-fixed text-primary p-2 rounded-lg"><span className="material-symbols-outlined">check_circle</span></div>
              </div>
              <p className="font-display-lg text-display-lg text-primary">{stats ? stats.approvedCount.toLocaleString("en-IN") : "---"}</p>
              <p className="font-label-sm text-on-primary-fixed-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">visibility</span>Visible on marketplace
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex flex-col gap-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-outline uppercase tracking-wider">Pending Approval</span>
                <div className="bg-tertiary-fixed text-on-tertiary-fixed-variant p-2 rounded-lg"><span className="material-symbols-outlined">hourglass_empty</span></div>
              </div>
              <p className="font-display-lg text-display-lg text-primary">{stats ? stats.pendingCount.toLocaleString("en-IN") : "---"}</p>
              <p className="font-label-sm text-on-tertiary-fixed-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">rate_review</span>Awaiting review
              </p>
            </div>
          </section>

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

          {/* ── Table Controls ── */}
          <div className="bg-surface-container-low p-md rounded-t-xl border-x border-t border-outline-variant flex flex-col md:flex-row gap-md items-center justify-between">
            <div className="flex flex-wrap items-center gap-sm">
              {/* Status filter */}
              <div className="relative" ref={statusMenuRef}>
                <button onClick={() => setShowStatusMenu((p) => !p)} className="bg-surface-container-lowest border border-outline-variant px-md py-2 rounded-lg font-label-md flex items-center gap-2 hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  <span>Status: {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                {showStatusMenu && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
                    {STATUS_OPTIONS.map((s) => (
                      <button key={s} onClick={() => { setStatusFilter(s); setShowStatusMenu(false); }}
                        className={"w-full text-left px-4 py-2.5 font-body-md hover:bg-surface-container-high transition-colors " + (statusFilter === s ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface")}>
                        {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Category filter */}
              <div className="relative" ref={catMenuRef}>
                <button onClick={() => setShowCatMenu((p) => !p)} className="bg-surface-container-lowest border border-outline-variant px-md py-2 rounded-lg font-label-md flex items-center gap-2 hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-[18px]">category</span>
                  <span>Category: {catFilter === "all" ? "All" : categories.find((c) => c._id === catFilter)?.name || "All"}</span>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                {showCatMenu && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto ">
                    <button onClick={() => { setCatFilter("all"); setShowCatMenu(false); }}
                      className={"w-full text-left px-4 py-2.5 font-body-md hover:bg-surface-container-high transition-colors " + (catFilter === "all" ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface")}>
                      All Categories
                    </button>
                    {categories.map((c) => (
                      <button key={c._id} onClick={() => { setCatFilter(c._id); setShowCatMenu(false); }}
                        className={"w-full text-left px-4 py-2.5 font-body-md hover:bg-surface-container-high transition-colors " + (catFilter === c._id ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface")}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Sort */}
              <div className="flex items-center gap-sm">
                <span className="font-label-sm text-on-surface-variant">Sort:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="bg-surface-container-lowest border border-outline-variant px-md py-2 rounded-lg font-label-md focus:ring-primary focus:border-primary cursor-pointer">
                  {SORT_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
            </div>
            <div className="w-full md:w-auto relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input className="w-full md:w-64 bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-4 py-2 focus:ring-primary focus:border-primary" placeholder="Search products by name..." type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
          </div>

          {/* ── Products Table ── */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-b-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Product</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Farmer</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Category</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Price</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Qty</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Status</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {products.length > 0 ? (
                    products.map((p) => (
                      <tr key={p._id} className="hover:bg-surface-container transition-colors group">
                        <td className="px-lg py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface-container flex items-center justify-center flex-shrink-0">
                              {p.images?.[0] ? <Image fill sizes="40px" src={p.images[0]} alt={p.name} className="object-cover" /> : <span className="material-symbols-outlined text-on-surface-variant text-[18px]">agriculture</span>}
                            </div>
                            <div>
                              <Link href={`/admin/inventory/${p._id}`} className="font-label-md text-on-surface hover:text-primary transition-colors">{p.name}</Link>
                              {p.isOrganic && <span className="text-[10px] bg-primary-fixed text-primary px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Organic</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-lg py-4">
                          <p className="font-body-md text-on-surface">{p.farmer?.name || "---"}</p>
                          {p.farmer?.farmName && <p className="text-label-sm text-on-surface-variant italic">{p.farmer.farmName}</p>}
                        </td>
                        <td className="px-lg py-4"><span className="font-body-md text-on-surface-variant">{p.category?.name || "---"}</span></td>
                        <td className="px-lg py-4 font-bold text-primary">{formatCurrency(p.price)}<span className="text-label-sm text-on-surface-variant font-normal">/{p.unit}</span></td>
                        <td className="px-lg py-4">{p.quantity}<span className="text-label-sm text-on-surface-variant"> {p.unit}</span></td>
                        <td className="px-lg py-4">
                          {p.isAvailable ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-fixed text-primary text-label-sm rounded-full font-bold"><span className="material-symbols-outlined text-[14px]">check_circle</span>Approved</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed-variant text-label-sm rounded-full font-bold"><span className="material-symbols-outlined text-[14px]">hourglass_empty</span>Pending</span>
                          )}
                        </td>
                        <td className="px-lg py-4 text-right">
                          <button onClick={() => setConfirmProductId(p._id)} disabled={statusUpdating === p._id}
                            className={"inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-label-sm text-xs transition-colors " + (p.isAvailable ? "bg-error-container text-on-error-container hover:bg-error/20" : "bg-primary-fixed text-primary hover:opacity-80") + (statusUpdating === p._id ? " opacity-50" : "")}>
                            {statusUpdating === p._id ? "..." : <><span className="material-symbols-outlined text-[14px]">{p.isAvailable ? "visibility_off" : "visibility"}</span>{p.isAvailable ? "Hide" : "Approve"}</>}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-lg py-16 text-center">
                        <div className="flex flex-col items-center gap-md">
                          <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-[36px] text-outline">inventory_2</span>
                          </div>
                          <p className="font-headline-md text-headline-md text-primary">No products found</p>
                          <p className="text-on-surface-variant font-body-md">{sendSearch || statusFilter !== "all" || catFilter !== "all" ? "Try adjusting your filters or search terms." : "No products have been listed yet."}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="px-lg py-md flex items-center justify-between border-t border-outline-variant bg-surface-container-low">
              <p className="font-label-sm text-on-surface-variant">
                Showing {pag ? (pag.page - 1) * pag.limit + 1 : 0} to {pag ? Math.min(pag.page * pag.limit, pag.total) : 0} of {pag ? pag.total : 0} products
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!pag || !pag.hasPrev}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {pageButtons.length > 0 ? pageButtons.map((b) => (
                  <button key={b.pageNum} onClick={() => setPage(b.pageNum)}
                    className={"w-8 h-8 flex items-center justify-center rounded-lg font-label-md transition-colors " + (pag && pag.page === b.pageNum ? "bg-primary text-on-primary" : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high")}>
                    {b.pageNum}
                  </button>
                )) : (
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-on-primary font-label-md">1</button>
                )}
                <button onClick={() => setPage((p) => Math.min(pag ? pag.totalPages : 1, p + 1))} disabled={!pag || !pag.hasNext}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

      {/* ── Confirmation Modal — Product Approve/Hide ── */}
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
                  <h3 className="font-headline-md text-headline-md text-primary">{prod.isAvailable ? "Hide Product" : "Approve Product"}</h3>
                  <p className="text-on-surface-variant font-body-md mt-2">
                    {prod.isAvailable
                      ? 'This will hide "' + prod.name + '" from the marketplace. Customers will no longer be able to purchase it. Are you sure?'
                      : 'This will approve "' + prod.name + '" and make it visible on the marketplace for customers to purchase. Are you sure?'}
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button onClick={() => setConfirmProductId(null)} disabled={statusUpdating === prod._id}
                    className="flex-1 px-6 py-3 border-2 border-outline-variant text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => handleToggleProduct(prod._id, prod.isAvailable)} disabled={statusUpdating === prod._id}
                    className={"flex-1 px-6 py-3 rounded-xl font-label-md text-white transition-all disabled:opacity-50 " + (prod.isAvailable ? "bg-error hover:bg-error/90" : "bg-primary hover:opacity-90")}>
                    {statusUpdating === prod._id ? "Processing..." : "Yes, " + (prod.isAvailable ? "Hide" : "Approve")}
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
