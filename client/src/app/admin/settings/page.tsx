"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminAPI, getApiErrorMessage } from "@/lib/api";

interface PlatformSettings {
  commissionPercent: number;
  minPayoutThreshold: number;
  maxDeliveryRadiusKm: number;
  supportEmail: string;
  supportPhone: string;
  aboutUs?: string;
  termsUrl?: string;
  privacyUrl?: string;
  isPlatformActive: boolean;
  maintenanceMode: boolean;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAdminAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [commissionPercent, setCommissionPercent] = useState(5);
  const [minPayoutThreshold, setMinPayoutThreshold] = useState(500);
  const [maxDeliveryRadiusKm, setMaxDeliveryRadiusKm] = useState(50);
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [aboutUs, setAboutUs] = useState("");

  // Confirmation modal
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const [pendingMaintenanceValue, setPendingMaintenanceValue] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push("/admin/login");
      else if (user?.role !== "admin") router.push("/");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") return;
    setLoading(true);
    setError(null);
    adminAPI
      .getSettings()
      .then((res) => {
        const s = res.data.settings as PlatformSettings;
        setSettings(s);
        setMaintenanceMode(s.maintenanceMode);
        setCommissionPercent(s.commissionPercent);
        setMinPayoutThreshold(s.minPayoutThreshold);
        setMaxDeliveryRadiusKm(s.maxDeliveryRadiusKm);
        setSupportEmail(s.supportEmail);
        setSupportPhone(s.supportPhone);
        setAboutUs(s.aboutUs || "");
      })
      .catch((err) => setError(getApiErrorMessage(err, "Failed to load settings.")))
      .finally(() => setLoading(false));
  }, [isAuthenticated, user?.role]);

  const handleSave = async (updates: Record<string, unknown>) => {
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await adminAPI.updateSettings(updates);
      setSettings(res.data.settings);
      return true;
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to save settings."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleMaintenanceToggle = () => {
    const newValue = !maintenanceMode;
    if (newValue) {
      // Turning ON maintenance — show confirmation
      setPendingMaintenanceValue(true);
      setConfirmMaintenance(true);
    } else {
      // Turning OFF — no confirmation needed
      setMaintenanceMode(false);
      handleSave({ maintenanceMode: false });
    }
  };

  const confirmMaintenanceOn = async () => {
    setConfirmMaintenance(false);
    setMaintenanceMode(true);
    await handleSave({ maintenanceMode: true });
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave({
      commissionPercent,
      minPayoutThreshold,
      maxDeliveryRadiusKm,
      supportEmail,
      supportPhone,
      aboutUs,
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  const userInitial = user.name?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop h-16 sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-xl">
          <Link href="/admin/dashboard" className="font-headline-md text-headline-md text-primary font-bold">
            Krishi Market
          </Link>
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
            <Link href="/admin/farmers" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">group</span><span className="font-label-md">Users</span>
            </Link>
            <Link href="/admin/inventory" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">inventory_2</span><span className="font-label-md">Inventory</span>
            </Link>
            <Link href="/admin/products" className="flex items-center gap-md px-md py-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined">rate_review</span><span className="font-label-md">Approvals</span>
            </Link>
            <Link href="/admin/settings" className="flex items-center gap-md px-md py-sm rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined">settings</span><span className="font-label-md">Settings</span>
            </Link>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-lg bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="mb-xl">
              <h2 className="font-headline-lg text-headline-lg text-primary">Platform Settings</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Manage platform configuration and maintenance mode.</p>
            </div>

            {/* Status messages */}
            {error && (
              <div className="mb-lg p-md bg-error-container/30 border border-error/20 rounded-xl flex items-center gap-md">
                <span className="material-symbols-outlined text-error">error</span>
                <p className="text-error font-body-md">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-error/60 hover:text-error">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            )}
            {success && (
              <div className="mb-lg p-md bg-primary-fixed/30 border border-primary/20 rounded-xl flex items-center gap-md">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                <p className="text-primary font-body-md">{success}</p>
                <button onClick={() => setSuccess(null)} className="ml-auto text-primary/60 hover:text-primary">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            )}

            {/* ─── Maintenance Mode Card ─────────────────── */}
            <section className="bg-white rounded-xl border border-outline-variant overflow-hidden mb-lg">
              <div className="px-lg py-md border-b border-outline-variant">
                <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-sm">
                  <span className="material-symbols-outlined">build</span>
                  Maintenance Mode
                </h3>
              </div>
              <div className="p-lg">
                <div className="flex items-start justify-between gap-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-md mb-sm">
                      <div className={`w-3 h-3 rounded-full ${maintenanceMode ? "bg-error animate-pulse" : "bg-primary"}`} />
                      <p className="font-label-lg text-label-lg text-on-surface">
                        {maintenanceMode ? "Maintenance mode is ON" : "Platform is live"}
                      </p>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      When enabled, all public API endpoints return a <code className="px-1 py-0.5 bg-surface-container-low rounded text-sm">503</code> response. 
                      Admin login and dashboard remain accessible so you can turn it off. 
                      Farmers and consumers will see a &quot;under maintenance&quot; message.
                    </p>
                  </div>
                  <button
                    onClick={handleMaintenanceToggle}
                    disabled={saving}
                    className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
                      maintenanceMode ? "bg-error" : "bg-surface-container-highest"
                    }`}
                    role="switch"
                    aria-checked={maintenanceMode}
                    aria-label="Toggle maintenance mode"
                  >
                    <span
                      className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        maintenanceMode ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {maintenanceMode && (
                  <div className="mt-md p-md bg-error-container/20 border border-error/10 rounded-lg flex items-center gap-md">
                    <span className="material-symbols-outlined text-error text-[20px]">warning</span>
                    <p className="font-body-sm text-body-sm text-error">
                      Consumers and farmers cannot access the platform while maintenance mode is active.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* ─── General Settings Card ─────────────────── */}
            <form onSubmit={handleSaveGeneral}>
              <section className="bg-white rounded-xl border border-outline-variant overflow-hidden mb-lg">
                <div className="px-lg py-md border-b border-outline-variant">
                  <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-sm">
                    <span className="material-symbols-outlined">tune</span>
                    General Settings
                  </h3>
                </div>
                <div className="p-lg space-y-lg">
                  {/* Commission */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                    <div>
                      <label className="font-label-md text-label-md text-on-surface block mb-xs">
                        Commission Rate (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={commissionPercent}
                        onChange={(e) => setCommissionPercent(Number(e.target.value))}
                        className="w-full px-md py-sm bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      />
                      <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
                        Platform commission deducted from each order.
                      </p>
                    </div>
                    <div>
                      <label className="font-label-md text-label-md text-on-surface block mb-xs">
                        Min Payout Threshold (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={minPayoutThreshold}
                        onChange={(e) => setMinPayoutThreshold(Number(e.target.value))}
                        className="w-full px-md py-sm bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      />
                      <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
                        Minimum earnings before a farmer can request payout.
                      </p>
                    </div>
                  </div>

                  {/* Delivery radius */}
                  <div>
                    <label className="font-label-md text-label-md text-on-surface block mb-xs">
                      Max Delivery Radius (km)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={maxDeliveryRadiusKm}
                      onChange={(e) => setMaxDeliveryRadiusKm(Number(e.target.value))}
                      className="w-full px-md py-sm bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                </div>
              </section>

              {/* ─── Support Contact Card ────────────────── */}
              <section className="bg-white rounded-xl border border-outline-variant overflow-hidden mb-lg">
                <div className="px-lg py-md border-b border-outline-variant">
                  <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-sm">
                    <span className="material-symbols-outlined">support_agent</span>
                    Support Contact
                  </h3>
                </div>
                <div className="p-lg space-y-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                    <div>
                      <label className="font-label-md text-label-md text-on-surface block mb-xs">
                        Support Email
                      </label>
                      <input
                        type="email"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        className="w-full px-md py-sm bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="font-label-md text-label-md text-on-surface block mb-xs">
                        Support Phone
                      </label>
                      <input
                        type="tel"
                        value={supportPhone}
                        onChange={(e) => setSupportPhone(e.target.value)}
                        className="w-full px-md py-sm bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface block mb-xs">
                      About Us
                    </label>
                    <textarea
                      rows={3}
                      value={aboutUs}
                      onChange={(e) => setAboutUs(e.target.value)}
                      className="w-full px-md py-sm bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* Save button */}
              <div className="flex justify-end gap-md mb-xl">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-sm"
                >
                  {saving && <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />}
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>

      {/* ─── Maintenance Mode Confirmation Modal ──────── */}
      {confirmMaintenance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setConfirmMaintenance(false)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl max-w-md w-full mx-margin-mobile p-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-md mb-lg">
              <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-[24px]">warning</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Enable Maintenance Mode?</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">This action will make the platform unavailable.</p>
              </div>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mb-lg leading-relaxed">
              All consumers and farmers will see a maintenance message. Only admin login and dashboard will remain accessible.
              You can disable maintenance mode at any time from this page.
            </p>
            <div className="flex justify-end gap-md">
              <button
                onClick={() => setConfirmMaintenance(false)}
                className="px-lg py-sm border border-outline-variant rounded-lg font-label-md text-on-surface hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMaintenanceOn}
                className="px-lg py-sm bg-error text-on-error font-label-md rounded-lg hover:opacity-90 transition-all flex items-center gap-sm"
              >
                <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                Enable Maintenance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
