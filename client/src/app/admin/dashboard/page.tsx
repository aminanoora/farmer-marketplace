"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI } from "@/lib/api";

interface DashboardStats {
  totalFarmers: number; totalConsumers: number; totalProducts: number;
  totalOrders: number; pendingVerifications: number;
  newFarmersThisMonth: number; totalRevenue: number; activeOrders: number;
}

interface OrderUser { _id: string; name: string; email?: string; farmName?: string; }

interface LatestOrder {
  _id: string; consumer: OrderUser; farmer: OrderUser;
  totalAmount: number; status: string; createdAt: string;
}

interface DashboardData { stats: DashboardStats; latestOrders: LatestOrder[]; }

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  delivered:         { label: "Delivered",        bg: "bg-primary-fixed",   text: "text-on-primary-fixed-variant" },
  "out-for-delivery":{ label: "Out for Delivery", bg: "bg-tertiary-fixed",  text: "text-on-tertiary-fixed-variant" },
  preparing:         { label: "Preparing",        bg: "bg-tertiary-fixed",  text: "text-on-tertiary-fixed-variant" },
  confirmed:         { label: "Confirmed",        bg: "bg-primary-fixed",   text: "text-on-primary-fixed-variant" },
  pending:           { label: "Pending",          bg: "bg-surface-container-highest", text: "text-on-surface-variant" },
  cancelled:         { label: "Cancelled",        bg: "bg-error-container", text: "text-error" },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || STATUS_STYLES.pending;
}

function formatDate(iso: string) {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number) {
  return "\u20B9" + amount.toLocaleString("en-IN");
}

function getOrderIdDisplay(id: string) {
  return "#KM-" + id.slice(-5).toUpperCase();
}

interface ActivityItem {
  icon: string;
  iconBg: string;
  iconColor: string;
  text: React.ReactNode;
  time: string;
}

const RECENT_ACTIVITIES: ActivityItem[] = [
  { icon: "add_task", iconBg: "bg-primary-fixed", iconColor: "text-primary", text: <>New crop listed by <span className="font-bold">Green Roots</span></>, time: "2 mins ago" },
  { icon: "chat_bubble", iconBg: "bg-secondary-fixed", iconColor: "text-secondary", text: <>Wholesale inquiry from <span className="font-bold">Gourmet Foods</span></>, time: "15 mins ago" },
  { icon: "verified", iconBg: "bg-primary-fixed", iconColor: "text-primary", text: <>Farmer <span className="font-bold">Ramesh Patel</span> verified</>, time: "1 hour ago" },
  { icon: "cancel", iconBg: "bg-error-container", iconColor: "text-error", text: <>Order <span className="font-bold">#KM-1018</span> cancelled</>, time: "3 hours ago" },
  { icon: "payments", iconBg: "bg-primary-fixed", iconColor: "text-primary", text: <>Payout of <span className="font-bold">\u20B942,000</span> released</>, time: "5 hours ago" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") return;
    setLoading(true);
    setError(null);
    adminAPI.getDashboardOverview()
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || err?.message || "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, [isAuthenticated, user?.role]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-margin-mobile">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Failed to load dashboard</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <button onClick={() => window.location.reload()} className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all">Try Again</button>
        </div>
      </div>
    );
  }

  const s = data?.stats;
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className="min-h-screen bg-white">
      <header className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop h-16 sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-xl">
          <Link href="/admin/dashboard" className="font-headline-md text-headline-md text-primary font-bold">Krishi Market</Link>
          <div className="hidden md:flex items-center gap-md">
            <nav className="flex gap-lg">
              <Link href="/admin/dashboard" className="text-primary font-bold border-b-2 border-primary py-2 transition-colors">Dashboard</Link>
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
        <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-outline-variant p-md sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <nav className="flex flex-col gap-xs">
            <Link href="/admin/dashboard" className="flex items-center gap-md px-md py-sm rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined">dashboard</span><span className="font-label-md">Overview</span>
            </Link>
            <Link href="/admin/orders" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">shopping_cart</span><span className="font-label-md">Orders</span>
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

        <main className="flex-1 p-lg bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-xl gap-md">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-primary">Admin Overview</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">Monitoring the pulse of Krishi Market ecosystem.</p>
              </div>
              <div className="flex items-center gap-sm bg-surface-container-low px-md py-sm rounded-lg border border-outline-variant cursor-pointer hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-primary">calendar_today</span>
                <span className="font-label-md text-label-md text-on-surface">{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
                <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
              <div className="lg:col-span-8 space-y-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                  <div className="bg-white p-lg rounded-xl border border-outline-variant hover:-translate-y-0.5 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <span className="material-symbols-outlined text-primary bg-primary-container p-xs rounded-lg" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                      <div className="flex items-center text-primary font-label-md text-[12px] bg-primary-fixed p-1 px-2 rounded-full">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        {(s && s.totalOrders > 0) ? ((s.totalOrders - s.pendingVerifications) / s.totalOrders * 100).toFixed(1) + "%" : "---"}
                      </div>
                    </div>
                    <div className="mt-md">
                      <p className="font-label-md text-label-md text-on-surface-variant">Total Revenue</p>
                      <h3 className="font-headline-md text-headline-md text-primary mt-1">{s ? formatCurrency(s.totalRevenue) : "---"}</h3>
                    </div>
                  </div>
                  <div className="bg-white p-lg rounded-xl border border-outline-variant hover:-translate-y-0.5 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <span className="material-symbols-outlined text-primary bg-primary-container p-xs rounded-lg" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                      <div className="flex items-center text-primary font-label-md text-[12px] bg-primary-fixed p-1 px-2 rounded-full">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        {s ? ((s.activeOrders / Math.max(s.totalOrders, 1)) * 100).toFixed(1) + "%" : "---"}
                      </div>
                    </div>
                    <div className="mt-md">
                      <p className="font-label-md text-label-md text-on-surface-variant">Active Orders</p>
                      <h3 className="font-headline-md text-headline-md text-primary mt-1">{s ? s.activeOrders : "---"}</h3>
                    </div>
                  </div>
                  <div className="bg-white p-lg rounded-xl border border-outline-variant hover:-translate-y-0.5 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <span className="material-symbols-outlined text-primary bg-primary-container p-xs rounded-lg" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
                      <div className="flex items-center text-primary font-label-md text-[12px] bg-primary-fixed p-1 px-2 rounded-full">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        {s ? ((s.newFarmersThisMonth / Math.max(s.totalFarmers, 1)) * 100).toFixed(1) + "%" : "---"}
                      </div>
                    </div>
                    <div className="mt-md">
                      <p className="font-label-md text-label-md text-on-surface-variant">New Farmers</p>
                      <h3 className="font-headline-md text-headline-md text-primary mt-1">{s ? s.newFarmersThisMonth : "---"}</h3>
                    </div>
                  </div>
                </div>

                <section className="bg-white rounded-xl border border-outline-variant overflow-hidden">
                  <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center">
                    <h3 className="font-headline-md text-headline-md text-primary">Latest Orders</h3>
                    <Link href="/admin/orders" className="text-primary font-label-md text-label-md hover:underline">View All</Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md">
                        <tr>
                          <th className="px-lg py-md">Order ID</th>
                          <th className="px-lg py-md">Date</th>
                          <th className="px-lg py-md">Customer</th>
                          <th className="px-lg py-md">Farm Name</th>
                          <th className="px-lg py-md">Amount</th>
                          <th className="px-lg py-md">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant font-body-md text-body-md">
                        {(data?.latestOrders || []).length > 0 ? data!.latestOrders.map((order) => {
                          const ss = getStatusStyle(order.status);
                          return (
                            <tr key={order._id} className="hover:bg-surface-container-lowest transition-colors cursor-pointer" onClick={() => router.push("/orders/" + order._id)}>
                              <td className="px-lg py-md font-bold text-primary">{getOrderIdDisplay(order._id)}</td>
                              <td className="px-lg py-md">{formatDate(order.createdAt)}</td>
                              <td className="px-lg py-md">{order.consumer?.name || "---"}</td>
                              <td className="px-lg py-md">{order.farmer?.farmName || order.farmer?.name || "---"}</td>
                              <td className="px-lg py-md font-bold">{formatCurrency(order.totalAmount)}</td>
                              <td className="px-lg py-md">
                                <span className={"px-sm py-1 rounded-full text-[12px] font-bold " + ss.bg + " " + ss.text}>{ss.label}</span>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr><td colSpan={6} className="px-lg py-md text-center text-on-surface-variant font-body-md">No orders yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="lg:col-span-4 space-y-lg">
                <section className="bg-white rounded-xl border border-outline-variant p-lg">
                  <h3 className="font-headline-md text-headline-md text-primary mb-md">Platform Health</h3>
                  <div className="space-y-lg">
                    <div>
                      <div className="flex justify-between items-center mb-xs">
                        <span className="font-label-md text-label-md text-on-surface-variant">Active Users</span>
                        <span className="font-label-md text-label-md text-primary">{s ? (s.totalConsumers + s.totalFarmers).toLocaleString("en-IN") : "---"}</span>
                      </div>
                      <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: Math.min(100, ((s?.totalConsumers ?? 0) + (s?.totalFarmers ?? 0)) / 20) + "%" }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-md">
                      <div className="w-10 h-10 bg-primary-fixed rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      </div>
                      <div>
                        <p className="font-label-md text-label-md text-primary">System Status</p>
                        <p className="font-body-md text-body-md text-on-surface-variant">Operational - All systems normal</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-md">
                      <div className="p-md bg-surface-container-low rounded-lg text-center border border-outline-variant/30">
                        <p className="font-headline-md text-headline-md text-primary">{s?.totalFarmers || 0}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Farmers</p>
                      </div>
                      <div className="p-md bg-surface-container-low rounded-lg text-center border border-outline-variant/30">
                        <p className="font-headline-md text-headline-md text-primary">{s?.totalProducts || 0}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Products</p>
                      </div>
                    </div>
                    <div className="p-md bg-surface-container-low rounded-lg flex gap-md items-start border border-outline-variant/30">
                      <span className="material-symbols-outlined text-tertiary-container mt-1">warning</span>
                      <div>
                        <p className="font-label-md text-label-md text-tertiary">Upcoming Maintenance</p>
                        <p className="font-body-md text-[13px] text-on-surface-variant leading-snug">Oct 28, 02:00 AM - 04:00 AM IST. Database optimization scheduled.</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-white rounded-xl border border-outline-variant">
                  <div className="px-lg py-md border-b border-outline-variant"><h3 className="font-headline-md text-headline-md text-primary">Recent Activity</h3></div>
                  <div className="p-lg space-y-lg relative">
                    <div className="absolute left-[36px] top-lg bottom-lg w-[1px] bg-outline-variant" />
                    {RECENT_ACTIVITIES.map((activity, idx) => (
                      <div key={idx} className="flex gap-md relative">
                        <div className={"w-8 h-8 rounded-full " + activity.iconBg + " border-4 border-white flex items-center justify-center z-10"}>
                          <span className={"material-symbols-outlined " + activity.iconColor + " text-[16px]"}>{activity.icon}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-label-md text-label-md text-on-surface">{activity.text}</p>
                          <p className="font-label-sm text-label-sm text-on-surface-variant opacity-70">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-md text-center border-t border-outline-variant">
                    <button className="text-primary font-label-md text-label-md hover:underline">See full log</button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
