"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";
import { useCart } from "@/lib/cart-context";
import { consumerAPI } from "@/lib/api";

/* ─── Types ──────────────────────────────────── */

interface OrderProduct {
  _id: string;
  name: string;
  images?: string[];
}

interface OrderItemDetail {
  product: OrderProduct;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface OrderUser {
  _id: string;
  name: string;
  phone?: string;
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

interface OrderDetail {
  _id: string;
  consumer: OrderUser;
  farmer: OrderUser;
  items: OrderItemDetail[];
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

/* ─── Status helpers ─────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  delivered:         { label: "Delivered",       icon: "check_circle",   bg: "bg-[#dcfce7]", text: "text-[#166534]" },
  "out-for-delivery":{ label: "Out for Delivery",icon: "local_shipping", bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
  preparing:         { label: "Preparing",       icon: "cooking",        bg: "bg-[#dbeafe]", text: "text-[#1e40af]" },
  confirmed:         { label: "Confirmed",       icon: "check_circle",   bg: "bg-[#e0e7ff]", text: "text-[#3730a3]" },
  pending:           { label: "Pending",         icon: "schedule",       bg: "bg-surface-container-high", text: "text-on-surface-variant" },
  cancelled:         { label: "Cancelled",       icon: "cancel",         bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
};

const STATUS_ORDER = ["pending", "confirmed", "preparing", "out-for-delivery", "delivered"];
const TERMINAL_STATUSES = ["delivered", "cancelled"];

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderIdDisplay(id: string) {
  return `#KM-${id.slice(-5).toUpperCase()}`;
}

/* ─── Component ──────────────────────────────── */

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { showSuccess } = useNotification();
  const { addItem } = useCart();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<OrderItemDetail | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewHover, setReviewHover] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewedProducts, setReviewedProducts] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/auth/login?redirect=/orders/${id}`);
    }
  }, [authLoading, isAuthenticated, router, id]);

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

  // Submit review
  const handleSubmitReview = async () => {
    if (!reviewTarget || reviewRating === 0) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await consumerAPI.addReview({
        product: reviewTarget.product._id,
        farmer: order!.farmer._id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewedProducts((prev) => new Set(prev).add(reviewTarget.product._id));
      setReviewTarget(null);
      setReviewRating(0);
      setReviewComment("");
      showSuccess(`Review submitted for ${reviewTarget.name}.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to submit review.";
      setReviewError(msg);
      // If already reviewed (e.g. after page refresh), update local state and close modal
      if (msg.toLowerCase().includes("already reviewed")) {
        setReviewedProducts((prev) => new Set(prev).add(reviewTarget!.product._id));
        setReviewTarget(null);
        setReviewRating(0);
        setReviewComment("");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  // Cancel order
  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await consumerAPI.cancelOrder(order._id);
      setOrder(res.data.order);
      setShowCancelDialog(false);
      showSuccess("Order has been cancelled successfully.");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to cancel order.";
      setCancelError(msg); // Displayed inside the open dialog
    } finally {
      setCancelling(false);
    }
  };

  // Fetch order & set up polling for real-time status updates
  useEffect(() => {
    if (!isAuthenticated || !id) return;
    setLoading(true);
    setError(null);
    consumerAPI
      .getOrder(id)
      .then((res) => {
        setOrder(res.data.order);
        previousStatusRef.current = res.data.order.status;
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setError("Order not found. It may have been removed or the link is incorrect.");
        } else if (err?.response?.status === 403) {
          setError("You don't have permission to view this order.");
        } else {
          setError(err?.response?.data?.message || err?.message || "Failed to load order details.");
        }
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, id]);

  // Poll for status updates every 20 seconds (stops on terminal statuses)
  useEffect(() => {
    if (!isAuthenticated || !id || !order) return;

    // Terminal states — no need to poll
    if (TERMINAL_STATUSES.includes(order.status)) {
      setPollingActive(false);
      return;
    }

    setPollingActive(true);

    const intervalId = setInterval(async () => {
      try {
        const res = await consumerAPI.getOrder(id);
        const updatedOrder = res.data.order;
        const prevStatus = previousStatusRef.current;
        const newStatus = updatedOrder.status;

        // Update the order data regardless
        setOrder(updatedOrder);

        // Detect status change and notify
        if (prevStatus && prevStatus !== newStatus) {
          previousStatusRef.current = newStatus;
          const config = getStatusConfig(newStatus);
          showSuccess(`Order status updated to "${config.label}"`);

          // If new status is terminal, stop polling
          if (TERMINAL_STATUSES.includes(newStatus)) {
            setPollingActive(false);
            clearInterval(intervalId);
          }
        }
      } catch {
        // Silent failure — don't disrupt the user experience
      }
    }, 20000);

    return () => {
      clearInterval(intervalId);
      setPollingActive(false);
    };
  }, [isAuthenticated, id, order?.status]);

  // Loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-margin-mobile">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Oops!</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push("/orders")}
              className="px-xl py-md border border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container transition-all"
            >
              Back to Orders
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all active:scale-95"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!order) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto bg-surface-container-high rounded-full flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">search_off</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Order not found</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">The order you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/orders"
            className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const sc = getStatusConfig(order.status);
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "?";
  const currentStatusIdx = STATUS_ORDER.indexOf(order.status);

  /* ─── Render ──────────────────────────────── */
  return (
    <div className="min-h-screen bg-surface">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col p-lg gap-sm h-screen w-64 fixed left-0 top-0 bg-surface border-r border-outline-variant z-40">
        <div className="mb-xl px-sm">
          <Link href="/profile" className="font-headline-md text-headline-md text-primary hover:underline">My Account</Link>
          <p className="text-on-surface-variant font-label-md">Track your farm orders</p>
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
        <div className="flex items-center gap-lg">
          <Link href="/cart" className="relative text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">shopping_cart</span>
          </Link>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileOpen((p) => !p)}
              className="w-8 h-8 rounded-full bg-primary text-on-primary font-label-md flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
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
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">person</span>My Profile
                  </Link>
                  <Link href="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-on-surface hover:bg-surface-container-high transition-colors font-body-md">
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">receipt_long</span>My Orders
                  </Link>
                </div>
                <div className="border-t border-outline-variant/50 py-1">
                  <button onClick={() => { logout(); router.push("/"); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error/5 transition-colors font-body-md">
                    <span className="material-symbols-outlined text-[20px]">logout</span>Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="lg:ml-64 p-margin-mobile md:p-margin-desktop min-h-[calc(100vh-3.5rem)] pb-16 md:pb-0">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-lg">
            <Link href="/orders" className="hover:text-primary transition-colors inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              Orders
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">{getOrderIdDisplay(order._id)}</span>
          </nav>

          {/* ── Order Header Card ── */}
          <div className="bg-white rounded-xl border border-outline-variant overflow-hidden mb-xl">
            <div className="p-xl md:p-xl">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md mb-lg">
                <div>
                  <h1 className="font-headline-lg text-headline-lg text-primary mb-xs">
                    {getOrderIdDisplay(order._id)}
                  </h1>
                  <p className="text-on-surface-variant font-body-md">
                    Placed on {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold gap-1.5 ${sc.bg} ${sc.text}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {sc.icon}
                    </span>
                    {sc.label}
                  </span>
                  {pollingActive && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-primary-container text-on-primary-container animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      LIVE
                    </span>
                  )}
                </div>
              </div>

              {/* Status Timeline */}
              <div className="border-t border-outline-variant/50 pt-lg">
                <div className="flex items-center justify-between">
                  {STATUS_ORDER.map((s, idx) => {
                    const config = getStatusConfig(s);
                    const isCompleted = idx <= currentStatusIdx && order.status !== "cancelled";
                    const isCancelled = order.status === "cancelled";
                    return (
                      <div key={s} className="flex flex-col items-center flex-1 relative">
                        {/* Connector line */}
                        {idx > 0 && (
                          <div
                            className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-10 ${
                              isCompleted && !isCancelled ? "bg-primary" : "bg-outline-variant"
                            }`}
                          />
                        )}
                        {/* Circle */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isCancelled
                              ? "bg-error-container text-error"
                              : isCompleted
                                ? "bg-primary text-on-primary shadow-sm"
                                : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          {isCompleted && !isCancelled ? (
                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                          ) : isCancelled && s === "pending" ? (
                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
                          ) : (
                            idx + 1
                          )}
                        </div>
                        {/* Label */}
                        <p
                          className={`text-[10px] mt-1.5 text-center leading-tight font-label-sm max-w-[60px] ${
                            isCancelled && s === "pending"
                              ? "text-error"
                              : isCompleted
                                ? "text-primary font-bold"
                                : "text-on-surface-variant"
                          }`}
                        >
                          {config.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Order summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-outline-variant bg-surface-container-low">
              <StatCell label="Items" value={`${order.items.length} product${order.items.length !== 1 ? "s" : ""}`} icon="inventory_2" />
              <StatCell label="Total Amount" value={`₹${order.totalAmount.toLocaleString("en-IN")}`} icon="payments" />
              <StatCell label="Payment" value={order.paymentMethod === "cod" ? "Cash on Delivery" : "Online"} icon={order.paymentMethod === "cod" ? "money" : "credit_card"} />
              <StatCell label="Payment Status" value={order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "pending" ? "Pending" : order.paymentStatus === "failed" ? "Failed" : "Refunded"} icon="account_balance" />
            </div>
          </div>

          {/* ── Two-column layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
            {/* Left column - Items + Notes */}
            <div className="lg:col-span-2 space-y-xl">
              {/* Order Items */}
              <div className="bg-white rounded-xl border border-outline-variant overflow-hidden">
                <div className="p-lg border-b border-outline-variant">
                  <h2 className="font-headline-md text-headline-md text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                    Items Ordered
                  </h2>
                </div>
                <div className="divide-y divide-outline-variant">
                  {order.items.map((item, idx) => {
                    const alreadyReviewed = reviewedProducts.has(item.product._id);
                    return (
                      <div key={idx} className="flex items-center gap-md p-lg hover:bg-surface-container-low/50 transition-colors">
                        {/* Product image placeholder */}
                        <div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0 text-on-surface-variant">
                          <span className="material-symbols-outlined text-[28px]">agriculture</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-label-md text-on-surface truncate">{item.name}</p>
                          <p className="text-label-sm text-on-surface-variant">
                            {item.quantity} × {item.unit} @ ₹{item.price}/{item.unit}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                          <p className="font-bold text-primary">
                            ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </p>
                          {order.status === "delivered" && (
                            alreadyReviewed ? (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-on-surface-variant font-label-sm">
                                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                Reviewed
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setReviewTarget(item);
                                  setReviewRating(0);
                                  setReviewComment("");
                                  setReviewError(null);
                                }}
                                className="inline-flex items-center gap-0.5 text-[11px] text-primary font-label-md hover:underline active:scale-95"
                              >
                                <span className="material-symbols-outlined text-[12px]">rate_review</span>
                                Rate Product
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Total row */}
                <div className="flex justify-between items-center p-lg bg-surface-container-low border-t border-outline-variant">
                  <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Order Total</span>
                  <span className="font-headline-md text-headline-md text-primary">
                    ₹{order.totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="bg-white rounded-xl border border-outline-variant p-lg">
                  <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">notes</span>
                    Order Notes
                  </h3>
                  <p className="text-body-md text-on-surface bg-surface-container-low rounded-lg p-md">{order.notes}</p>
                </div>
              )}

              {/* Delivery Slot */}
              {order.deliverySlot?.date && (
                <div className="bg-white rounded-xl border border-outline-variant p-lg">
                  <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                    Delivery Slot
                  </h3>
                  <div className="bg-surface-container-low rounded-lg p-md flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px] text-primary">calendar_month</span>
                    </div>
                    <div>
                      <p className="font-label-md text-on-surface">{formatDate(order.deliverySlot.date)}</p>
                      <p className="text-label-sm text-on-surface-variant">{order.deliverySlot.timeSlot}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right column - Delivery + Farmer */}
            <div className="space-y-xl">
              {/* Delivery Address */}
              <div className="bg-white rounded-xl border border-outline-variant p-lg">
                <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">location_on</span>
                  Delivery Address
                </h3>
                <div className="space-y-2">
                  <p className="font-label-md text-on-surface">{order.deliveryAddress.fullName}</p>
                  <p className="text-body-md text-on-surface-variant">{order.deliveryAddress.phone}</p>
                  <div className="bg-surface-container-low rounded-lg p-md mt-sm">
                    <p className="text-body-md text-on-surface">{order.deliveryAddress.street}</p>
                    <p className="text-body-md text-on-surface">
                      {order.deliveryAddress.city}, {order.deliveryAddress.state}
                    </p>
                    <p className="text-body-md text-on-surface">Pincode: {order.deliveryAddress.pincode}</p>
                  </div>
                </div>
              </div>

              {/* Farmer Info */}
              <div className="bg-white rounded-xl border border-outline-variant p-lg">
                <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">store</span>
                  Farm / Producer
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[22px] text-primary">agriculture</span>
                  </div>
                  <div>
                    <p className="font-label-md text-on-surface">{order.farmer?.farmName || order.farmer?.name || "Unknown Farm"}</p>
                    <p className="text-label-sm text-on-surface-variant">{order.farmer?.name}</p>
                    {order.farmer?.phone && (
                      <a href={`tel:${order.farmer.phone}`} className="text-label-sm text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        {order.farmer.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Re-order for cancelled orders */}
              {order.status === "cancelled" && (
                <div className="bg-white rounded-xl border border-outline-variant p-lg">
                  <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">replay</span>
                    Re-order
                  </h3>
                  <p className="text-body-md text-on-surface-variant mb-md">
                    Add all {order.items.length} item{order.items.length !== 1 ? "s" : ""} from this cancelled order back to your cart.
                  </p>
                  <button
                    onClick={() => {
                      order.items.forEach((item) => {
                        addItem(
                          {
                            productId: item.product._id,
                            name: item.name,
                            price: item.price,
                            unit: item.unit,
                            image: item.product.images?.[0] || "",
                            farmerId: order.farmer._id,
                            farmerName: order.farmer.farmName || order.farmer.name,
                            isOrganic: false,
                            isAvailable: true,
                            maxQuantity: 99,
                          },
                          item.quantity
                        );
                      });
                      showSuccess("Items have been added to your cart.");
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                    Add All to Cart
                  </button>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-outline-variant p-lg">
                <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">quick_buttons</span>
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <Link
                    href="/orders"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Back to Orders
                  </Link>
                  <Link
                    href="/marketplace"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">storefront</span>
                    Continue Shopping
                  </Link>
                  {(order.status === "pending" || order.status === "confirmed") && (
                    <button
                      onClick={() => setShowCancelDialog(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-error text-error font-label-md rounded-xl hover:bg-error/5 transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Review Modal ── */}
      {reviewTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submittingReview && setReviewTarget(null)} />
          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-xl animate-slideDown">
            {/* Header */}
            <div className="flex items-center justify-between mb-lg">
              <h3 className="font-headline-md text-headline-md text-primary">Rate Product</h3>
              <button onClick={() => setReviewTarget(null)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Product name */}
            <div className="flex items-center gap-3 mb-lg p-md bg-surface-container-low rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">agriculture</span>
              </div>
              <div>
                <p className="font-label-md text-on-surface">{reviewTarget.name}</p>
                <p className="text-label-sm text-on-surface-variant">{reviewTarget.quantity} {reviewTarget.unit} &middot; ₹{reviewTarget.price}/{reviewTarget.unit}</p>
              </div>
            </div>

            {/* Star rating */}
            <div className="mb-lg">
              <p className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs mb-md">Your Rating</p>
              <div className="flex items-center gap-0.5 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    onMouseEnter={() => setReviewHover(star)}
                    onMouseLeave={() => setReviewHover(0)}
                    className="p-1 transition-transform hover:scale-110 active:scale-90"
                  >
                    <span
                      className="material-symbols-outlined text-[36px]"
                      style={{
                        fontVariationSettings: "'FILL' 1",
                        color:
                          star <= (reviewHover || reviewRating)
                            ? "#f59e0b"
                            : "#d1d5db",
                        transition: "color 0.15s ease",
                      }}
                    >
                      star
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-center text-label-sm text-on-surface-variant mt-1">
                {reviewRating === 1 && "Poor"}
                {reviewRating === 2 && "Below Average"}
                {reviewRating === 3 && "Average"}
                {reviewRating === 4 && "Good"}
                {reviewRating === 5 && "Excellent"}
                {reviewRating === 0 && "Tap a star to rate"}
              </p>
            </div>

            {/* Comment */}
            <div className="mb-lg">
              <label className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs block mb-sm">
                Comment <span className="text-on-surface-variant/60">(optional)</span>
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 border border-outline-variant rounded-xl bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
              />
              <p className="text-right text-label-sm text-on-surface-variant/60 mt-1">{reviewComment.length}/500</p>
            </div>

            {/* Error */}
            {reviewError && (
              <div className="mb-md p-md rounded-xl bg-error-container text-on-error-container border border-error/20 flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{reviewError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setReviewTarget(null)}
                disabled={submittingReview}
                className="flex-1 px-6 py-3 border border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container transition-all disabled:opacity-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview || reviewRating === 0}
                className="flex-1 px-6 py-3 bg-[#f59e0b] text-white font-label-md rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 inline-flex items-center justify-center gap-2"
              >
                {submittingReview ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    Submit Review
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Dialog ── */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !cancelling && setShowCancelDialog(false)} />
          {/* Dialog */}
          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-xl animate-slideDown">
            {/* Icon */}
            <div className="w-14 h-14 mx-auto rounded-full bg-error-container flex items-center justify-center mb-lg">
              <span className="material-symbols-outlined text-[32px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
            </div>

            <h3 className="font-headline-md text-headline-md text-primary text-center mb-sm">Cancel Order?</h3>
            <p className="text-body-md text-on-surface-variant text-center mb-lg max-w-sm mx-auto">
              Are you sure you want to cancel <strong>{getOrderIdDisplay(order._id)}</strong>?
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
                onClick={() => { setShowCancelDialog(false); setCancelError(null); }}
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
      {/* ── Mobile Bottom Nav ── */}
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

/* ─── Stat Cell ──────────────────────────────── */
function StatCell({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 p-lg border-r border-outline-variant last:border-r-0">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-label-sm text-on-surface-variant uppercase tracking-wider truncate">{label}</p>
        <p className="font-label-md text-on-surface truncate">{value}</p>
      </div>
    </div>
  );
}
