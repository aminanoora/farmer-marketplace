"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate, getInitials, getOrderIdDisplay } from "@shared/utils";

/* ─── Types ────────────────────────────────── */

interface OrderUser {
  _id: string; name: string; email?: string; farmName?: string;
}

interface AdminOrder {
  _id: string; consumer: OrderUser; farmer: OrderUser;
  totalAmount: number; status: string; createdAt: string;
}

interface OrdersStats {
  totalOrders: number; pendingFulfillment: number;
  urgentCount: number; revenuePeriod: number;
}

interface PaginationInfo {
  page: number; limit: number; total: number;
  totalPages: number; hasNext: boolean; hasPrev: boolean;
}

interface OrdersResponse {
  orders: AdminOrder[]; stats: OrdersStats; pagination: PaginationInfo;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  delivered:         { label: "Delivered",        bg: "bg-primary-fixed",            text: "text-on-primary-fixed-variant",     dot: "bg-primary-container" },
  "out-for-delivery":{ label: "Out for Delivery", bg: "bg-secondary-container",      text: "text-on-secondary-container",       dot: "bg-secondary" },
  preparing:         { label: "Preparing",        bg: "bg-tertiary-fixed",           text: "text-on-tertiary-fixed-variant",    dot: "bg-tertiary-container" },
  confirmed:         { label: "Confirmed",        bg: "bg-primary-fixed-dim",        text: "text-on-primary-fixed-variant",     dot: "bg-primary" },
  pending:           { label: "Pending",          bg: "bg-surface-container-highest", text: "text-on-surface-variant",           dot: "bg-outline" },
  cancelled:         { label: "Cancelled",        bg: "bg-error-container",          text: "text-on-error-container",           dot: "bg-error" },
};

const STATUSES = ["all", "pending", "confirmed", "preparing", "out-for-delivery", "delivered", "cancelled"] as const;

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || STATUS_STYLES.pending;
}




function getInitialsBg(name: string) {
  const colors = [
    "bg-secondary-container text-on-secondary-container",
    "bg-tertiary-fixed text-on-tertiary-fixed",
    "bg-primary-fixed text-on-primary-fixed-variant",
    "bg-secondary-fixed text-on-secondary-fixed",
    "bg-primary-fixed-dim text-on-primary-fixed-variant",
    "bg-error-container text-on-error-container",
  ];
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search with debounce
  const [searchInput, setSearchInput] = useState("");
  const [sendSearch, setSendSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("-createdAt");
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSendSearch(searchInput);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [sendSearch, statusFilter, dateFilter]);

  const buildDateParams = useCallback(() => {
    const now = new Date();
    switch (dateFilter) {
      case "last30":
        return { dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() };
      case "last90":
        return { dateFrom: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString() };
      case "thisYear":
        return { dateFrom: new Date(now.getFullYear(), 0, 1).toISOString() };
      default:
        return {};
    }
  }, [dateFilter]);

  const fetchOrders = useCallback(() => {
    if (!isAuthenticated || user?.role !== "admin") return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {
      page: String(page),
      limit: String(perPage),
      sort: sortBy,
      status: statusFilter,
    };
    const dateParams = buildDateParams();
    if (dateParams.dateFrom) params.dateFrom = dateParams.dateFrom;
    if (sendSearch.trim()) params.search = sendSearch.trim();
    adminAPI.getOrders(params)
      .then((res) => { if (id === fetchIdRef.current) setData(res.data); })
      .catch((err) => { if (id === fetchIdRef.current) setError(getApiErrorMessage(err, "Failed to load orders.")); })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }, [isAuthenticated, user?.role, page, sortBy, statusFilter, sendSearch, buildDateParams]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) setShowDateMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Render states ───────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading orders...</p>
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
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Failed to load orders</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <button onClick={fetchOrders} className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all">Try Again</button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const pag = data?.pagination;
  const orders = data?.orders || [];
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";

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
            <Link href="/admin/orders" className="flex items-center gap-md px-md py-sm rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_cart</span><span className="font-label-md">Orders</span>
            </Link>
            <Link href="/admin/deliveries" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">local_shipping</span><span className="font-label-md">Deliveries</span>
            </Link>
            <Link href="/admin/farmers" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">group</span><span className="font-label-md">Users</span>
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

        {/* ── Main Content ── */}
        <main className="flex-1">
        <div className="p-lg lg:p-margin-desktop max-w-max-width mx-auto">
          <header className="mb-xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-primary mb-xs">Order Management</h2>
                <p className="font-body-md text-on-surface-variant">Review and fulfill customer orders from across the platform.</p>
              </div>
              <div className="flex gap-sm">
                <button className="bg-primary text-on-primary px-lg py-2 rounded-lg font-label-md flex items-center gap-2 hover:opacity-90 transition-opacity">
                  <span className="material-symbols-outlined text-[20px]">download</span>Export Report
                </button>
              </div>
            </div>
          </header>

          {/* ── Summary Stats ────────────────────── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl">
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex flex-col gap-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-outline uppercase tracking-wider">Total Orders</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined">shopping_basket</span>
                </div>
              </div>
              <p className="font-display-lg text-display-lg text-primary">{stats ? stats.totalOrders.toLocaleString("en-IN") : "---"}</p>
              <p className="font-label-sm text-on-primary-fixed-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                {stats && stats.totalOrders > 0 ? Math.round((stats.pendingFulfillment / stats.totalOrders) * 100) + "% pending fulfillment" : "No orders yet"}
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex flex-col gap-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-outline uppercase tracking-wider">Pending Fulfillment</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined">pending_actions</span>
                </div>
              </div>
              <p className="font-display-lg text-display-lg text-primary">{stats ? stats.pendingFulfillment : "---"}</p>
              <p className="font-label-sm text-on-primary-fixed-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                {stats && stats.urgentCount > 0 ? stats.urgentCount + " order" + (stats.urgentCount > 1 ? "s" : "") + " need urgent attention" : "All orders on track"}
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex flex-col gap-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-outline uppercase tracking-wider">Revenue (Period)</span>
                <div className="bg-tertiary-fixed text-on-tertiary-fixed-variant p-2 rounded-lg">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                </div>
              </div>
              <p className="font-display-lg text-display-lg text-primary">{stats ? formatCurrency(stats.revenuePeriod) : "---"}</p>
              <p className="font-label-sm text-on-primary-fixed-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                {"Delivered orders revenue"}
              </p>
            </div>
          </section>

          {/* ── Table Controls ──────────────────── */}
          <div className="bg-surface-container-low p-md rounded-t-xl border-x border-t border-outline-variant flex flex-col md:flex-row gap-md items-center justify-between">
            <div className="flex flex-wrap items-center gap-sm">
              <div className="relative" ref={dateMenuRef}>
                <button onClick={() => setShowDateMenu((p) => !p)} className="bg-surface-container-lowest border border-outline-variant px-md py-2 rounded-lg font-label-md flex items-center gap-2 hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                  <span>Date: {dateFilter === "last30" ? "Last 30 Days" : dateFilter === "last90" ? "Last 90 Days" : dateFilter === "thisYear" ? "This Year" : "All Time"}</span>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                {showDateMenu && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
                    {[
                      { value: "last30", label: "Last 30 Days" },
                      { value: "last90", label: "Last 90 Days" },
                      { value: "thisYear", label: "This Year" },
                      { value: "all", label: "All Time" },
                    ].map((opt) => (
                      <button key={opt.value} onClick={() => { setDateFilter(opt.value); setShowDateMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 font-body-md hover:bg-surface-container-high transition-colors ${dateFilter === opt.value ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={statusMenuRef}>
                <button onClick={() => setShowStatusMenu((p) => !p)} className="bg-surface-container-lowest border border-outline-variant px-md py-2 rounded-lg font-label-md flex items-center gap-2 hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  <span>Status: {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                {showStatusMenu && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
                    {STATUSES.map((s) => (
                      <button key={s} onClick={() => { setStatusFilter(s); setShowStatusMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 font-body-md hover:bg-surface-container-high transition-colors ${statusFilter === s ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface"}`}>
                        {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-sm">
                <span className="font-label-sm text-on-surface-variant">Sort:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="bg-surface-container-lowest border border-outline-variant px-md py-2 rounded-lg font-label-md focus:ring-primary focus:border-primary cursor-pointer">
                  <option value="-createdAt">Newest First</option>
                  <option value="createdAt">Oldest First</option>
                  <option value="-totalAmount">Highest Amount</option>
                  <option value="totalAmount">Lowest Amount</option>
                </select>
              </div>
            </div>
            <div className="w-full md:w-auto relative md:hidden">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-4 py-2 focus:ring-primary focus:border-primary" placeholder="Search by ID or Name" type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
          </div>

          {/* ── Orders Table ─────────────────────── */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-b-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Order ID</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Date</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Customer</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Farm Name</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Amount</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Status</th>
                    <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {orders.length > 0 ? (
                    orders.map((order) => {
                      const ss = getStatusStyle(order.status);
                      const initials = getInitials(order.consumer?.name || "");
                      const initialsClass = getInitialsBg(order.consumer?.name || "");
                      return (
                        <tr key={order._id} className="hover:bg-surface-container transition-colors group cursor-pointer" onClick={() => router.push("/admin/orders/" + order._id)}>
                          <td className="px-lg py-4 font-label-md text-primary">{getOrderIdDisplay(order._id, "ORD")}</td>
                          <td className="px-lg py-4 text-on-surface-variant">{formatDate(order.createdAt)}</td>
                          <td className="px-lg py-4">
                            <div className="flex items-center gap-3">
                              <div className={"w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs " + initialsClass}>{initials}</div>
                              <span className="font-body-md text-on-surface">{order.consumer?.name || "---"}</span>
                            </div>
                          </td>
                          <td className="px-lg py-4 text-on-surface-variant italic">{order.farmer?.farmName || order.farmer?.name || "---"}</td>
                          <td className="px-lg py-4 font-bold text-primary">{formatCurrency(order.totalAmount)}</td>
                          <td className="px-lg py-4">
                            <span className={"inline-flex items-center px-3 py-1 rounded-full text-xs font-bold gap-1.5 " + ss.bg + " " + ss.text}>
                              <span className={"w-1.5 h-1.5 rounded-full " + ss.dot + (order.status === "pending" || order.status === "out-for-delivery" ? " animate-pulse" : "")}></span>
                              {ss.label}
                            </span>
                          </td>
                          <td className="px-lg py-4">
                            <button onClick={(e) => { e.stopPropagation(); router.push("/admin/orders/" + order._id); }}
                              className="text-primary hover:underline font-label-md flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              View Details
                              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-lg py-16 text-center">
                        <div className="flex flex-col items-center gap-md">
                          <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-[36px] text-outline">shopping_basket</span>
                          </div>
                          <p className="font-headline-md text-headline-md text-primary">No orders found</p>
                          <p className="text-on-surface-variant font-body-md">
                            {sendSearch || statusFilter !== "all" ? "Try adjusting your filters or search terms." : "No orders have been placed yet."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ──────────────────────── */}
            <div className="px-lg py-md flex items-center justify-between border-t border-outline-variant bg-surface-container-low">
              <p className="font-label-sm text-on-surface-variant">
                Showing {pag ? (pag.page - 1) * pag.limit + 1 : 0} to {pag ? Math.min(pag.page * pag.limit, pag.total) : 0} of {pag ? pag.total : 0} orders
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!pag || !pag.hasPrev}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {pag ? (
                  Array.from({ length: Math.min(pag.totalPages, 5) }, (_, i) => {
                    const startPage = Math.max(1, Math.min(pag.page - 2, pag.totalPages - 4));
                    const pageNum = startPage + i;
                    if (pageNum > pag.totalPages) return null;
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg font-label-md transition-colors ${pag.page === pageNum ? "bg-primary text-on-primary" : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high"}`}>
                        {pageNum}
                      </button>
                    );
                  })
                ) : (
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-on-primary font-label-md">1</button>
                )}
                <button onClick={() => setPage((p) => Math.min(pag ? pag.totalPages : 1, p + 1))} disabled={!pag || !pag.hasNext}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Bottom Cards ──────────────────────── */}
          <section className="mt-xl grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div className="bg-primary-container p-xl rounded-2xl text-on-primary relative overflow-hidden flex items-center justify-between shadow-lg">
              <div className="relative z-10 flex flex-col gap-md max-w-[60%]">
                <span className="font-label-sm uppercase tracking-widest text-on-primary-container">Spotlight</span>
                <h3 className="font-headline-md text-on-primary">Improve Delivery Times by 15%</h3>
                <p className="text-on-primary-container font-body-md">Optimized routing for regional hubs is now available for all orders from Central Zone farms.</p>
                <button className="bg-surface-container-lowest text-primary px-lg py-2 rounded-lg font-label-md self-start hover:shadow-md transition-shadow">Read Guidelines</button>
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-30 mix-blend-overlay">
                <div className="w-full h-full bg-gradient-to-l from-primary/40 to-transparent" />
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl flex flex-col gap-md">
              <div className="flex items-center gap-md">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary-fixed-dim p-0.5 flex items-center justify-center bg-primary-container">
                  <span className="text-primary font-headline-md text-2xl">BS</span>
                </div>
                <div>
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-xs font-bold mb-1">Organic Certified</span>
                  <h4 className="font-headline-md text-on-surface">Top Performer: Balbir Singh</h4>
                  <p className="text-on-surface-variant font-body-md">Completed 450+ orders with 4.9{'★'} rating this season.</p>
                </div>
              </div>
              <div className="flex gap-sm mt-xs">
                <button className="flex-1 border border-secondary text-secondary px-md py-2 rounded-lg font-label-md hover:bg-secondary-fixed transition-colors">View Farmer Profile</button>
                <button className="flex-1 bg-primary text-on-primary px-md py-2 rounded-lg font-label-md hover:opacity-90 transition-opacity">Contact Farmer</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
    </div>
  );
}
