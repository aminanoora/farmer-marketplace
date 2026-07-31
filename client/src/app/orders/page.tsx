"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";
import { useCart } from "@/lib/cart-context";
import { consumerAPI } from "@/lib/api";

/* ─── Types ──────────────────────────────────── */

interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface OrderFarmer {
  _id: string;
  name: string;
  farmName?: string;
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
  consumer: string;
  farmer: OrderFarmer;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "preparing" | "out-for-delivery" | "delivered" | "cancelled";
  deliverySlot?: { date: string; timeSlot: string };
  paymentMethod: "cod" | "online";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  deliveryAddress: DeliveryAddress;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = "all" | "delivered" | "in-progress";

/* ─── Status helpers ─────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  delivered:     { label: "Delivered",       icon: "check_circle",      bg: "bg-[#dcfce7]", text: "text-[#166534]" },
  "out-for-delivery": { label: "Out for Delivery", icon: "local_shipping", bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
  preparing:     { label: "Preparing",       icon: "cooking",          bg: "bg-[#dbeafe]", text: "text-[#1e40af]" },
  confirmed:     { label: "Confirmed",       icon: "check_circle",     bg: "bg-[#e0e7ff]", text: "text-[#3730a3]" },
  pending:       { label: "Pending",         icon: "schedule",         bg: "bg-surface-container-high", text: "text-on-surface-variant" },
  cancelled:     { label: "Cancelled",       icon: "cancel",           bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderIdDisplay(id: string) {
  return `#KM-${id.slice(-5).toUpperCase()}`;
}

function getItemsSummary(items: OrderItem[]) {
  return items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(", ");
}

/* ─── Component ──────────────────────────────── */

export default function OrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { showSuccess } = useNotification();
  const { addItem } = useCart();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "amount-desc" | "amount-asc">("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const PER_PAGE = 5;

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login?redirect=/orders");
    }
  }, [authLoading, isAuthenticated, router]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Re-order — add all items from a cancelled order back to the cart
  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      addItem(
        {
          productId: item.product,
          name: item.name,
          price: item.price,
          unit: item.unit,
          image: "",
          farmerId: order.farmer._id,
          farmerName: order.farmer.farmName || order.farmer.name,
          isOrganic: false,
          isAvailable: true,
          maxQuantity: 99,
        },
        item.quantity
      );
    });
    showSuccess("Items from cancelled order have been added to your cart.");
  };

  // Cancel order
  const handleCancelOrder = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await consumerAPI.cancelOrder(cancelTarget._id);
      // Update the order in local state
      setOrders((prev) =>
        prev.map((o) =>
          o._id === cancelTarget._id ? { ...o, status: "cancelled" as const } : o
        )
      );
      setCancelTarget(null);
      showSuccess("Order has been cancelled successfully.");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to cancel order.";
      setCancelError(msg); // Displayed inside the open dialog
    } finally {
      setCancelling(false);
    }
  };

  // Fetch orders
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    consumerAPI
      .getOrders()
      .then((res) => setOrders(res.data.orders || []))
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || "Failed to load orders";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  // Filtered + sorted orders
  const processedOrders = useMemo(() => {
    let filtered = [...orders];

    // Filter by status
    if (statusFilter === "delivered") {
      filtered = filtered.filter((o) => o.status === "delivered");
    } else if (statusFilter === "in-progress") {
      filtered = filtered.filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled"
      );
    }

    // Sort
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
  }, [orders, statusFilter, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processedOrders.length / PER_PAGE));
  const paginatedOrders = processedOrders.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, sortBy]);

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading your orders...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitial = user.name?.charAt(0)?.toUpperCase() || "?";

  /* ─── Render ──────────────────────────────── */
  return (
    <div className="min-h-screen bg-surface">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col p-lg gap-sm h-screen w-64 fixed left-0 top-0 bg-surface border-r border-outline-variant z-40">
        <div className="mb-xl px-sm">
          <Link href="/profile" className="font-headline-md text-headline-md text-primary hover:underline">My Account</Link>
          <p className="text-on-surface-variant font-label-md">Manage your farm orders</p>
        </div>
        <nav className="flex flex-col gap-xs flex-grow">
          <SidebarLink href="/profile" icon="dashboard" label="Dashboard" />
          <SidebarLink href="/profile" icon="person" label="Personal Info" />
          <SidebarLink href="/profile/address" icon="location_on" label="Saved Addresses" />
          <SidebarLink href="/profile/payments" icon="payments" label="Payment Methods" />
          <SidebarLink href="/orders" icon="history" label="Order History" active />
          <SidebarLink href="/profile" icon="settings" label="Settings" />
        </nav>
        <div className="mt-auto p-md rounded-xl bg-surface-container border border-outline-variant flex items-center gap-md">
          <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
            {userInitial}
          </div>
          <div className="overflow-hidden">
            <p className="font-label-md truncate text-on-surface">{user.name}</p>
            <p className="text-xs text-on-surface-variant truncate">
              {user.role === "farmer" ? "Farmer" : user.role === "admin" ? "Admin" : "Premium Member"}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Top Navigation ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop w-full h-14 bg-surface border-b border-outline-variant lg:pl-72">
        <div className="flex items-center gap-md">
          <Link href="/" className="font-display-lg text-headline-md text-primary">Krishi Market</Link>
        </div>
        <div className="hidden md:flex flex-grow max-w-xl mx-xl">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-on-surface-variant pointer-events-none">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input
              className="block w-full pl-10 pr-3 py-2 border border-outline-variant rounded-full bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              placeholder="Search orders..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-lg">
          <Link href="/cart" className="relative text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">shopping_cart</span>
          </Link>
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileOpen((p) => !p)}
              className="w-8 h-8 rounded-full bg-primary text-on-primary font-label-md flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
              aria-label="Profile menu"
            >
              {userInitial}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant/50">
                  <p className="font-label-md text-primary truncate">{user.name}</p>
                  <p className="text-label-sm text-on-surface-variant truncate">{user.email}</p>
                </div>
                <div className="py-1">
                  <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-on-surface hover:bg-surface-container-high transition-colors font-body-md">
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">person</span>
                    My Profile
                  </Link>
                  <Link href="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-on-surface hover:bg-surface-container-high transition-colors font-body-md">
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">receipt_long</span>
                    My Orders
                  </Link>
                </div>
                <div className="border-t border-outline-variant/50 py-1">                      <button onClick={() => { logout(); router.push("/"); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error/5 transition-colors font-body-md">
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                            Sign Out
                          </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="lg:ml-64 p-margin-mobile md:p-margin-desktop min-h-[calc(100vh-3.5rem)]">
        <div className="max-w-5xl mx-auto">
          {/* Page Header */}
          <div className="mb-xl">
            <h2 className="font-headline-lg text-headline-lg text-primary mb-xs">Order History</h2>
            <p className="font-body-lg text-on-surface-variant">Track and manage your recent farm-fresh orders.</p>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-lg p-md rounded-xl bg-error-container text-on-error-container border border-error/20 flex items-center gap-3 animate-slideDown">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <p className="font-body-md flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-on-error-container/70 hover:text-on-error-container">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-md justify-between items-start sm:items-center mb-lg">
            <div className="flex gap-sm overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto custom-scrollbar">
              {(["all", "delivered", "in-progress"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={
                    "px-md py-sm rounded-full font-label-md text-sm whitespace-nowrap transition-all active:scale-95 " +
                    (statusFilter === f
                      ? "bg-primary-container text-on-primary-container shadow-sm"
                      : "bg-white border border-outline-variant hover:bg-surface-container text-on-surface-variant")
                  }
                >
                  {f === "all" ? "All Orders" : f === "delivered" ? "Delivered" : "In Progress"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-sm">
              <span className="text-sm text-on-surface-variant font-label-md">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-transparent border border-outline-variant rounded-lg px-3 py-1.5 font-label-md text-sm text-primary focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
              >
                <option value="recent">Recent first</option>
                <option value="amount-desc">Amount: High to Low</option>
                <option value="amount-asc">Amount: Low to High</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          {/* Orders List */}
          {paginatedOrders.length > 0 ? (
            <div className="bg-white rounded-xl border border-outline-variant overflow-hidden">
              {/* Desktop Header */}
              <div className="hidden md:grid grid-cols-12 gap-md p-lg bg-surface-container-low border-b border-outline-variant font-label-md text-on-surface-variant">
                <div className="col-span-2">Order ID</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-3">Farm / Producer</div>
                <div className="col-span-2">Total</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {paginatedOrders.map((order, idx) => {
                const sc = getStatusConfig(order.status);
                const isLast = idx === paginatedOrders.length - 1;
                return (
                  <div
                    key={order._id}
                    className={
                      "grid grid-cols-1 md:grid-cols-12 gap-md p-lg transition-all bg-white hover:shadow-md hover:-translate-y-0.5 duration-300 " +
                      (isLast ? "" : "border-b border-outline-variant")
                    }
                  >
                    {/* Order ID */}
                    <div className="col-span-2 flex md:block justify-between items-center">
                      <span className="md:hidden text-on-surface-variant font-label-sm uppercase">Order ID</span>
                      <span className="font-label-md text-primary">{getOrderIdDisplay(order._id)}</span>
                    </div>

                    {/* Date */}
                    <div className="col-span-2 flex md:block justify-between items-center">
                      <span className="md:hidden text-on-surface-variant font-label-sm uppercase">Date</span>
                      <div>
                        <span className="text-body-md block">{formatDate(order.createdAt)}</span>
                        <span className="text-label-sm text-on-surface-variant">{formatTime(order.createdAt)}</span>
                      </div>
                    </div>

                    {/* Farm / Producer */}
                    <div className="col-span-3 flex md:block justify-between items-center">
                      <span className="md:hidden text-on-surface-variant font-label-sm uppercase">Farm</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-md truncate">{order.farmer?.farmName || order.farmer?.name || "Unknown Farm"}</span>
                        <span className="text-xs text-on-surface-variant truncate">{getItemsSummary(order.items)}</span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="col-span-2 flex md:block justify-between items-center">
                      <span className="md:hidden text-on-surface-variant font-label-sm uppercase">Total</span>
                      <span className="font-bold text-primary">
                        ₹{order.totalAmount.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 flex md:block justify-between items-center">
                      <span className="md:hidden text-on-surface-variant font-label-sm uppercase">Status</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold gap-1 ${sc.bg} ${sc.text}`}>
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {sc.icon}
                        </span>
                        {sc.label}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="col-span-1 flex justify-end items-center gap-2">
                      {order.status === "cancelled" ? (
                        <button
                          onClick={() => handleReorder(order)}
                          className="text-primary font-label-md text-xs hover:underline flex items-center gap-0.5 active:scale-95"
                          title="Re-order all items"
                        >
                          <span className="material-symbols-outlined text-[14px]">replay</span>
                          Re-order
                        </button>
                      ) : (
                        order.status !== "delivered" && order.status !== "out-for-delivery" && (
                          <button
                            onClick={() => setCancelTarget(order)}
                            className="text-error font-label-md text-xs hover:underline flex items-center gap-0.5 active:scale-95"
                            title="Cancel this order"
                          >
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            Cancel
                          </button>
                        )
                      )}
                      <Link
                        href={`/orders/${order._id}`}
                        className="text-primary font-label-md text-sm hover:underline flex items-center gap-1 group"
                      >
                        Details
                        <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">chevron_right</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !loading && !error ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-surface-container-high rounded-full flex items-center justify-center mb-md text-on-surface-variant">
                <span className="material-symbols-outlined text-[48px]">shopping_basket</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary">
                {statusFilter !== "all" ? "No matching orders" : "No orders yet"}
              </h3>
              <p className="text-on-surface-variant max-w-sm mb-lg font-body-md">
                {statusFilter !== "all"
                  ? "Try changing your filter to see more orders."
                  : "When you start ordering fresh farm produce, your order history will appear here."}
              </p>
              <Link
                href="/marketplace"
                className="px-xl py-md bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 transition-all active:scale-95 inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">storefront</span>
                Browse Marketplace
              </Link>
            </div>
          ) : null}

          {/* Pagination */}
          {processedOrders.length > 0 && totalPages > 1 && (
            <div className="mt-lg flex flex-col md:flex-row justify-between items-center gap-md">
              <p className="text-sm text-on-surface-variant font-body-md">
                Showing {(currentPage - 1) * PER_PAGE + 1}
                {" – "}
                {Math.min(currentPage * PER_PAGE, processedOrders.length)}
                {" of "}
                {processedOrders.length} orders
              </p>
              <div className="flex gap-sm">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={
                      "w-10 h-10 flex items-center justify-center rounded-lg font-label-md transition-all active:scale-95 " +
                      (page === currentPage
                        ? "bg-primary text-on-primary shadow-sm"
                        : "border border-outline-variant hover:bg-surface-container text-on-surface-variant")
                    }
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Cancel Confirmation Dialog ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !cancelling && setCancelTarget(null)} />
          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-xl animate-slideDown">
            <div className="w-14 h-14 mx-auto rounded-full bg-error-container flex items-center justify-center mb-lg">
              <span className="material-symbols-outlined text-[32px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary text-center mb-sm">Cancel Order?</h3>
            <p className="text-body-md text-on-surface-variant text-center mb-lg max-w-sm mx-auto">
              Are you sure you want to cancel <strong>{getOrderIdDisplay(cancelTarget._id)}</strong>?
              This action cannot be undone and any items will be returned to inventory.
            </p>
            {cancelError && (
              <div className="mb-md p-md rounded-xl bg-error-container text-on-error-container border border-error/20 flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{cancelError}</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setCancelTarget(null); setCancelError(null); }}
                disabled={cancelling}
                className="flex-1 px-6 py-3 border border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container transition-all disabled:opacity-50 active:scale-95"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 px-6 py-3 bg-error text-on-error font-label-md rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 inline-flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    Yes, Cancel Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-outline-variant flex justify-around items-center z-50">
        <MobileNavLink href="/" icon="home" label="Home" />
        <MobileNavLink href="/marketplace" icon="search" label="Explore" />
        <MobileNavLink href="/orders" icon="history" label="Orders" active />
        <MobileNavLink href="/profile" icon="person" label="Profile" />
      </nav>
    </div>
  );
}

/* ─── Sidebar Link ──────────────────────────── */
function SidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex items-center gap-md p-md rounded-lg transition-all active:scale-95 " +
        (active
          ? "bg-primary-container text-on-primary-container font-bold"
          : "text-on-surface-variant hover:bg-surface-container-high")
      }
    >
      <span className="material-symbols-outlined">{icon}</span>
      <span className="font-label-md">{label}</span>
    </Link>
  );
}

/* ─── Mobile Nav Link ───────────────────────── */
function MobileNavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={"flex flex-col items-center gap-0.5 " + (active ? "text-primary" : "text-on-surface-variant")}
    >
      <span
        className="material-symbols-outlined text-[22px]"
        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
      >
        {icon}
      </span>
      <span className={"text-[10px] font-label-sm " + (active ? "font-bold" : "")}>{label}</span>
    </Link>
  );
}
