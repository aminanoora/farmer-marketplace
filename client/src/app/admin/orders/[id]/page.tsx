"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI, getApiErrorMessage, getApiErrorStatus } from "@/lib/api";
import { formatCurrency, formatDate, formatTime, getInitials, getOrderIdDisplay } from "@shared/utils";

/* ─── Types ────────────────────────────────── */

interface OrderProduct {
  _id: string; name: string; images?: string[];
}

interface OrderItemDetail {
  product: OrderProduct; name: string; price: number;
  quantity: number; unit: string;
}

interface OrderUser {
  _id: string; name: string; phone?: string; email?: string; farmName?: string;
}

interface DeliveryAddress {
  fullName: string; phone: string; street: string;
  city: string; state: string; pincode: string;
}

interface OrderDetail {
  _id: string; consumer: OrderUser; farmer: OrderUser;
  items: OrderItemDetail[]; totalAmount: number;
  status: string; deliverySlot?: { date: string; timeSlot: string };
  paymentMethod: string; paymentStatus: string;
  deliveryAddress: DeliveryAddress; trackingId?: string; notes?: string;
  createdAt: string; updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  delivered:         { label: "Delivered",       icon: "check_circle",   bg: "bg-primary-fixed",       text: "text-on-primary-fixed-variant" },
  "out-for-delivery":{ label: "Out for Delivery",icon: "local_shipping", bg: "bg-secondary-container", text: "text-on-secondary-container" },
  preparing:         { label: "Preparing",       icon: "cooking",        bg: "bg-tertiary-fixed",      text: "text-on-tertiary-fixed-variant" },
  confirmed:         { label: "Confirmed",       icon: "check_circle",   bg: "bg-primary-fixed-dim",   text: "text-on-primary-fixed-variant" },
  pending:           { label: "Pending",         icon: "schedule",       bg: "bg-surface-container-highest", text: "text-on-surface-variant" },
  cancelled:         { label: "Cancelled",       icon: "cancel",         bg: "bg-error-container",     text: "text-on-error-container" },
};

const STATUS_ORDER = ["pending", "confirmed", "preparing", "out-for-delivery", "delivered"];

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}





export default function AdminOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [detailsUpdating, setDetailsUpdating] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

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
    if (!isAuthenticated || !id || user?.role !== "admin") return;
    setLoading(true); setError(null);
    adminAPI.getOrder(id)
      .then((res) => {
        setOrder(res.data.order);
        setNewStatus(res.data.order.status);
        setTrackingId(res.data.order.trackingId || "");
        setInternalNotes(res.data.order.notes || "");
      })
      .catch((err) => {
        if (getApiErrorStatus(err) === 404) setError("Order not found.");
        else setError(getApiErrorMessage(err, "Failed to load order."));
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, id, user?.role]);

  const handleUpdateStatus = async () => {
    if (!order || !newStatus || newStatus === order.status) return;
    setStatusUpdating(true); setStatusError(null); setStatusMessage(null);
    try {
      const res = await adminAPI.updateOrderStatus(order._id, newStatus);
      setOrder(res.data.order);
      setTrackingId(res.data.order.trackingId || "");
      setInternalNotes(res.data.order.notes || "");
      setStatusMessage("Order status updated to \"" + getStatusConfig(newStatus).label + "\".");
      setConfirmStatus(null);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      setStatusError(getApiErrorMessage(err, "Failed to update order status."));
    } finally { setStatusUpdating(false); }
  };

  const handleSaveDetails = async () => {
    if (!order) return;
    setDetailsUpdating(true); setStatusError(null); setStatusMessage(null);
    try {
      const res = await adminAPI.updateOrderDetails(order._id, {
        trackingId: trackingId.trim() || undefined,
        notes: internalNotes.trim() || undefined,
      });
      setOrder(res.data.order);
      setStatusMessage("Tracking ID and notes saved.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      setStatusError(getApiErrorMessage(err, "Failed to save details."));
    } finally { setDetailsUpdating(false); }
  };

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

  if (!user || user.role !== "admin") return null;

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-margin-mobile">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Order not found</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <Link href="/admin/orders" className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const sc = getStatusConfig(order.status);
  const currentStatusIdx = STATUS_ORDER.indexOf(order.status);
  const customerInitials = getInitials(order.consumer?.name || "");
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
        <main className="flex-1 px-margin-mobile md:px-margin-desktop py-8 max-w-[1400px]">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-6">
          <Link href="/admin/orders" className="hover:text-primary transition-colors">Orders</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-on-surface">{getOrderIdDisplay(order._id, "ORD")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h2 className="font-headline-lg text-headline-lg text-primary">Order {getOrderIdDisplay(order._id, "ORD")}</h2>
              <span className={"inline-flex items-center px-3 py-1 rounded-full font-label-sm text-label-sm gap-1 " + sc.bg + " " + sc.text}>
                <span className={"w-2 h-2 rounded-full " + (order.status === "pending" || order.status === "out-for-delivery" ? "bg-current animate-pulse" : "bg-current")}></span>
                {sc.label}
              </span>
            </div>
            <p className="text-on-surface-variant font-body-md text-body-md">Placed on {formatDate(order.createdAt)} at {formatTime(order.createdAt)}</p>
          </div>
          <div className="flex gap-3">
            <button className="px-6 py-3 border-2 border-secondary text-secondary font-label-md rounded-lg hover:bg-secondary-container transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined">print</span>Print Invoice
            </button>
            <button onClick={() => setConfirmStatus(newStatus)} disabled={statusUpdating || !newStatus || newStatus === order.status}
              className="px-6 py-3 bg-primary text-white font-label-md rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined">save</span>
              {statusUpdating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Status message */}
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

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">

          {/* ── Left: Items + Status Management ── */}
          <div className="lg:col-span-8 space-y-gutter">

            {/* Order Items Table */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="font-headline-md text-headline-md mb-6 text-primary border-b border-outline-variant pb-4">Order Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-on-surface-variant border-b border-outline-variant">
                      <th className="pb-4 font-label-md">Product</th>
                      <th className="pb-4 font-label-md text-center">Qty</th>
                      <th className="pb-4 font-label-md text-right">Unit Price</th>
                      <th className="pb-4 font-label-md text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {order.items.map((item, idx) => {
                      const itemTotal = item.price * item.quantity;
                      return (
                        <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-6">
                            <div className="flex items-center gap-4">
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-surface-container flex-shrink-0 flex items-center justify-center">
                                {item.product.images?.[0] ? (
                                  <Image fill sizes="64px" src={item.product.images[0]} alt={item.name} className="object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-on-surface-variant">agriculture</span>
                                )}
                              </div>
                              <div>
                                <p className="font-label-md text-on-surface">{item.name}</p>
                                <p className="text-label-sm text-on-surface-variant">{item.unit} per unit</p>
                                {item.product.name && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-bold uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-[12px]">eco</span> Organic
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-6 text-center font-medium">{item.quantity}</td>
                          <td className="py-6 text-right">{formatCurrency(item.price)}</td>
                          <td className="py-6 text-right font-bold">{formatCurrency(itemTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-8 pt-6 border-t border-outline flex justify-end">
                <div className="w-full max-w-xs space-y-3">
                  <div className="flex justify-between text-on-surface-variant font-label-md">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant font-label-md">
                    <span>Delivery Fee</span>
                    <span>Free</span>
                  </div>
                  <div className="flex justify-between text-primary font-bold text-headline-md pt-2 border-t border-outline-variant">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Management */}
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
              <h3 className="font-headline-md text-headline-md mb-6 text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">edit_note</span>
                Order Status Management
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">Change Order Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full h-14 bg-white border-2 border-outline-variant rounded-lg px-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer">
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="preparing">Preparing</option>
                    <option value="out-for-delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">Update Carrier Tracking</label>
                  <div className="relative">
                    <input value={trackingId} onChange={(e) => setTrackingId(e.target.value)}
                      className="w-full h-14 bg-white border-2 border-outline-variant rounded-lg px-4 focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Tracking ID (e.g. KR-921822)" type="text" />
                    <span className="material-symbols-outlined absolute right-4 top-4 text-on-surface-variant">local_shipping</span>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">Internal Notes (Visible only to Admins)</label>
                  <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
                    className="w-full bg-white border-2 border-outline-variant rounded-lg p-4 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Add details about farmer coordination or packaging issues..." rows={3}></textarea>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button onClick={handleSaveDetails} disabled={detailsUpdating}
                    className="px-6 py-3 bg-primary text-white font-label-md rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50">
                    <span className="material-symbols-outlined">save</span>
                    {detailsUpdating ? "Saving..." : "Save Details"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Customer + Details + Timeline ── */}
          <div className="lg:col-span-4 space-y-gutter">

            {/* Customer Information */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="font-headline-md text-headline-md text-primary">Customer</h3>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">{customerInitials}</div>
                <div>
                  <p className="font-label-md text-on-surface">{order.consumer?.name || "Unknown"}</p>
                  <p className="text-label-sm text-on-surface-variant">{order.createdAt ? "Customer since " + new Date(order.createdAt).getFullYear() : ""}</p>
                </div>
              </div>
              <div className="space-y-4 border-t border-outline-variant pt-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">call</span>
                  <div>
                    <p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Phone</p>
                    <p className="text-body-md text-on-surface">{order.consumer?.phone || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">mail</span>
                  <div>
                    <p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Email</p>
                    <p className="text-body-md text-on-surface">{order.consumer?.email || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">location_on</span>
                  <div>
                    <p className="text-label-sm font-label-sm text-on-surface-variant uppercase">Shipping Address</p>
                    <p className="text-body-md text-on-surface">{order.deliveryAddress?.street}, {order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.pincode}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment & Fulfillment */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="font-headline-md text-headline-md mb-6 text-primary border-b border-outline-variant pb-4">Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant uppercase mb-1">Payment Method</p>
                  <div className="flex items-center gap-2 text-on-surface font-label-md">
                    <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                    {order.paymentMethod === "cod" ? "Cash on Delivery" : "Online"}
                    {order.paymentStatus === "paid" ? " (Paid)" : order.paymentStatus === "pending" ? " (Pending)" : " (" + order.paymentStatus + ")"}
                  </div>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant uppercase mb-1">Fulfillment</p>
                  <div className="flex items-center gap-2 text-on-surface font-label-md">
                    <span className="material-symbols-outlined text-primary">box</span>
                    Standard Delivery (2-3 Days)
                  </div>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant uppercase mb-1">Farmer</p>
                  <div className="flex items-center gap-2 text-on-surface font-label-md">
                    <span className="material-symbols-outlined text-primary">store</span>
                    {order.farmer?.farmName || order.farmer?.name || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Order History Timeline */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="font-headline-md text-headline-md mb-6 text-primary">Order History</h3>
              <div className="relative space-y-8" style={{ paddingLeft: "1rem" }}>
                <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-outline-variant" />
                {STATUS_ORDER.map((s, idx) => {
                  const config = getStatusConfig(s);
                  const isCompleted = idx <= currentStatusIdx && order.status !== "cancelled";
                  const isCancelled = order.status === "cancelled";
                  const isCurrent = s === order.status;
                  return (
                    <div key={s} className="relative flex items-start gap-4">
                      <div className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-full z-10 shadow-sm ' + (isCancelled && s === 'pending' ? 'bg-error text-white' : isCompleted ? 'bg-primary text-white' : isCurrent && !isCancelled ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-4 border-white' : 'bg-outline-variant text-on-surface-variant border-4 border-white')}>
                        {isCancelled && s === "pending" ? (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
                        ) : isCompleted ? (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                        ) : isCurrent ? (
                          <span className="material-symbols-outlined text-sm">{config.icon}</span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">{config.icon}</span>
                        )}
                      </div>
                      <div>
                        <p className={'font-label-md ' + (isCompleted && !isCancelled ? 'text-on-surface' : isCancelled && s === 'pending' ? 'text-error' : 'text-on-surface')}>{config.label}</p>
                        <p className="text-label-sm text-on-surface-variant">{isCompleted ? "Completed" : isCurrent ? "Current" : "Pending"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="w-full mt-6 py-3 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container transition-colors">
                View Full Activity Log
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

      {/* ── Confirmation Modal — Status Change ── */}
      {confirmStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmStatus(null)} />
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-8 max-w-md w-full mx-4 animate-slideDown">
            <div className="flex flex-col items-center text-center gap-4">
              <div className={"w-16 h-16 rounded-full flex items-center justify-center " + (confirmStatus === "cancelled" ? "bg-error-container" : "bg-primary-fixed")}>
                <span className={"material-symbols-outlined text-[36px] " + (confirmStatus === "cancelled" ? "text-error" : "text-primary")} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {confirmStatus === "cancelled" ? "cancel" : confirmStatus === "delivered" ? "check_circle" : confirmStatus === "out-for-delivery" ? "local_shipping" : confirmStatus === "preparing" ? "cooking" : "edit_note"}
                </span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-primary">Change Order Status</h3>
                <p className="text-on-surface-variant font-body-md mt-2">
                  This will change the order status from <strong>&quot;{getStatusConfig(order.status).label}&quot;</strong> to <strong>&quot;{getStatusConfig(confirmStatus).label}&quot;</strong>.
                  {confirmStatus === "cancelled"
                    ? " The customer will be notified and a refund may be initiated. This action cannot be undone."
                    : " The customer will be notified of the update."}
                  Are you sure?
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => setConfirmStatus(null)} disabled={statusUpdating}
                  className="flex-1 px-6 py-3 border-2 border-outline-variant text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container transition-colors">
                  Cancel
                </button>
                <button onClick={handleUpdateStatus} disabled={statusUpdating}
                  className={"flex-1 px-6 py-3 rounded-xl font-label-md text-white transition-all disabled:opacity-50 " + (confirmStatus === "cancelled" ? "bg-error hover:bg-error/90" : "bg-primary hover:opacity-90")}>
                  {statusUpdating ? "Processing..." : "Yes, " + (confirmStatus === "cancelled" ? "Cancel" : "Update")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
