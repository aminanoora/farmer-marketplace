"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI, getApiErrorMessage, getApiErrorStatus } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, getInitials, getOrderIdDisplay } from "@shared/utils";

/* ─── Types ────────────────────────────────── */

interface DeliveryOrderConsumer {
  _id: string; name: string; phone?: string; email?: string;
}
interface DeliveryOrderFarmer {
  _id: string; name: string; farmName?: string; phone?: string;
}
interface DeliveryOrderItem {
  product: { _id: string; name: string; images?: string[] };
  quantity: number;
  price: number;
}
interface DeliveryOrder {
  _id: string;
  totalAmount: number;
  status: string;
  items: DeliveryOrderItem[];
  consumer: DeliveryOrderConsumer;
  farmer: DeliveryOrderFarmer;
  deliveryAddress?: { street: string; city: string; state: string; pincode: string };
  createdAt: string;
}

interface Delivery {
  _id: string;
  order: DeliveryOrder;
  partnerName: string;
  partnerPhone: string;
  vehicleNumber?: string;
  status: "assigned" | "picked-up" | "in-transit" | "delivered" | "failed";
  estimatedDelivery: string;
  actualDelivery?: string;
  pickupLocation?: string;
  deliveryLocation: { street: string; city: string; state: string; pincode: string };
  trackingNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Constants ─────────────────────────────── */

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; dot: string; icon: string }> = {
  assigned:   { label: "Assigned",   bg: "bg-surface-container-highest", text: "text-on-surface-variant", dot: "bg-outline", icon: "assignment_ind" },
  "picked-up": { label: "Picked Up", bg: "bg-secondary-container",      text: "text-on-secondary-container", dot: "bg-secondary", icon: "inventory_2" },
  "in-transit":{ label: "In Transit", bg: "bg-tertiary-fixed",          text: "text-on-tertiary-fixed-variant", dot: "bg-tertiary-container", icon: "local_shipping" },
  delivered:   { label: "Delivered",  bg: "bg-primary-fixed",            text: "text-on-primary-fixed-variant", dot: "bg-primary-container", icon: "check_circle" },
  failed:      { label: "Failed",     bg: "bg-error-container",          text: "text-on-error-container", dot: "bg-error", icon: "error" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  assigned: ["picked-up"],
  "picked-up": ["in-transit"],
  "in-transit": ["delivered", "failed"],
  delivered: [],
  failed: [],
};

const STATUS_TIMELINE: { status: string; label: string; icon: string }[] = [
  { status: "assigned", label: "Assigned", icon: "assignment_ind" },
  { status: "picked-up", label: "Picked Up", icon: "inventory_2" },
  { status: "in-transit", label: "In Transit", icon: "local_shipping" },
  { status: "delivered", label: "Delivered", icon: "check_circle" },
];

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || STATUS_STYLES.assigned;
}

function getInitialsBg(name: string) {
  const colors = [
    "bg-secondary-container text-on-secondary-container",
    "bg-tertiary-fixed text-on-tertiary-fixed",
    "bg-primary-fixed text-on-primary-fixed-variant",
  ];
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ─── Info Row ──────────────────────────────── */

function InfoRow({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-md py-sm">
      <span className="material-symbols-outlined text-[20px] text-outline mt-0.5">{icon}</span>
      <div>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
        <p className="font-body-md text-on-surface">{value || "---"}</p>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────── */

export default function AdminDeliveryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update
  const [newStatus, setNewStatus] = useState("");
  const [trackingNotes, setTrackingNotes] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Detail update
  const [editPartnerName, setEditPartnerName] = useState("");
  const [editPartnerPhone, setEditPartnerPhone] = useState("");
  const [editVehicle, setEditVehicle] = useState("");
  const [editPickup, setEditPickup] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [detailsUpdating, setDetailsUpdating] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((type: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin" || !id) return;
    setLoading(true);
    setError(null);
    adminAPI.getDelivery(id)
      .then((res) => {
        setDelivery(res.data.delivery);
        const d = res.data.delivery;
        setEditPartnerName(d.partnerName || "");
        setEditPartnerPhone(d.partnerPhone || "");
        setEditVehicle(d.vehicleNumber || "");
        setEditPickup(d.pickupLocation || "");
        setEditNotes(d.trackingNotes || "");
      })
      .catch((err) => {
        if (getApiErrorStatus(err) === 404) setError("Delivery not found.");
        else setError(getApiErrorMessage(err, "Failed to load delivery."));
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, user?.role, id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleStatusUpdate = async () => {
    if (!delivery || !newStatus) return;
    setStatusUpdating(true);
    setStatusError(null);
    try {
      const res = await adminAPI.updateDeliveryStatus(delivery._id, newStatus, trackingNotes.trim() || undefined);
      setDelivery(res.data.delivery);
      setStatusMessage(`Status updated to "${getStatusStyle(newStatus).label}".`);
      setNewStatus("");
      setTrackingNotes("");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      setStatusError(getApiErrorMessage(err, "Failed to update status."));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDetailsUpdate = async () => {
    if (!delivery) return;
    setDetailsUpdating(true);
    setDetailsError(null);
    try {
      const res = await adminAPI.updateDeliveryDetails(delivery._id, {
        partnerName: editPartnerName.trim(),
        partnerPhone: editPartnerPhone.trim(),
        vehicleNumber: editVehicle.trim() || undefined,
        pickupLocation: editPickup.trim() || undefined,
        trackingNotes: editNotes.trim() || undefined,
      });
      setDelivery(res.data.delivery);
      setDetailsMessage("Delivery details updated.");
      setTimeout(() => setDetailsMessage(null), 3000);
    } catch (err: unknown) {
      setDetailsError(getApiErrorMessage(err, "Failed to update details."));
    } finally {
      setDetailsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!delivery) return;
    try {
      await adminAPI.deleteDelivery(delivery._id);
      showToast("success", "Delivery deleted.");
      setTimeout(() => router.push("/admin/deliveries"), 800);
    } catch (err: unknown) {
      showToast("error", getApiErrorMessage(err, "Failed to delete delivery."));
    }
  };

  // ── Render states ──
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading delivery details...</p>
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
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Failed to load delivery</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <button onClick={() => router.push("/admin/deliveries")} className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all">Back to Deliveries</button>
        </div>
      </div>
    );
  }

  if (!delivery) return null;

  const sc = getStatusStyle(delivery.status);
  const allowed = STATUS_TRANSITIONS[delivery.status] || [];
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";

  // Timeline step index
  const failedPath = delivery.status === "failed";
  const currentIdx = failedPath ? -1 : STATUS_TIMELINE.findIndex((t) => t.status === delivery.status);

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface">

      {/* ── Toast ── */}
      {toast && (
        <div className={"fixed top-4 right-4 z-[100] px-lg py-md rounded-xl shadow-lg border font-label-md flex items-center gap-md transition-all " + (toast.type === "success" ? "bg-primary-fixed border-primary-container text-on-primary-fixed-variant" : "bg-error-container border-error text-on-error-container")}>
          <span className="material-symbols-outlined text-[20px]">{toast.type === "success" ? "check_circle" : "error"}</span>
          {toast.message}
        </div>
      )}

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
            <Link href="/admin/deliveries" className="flex items-center gap-md px-md py-sm rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span><span className="font-label-md">Deliveries</span>
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
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-6">
              <Link href="/admin/deliveries" className="hover:text-primary transition-colors">Deliveries</Link>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span className="text-on-surface">{getOrderIdDisplay(delivery._id, "DLV")}</span>
            </nav>

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h2 className="font-headline-lg text-headline-lg text-primary">Delivery {getOrderIdDisplay(delivery._id, "DLV")}</h2>
                  <span className={"inline-flex items-center px-3 py-1 rounded-full font-label-sm text-label-sm gap-1 " + sc.bg + " " + sc.text}>
                    <span className={"w-2 h-2 rounded-full " + sc.dot + (delivery.status === "in-transit" ? " animate-pulse" : "")}></span>
                    {sc.label}
                  </span>
                </div>
                <p className="font-body-md text-on-surface-variant">
                  Assigned to <strong>{delivery.partnerName}</strong> • Created {formatDate(delivery.createdAt)}
                </p>
              </div>
              <div className="flex gap-sm">
                <button onClick={() => setConfirmDelete(true)}
                  className="px-lg py-2 border border-error text-error rounded-lg font-label-md hover:bg-error-container/30 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">delete</span>Delete
                </button>
              </div>
            </div>

            {/* Status Messages */}
            {statusMessage && (
              <div className="mb-lg px-lg py-md bg-primary-fixed rounded-xl border border-primary-container text-on-primary-fixed-variant font-label-md flex items-center gap-md">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>{statusMessage}
              </div>
            )}
            {statusError && (
              <div className="mb-lg px-lg py-md bg-error-container rounded-xl border border-error text-on-error-container font-label-md flex items-center gap-md">
                <span className="material-symbols-outlined text-[20px]">error</span>{statusError}
              </div>
            )}
            {detailsMessage && (
              <div className="mb-lg px-lg py-md bg-primary-fixed rounded-xl border border-primary-container text-on-primary-fixed-variant font-label-md flex items-center gap-md">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>{detailsMessage}
              </div>
            )}
            {detailsError && (
              <div className="mb-lg px-lg py-md bg-error-container rounded-xl border border-error text-on-error-container font-label-md flex items-center gap-md">
                <span className="material-symbols-outlined text-[20px]">error</span>{detailsError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">

              {/* ── Left Column: Info ── */}
              <div className="lg:col-span-2 space-y-lg">

                {/* Status Timeline */}
                <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg">
                  <h3 className="font-headline-md text-headline-md text-primary mb-lg">Delivery Timeline</h3>
                  <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 right-0 top-5 h-[2px] bg-outline-variant z-0" />
                    <div className={"absolute left-0 top-5 h-[2px] z-[1] transition-all " + (failedPath ? "bg-error w-0" : currentIdx >= 0 ? "bg-primary" : "bg-transparent w-0")}
                      style={!failedPath && currentIdx >= 0 ? { width: (currentIdx / (STATUS_TIMELINE.length - 1)) * 100 + "%" } : failedPath ? { width: "100%", backgroundColor: "var(--color-error, #dc2626)" } : {}} />
                    {STATUS_TIMELINE.map((step, idx) => {
                      const reached = !failedPath && idx <= currentIdx;
                      return (
                        <div key={step.status} className="flex flex-col items-center relative z-10 flex-1">
                          <div className={"w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors " + (reached ? "bg-primary border-primary text-on-primary" : "bg-surface border-outline-variant text-outline")}>
                            <span className="material-symbols-outlined text-[20px]" style={reached ? { fontVariationSettings: "'FILL' 1" } : {}}>{step.icon}</span>
                          </div>
                          <span className={"mt-2 font-label-sm text-label-sm text-center " + (reached ? "text-primary font-bold" : "text-outline")}>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {failedPath && (
                    <div className="mt-md flex items-center gap-md p-md bg-error-container rounded-lg">
                      <span className="material-symbols-outlined text-error">error</span>
                      <div>
                        <p className="font-label-md text-on-error-container font-bold">Delivery Failed</p>
                        {delivery.actualDelivery && <p className="text-sm text-on-error-container">Failed at {formatDateTime(delivery.actualDelivery)}</p>}
                      </div>
                    </div>
                  )}
                </section>

                {/* Delivery Details Card */}
                <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                  <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center">
                    <h3 className="font-headline-md text-headline-md text-primary">Delivery Details</h3>
                    <button onClick={handleDetailsUpdate} disabled={detailsUpdating}
                      className="bg-primary text-on-primary px-md py-1.5 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      {detailsUpdating ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <div className="p-lg grid grid-cols-1 md:grid-cols-2 gap-x-xl gap-y-md">
                    <div>
                      <label className="font-label-sm text-label-sm text-on-surface-variant mb-xs block">Partner Name</label>
                      <input type="text" value={editPartnerName} onChange={(e) => setEditPartnerName(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md" />
                    </div>
                    <div>
                      <label className="font-label-sm text-label-sm text-on-surface-variant mb-xs block">Partner Phone</label>
                      <input type="tel" value={editPartnerPhone} onChange={(e) => setEditPartnerPhone(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md" />
                    </div>
                    <div>
                      <label className="font-label-sm text-label-sm text-on-surface-variant mb-xs block">Vehicle Number</label>
                      <input type="text" value={editVehicle} onChange={(e) => setEditVehicle(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md"
                        placeholder="e.g. MH-12-AB-1234" />
                    </div>
                    <div>
                      <label className="font-label-sm text-label-sm text-on-surface-variant mb-xs block">Pickup Location</label>
                      <input type="text" value={editPickup} onChange={(e) => setEditPickup(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md"
                        placeholder="Farm / warehouse address" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="font-label-sm text-label-sm text-on-surface-variant mb-xs block">Tracking Notes</label>
                      <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md h-20 resize-none"
                        placeholder="Add delivery tracking notes..." />
                    </div>
                  </div>
                </section>

                {/* Order Items */}
                {delivery.order?.items && delivery.order.items.length > 0 && (
                  <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                    <div className="px-lg py-md border-b border-outline-variant">
                      <h3 className="font-headline-md text-headline-md text-primary">Order Items</h3>
                    </div>
                    <div className="divide-y divide-outline-variant">
                      {delivery.order.items.map((item, idx) => (
                        <div key={idx} className="px-lg py-md flex items-center justify-between">
                          <div className="flex items-center gap-md">
                            <div className="w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center">
                              <span className="material-symbols-outlined text-outline">inventory_2</span>
                            </div>
                            <div>
                              <p className="font-body-md text-on-surface">{item.product?.name || "Unknown Product"}</p>
                              <p className="font-label-sm text-on-surface-variant">Qty: {item.quantity}</p>
                            </div>
                          </div>
                          <p className="font-bold text-primary">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-lg py-md border-t border-outline-variant bg-surface-container-low flex justify-between items-center">
                      <span className="font-label-md text-on-surface-variant">Total</span>
                      <span className="font-headline-md text-headline-md text-primary">{formatCurrency(delivery.order.totalAmount)}</span>
                    </div>
                  </section>
                )}
              </div>

              {/* ── Right Column: Status + Info ── */}
              <div className="space-y-lg">

                {/* Status Update Card */}
                {allowed.length > 0 && (
                  <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg">
                    <h3 className="font-headline-md text-headline-md text-primary mb-lg">Update Status</h3>
                    <div className="space-y-md">
                      {allowed.map((s) => {
                        const ss = getStatusStyle(s);
                        return (
                          <label key={s} className={"flex items-center gap-md px-md py-3 rounded-lg border cursor-pointer transition-colors " + (newStatus === s ? "border-primary bg-primary-container/30" : "border-outline-variant hover:bg-surface-container-low")}>
                            <input type="radio" name="newStatus" value={s} checked={newStatus === s} onChange={() => setNewStatus(s)} className="accent-primary" />
                            <span className={"w-2 h-2 rounded-full " + ss.dot}></span>
                            <span className="material-symbols-outlined text-[18px] text-outline">{ss.icon}</span>
                            <span className="font-label-md text-on-surface">{ss.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {newStatus && (
                      <>
                        <div className="mt-md">
                          <label className="font-label-sm text-label-sm text-on-surface-variant mb-xs block">Status Notes</label>
                          <textarea value={trackingNotes} onChange={(e) => setTrackingNotes(e.target.value)}
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md h-16 resize-none"
                            placeholder="Optional notes..." />
                        </div>
                        <button onClick={handleStatusUpdate} disabled={statusUpdating}
                          className="mt-md w-full bg-primary text-on-primary py-2 rounded-lg font-label-md hover:opacity-90 transition-opacity disabled:opacity-50">
                          {statusUpdating ? "Updating..." : "Update to " + getStatusStyle(newStatus).label}
                        </button>
                      </>
                    )}
                  </section>
                )}

                {/* Delivery Info Card */}
                <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg">
                  <h3 className="font-headline-md text-headline-md text-primary mb-md">Delivery Info</h3>
                  <div className="space-y-sm divide-y divide-outline-variant/50">
                    <InfoRow icon="person" label="Partner" value={delivery.partnerName} />
                    <InfoRow icon="phone" label="Phone" value={delivery.partnerPhone} />
                    <InfoRow icon="local_shipping" label="Vehicle" value={delivery.vehicleNumber} />
                    <InfoRow icon="schedule" label="Est. Delivery" value={formatDateTime(delivery.estimatedDelivery)} />
                    {delivery.actualDelivery && (
                      <InfoRow icon="check_circle" label="Actual Delivery" value={formatDateTime(delivery.actualDelivery)} />
                    )}
                    <InfoRow icon="place" label="Pickup" value={delivery.pickupLocation} />
                    <InfoRow icon="location_on" label="Destination" value={delivery.deliveryLocation ? delivery.deliveryLocation.street + ", " + delivery.deliveryLocation.city + ", " + delivery.deliveryLocation.state + " - " + delivery.deliveryLocation.pincode : "---"} />
                    <InfoRow icon="notes" label="Notes" value={delivery.trackingNotes} />
                  </div>
                </section>

                {/* Order Info Card */}
                {delivery.order && (
                  <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg">
                    <h3 className="font-headline-md text-headline-md text-primary mb-md">Order Info</h3>
                    <div className="space-y-sm divide-y divide-outline-variant/50">
                      <div className="flex items-center gap-md py-sm">
                        <span className="material-symbols-outlined text-[20px] text-outline">receipt</span>
                        <div>
                          <p className="font-label-sm text-label-sm text-on-surface-variant">Order</p>
                          <button onClick={() => router.push("/admin/orders/" + delivery.order._id)} className="font-body-md text-primary hover:underline">
                            {getOrderIdDisplay(delivery.order._id, "ORD")}
                          </button>
                        </div>
                      </div>
                      <InfoRow icon="person" label="Customer" value={
                        <span>
                          {delivery.order.consumer?.name || "---"}
                          {delivery.order.consumer?.phone && <span className="text-on-surface-variant"> • {delivery.order.consumer.phone}</span>}
                        </span>
                      } />
                      <InfoRow icon="agriculture" label="Farmer" value={
                        <span>
                          {delivery.order.farmer?.farmName || delivery.order.farmer?.name || "---"}
                          {delivery.order.farmer?.phone && <span className="text-on-surface-variant"> • {delivery.order.farmer.phone}</span>}
                        </span>
                      } />
                      <InfoRow icon="payments" label="Amount" value={formatCurrency(delivery.order.totalAmount)} />
                      <InfoRow icon="inventory_2" label="Items" value={delivery.order.items?.length || 0} />
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
          <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant w-full max-w-sm mx-4 p-xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto bg-error-container rounded-full flex items-center justify-center mb-lg">
              <span className="material-symbols-outlined text-[32px] text-error">delete_forever</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-sm">Delete Delivery?</h3>
            <p className="font-body-md text-on-surface-variant mb-xl">This delivery assignment will be permanently removed. This cannot be undone.</p>
            <div className="flex gap-sm justify-center">
              <button onClick={() => setConfirmDelete(false)} className="px-xl py-2 border border-outline-variant rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">Cancel</button>
              <button onClick={handleDelete} className="px-xl py-2 bg-error text-on-error rounded-lg font-label-md hover:opacity-90 transition-opacity">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
