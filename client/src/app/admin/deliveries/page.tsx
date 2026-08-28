"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, getInitials, getOrderIdDisplay } from "@shared/utils";

/* ─── Types ────────────────────────────────── */

interface DeliveryOrder {
  _id: string;
  totalAmount: number;
  status: string;
  consumer: { _id: string; name: string; phone?: string };
  farmer: { _id: string; name: string; farmName?: string };
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

interface DeliveriesStats {
  totalDeliveries: number;
  byStatus: Record<string, number>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DeliveriesResponse {
  deliveries: Delivery[];
  stats: DeliveriesStats;
  pagination: PaginationInfo;
}

/* ─── Constants ─────────────────────────────── */

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  assigned:   { label: "Assigned",   bg: "bg-surface-container-highest", text: "text-on-surface-variant", dot: "bg-outline" },
  "picked-up": { label: "Picked Up", bg: "bg-secondary-container",      text: "text-on-secondary-container", dot: "bg-secondary" },
  "in-transit":{ label: "In Transit", bg: "bg-tertiary-fixed",          text: "text-on-tertiary-fixed-variant", dot: "bg-tertiary-container" },
  delivered:   { label: "Delivered",  bg: "bg-primary-fixed",            text: "text-on-primary-fixed-variant", dot: "bg-primary-container" },
  failed:      { label: "Failed",     bg: "bg-error-container",          text: "text-on-error-container", dot: "bg-error" },
};

const DELIVERY_STATUSES = ["all", "assigned", "picked-up", "in-transit", "delivered", "failed"] as const;

const STATUS_TRANSITIONS: Record<string, string[]> = {
  assigned: ["picked-up"],
  "picked-up": ["in-transit"],
  "in-transit": ["delivered", "failed"],
  delivered: [],
  failed: [],
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || STATUS_STYLES.assigned;
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

/* ─── Create Delivery Modal ─────────────────── */

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
}

function CreateDeliveryModal({ open, onClose, onCreated, showError, showSuccess }: CreateModalProps) {
  const [orderId, setOrderId] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim() || !partnerName.trim() || !partnerPhone.trim() || !estimatedDelivery) {
      showError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      await adminAPI.createDelivery({
        orderId: orderId.trim(),
        partnerName: partnerName.trim(),
        partnerPhone: partnerPhone.trim(),
        vehicleNumber: vehicleNumber.trim() || undefined,
        estimatedDelivery,
        pickupLocation: pickupLocation.trim() || undefined,
      });
      showSuccess("Delivery assigned successfully.");
      setOrderId(""); setPartnerName(""); setPartnerPhone(""); setVehicleNumber(""); setEstimatedDelivery(""); setPickupLocation("");
      onCreated();
      onClose();
    } catch (err: unknown) {
      showError(getApiErrorMessage(err, "Failed to create delivery."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-xl py-lg border-b border-outline-variant flex items-center justify-between">
          <h3 className="font-headline-md text-headline-md text-primary">Assign Delivery</h3>
          <button onClick={onClose} className="p-sm rounded-full hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-xl space-y-lg">
          <div>
            <label className="font-label-md text-label-md text-on-surface-variant mb-xs block">Order ID *</label>
            <input type="text" value={orderId} onChange={(e) => setOrderId(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md"
              placeholder="Paste order ID" required />
          </div>
          <div className="grid grid-cols-2 gap-md">
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant mb-xs block">Partner Name *</label>
              <input type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md"
                placeholder="Delivery partner name" required />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant mb-xs block">Partner Phone *</label>
              <input type="tel" value={partnerPhone} onChange={(e) => setPartnerPhone(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md"
                placeholder="Phone number" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-md">
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant mb-xs block">Vehicle Number</label>
              <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md"
                placeholder="e.g. MH-12-AB-1234" />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant mb-xs block">Est. Delivery *</label>
              <input type="datetime-local" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md"
                required />
            </div>
          </div>
          <div>
            <label className="font-label-md text-label-md text-on-surface-variant mb-xs block">Pickup Location</label>
            <input type="text" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md"
              placeholder="Farm / warehouse pickup address" />
          </div>
          <div className="flex gap-sm justify-end pt-sm">
            <button type="button" onClick={onClose} className="px-lg py-2 border border-outline-variant rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-lg py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity disabled:opacity-50">
              {submitting ? "Assigning..." : "Assign Delivery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Status Update Modal ───────────────────── */

interface StatusModalProps {
  open: boolean;
  delivery: Delivery | null;
  onClose: () => void;
  onUpdated: () => void;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
}

function StatusUpdateModal({ open, delivery, onClose, onUpdated, showError, showSuccess }: StatusModalProps) {
  const [newStatus, setNewStatus] = useState("");
  const [trackingNotes, setTrackingNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open || !delivery) return null;

  const allowed = STATUS_TRANSITIONS[delivery.status] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus) { showError("Select a status."); return; }
    setSubmitting(true);
    try {
      await adminAPI.updateDeliveryStatus(delivery._id, newStatus, trackingNotes.trim() || undefined);
      showSuccess(`Status updated to "${getStatusStyle(newStatus).label}".`);
      setNewStatus(""); setTrackingNotes("");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      showError(getApiErrorMessage(err, "Failed to update status."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-xl py-lg border-b border-outline-variant flex items-center justify-between">
          <h3 className="font-headline-md text-headline-md text-primary">Update Delivery Status</h3>
          <button onClick={onClose} className="p-sm rounded-full hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-xl space-y-lg">
          <div>
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Current Status</p>
            <span className={"inline-flex items-center px-3 py-1 rounded-full text-xs font-bold gap-1.5 " + getStatusStyle(delivery.status).bg + " " + getStatusStyle(delivery.status).text}>
              {getStatusStyle(delivery.status).label}
            </span>
          </div>
          {allowed.length > 0 ? (
            <>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant mb-xs block">New Status *</label>
                <div className="space-y-sm">
                  {allowed.map((s) => (
                    <label key={s} className={"flex items-center gap-md px-md py-3 rounded-lg border cursor-pointer transition-colors " + (newStatus === s ? "border-primary bg-primary-container/30" : "border-outline-variant hover:bg-surface-container-low")}>
                      <input type="radio" name="newStatus" value={s} checked={newStatus === s} onChange={() => setNewStatus(s)} className="accent-primary" />
                      <span className={"w-2 h-2 rounded-full " + getStatusStyle(s).dot}></span>
                      <span className="font-label-md text-on-surface">{getStatusStyle(s).label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant mb-xs block">Tracking Notes</label>
                <textarea value={trackingNotes} onChange={(e) => setTrackingNotes(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-2 focus:ring-primary focus:border-primary font-body-md h-20 resize-none"
                  placeholder="Optional notes about this status change..." />
              </div>
              <div className="flex gap-sm justify-end pt-sm">
                <button type="button" onClick={onClose} className="px-lg py-2 border border-outline-variant rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="px-lg py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity disabled:opacity-50">
                  {submitting ? "Updating..." : "Update Status"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-lg">
              <span className="material-symbols-outlined text-[48px] text-outline mb-sm">check_circle</span>
              <p className="font-body-md text-on-surface-variant">This delivery is in a terminal state ({getStatusStyle(delivery.status).label}). No further status changes are possible.</p>
              <button type="button" onClick={onClose} className="mt-lg px-lg py-2 border border-outline-variant rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">Close</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────── */

export default function AdminDeliveriesPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const [data, setData] = useState<DeliveriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search with debounce
  const [searchInput, setSearchInput] = useState("");
  const [sendSearch, setSendSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [sortBy, setSortBy] = useState("-createdAt");
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusModalDelivery, setStatusModalDelivery] = useState<Delivery | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSendSearch(searchInput), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => { setPage(1); }, [sendSearch, statusFilter]);

  const fetchDeliveries = useCallback(() => {
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
    if (sendSearch.trim()) params.search = sendSearch.trim();
    adminAPI.getDeliveries(params)
      .then((res) => { if (id === fetchIdRef.current) setData(res.data); })
      .catch((err) => { if (id === fetchIdRef.current) setError(getApiErrorMessage(err, "Failed to load deliveries.")); })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }, [isAuthenticated, user?.role, page, sortBy, statusFilter, sendSearch]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await adminAPI.deleteDelivery(id);
      showToast("success", "Delivery deleted successfully.");
      setConfirmDelete(null);
      fetchDeliveries();
    } catch (err: unknown) {
      showToast("error", getApiErrorMessage(err, "Failed to delete delivery."));
    }
  };

  // ── Render states ───────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading deliveries...</p>
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
          <h2 className="font-headline-md text-headline-md text-primary mb-sm">Failed to load deliveries</h2>
          <p className="text-on-surface-variant font-body-md mb-xl">{error}</p>
          <button onClick={fetchDeliveries} className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all">Try Again</button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const pag = data?.pagination;
  const deliveries = data?.deliveries || [];
  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface">

      {/* ── Toast ── */}
      {toast && (
        <div className={"fixed top-4 right-4 z-[100] px-lg py-md rounded-xl shadow-lg border font-label-md flex items-center gap-md transition-all animate-in slide-in-from-top-4 " + (toast.type === "success" ? "bg-primary-fixed border-primary-container text-on-primary-fixed-variant" : "bg-error-container border-error text-on-error-container")}>
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
            {/* ── Page Header ── */}
            <header className="mb-xl">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-primary mb-xs">Delivery Management</h2>
                  <p className="font-body-md text-on-surface-variant">Track and manage all delivery assignments across the platform.</p>
                </div>
                <button onClick={() => setShowCreateModal(true)}
                  className="bg-primary text-on-primary px-lg py-2 rounded-lg font-label-md flex items-center gap-2 hover:opacity-90 transition-opacity">
                  <span className="material-symbols-outlined text-[20px]">add</span>Assign Delivery
                </button>
              </div>
            </header>

            {/* ── Summary Stats ── */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-md mb-xl">
              {(["assigned", "picked-up", "in-transit", "delivered", "failed"] as const).map((s) => {
                const ss = getStatusStyle(s);
                return (
                  <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                    className={"p-lg rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md text-left " + (statusFilter === s ? "border-primary shadow-md bg-surface-container-low" : "border-outline-variant bg-surface-container-lowest")}>
                    <div className="flex items-center justify-between mb-sm">
                      <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold gap-1 " + ss.bg + " " + ss.text}>
                        <span className={"w-1.5 h-1.5 rounded-full " + ss.dot}></span>
                        {ss.label}
                      </span>
                    </div>
                    <p className="font-headline-md text-headline-md text-primary">{stats ? (stats.byStatus[s] || 0) : "---"}</p>
                  </button>
                );
              })}
            </section>

            {/* ── Table Controls ── */}
            <div className="bg-surface-container-low p-md rounded-t-xl border-x border-t border-outline-variant flex flex-col md:flex-row gap-md items-center justify-between">
              <div className="flex flex-wrap items-center gap-sm">
                <div className="relative" ref={statusMenuRef}>
                  <button onClick={() => setShowStatusMenu((p) => !p)} className="bg-surface-container-lowest border border-outline-variant px-md py-2 rounded-lg font-label-md flex items-center gap-2 hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-[18px]">filter_list</span>
                    <span>Status: {statusFilter === "all" ? "All" : getStatusStyle(statusFilter).label}</span>
                    <span className="material-symbols-outlined text-[18px]">expand_more</span>
                  </button>
                  {showStatusMenu && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
                      {DELIVERY_STATUSES.map((s) => (
                        <button key={s} onClick={() => { setStatusFilter(s); setShowStatusMenu(false); }}
                          className={"w-full text-left px-4 py-2.5 font-body-md hover:bg-surface-container-high transition-colors " + (statusFilter === s ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface")}>
                          {s === "all" ? "All" : getStatusStyle(s).label}
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
                    <option value="-estimatedDelivery">Est. Delivery (Late)</option>
                    <option value="estimatedDelivery">Est. Delivery (Soon)</option>
                  </select>
                </div>
              </div>
              <div className="w-full md:w-auto relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                <input className="w-full md:w-64 bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-4 py-2 focus:ring-primary focus:border-primary font-body-md"
                  placeholder="Search partner, order ID..." type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
              </div>
            </div>

            {/* ── Deliveries Table ── */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-b-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Order</th>
                      <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Delivery Partner</th>
                      <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Customer</th>
                      <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Destination</th>
                      <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Est. Delivery</th>
                      <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Status</th>
                      <th className="px-lg py-4 font-label-md text-outline uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {deliveries.length > 0 ? (
                      deliveries.map((d) => {
                        const ss = getStatusStyle(d.status);
                        const initials = getInitials(d.partnerName);
                        const initialsClass = getInitialsBg(d.partnerName);
                        return (
                          <tr key={d._id} className="hover:bg-surface-container transition-colors group">
                            <td className="px-lg py-4">
                              <button onClick={() => router.push("/admin/orders/" + d.order?._id)} className="font-label-md text-primary hover:underline cursor-pointer">
                                {d.order ? getOrderIdDisplay(d.order._id, "ORD") : "---"}
                              </button>
                              <p className="text-xs text-on-surface-variant mt-0.5">{d.order ? formatCurrency(d.order.totalAmount) : ""}</p>
                            </td>
                            <td className="px-lg py-4">
                              <div className="flex items-center gap-3">
                                <div className={"w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs " + initialsClass}>{initials}</div>
                                <div>
                                  <span className="font-body-md text-on-surface">{d.partnerName}</span>
                                  <p className="text-xs text-on-surface-variant">{d.partnerPhone}{d.vehicleNumber ? " • " + d.vehicleNumber : ""}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-lg py-4 text-on-surface-variant">{d.order?.consumer?.name || "---"}</td>
                            <td className="px-lg py-4 text-on-surface-variant text-sm max-w-[160px] truncate" title={d.deliveryLocation ? d.deliveryLocation.street + ", " + d.deliveryLocation.city : ""}>
                              {d.deliveryLocation ? d.deliveryLocation.city + ", " + d.deliveryLocation.pincode : "---"}
                            </td>
                            <td className="px-lg py-4 text-on-surface-variant">{formatDateTime(d.estimatedDelivery)}</td>
                            <td className="px-lg py-4">
                              <span className={"inline-flex items-center px-3 py-1 rounded-full text-xs font-bold gap-1.5 " + ss.bg + " " + ss.text}>
                                <span className={"w-1.5 h-1.5 rounded-full " + ss.dot + (d.status === "in-transit" ? " animate-pulse" : "")}></span>
                                {ss.label}
                              </span>
                            </td>
                            <td className="px-lg py-4">
                              <div className="flex items-center gap-2">
                                <button onClick={() => router.push("/admin/deliveries/" + d._id)}
                                  className="text-primary hover:underline font-label-md flex items-center gap-1 text-sm group-hover:translate-x-1 transition-transform">
                                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                                </button>
                                {(STATUS_TRANSITIONS[d.status] || []).length > 0 && (
                                  <button onClick={() => setStatusModalDelivery(d)}
                                    className="text-secondary hover:underline font-label-md flex items-center gap-1 text-sm">
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                  </button>
                                )}
                                <button onClick={() => setConfirmDelete(d._id)}
                                  className="text-error hover:underline font-label-md flex items-center gap-1 text-sm">
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-lg py-16 text-center">
                          <div className="flex flex-col items-center gap-md">
                            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-[36px] text-outline">local_shipping</span>
                            </div>
                            <p className="font-headline-md text-headline-md text-primary">No deliveries found</p>
                            <p className="text-on-surface-variant font-body-md">
                              {sendSearch || statusFilter !== "all" ? "Try adjusting your filters or search terms." : "No deliveries have been assigned yet."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              {pag && pag.total > 0 && (
                <div className="px-lg py-md flex items-center justify-between border-t border-outline-variant bg-surface-container-low">
                  <p className="font-label-sm text-on-surface-variant">
                    Showing {(pag.page - 1) * pag.limit + 1} to {Math.min(pag.page * pag.limit, pag.total)} of {pag.total} deliveries
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pag.page <= 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    {Array.from({ length: Math.min(pag.totalPages, 5) }, (_, i) => {
                      const startPage = Math.max(1, Math.min(pag.page - 2, pag.totalPages - 4));
                      const pageNum = startPage + i;
                      if (pageNum > pag.totalPages) return null;
                      return (
                        <button key={pageNum} onClick={() => setPage(pageNum)}
                          className={"w-8 h-8 flex items-center justify-center rounded-lg font-label-md transition-colors " + (pag.page === pageNum ? "bg-primary text-on-primary" : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high")}>
                          {pageNum}
                        </button>
                      );
                    })}
                    <button onClick={() => setPage((p) => Math.min(pag.totalPages, p + 1))} disabled={pag.page >= pag.totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      <CreateDeliveryModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={fetchDeliveries}
        showError={(msg) => showToast("error", msg)} showSuccess={(msg) => showToast("success", msg)} />

      <StatusUpdateModal open={!!statusModalDelivery} delivery={statusModalDelivery} onClose={() => setStatusModalDelivery(null)} onUpdated={fetchDeliveries}
        showError={(msg) => showToast("error", msg)} showSuccess={(msg) => showToast("success", msg)} />

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant w-full max-w-sm mx-4 p-xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto bg-error-container rounded-full flex items-center justify-center mb-lg">
              <span className="material-symbols-outlined text-[32px] text-error">delete_forever</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-sm">Delete Delivery?</h3>
            <p className="font-body-md text-on-surface-variant mb-xl">This action cannot be undone. The delivery assignment will be permanently removed.</p>
            <div className="flex gap-sm justify-center">
              <button onClick={() => setConfirmDelete(null)} className="px-xl py-2 border border-outline-variant rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-xl py-2 bg-error text-on-error rounded-lg font-label-md hover:opacity-90 transition-opacity">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
