"use client";

import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";
import { farmerAPI } from "@/lib/api";

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
  trackingId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Status helpers ─────────────────────────── */
const ORDER_STATUSES: OrderDetail["status"][] = [
  "pending",
  "confirmed",
  "preparing",
  "out-for-delivery",
  "delivered",
  "cancelled",
];

const STATUS_ORDER: OrderDetail["status"][] = [
  "pending",
  "confirmed",
  "preparing",
  "out-for-delivery",
  "delivered",
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

/* ─── Format helpers ─────────────────────────── */
function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderIdDisplay(id: string): string {
  return "#KM-" + id.slice(-5).toUpperCase();
}

function getInitials(name: string): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Sub-components ─────────────────────────── */
function DetailItem({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
        <div className="text-body-md text-on-surface mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

function PaymentBadge({ method, status }: { method: OrderDetail["paymentMethod"]; status: OrderDetail["paymentStatus"] }) {
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

/* ─── Page ───────────────────────────────────── */
export default function FarmerOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  // Redirect if not a farmer
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/auth/login?redirect=/farmer/orders/${id}`);
      } else if (user?.role !== "farmer") {
        router.push(user?.role === "admin" ? "/admin/dashboard" : "/");
      }
    }
  }, [authLoading, isAuthenticated, user, router, id]);

  // Fetch order
  useEffect(() => {
    if (!isAuthenticated || !id || user?.role !== "farmer") return;
    setLoading(true);
    setError(null);
    farmerAPI
      .getOrder(id)
      .then((res) => {
        setOrder(res.data.order);
        setNewStatus(res.data.order.status);
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
  }, [isAuthenticated, id, user?.role]);

  // Apply status update
  const handleApplyStatus = async () => {
    if (!order || !newStatus || newStatus === order.status) return;
    setStatusUpdating(true);
    setStatusError(null);
    setStatusMessage(null);
    try {
      const res = await farmerAPI.updateOrderStatus(order._id, newStatus);
      setOrder(res.data.order);
      setNewStatus(res.data.order.status);
      setConfirmStatus(null);
      showSuccess(`Order ${getOrderIdDisplay(order._id)} marked as "${getStatusStyle(newStatus).label}".`);
      setStatusMessage(`Order status updated to "${getStatusStyle(newStatus).label}".`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to update order status.";
      setStatusError(msg);
      showError(msg);
    } finally {
      setStatusUpdating(false);
    }
  };

  const subtotal = useMemo(
    () => (order ? order.items.reduce((sum, i) => sum + i.price * i.quantity, 0) : 0),
    [order]
  );

  /* ─── Loading ─── */
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "farmer") return null;

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-2">Order not found</h2>
          <p className="text-on-surface-variant font-body-md mb-8">{error}</p>
          <Link
            href="/farmer/orders"
            className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const ss = getStatusStyle(order.status);
  const currentStatusIdx = STATUS_ORDER.indexOf(order.status);
  const customerInitials = getInitials(order.consumer?.name || "");
  const canManage = order.status !== "cancelled" && order.status !== "delivered";

  return (
    <div className="max-w-6xl mx-auto">
      {/* ─── Breadcrumb ─── */}
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-6 flex-wrap print:hidden">
        <Link href="/farmer/orders" className="hover:text-primary transition-colors inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          Orders
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-primary font-bold">{getOrderIdDisplay(order._id)}</span>
      </nav>

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="font-headline-lg text-headline-lg text-primary">{getOrderIdDisplay(order._id)}</h1>
            <span className={`px-3 py-1 rounded-full text-[12px] font-bold inline-flex items-center gap-1 ${ss.bg} ${ss.text}`}>
              <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {ss.icon}
              </span>
              {ss.label}
            </span>
          </div>
          <p className="text-on-surface-variant">
            Placed on {formatDate(order.createdAt)} at {formatTime(order.createdAt)} ·{" "}
            {order.consumer?.name || "Customer"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 border-2 border-secondary text-secondary font-label-md rounded-lg hover:bg-secondary-container transition-colors flex items-center gap-2 active:scale-95 print:hidden"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print Receipt
          </button>
          <Link
            href="/farmer/orders"
            className="px-5 py-2.5 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container transition-colors flex items-center gap-2 print:hidden"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            All Orders
          </Link>
        </div>
      </div>

      {/* ─── Status messages ─── */}
      {statusMessage && (
        <div className="mb-6 p-4 rounded-xl bg-primary-fixed/40 text-on-primary-fixed-variant border border-primary/20 flex items-center gap-3 animate-slideDown print:hidden">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <span className="font-label-md">{statusMessage}</span>
        </div>
      )}
      {statusError && (
        <div className="mb-6 p-4 rounded-xl bg-error-container text-on-error-container border border-error/20 flex items-center gap-3 animate-slideDown print:hidden">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span className="font-label-md">{statusError}</span>
        </div>
      )}

      {/* ─── Status Management (not printed) ─── */}
      <div className="mb-8 bg-white rounded-2xl border border-outline-variant p-5 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">sync_alt</span>
            <span className="font-label-md text-label-md">Update status:</span>
          </div>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            disabled={!canManage}
            className="flex-1 sm:flex-none sm:w-56 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-label-md text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {getStatusStyle(s).label}
              </option>
            ))}
          </select>
          {canManage && newStatus && newStatus !== order.status && (
            <button
              onClick={() => setConfirmStatus(newStatus)}
              disabled={statusUpdating}
              className="px-5 py-2 bg-primary text-on-primary font-label-md rounded-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {statusUpdating ? (
                <>
                  <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Save Status
                </>
              )}
            </button>
          )}
          {!canManage && (
            <span className="text-label-sm text-on-surface-variant">
              {order.status === "cancelled" ? "This order was cancelled and can no longer be updated." : "This order is complete."}
            </span>
          )}
        </div>

        {/* Status timeline */}
        <div className="mt-6 border-t border-outline-variant pt-5">
          <div className="flex items-center justify-between">
            {STATUS_ORDER.map((s, idx) => {
              const config = getStatusStyle(s);
              const isCompleted = idx <= currentStatusIdx && order.status !== "cancelled";
              const isCancelled = order.status === "cancelled";
              return (
                <div key={s} className="flex flex-col items-center flex-1 relative">
                  {idx > 0 && (
                    <div
                      className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-10 ${
                        isCompleted && !isCancelled ? "bg-primary" : "bg-outline-variant"
                      }`}
                    />
                  )}
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

      {/* ─── Main Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        {/* Left: Items */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="font-headline-md text-headline-md text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                Items Ordered
              </h2>
            </div>
            <div className="divide-y divide-outline-variant">
              {order.items.map((item, idx) => (
                <div key={`${item.product._id}-${idx}`} className="flex items-center gap-4 p-5">
                  <div className="relative w-14 h-14 rounded-xl bg-surface-container-high overflow-hidden flex items-center justify-center flex-shrink-0 text-on-surface-variant">
                    {item.product?.images?.[0] ? (
                      <Image
                        fill
                        sizes="56px"
                        src={item.product.images[0]}
                        alt={item.name}
                        className="object-cover"
                        onError={(e) => {
                          // Avoid infinite loop: only swap once per broken image
                          const el = e.currentTarget;
                          if (el.dataset.fb) return;
                          el.dataset.fb = "1";
                          el.onerror = null;
                          el.style.display = "none";
                          el.parentElement?.classList.add("bg-surface-container-high");
                          el.parentElement?.classList.add("text-on-surface-variant");
                          const icon = document.createElement("span");
                          icon.className = "material-symbols-outlined text-[28px]";
                          icon.textContent = "agriculture";
                          el.parentElement?.appendChild(icon);
                        }}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[28px]">agriculture</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-on-surface truncate">{item.name}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      {item.quantity} × {item.unit} @ {formatCurrency(item.price)}
                    </p>
                  </div>
                  <span className="font-bold text-on-tertiary-container whitespace-nowrap">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant">
              <div className="flex justify-between text-on-surface-variant font-label-md mb-1">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant font-label-md mb-3">
                <span>Delivery Fee</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-outline-variant">
                <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Order Total</span>
                <span className="font-headline-md text-headline-md text-primary">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="bg-white rounded-2xl border border-outline-variant p-6">
              <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">notes</span>
                Order Notes
              </h3>
              <p className="text-body-md text-on-surface bg-surface-container-low rounded-lg p-4">{order.notes}</p>
            </div>
          )}

          {order.deliverySlot?.date && (
            <div className="bg-white rounded-2xl border border-outline-variant p-6">
              <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                Delivery Slot
              </h3>
              <div className="bg-surface-container-low rounded-lg p-4 flex items-center gap-3">
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

        {/* Right: Customer + Details */}
        <div className="lg:col-span-4 space-y-6">
          {/* Customer */}
          <div className="bg-white rounded-2xl border border-outline-variant p-6">
            <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">person</span>
              Customer
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm flex-shrink-0">
                {customerInitials}
              </div>
              <div className="min-w-0">
                <p className="font-label-md text-on-surface truncate">{order.consumer?.name || "Unknown"}</p>
                {order.consumer?.phone && <p className="text-label-sm text-on-surface-variant">{order.consumer.phone}</p>}
              </div>
            </div>
            <PaymentBadge method={order.paymentMethod} status={order.paymentStatus} />
          </div>

          {/* Delivery address */}
          <div className="bg-white rounded-2xl border border-outline-variant p-6">
            <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">location_on</span>
              Delivery Address
            </h3>
            <div className="space-y-2">
              <p className="font-label-md text-on-surface">{order.deliveryAddress?.fullName || "Customer"}</p>
              <p className="text-label-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">call</span>
                {order.deliveryAddress?.phone || "No phone"}
              </p>
              <div className="bg-surface-container-low rounded-lg p-3 mt-2">
                <p className="text-body-md text-on-surface">{order.deliveryAddress?.street}</p>
                <p className="text-body-md text-on-surface">
                  {order.deliveryAddress?.city}, {order.deliveryAddress?.state}
                </p>
                <p className="text-body-md text-on-surface">Pincode: {order.deliveryAddress?.pincode}</p>
              </div>
            </div>
          </div>

          {/* Order info */}
          <div className="bg-white rounded-2xl border border-outline-variant p-6">
            <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">info</span>
              Order Info
            </h3>
            <div className="space-y-3">
              <DetailItem icon="calendar_month" label="Placed on" value={`${formatDate(order.createdAt)} at ${formatTime(order.createdAt)}`} />
              <DetailItem icon="update" label="Last update" value={formatDate(order.updatedAt)} />
              <DetailItem
                icon="payments"
                label="Payment"
                value={
                  <span className="capitalize">
                    {order.paymentMethod === "cod" ? "Cash on Delivery" : "Online"}
                    {" · "}
                    {order.paymentStatus}
                  </span>
                }
              />
              <DetailItem
                icon="local_shipping"
                label="Fulfillment"
                value="Standard Delivery (2-3 days)"
              />
              {order.trackingId && (
                <DetailItem icon="qr_code_2" label="Tracking" value={order.trackingId} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Confirmation Dialog ─── */}
      {confirmStatus && order && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="status-confirm-title">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !statusUpdating && setConfirmStatus(null)} />
          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-8 animate-slideDown">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
              confirmStatus === "cancelled" ? "bg-error-container" : "bg-primary-fixed"
            }`}>
              <span
                className={`material-symbols-outlined text-[32px] ${confirmStatus === "cancelled" ? "text-error" : "text-primary"}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {confirmStatus === "cancelled" ? "cancel" : getStatusStyle(confirmStatus).icon}
              </span>
            </div>
            <h3 id="status-confirm-title" className="font-headline-md text-headline-md text-primary text-center mb-2">Update Order Status</h3>
            <p className="text-body-md text-on-surface-variant text-center mb-6 max-w-sm mx-auto">
              Change status from <strong>{getStatusStyle(order.status).label}</strong> to{" "}
              <strong>{getStatusStyle(confirmStatus).label}</strong>?
              {confirmStatus === "cancelled"
                ? " The customer will be notified. This action cannot be undone."
                : " The customer will be notified of the update."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConfirmStatus(null)}
                disabled={statusUpdating}
                className="flex-1 px-6 py-3 border border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container transition-all disabled:opacity-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyStatus}
                disabled={statusUpdating}
                className={`flex-1 px-6 py-3 rounded-xl font-label-md text-white transition-all disabled:opacity-50 active:scale-95 ${
                  confirmStatus === "cancelled" ? "bg-error hover:opacity-90" : "bg-primary hover:opacity-90"
                }`}
              >
                {statusUpdating ? "Updating..." : `Yes, Mark ${getStatusStyle(confirmStatus).label}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Printable Receipt ─── */}
      <div className="print-receipt hidden print:block">
        <div className="bg-white text-black max-w-2xl mx-auto p-10">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-6 mb-6">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wide">Krishi Market</h2>
              <p className="text-sm mt-1">Direct from local farms to your table</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">Order Receipt</p>
              <p className="text-xs text-neutral-600">{getOrderIdDisplay(order._id)}</p>
              <p className="text-xs text-neutral-600">{formatDate(order.createdAt)}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
            <div>
              <p className="font-bold uppercase text-[11px] tracking-wider text-neutral-600 mb-1">Sold By</p>
              <p className="font-bold">{order.farmer?.farmName || order.farmer?.name || "Farmer"}</p>
              <p className="text-neutral-700">{order.farmer?.name}</p>
            </div>
            <div>
              <p className="font-bold uppercase text-[11px] tracking-wider text-neutral-600 mb-1">Bill To</p>
              <p className="font-bold">{order.deliveryAddress?.fullName || order.consumer?.name}</p>
              <p className="text-neutral-700">{order.deliveryAddress?.street}</p>
              <p className="text-neutral-700">
                {order.deliveryAddress?.city}, {order.deliveryAddress?.state} — {order.deliveryAddress?.pincode}
              </p>
              <p className="text-neutral-700">{order.deliveryAddress?.phone}</p>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-2 font-bold uppercase text-[11px] tracking-wider">Item</th>
                <th className="text-center py-2 font-bold uppercase text-[11px] tracking-wider">Qty</th>
                <th className="text-right py-2 font-bold uppercase text-[11px] tracking-wider">Rate</th>
                <th className="text-right py-2 font-bold uppercase text-[11px] tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300">
              {order.items.map((item, idx) => (
                <tr key={`${item.product._id}-${idx}`}>
                  <td className="py-3">{item.name}</td>
                  <td className="py-3 text-center">{item.quantity} {item.unit}</td>
                  <td className="py-3 text-right">{formatCurrency(item.price)}</td>
                  <td className="py-3 text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Delivery Fee</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between font-black text-base pt-2 border-t-2 border-black">
                <span>Total</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-600 pt-1">
                <span>Payment</span>
                <span className="capitalize">
                  {order.paymentMethod === "cod" ? "Cash on Delivery" : "Online"} ({order.paymentStatus})
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-300 pt-4 text-center text-xs text-neutral-500">
            <p>
              Status: <span className="font-bold text-black">{getStatusStyle(order.status).label}</span>
              {order.deliverySlot?.date && (
                <> · Delivery {formatDate(order.deliverySlot.date)} {order.deliverySlot.timeSlot}</>
              )}
            </p>
            <p className="mt-1">Thank you for supporting local farmers! 🌾</p>
          </div>
        </div>
      </div>
    </div>
  );
}
