"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { farmerAPI } from "@/lib/api";
import { formatCurrency, formatDate, getOrderIdDisplay } from "@shared/utils";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
interface DashboardOrder {
  _id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  consumer?: { name: string };
}

interface DashboardProduct {
  _id: string;
  isAvailable: boolean;
  quantity: number;
  approvalStatus: string;
}

interface DashboardData {
  products: { total: number; active: number; lowStock: number; outOfStock: number; pending: number };
  orders: { total: number; pending: number; recent: DashboardOrder[] };
  earnings: { total: number; totalOrders: number };
  farmerName: string;
  farmName: string;
  verificationStatus?: string;
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────


const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  delivered:            { label: "Delivered",        bg: "bg-primary-fixed",      text: "text-on-primary-fixed-variant" },
  "out-for-delivery":   { label: "Out for Delivery",  bg: "bg-tertiary-fixed",     text: "text-on-tertiary-fixed-variant" },
  preparing:            { label: "Preparing",        bg: "bg-tertiary-fixed",     text: "text-on-tertiary-fixed-variant" },
  confirmed:            { label: "Confirmed",        bg: "bg-primary-fixed",      text: "text-on-primary-fixed-variant" },
  pending:              { label: "Pending",          bg: "bg-surface-container-highest", text: "text-on-surface-variant" },
  cancelled:            { label: "Cancelled",        bg: "bg-error-container",    text: "text-error" },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || STATUS_STYLES.pending;
}

// ─────────────────────────────────────────────────
// Stat Card Component
// ─────────────────────────────────────────────────
function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  barWidth,
  barColor,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  sub?: string;
  barWidth?: string;
  barColor?: string;
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-outline-variant hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconColor} text-2xl`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        {sub && (
          <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-full whitespace-nowrap">
            {sub}
          </span>
        )}
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">{label}</p>
      <p className="font-headline-md text-headline-md text-primary">{value}</p>
      {barWidth && (
        <div className="h-1.5 w-full bg-outline-variant rounded-full mt-3 overflow-hidden">
          <div className={`h-full rounded-full ${barColor || "bg-primary"}`} style={{ width: barWidth }} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────────
export default function FarmerDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData>({
    products: { total: 0, active: 0, lowStock: 0, outOfStock: 0, pending: 0 },
    orders: { total: 0, pending: 0, recent: [] },
    earnings: { total: 0, totalOrders: 0 },
    farmerName: "",
    farmName: "",
    verificationStatus: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== "farmer")) {
      router.push(user?.role === "consumer" ? "/" : "/auth/login?redirect=/farmer/dashboard");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "farmer") return;

    setLoading(true);
    setError(null);

    Promise.all([
      farmerAPI.getProfile().catch(() => ({ data: { farmer: {} } })),
      farmerAPI.getProducts().catch(() => ({ data: { products: [] } })),
      farmerAPI.getOrders().catch(() => ({ data: { orders: [] } })),
      farmerAPI.getEarnings().catch(() => ({ data: { earnings: 0, totalOrders: 0 } })),
    ])
      .then(([profileRes, productsRes, ordersRes, earningsRes]) => {
        const profile = profileRes.data.farmer || {};
        const products = productsRes.data.products || [];
        const orders = ordersRes.data.orders || [];
        const earnings = earningsRes.data;

        const activeProducts = products.filter((p: DashboardProduct) => p.isAvailable);
        const lowStockProducts = products.filter(
          (p: DashboardProduct) => p.isAvailable && p.quantity < 20 && p.quantity > 0
        );
        const outOfStockProducts = products.filter((p: DashboardProduct) => !p.isAvailable);
        const pendingProducts = products.filter((p: DashboardProduct) => p.approvalStatus === "pending");
        const pendingOrders = orders.filter(
          (o: DashboardOrder) => o.status === "pending" || o.status === "confirmed"
        );
        const recentOrders = orders.slice(0, 5);

        setData({
          products: {
            total: products.length,
            active: activeProducts.length,
            lowStock: lowStockProducts.length,
            outOfStock: outOfStockProducts.length,
            pending: pendingProducts.length,
          },
          orders: {
            total: orders.length,
            pending: pendingOrders.length,
            recent: recentOrders,
          },
          earnings: {
            total: earnings.earnings || 0,
            totalOrders: earnings.totalOrders || 0,
          },
          farmerName: profile.name || user?.name || "Farmer",
          farmName: profile.farmName || user?.farmName || "",
          verificationStatus: profile.verificationStatus || user?.verificationStatus,
        });
      })
      .catch((err) => {
        setError(err?.message || "Failed to load dashboard data.");
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, user]);

  // ─── Loading State ───
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── Redirect if not farmer ───
  if (!user || user.role !== "farmer") return null;

  // ─── Error state ───
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-2">Failed to load dashboard</h2>
          <p className="text-on-surface-variant font-body-md mb-8">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const s = data;
  const activeProductPercent = s.products.total > 0
    ? Math.round((s.products.active / s.products.total) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      {/* ─── Welcome Header ─── */}
      <div className="mb-8">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-1">
          Welcome back, {s.farmerName.split(" ")[0]} 👋
        </h1>
        <p className="text-on-surface-variant max-w-xl">
          {s.farmName ? `${s.farmName} — ` : ""}Here&apos;s an overview of your farm&apos;s performance today.
        </p>
      </div>

      {/* ─── Farmer Verification Alert ─── */}
      {s.verificationStatus && s.verificationStatus !== "verified" && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 shadow-sm ${
          s.verificationStatus === "rejected"
            ? "bg-error-container/40 border-error/30"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            s.verificationStatus === "rejected" ? "bg-error/10" : "bg-amber-100"
          }`}>
            <span className={`material-symbols-outlined text-xl ${
              s.verificationStatus === "rejected" ? "text-error" : "text-amber-600"
            }`} style={{ fontVariationSettings: "'FILL' 1" }}>
              {s.verificationStatus === "rejected" ? "gpp_bad" : "hourglass_empty"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-label-md ${s.verificationStatus === "rejected" ? "text-error" : "text-amber-800"}`}>
              {s.verificationStatus === "rejected"
                ? "Your farmer account was rejected"
                : "Your farmer account is pending approval"}
            </p>
            <p className={`text-label-sm ${s.verificationStatus === "rejected" ? "text-error/80" : "text-amber-600"}`}>
              {s.verificationStatus === "rejected"
                ? "Your account was not approved by the admin. You cannot add products. Please contact support for assistance."
                : "An admin needs to approve your account before you can list products. Your existing listings remain visible only after product approval."}
            </p>
          </div>
          <Link
            href="/farmer/profile"
            className="flex-shrink-0 px-4 py-2 bg-surface-container-lowest text-on-surface-variant rounded-lg font-label-md hover:bg-surface-container-high transition-colors flex items-center gap-1"
          >
            View Profile
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* ─── Pending Approval Alert ─── */}
      {s.products.pending > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-amber-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>hourglass_empty</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-amber-800">
              <span className="font-bold">{s.products.pending}</span> product{s.products.pending !== 1 ? "s" : ""} pending approval
            </p>
            <p className="text-label-sm text-amber-600">
              Your recently added product{s.products.pending !== 1 ? "s are" : " is"} waiting for admin review. They will appear on the marketplace once approved.
            </p>
          </div>
          <Link
            href="/farmer/products"
            className="flex-shrink-0 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg font-label-md hover:bg-amber-200 transition-colors flex items-center gap-1"
          >
            View Products
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* ─── Stats Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="inventory_2"
          iconBg="bg-primary-fixed"
          iconColor="text-primary"
          label="Total Products"
          value={s.products.total}
          sub={s.products.pending > 0 ? `${s.products.pending} pending` : undefined}
          barWidth={`${activeProductPercent}%`}
          barColor="bg-primary"
        />
        <StatCard
          icon="inventory"
          iconBg="bg-tertiary-fixed"
          iconColor="text-on-tertiary-container"
          label="Low Stock Alerts"
          value={s.products.lowStock}
          sub={s.products.lowStock > 0 ? "Action Needed" : "All good"}
          barWidth={s.products.total > 0 ? `${Math.round((s.products.lowStock / s.products.total) * 100)}%` : "0%"}
          barColor="bg-on-tertiary-container"
        />
        <StatCard
          icon="shopping_bag"
          iconBg="bg-secondary-fixed"
          iconColor="text-secondary"
          label="Pending Orders"
          value={s.orders.pending}
          sub={s.orders.pending > 0 ? "Needs attention" : "All clear"}
          barWidth={s.orders.total > 0 ? `${Math.round((s.orders.pending / s.orders.total) * 100)}%` : "0%"}
          barColor="bg-secondary"
        />
        <StatCard
          icon="payments"
          iconBg="bg-primary-fixed"
          iconColor="text-primary"
          label="Total Earnings"
          value={formatCurrency(s.earnings.total)}
          sub={s.earnings.totalOrders > 0 ? `${s.earnings.totalOrders} order${s.earnings.totalOrders > 1 ? "s" : ""}` : undefined}
          barWidth="100%"
          barColor="bg-primary"
        />
      </div>

      {/* ─── Quick Stats Rows ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-outline-variant p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl">checklist</span>
          </div>
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Active Listings</p>
            <p className="font-headline-md text-headline-md text-primary">{s.products.active}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-on-tertiary-container text-2xl">remove_shopping_cart</span>
          </div>
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Out of Stock</p>
            <p className="font-headline-md text-headline-md text-on-tertiary-container">{s.products.outOfStock}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-2xl">receipt_long</span>
          </div>
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Total Orders</p>
            <p className="font-headline-md text-headline-md text-secondary">{s.orders.total}</p>
          </div>
        </div>
      </div>

      {/* ─── Main Two-Column Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Recent Orders */}
        <div className="lg:col-span-8">
          <section className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
                Recent Orders
              </h2>
              <Link
                href="/farmer/orders"
                className="text-primary font-label-md text-label-md hover:underline flex items-center gap-1"
              >
                View All
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              {s.orders.recent.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="text-left px-6 py-3">Order ID</th>
                      <th className="text-left px-6 py-3">Date</th>
                      <th className="text-left px-6 py-3">Customer</th>
                      <th className="text-right px-6 py-3">Amount</th>
                      <th className="text-left px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {s.orders.recent.map((order: DashboardOrder) => {
                      const ss = getStatusStyle(order.status);
                      return (
                        <tr
                          key={order._id}
                          className="hover:bg-surface-container-lowest transition-colors cursor-pointer"
                          onClick={() => router.push("/farmer/orders")}
                        >
                          <td className="px-6 py-4">
                            <span className="font-label-md text-primary">{getOrderIdDisplay(order._id)}</span>
                          </td>
                          <td className="px-6 py-4 text-on-surface-variant">{formatDate(order.createdAt)}</td>
                          <td className="px-6 py-4 text-on-surface">{order.consumer?.name || "---"}</td>
                          <td className="px-6 py-4 text-right font-bold">{formatCurrency(order.totalAmount)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${ss.bg} ${ss.text}`}>
                              {ss.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-16 px-6">
                  <span className="material-symbols-outlined text-[48px] text-outline mb-4">receipt_long</span>
                  <h3 className="font-headline-md text-headline-md text-primary mb-1">No Orders Yet</h3>
                  <p className="text-on-surface-variant max-w-sm mx-auto">
                    When customers place orders for your products, they&apos;ll appear here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column - Quick Actions & Activity */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <section className="bg-white rounded-2xl border border-outline-variant p-6">
            <h2 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">bolt</span>
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Link
                href="/farmer/products"
                className="flex items-center gap-4 p-4 rounded-xl bg-primary-fixed/30 hover:bg-primary-fixed transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                </div>
                <div className="flex-1">
                  <p className="font-label-md text-label-md text-primary font-bold">Add New Product</p>
                  <p className="text-label-sm text-on-surface-variant">List a new item for sale</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-xl">chevron_right</span>
              </Link>

              <Link
                href="/farmer/orders"
                className="flex items-center gap-4 p-4 rounded-xl bg-secondary-fixed/30 hover:bg-secondary-fixed transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary text-on-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>assignment_return</span>
                </div>
                <div className="flex-1">
                  <p className="font-label-md text-label-md text-secondary font-bold">Manage Orders</p>
                  <p className="text-label-sm text-on-surface-variant">{s.orders.pending} pending order{s.orders.pending !== 1 ? "s" : ""}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-xl">chevron_right</span>
              </Link>

              <Link
                href="/farmer/profile"
                className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-high hover:bg-surface-container-high/80 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>edit</span>
                </div>
                <div className="flex-1">
                  <p className="font-label-md text-label-md text-primary font-bold">Edit Profile</p>
                  <p className="text-label-sm text-on-surface-variant">Update farm details</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-xl">chevron_right</span>
              </Link>
            </div>
          </section>

          {/* Farm Overview Card */}
          <section className="bg-gradient-to-br from-primary/5 to-primary-fixed/20 rounded-2xl border border-primary/10 p-6">
            <h2 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">agriculture</span>
              Farm Overview
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">store</span>
                </div>
                <div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Farm Name</p>
                  <p className="font-label-md text-label-md text-on-surface">{s.farmName || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Farmer Name</p>
                  <p className="font-label-md text-label-md text-on-surface">{s.farmerName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">package_2</span>
                </div>
                <div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Product Catalog</p>
                  <p className="font-label-md text-label-md text-on-surface">
                    {s.products.active} active of {s.products.total} total
                  </p>
                </div>
              </div>
              <Link
                href="/farmer/profile"
                className="mt-2 inline-flex items-center gap-1 text-primary font-label-md hover:underline"
              >
                Manage farm details
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
