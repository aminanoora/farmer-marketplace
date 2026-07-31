"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";
import { farmerAPI } from "@/lib/api";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface OrderConsumer {
  _id: string;
  name: string;
  phone?: string;
}

interface DeliveryAddress {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

interface Order {
  _id: string;
  consumer: OrderConsumer;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "preparing" | "out-for-delivery" | "delivered" | "cancelled";
  deliverySlot?: { date: string; timeSlot: string };
  paymentMethod: "cod" | "online";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  deliveryAddress: DeliveryAddress;
  trackingId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────
// Status configuration (matches dashboard conventions)
// ─────────────────────────────────────────────────
const ORDER_STATUSES: Order["status"][] = [
  "pending",
  "confirmed",
  "preparing",
  "out-for-delivery",
  "delivered",
  "cancelled",
];

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  delivered:            { label: "Delivered",        bg: "bg-primary-fixed",         text: "text-on-primary-fixed-variant", icon: "check_circle" },
  "out-for-delivery":   { label: "Out for Delivery", bg: "bg-tertiary-fixed",        text: "text-on-tertiary-fixed-variant", icon: "local_shipping" },
  preparing:            { label: "Preparing",        bg: "bg-tertiary-fixed",        text: "text-on-tertiary-fixed-variant", icon: "cooking" },
  confirmed:            { label: "Confirmed",        bg: "bg-primary-fixed",         text: "text-on-primary-fixed-variant", icon: "check" },
  pending:              { label: "Pending",          bg: "bg-surface-container-highest", text: "text-on-surface-variant", icon: "schedule" },
  cancelled:            { label: "Cancelled",        bg: "bg-error-container",       text: "text-error", icon: "cancel" },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || STATUS_STYLES.pending;
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

function formatDate(iso: string): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderIdDisplay(id: string): string {
  return "#KM-" + id.slice(-5).toUpperCase();
}

function getItemsSummary(items: OrderItem[]): string {
  return items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(", ");
}

function getItemsTotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

// ─────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────
function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-outline-variant hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <span className={`material-symbols-outlined ${iconColor} text-[22px]`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-0.5">{label}</p>
          <p className="font-headline-md text-headline-md text-primary truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentBadge({ method, status }: { method: Order["paymentMethod"]; status: Order["paymentStatus"] }) {
  const methodLabel = method === "online" ? "Online" : "Cash on Delivery";
  const statusStyle =
    status === "paid" || status === "refunded"
      ? "bg-[#dcfce7] text-[#166534]"
      : status === "failed"
      ? "bg-[#fee2e2] text-[#991b1b]"
      : "bg-surface-container-high text-on-surface-variant";
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusStyle}`}>
      {methodLabel} · {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─────────────────────────────────────────────────
// Farmer Orders Page
// ─────────────────────────────────────────────────
export default function FarmerOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | Order["status"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "amount-desc" | "amount-asc">("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusSelect, setStatusSelect] = useState<Record<string, Order["status"]>>({});
  // Pending (unconfirmed) status change awaiting user confirmation
  const [pendingChange, setPendingChange] = useState<{ orderId: string; from: Order["status"]; to: Order["status"] } | null>(null);

  const PER_PAGE = 5;

  // Redirect if not a farmer
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/auth/login?redirect=/farmer/orders");
      } else if (user?.role !== "farmer") {
        router.push(user?.role === "admin" ? "/admin/dashboard" : "/");
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Fetch orders
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "farmer") return;
    setLoading(true);
    setError(null);
    farmerAPI
      .getOrders()
      .then((res) => {
        const fetched = res.data.orders || [];
        setOrders(fetched);
        // Initialize status select values
        const initial: Record<string, Order["status"]> = {};
        fetched.forEach((o: Order) => (initial[o._id] = o.status));
        setStatusSelect(initial);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || "Failed to load orders.";
        setError(msg);
        showError(msg);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  // Stage a status change — show confirmation dialog first
  const handleStatusSelect = (orderId: string, to: Order["status"]) => {
    if (updatingId || !to) return;
    const order = orders.find((o) => o._id === orderId);
    if (!order || to === order.status) return;
    // Track the intended change but don't apply yet
    setStatusSelect((prev) => ({ ...prev, [orderId]: to }));
    setPendingChange({ orderId, from: order.status, to });
  };

  // Dismiss the dialog and revert the staged select value.
  // Both call sites only exist while pendingChange is non-null, so reading it
  // from the closure is safe.
  const cancelPendingChange = () => {
    if (pendingChange) {
      setStatusSelect((prev) => ({ ...prev, [pendingChange.orderId]: pendingChange.from }));
    }
    setPendingChange(null);
  };

  // Apply the confirmed status change
  const handleStatusChange = async (orderId: string, newStatus: Order["status"]) => {
    if (updatingId) return;
    setError(null);
    setUpdatingId(orderId);
    setPendingChange(null);
    try {
      await farmerAPI.updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o))
      );
      setStatusSelect((prev) => ({ ...prev, [orderId]: newStatus }));
      showSuccess(`Order ${getOrderIdDisplay(orderId)} marked as "${getStatusStyle(newStatus).label}".`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to update order status.";
      showError(msg);
      setError(msg);
      // Roll back the staged select value on failure
      const order = orders.find((o) => o._id === orderId);
      if (order) setStatusSelect((prev) => ({ ...prev, [orderId]: order.status }));
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered + sorted orders
  const processedOrders = useMemo(() => {
    let filtered = [...orders];

    if (statusFilter !== "all") {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((o) => {
        const idMatch = getOrderIdDisplay(o._id).toLowerCase().includes(q);
        const customerMatch = (o.consumer?.name || "").toLowerCase().includes(q);
        const itemsMatch = getItemsSummary(o.items).toLowerCase().includes(q);
        return idMatch || customerMatch || itemsMatch;
      });
    }

    if (sortBy === "recent") {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === "amount-desc") {
      filtered.sort((a, b) => b.totalAmount - a.totalAmount);
    } else if (sortBy === "amount-asc") {
      filtered.sort((a, b) => a.totalAmount - b.totalAmount);
    }

    return filtered;
  }, [orders, statusFilter, searchQuery, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processedOrders.length / PER_PAGE));
  const paginatedOrders = processedOrders.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const inTransit = orders.filter((o) => o.status === "preparing" || o.status === "out-for-delivery").length;
    const revenue = orders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + o.totalAmount, 0);
    return { total: orders.length, pending, delivered, inTransit, revenue };
  }, [orders]);

  // ─── Loading ───
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading your orders...</p>
        </div>
      </div>
    );
  }

  // ─── Redirect guard ───
  if (!user || user.role !== "farmer") return null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* ─── Header ─── */}
      <div className="mb-8">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-1">Orders</h1>
        <p className="text-on-surface-variant max-w-xl">
          Track, manage, and fulfill orders placed for your farm products.
        </p>
      </div>

      {/* ─── Stats Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="receipt_long" iconBg="bg-primary-fixed" iconColor="text-primary" label="Total Orders" value={stats.total} />
        <StatCard icon="hourglass_empty" iconBg="bg-amber-100" iconColor="text-amber-700" label="Needs Attention" value={stats.pending} />
        <StatCard icon="local_shipping" iconBg="bg-tertiary-fixed" iconColor="text-on-tertiary-container" label="In Transit" value={stats.inTransit} />
        <StatCard icon="payments" iconBg="bg-primary-fixed" iconColor="text-primary" label="Delivered Revenue" value={formatCurrency(stats.revenue)} />
      </div>

      {/* ─── Error Banner ─── */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-error-container text-on-error-container border border-error/20 flex items-start gap-3 animate-slideDown">
          <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <p className="font-body-md text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="shrink-0 p-0.5 rounded-full hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ─── Toolbar: Filters / Search / Sort ─── */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Status filter pills */}
          <div className="flex overflow-x-auto gap-2 pb-1 lg:pb-0 hide-scrollbar">
            {(["all", ...ORDER_STATUSES] as const).map((f) => {
              const isActive = statusFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] whitespace-nowrap transition-all active:scale-95 ${
                    isActive
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-white border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {f === "all" ? "All Orders" : getStatusStyle(f).label}
                </button>
              );
            })}
          </div>

          {/* Search + sort */}
          <div className="flex flex-col sm:flex-row gap-3 lg:ml-auto">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-on-surface-variant pointer-events-none">
                <span className="material-symbols-outlined text-[18px]">search</span>
              </span>
              <input
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-outline-variant rounded-xl font-body-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-on-surface placeholder:text-on-surface-variant/50"
                placeholder="Search by order ID, customer, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2.5 bg-white border border-outline-variant rounded-xl font-label-md text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
            >
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Orders List ─── */}
      {paginatedOrders.length > 0 ? (
        <div className="space-y-4">
          {paginatedOrders.map((order) => {
            const ss = getStatusStyle(order.status);
            const isExpanded = expandedId === order._id;
            const isUpdating = updatingId === order._id;
            const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
            const canManage =
              order.status !== "cancelled" && order.status !== "delivered";

            return (
              <div
                key={order._id}
                className="bg-white rounded-2xl border border-outline-variant overflow-hidden transition-all duration-200 hover:shadow-md"
              >
                {/* Order header row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : order._id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-5 hover:bg-surface-container-low/60 transition-colors"
                >
                  {/* Left: ID + date + customer */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-headline-md text-[15px] text-primary">
                        {getOrderIdDisplay(order._id)}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${ss.bg} ${ss.text}`}>
                        <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {ss.icon}
                        </span>
                        {ss.label}
                      </span>
                    </div>
                    <p className="text-label-sm text-on-surface-variant mt-1 truncate">
                      {order.consumer?.name || "Customer"} · {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
                    </p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5 truncate">
                      {getItemsSummary(order.items)}
                    </p>
                  </div>

                  {/* Right: amount + expand */}
                  <div className="flex items-center gap-3 md:gap-4 shrink-0">
                    <div className="text-right">
                      <p className="font-headline-md text-[18px] text-on-tertiary-container">
                        {formatCurrency(order.totalAmount)}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        {itemCount} item{itemCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span
                      className={`w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
                    </span>
                  </div>
                </button>

                {/* ─── Expanded full details ─── */}
                {isExpanded && (
                  <div className="border-t border-outline-variant bg-surface-container-lowest/50 animate-slideDown">
                    {/* Status management + view details */}
                    <div className="p-5 border-b border-outline-variant bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                          <span className="font-label-md text-label-md">Update status:</span>
                        </div>
                        <select
                          value={statusSelect[order._id] || order.status}
                          onChange={(e) => handleStatusSelect(order._id, e.target.value as Order["status"])}
                          disabled={!canManage || updatingId !== null || pendingChange !== null}
                          className="flex-1 sm:flex-none sm:w-56 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-label-md text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {getStatusStyle(s).label}
                            </option>
                          ))}
                        </select>
                        {isUpdating && (
                          <span className="inline-flex items-center gap-2 text-label-sm text-on-surface-variant">
                            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Updating...
                          </span>
                        )}
                        {!canManage && (
                          <span className="text-label-sm text-on-surface-variant">
                            {order.status === "cancelled" ? "This order was cancelled and can no longer be updated." : "This order is complete."}
                          </span>
                        )}
                        <Link
                          href={`/farmer/orders/${order._id}`}
                          className="sm:ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 border border-outline-variant rounded-lg font-label-md text-[13px] text-primary hover:bg-primary-fixed/40 transition-colors active:scale-95 shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          View Full Details
                        </Link>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                      {/* Items */}
                      <div className="lg:col-span-2 space-y-4">
                        <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-2">
                          <span className="material-symbols-outlined text-[20px]">shopping_basket</span>
                          Items
                        </h3>
                        <div className="space-y-3">
                          {order.items.map((item, idx) => (
                            <div
                              key={`${order._id}-item-${idx}`}
                              className="flex items-center justify-between gap-4 p-4 bg-white rounded-xl border border-outline-variant"
                            >
                              <div className="min-w-0">
                                <p className="font-label-md text-label-md text-on-surface truncate">{item.name}</p>
                                <p className="text-label-sm text-on-surface-variant">
                                  {item.quantity} × {item.unit} @ {formatCurrency(item.price)}
                                </p>
                              </div>
                              <span className="font-bold text-on-tertiary-container whitespace-nowrap">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between p-4 bg-primary-fixed/30 rounded-xl border border-primary/10">
                            <span className="font-label-md text-label-md text-on-surface-variant">Subtotal</span>
                            <span className="font-headline-md text-headline-md text-primary">
                              {formatCurrency(getItemsTotal(order.items))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-primary text-on-primary rounded-xl shadow-sm">
                            <span className="font-label-md text-label-md flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px]">payments</span>
                              Order Total
                            </span>
                            <span className="font-headline-md text-headline-md">
                              {formatCurrency(order.totalAmount)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Customer & delivery */}
                      <div className="space-y-5">
                        {/* Customer */}
                        <section className="bg-white rounded-xl border border-outline-variant p-5">
                          <h3 className="font-headline-md text-headline-md text-primary mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px]">person</span>
                            Customer
                          </h3>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {(order.consumer?.name || "C").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-label-md text-label-md text-on-surface truncate">
                                {order.consumer?.name || "Unknown"}
                              </p>
                              {order.consumer?.phone && (
                                <p className="text-label-sm text-on-surface-variant">{order.consumer.phone}</p>
                              )}
                            </div>
                          </div>
                          <PaymentBadge method={order.paymentMethod} status={order.paymentStatus} />
                        </section>

                        {/* Delivery address */}
                        <section className="bg-white rounded-xl border border-outline-variant p-5">
                          <h3 className="font-headline-md text-headline-md text-primary mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px]">location_on</span>
                            Delivery Address
                          </h3>
                          <p className="font-label-md text-label-md text-on-surface">
                            {order.deliveryAddress?.fullName || "Customer"}
                          </p>
                          <p className="text-label-sm text-on-surface-variant mt-1 leading-relaxed">
                            {order.deliveryAddress?.street},<br />
                            {order.deliveryAddress?.city}, {order.deliveryAddress?.state} — {order.deliveryAddress?.pincode}
                          </p>
                          <p className="text-label-sm text-on-surface-variant mt-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">call</span>
                            {order.deliveryAddress?.phone || "No phone"}
                          </p>
                        </section>

                        {/* Delivery slot & tracking */}
                        <section className="bg-white rounded-xl border border-outline-variant p-5">
                          <h3 className="font-headline-md text-headline-md text-primary mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px]">schedule</span>
                            Delivery
                          </h3>
                          {order.deliverySlot ? (
                            <div className="space-y-2 text-label-sm">
                              <div className="flex justify-between">
                                <span className="text-on-surface-variant">Date</span>
                                <span className="font-bold text-on-surface">{formatDate(order.deliverySlot.date)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-on-surface-variant">Time slot</span>
                                <span className="font-bold text-on-surface">{order.deliverySlot.timeSlot || "---"}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-label-sm text-on-surface-variant">No delivery slot selected.</p>
                          )}
                          {order.trackingId && (
                            <p className="text-label-sm text-on-surface-variant mt-3 pt-3 border-t border-outline-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                              Tracking: <span className="font-bold text-on-surface">{order.trackingId}</span>
                            </p>
                          )}
                        </section>

                        {/* Order info */}
                        <section className="bg-white rounded-xl border border-outline-variant p-5">
                          <h3 className="font-headline-md text-headline-md text-primary mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px]">info</span>
                            Order Info
                          </h3>
                          <div className="space-y-2 text-label-sm">
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant">Placed on</span>
                              <span className="font-bold text-on-surface">{formatDate(order.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant">Last update</span>
                              <span className="font-bold text-on-surface">{formatDate(order.updatedAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant">Payment</span>
                              <span className="font-bold text-on-surface capitalize">{order.paymentMethod}</span>
                            </div>
                          </div>
                          {order.notes && (
                            <p className="text-label-sm text-on-surface-variant mt-3 pt-3 border-t border-outline-variant">
                              <span className="font-bold text-on-surface">Notes:</span> {order.notes}
                            </p>
                          )}
                        </section>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !loading && !error ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 bg-surface-container-high rounded-full flex items-center justify-center mb-6 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px]">receipt_long</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-primary mb-2">
            {statusFilter !== "all" || searchQuery ? "No matching orders" : "No orders yet"}
          </h3>
          <p className="text-on-surface-variant max-w-sm mb-6 font-body-md">
            {statusFilter !== "all" || searchQuery
              ? "Try changing your filter or search to see more orders."
              : "When customers place orders for your products, they'll appear here with full details."}
          </p>
          {(statusFilter !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
                setSortBy("recent");
              }}
              className="px-6 py-3 bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 transition-all active:scale-95 inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
              Clear Filters
            </button>
          )}
        </div>
      ) : null}

      {/* ─── Pagination ─── */}
      {processedOrders.length > 0 && totalPages > 1 && (
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-on-surface-variant font-body-md">
            Showing {(currentPage - 1) * PER_PAGE + 1} – {Math.min(currentPage * PER_PAGE, processedOrders.length)} of {processedOrders.length} orders
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant bg-white hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg font-label-md transition-all active:scale-95 ${
                  page === currentPage
                    ? "bg-primary text-on-primary shadow-sm"
                    : "border border-outline-variant bg-white hover:bg-surface-container text-on-surface-variant"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant bg-white hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Status Change Confirmation Dialog ─── */}
      {pendingChange && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-confirm-title"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !updatingId && cancelPendingChange()}
          />
          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-8 animate-slideDown">
            <div
              className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
                pendingChange.to === "cancelled" ? "bg-error-container" : "bg-primary-fixed"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[32px] ${pendingChange.to === "cancelled" ? "text-error" : "text-primary"}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {pendingChange.to === "cancelled" ? "cancel" : getStatusStyle(pendingChange.to).icon}
              </span>
            </div>
            <h3 id="status-confirm-title" className="font-headline-md text-headline-md text-primary text-center mb-2">
              Update Order Status
            </h3>
            <p className="text-body-md text-on-surface-variant text-center mb-6 max-w-sm mx-auto">
              Change order <strong>{getOrderIdDisplay(pendingChange.orderId)}</strong> from{" "}
              <strong>{getStatusStyle(pendingChange.from).label}</strong> to{" "}
              <strong>{getStatusStyle(pendingChange.to).label}</strong>?
              {pendingChange.to === "cancelled"
                ? " The customer will be notified and this action cannot be undone."
                : pendingChange.to === "delivered"
                ? " Confirm the order was actually delivered before marking it complete."
                : " The customer will be notified of the update."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={cancelPendingChange}
                disabled={updatingId !== null}
                className="flex-1 px-6 py-3 border border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container transition-all disabled:opacity-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(pendingChange.orderId, pendingChange.to)}
                disabled={updatingId !== null}
                className={`flex-1 px-6 py-3 rounded-xl font-label-md text-white transition-all disabled:opacity-50 active:scale-95 ${
                  pendingChange.to === "cancelled" ? "bg-error hover:opacity-90" : "bg-primary hover:opacity-90"
                }`}
              >
                {updatingId !== null ? "Updating..." : `Yes, Mark ${getStatusStyle(pendingChange.to).label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
