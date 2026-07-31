"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI } from "@/lib/api";

/* ─── Types ────────────────────────────────── */

interface AdminUser {
  _id: string; name: string; email: string; phone?: string;
  role: "farmer" | "consumer" | "admin";
  farmName?: string; isActive: boolean;
  verificationStatus?: string;
  createdAt: string;
}

interface UsersStats {
  totalUsers: number; activeFarmers: number; new24h: number;
}

interface PaginationInfo {
  page: number; limit: number; total: number;
  totalPages: number; hasNext: boolean; hasPrev: boolean;
}

interface UsersResponse {
  users: AdminUser[]; stats: UsersStats; pagination: PaginationInfo;
}

const ROLE_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  farmer:   { label: "Farmer",   bg: "bg-primary-fixed",      text: "text-primary",           icon: "eco" },
  consumer: { label: "Consumer", bg: "bg-secondary-fixed",    text: "text-secondary",         icon: "shopping_basket" },
  admin:    { label: "Admin",    bg: "bg-inverse-surface",    text: "text-inverse-on-surface", icon: "verified_user" },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: "Active",    bg: "bg-primary-fixed",    text: "text-primary" },
  approved:  { label: "Approved",  bg: "bg-primary-fixed",    text: "text-primary" },
  pending:   { label: "Pending",   bg: "bg-tertiary-fixed",   text: "text-on-tertiary-fixed-variant" },
  rejected:  { label: "Rejected",  bg: "bg-error-container",  text: "text-on-error-container" },
  suspended: { label: "Suspended", bg: "bg-error-container",  text: "text-on-error-container" },
};

const ROLE_FILTERS = ["all", "farmer", "consumer", "admin"] as const;

const STATUS_FILTERS = ["all", "pending", "approved", "rejected", "suspended"] as const;

function formatDate(iso: string) {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(name: string) {
  if (!name) return "??";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getInitialsBg(name: string) {
  const colors = [
    "bg-secondary-fixed text-secondary",
    "bg-tertiary-fixed text-on-tertiary-fixed",
    "bg-primary-fixed text-primary",
    "bg-secondary-fixed text-secondary",
    "bg-primary-fixed-dim text-on-primary-fixed-variant",
    "bg-error-container text-on-error-container",
  ];
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();

  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [sendSearch, setSendSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSendSearch(searchInput), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Auth guard
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [sendSearch, roleFilter, statusFilter]);

  // Click-outside for dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch users
  const fetchUsers = useCallback(() => {
    if (!isAuthenticated || user?.role !== "admin") return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {
      page: String(page), limit: String(perPage), sort: sortBy,
      role: roleFilter,
    };
    if (statusFilter !== "all") params.status = statusFilter;
    if (sendSearch.trim()) params.search = sendSearch.trim();
    adminAPI.getFarmers(params)
      .then((res) => { if (id === fetchIdRef.current) setData(res.data); })
      .catch((err) => { if (id === fetchIdRef.current) setError(err?.response?.data?.message || err?.message || "Failed to load users."); })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }, [isAuthenticated, user?.role, page, sortBy, roleFilter, statusFilter, sendSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Render states ───────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading users...</p>
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
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Failed to load users</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <button onClick={fetchUsers} className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all">Try Again</button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const pag = data?.pagination;
  const usersList = data?.users || [];
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";

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
          {/* Page Header */}
          <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-lg">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary mb-xs">User Management</h2>
              <p className="text-body-lg text-on-surface-variant">Maintain Krishi Market&apos;s ecosystem of growers and consumers.</p>
            </div>
            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-md w-full md:w-auto">
              <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl flex flex-col justify-between min-w-[140px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Total Users</span>
                <span className="font-headline-md text-headline-md text-primary mt-sm">{stats ? stats.totalUsers.toLocaleString("en-IN") : "---"}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl flex flex-col justify-between min-w-[140px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Active Farmers</span>
                <span className="font-headline-md text-headline-md text-primary mt-sm">{stats ? stats.activeFarmers.toLocaleString("en-IN") : "---"}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl flex flex-col justify-between min-w-[140px] col-span-2 md:col-span-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">New (24h)</span>
                <div className="flex items-baseline gap-xs mt-sm">
                  <span className="font-headline-md text-headline-md text-primary">{stats ? stats.new24h : "---"}</span>
                  {stats && stats.new24h > 0 && (
                    <span className="text-label-sm text-primary-container font-bold">+{stats.new24h}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mb-lg space-y-md">
            <div className="flex flex-col xl:flex-row gap-md items-center">
              <div className="relative w-full xl:w-2/5">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant">person_search</span>
                <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-14 border-2 border-outline-variant rounded-xl pl-xl pr-md focus:border-primary focus:ring-0 text-body-md bg-white transition-all"
                  placeholder="Find users by name, email, or phone..." type="text" />
              </div>
              <div className="flex flex-wrap items-center gap-sm w-full xl:w-3/5">
                <div className="flex bg-surface-container-low p-[4px] rounded-xl border border-outline-variant">
                  {ROLE_FILTERS.map((r) => (
                    <button key={r} onClick={() => setRoleFilter(r)}
                      className={`px-lg py-sm rounded-lg font-label-md transition-colors ${roleFilter === r ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-primary"}`}>
                      {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex bg-surface-container-low p-[4px] rounded-xl border border-outline-variant">
                  {STATUS_FILTERS.map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-lg py-sm rounded-lg font-label-md transition-colors ${statusFilter === s ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-primary"}`}>
                      {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="h-8 w-px bg-outline-variant hidden sm:block mx-sm" />
                <div className="flex items-center gap-xs ml-auto">
                  <span className="text-label-md text-on-surface-variant mr-xs">Sort:</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="border-2 border-outline-variant rounded-xl h-14 px-md focus:border-primary focus:ring-0 font-label-md text-primary bg-white cursor-pointer">
                    <option value="-createdAt">Newest First</option>
                    <option value="createdAt">Oldest First</option>
                    <option value="name">Alphabetical</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider">User &amp; Role</th>
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider">Contact Details</th>
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider">Joined Date</th>
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {usersList.length > 0 ? (
                    usersList.map((u) => {
                      const roleBadge = ROLE_BADGES[u.role] || ROLE_BADGES.consumer;
                      const userStatus = !u.isActive
                        ? "suspended"
                        : u.role === "farmer" && u.verificationStatus === "pending" ? "pending"
                        : u.role === "farmer" && u.verificationStatus === "rejected" ? "rejected"
                        : u.role === "farmer" ? "approved"
                        : "active";
                      const statusBadge = STATUS_BADGES[userStatus] || STATUS_BADGES.active;
                      const initialsClass = getInitialsBg(u.name);
                      return (
                        <tr key={u._id} className="hover:bg-surface-container-lowest transition-colors">
                          <td className="px-lg py-lg">
                            <div className="flex items-center gap-md">
                              <div className={"h-12 w-12 rounded-full overflow-hidden flex-shrink-0 border border-outline-variant flex items-center justify-center " + initialsClass}>
                                {u.role === "admin" ? (
                                  <span className="material-symbols-outlined text-[24px]">shield_person</span>
                                ) : (
                                  <span className="font-bold text-sm">{getInitials(u.name)}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-label-md text-primary">{u.name}</p>
                                <span className={"inline-flex items-center gap-xs mt-1 px-sm py-[2px] rounded-full text-label-sm " + roleBadge.bg + " " + roleBadge.text}>
                                  <span className="material-symbols-outlined text-[14px]">{roleBadge.icon}</span>
                                  {roleBadge.label}
                                </span>
                                {u.farmName && (
                                  <span className="block text-label-sm text-on-surface-variant mt-0.5">{u.farmName}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-lg py-lg">
                            <p className="text-body-md text-on-surface">{u.email}</p>
                            <p className="text-label-sm text-on-surface-variant">{u.phone || "No phone"}</p>
                          </td>
                          <td className="px-lg py-lg">
                            <p className="text-body-md text-on-surface">{formatDate(u.createdAt)}</p>
                          </td>
                          <td className="px-lg py-lg">
                            <span className={"px-lg py-sm rounded-full text-label-sm font-bold " + statusBadge.bg + " " + statusBadge.text}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="px-lg py-lg text-right">
                            <div className="flex justify-end gap-sm">
                              <button onClick={(e) => { e.stopPropagation(); router.push("/admin/farmers/" + u._id); }} className="p-sm rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant" title="View Details">
                                <span className="material-symbols-outlined">visibility</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); router.push("/admin/farmers/" + u._id); }} className="p-sm rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant" title="Edit Role">
                                <span className="material-symbols-outlined">edit_note</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-lg py-16 text-center">
                        <div className="flex flex-col items-center gap-md">
                          <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-[36px] text-outline">group_off</span>
                          </div>
                          <p className="font-headline-md text-headline-md text-primary">No users found</p>
                          <p className="text-on-surface-variant font-body-md">
                            {sendSearch || roleFilter !== "all" ? "Try adjusting your filters or search terms." : "No users have been registered yet."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-lg py-md bg-surface-container-low border-t border-outline-variant flex items-center justify-between">
              <p className="text-label-md text-on-surface-variant">
                Showing {pag ? (pag.page - 1) * pag.limit + 1 : 0} to {pag ? Math.min(pag.page * pag.limit, pag.total) : 0} of {pag ? pag.total : 0} users
              </p>
              <div className="flex items-center gap-xs">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!pag || !pag.hasPrev}
                  className="p-sm rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {pag ? (
                  Array.from({ length: Math.min(pag.totalPages, 5) }, (_, i) => {
                    const startPage = Math.max(1, Math.min(pag.page - 2, pag.totalPages - 4));
                    const pageNum = startPage + i;
                    if (pageNum > pag.totalPages) return null;
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)}
                        className={`h-8 w-8 flex items-center justify-center rounded-lg font-label-md transition-colors ${pag.page === pageNum ? "bg-primary text-on-primary" : "hover:bg-surface-container-high text-on-surface-variant"}`}>
                        {pageNum}
                      </button>
                    );
                  })
                ) : (
                  <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-on-primary font-label-md">1</button>
                )}
                <button onClick={() => setPage((p) => Math.min(pag ? pag.totalPages : 1, p + 1))} disabled={!pag || !pag.hasNext}
                  className="p-sm rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}