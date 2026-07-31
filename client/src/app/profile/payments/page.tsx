"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";
import { paymentAPI } from "@/lib/api";

/* ─── Types ──────────────────────────────────── */

interface MethodOrder {
  _id: string;
  totalAmount: number;
  paymentStatus: string;
  createdAt: string;
}

interface PaymentMethod {
  method: string;
  count: number;
  totalSpent: number;
  successfulCount: number;
  lastUsed: string | null;
  orders: MethodOrder[];
}

interface PaymentMethodsResponse {
  methods: PaymentMethod[];
  totalOrders: number;
}

/* ─── Method display config ──────────────────── */

const METHOD_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  cod: {
    label: "Cash on Delivery",
    icon: "payments",
    color: "text-[#166534]",
    bg: "bg-[#dcfce7]",
  },
  online: {
    label: "Online Payment",
    icon: "credit_card",
    color: "text-[#1e40af]",
    bg: "bg-[#dbeafe]",
  },
};

function getMethodConfig(method: string) {
  return METHOD_CONFIG[method] || { label: method, icon: "payments", color: "text-on-surface-variant", bg: "bg-surface-container-high" };
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getOrderIdDisplay(id: string) {
  return `#KM-${id.slice(-5).toUpperCase()}`;
}

/* ─── Component ──────────────────────────────── */

export default function PaymentsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { showError } = useNotification();

  const [data, setData] = useState<PaymentMethodsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login?redirect=/profile/payments");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    paymentAPI
      .getPaymentMethods()
      .then((res) => setData(res.data))
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || "Failed to load payment methods.";
        setError(msg);
        showError(msg);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, showError]);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const methods = data?.methods || [];
  const totalOrders = data?.totalOrders || 0;

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col p-lg gap-sm h-screen w-64 fixed left-0 top-0 bg-surface border-r border-outline-variant z-40">
        <div className="mb-xl px-sm">
          <Link href="/profile" className="font-headline-md text-headline-md text-primary hover:underline">My Account</Link>
          <p className="text-on-surface-variant font-label-md">Manage your payment methods</p>
        </div>
        <nav className="flex flex-col gap-xs flex-grow">
          <SidebarLink href="/profile" icon="dashboard" label="Dashboard" />
          <SidebarLink href="/profile" icon="person" label="Personal Info" />
          <SidebarLink href="/profile/address" icon="location_on" label="Saved Addresses" />
          <SidebarLink href="/profile/payments" icon="payments" label="Payment Methods" active />
          <SidebarLink href="/orders" icon="history" label="Order History" />
          <SidebarLink href="/profile" icon="settings" label="Settings" />
        </nav>
        <div className="mt-auto p-md rounded-xl bg-surface-container border border-outline-variant flex items-center gap-md">
          <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm flex-shrink-0">{userInitial}</div>
          <div className="overflow-hidden">
            <p className="font-label-md truncate text-on-surface">{user.name}</p>
            <p className="text-xs text-on-surface-variant truncate">{user.role === "farmer" ? "Farmer" : user.role === "admin" ? "Admin" : "Premium Member"}</p>
          </div>
        </div>
      </aside>

      {/* ── Top Navigation ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop w-full h-14 bg-surface border-b border-outline-variant lg:pl-72">
        <Link href="/" className="font-display-lg text-headline-md text-primary">Krishi Market</Link>
        <div className="flex items-center gap-lg">
          <Link href="/cart" className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">shopping_cart</span>
          </Link>
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setProfileOpen((p) => !p)} className="w-8 h-8 rounded-full bg-primary text-on-primary font-label-md flex items-center justify-center hover:opacity-90 transition-all active:scale-95">{userInitial}</button>
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
      <main className="lg:ml-64 p-margin-mobile md:p-margin-desktop min-h-[calc(100vh-3.5rem)]">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-xl">
            <h2 className="font-headline-lg text-headline-lg text-primary mb-xs">Payment Methods</h2>
            <p className="font-body-lg text-on-surface-variant">View payment methods used across your orders.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-lg p-md rounded-xl bg-error-container text-on-error-container border border-error/20 flex items-center gap-3 animate-slideDown">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <p className="font-body-md flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-on-error-container/70 hover:text-on-error-container">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : methods.length > 0 ? (
            <>
              {/* Payment Method Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mb-xl">
                {methods.map((method) => {
                  const cfg = getMethodConfig(method.method);
                  return (
                    <div key={method.method} className="bg-white rounded-xl border border-outline-variant p-lg hover:shadow-md transition-all duration-300">
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className={`material-symbols-outlined text-[24px] ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline-md text-headline-md text-primary">{cfg.label}</h3>
                          {method.lastUsed && (
                            <p className="text-label-sm text-on-surface-variant">Last used {formatDate(method.lastUsed)}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-md mb-4">
                        <div className="text-center p-3 rounded-lg bg-surface-container-low">
                          <p className="font-bold text-headline-md text-on-surface">{method.count}</p>
                          <p className="text-label-sm text-on-surface-variant">Orders</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-surface-container-low">
                          <p className="font-bold text-headline-md text-primary">₹{method.totalSpent.toLocaleString("en-IN")}</p>
                          <p className="text-label-sm text-on-surface-variant">Total Spent</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-surface-container-low">
                          <p className="font-bold text-headline-md text-[#166534]">{method.successfulCount}/{method.count}</p>
                          <p className="text-label-sm text-on-surface-variant">Successful</p>
                        </div>
                      </div>

                      {/* Recent orders using this method */}
                      {method.orders.length > 0 && (
                        <div className="border-t border-outline-variant/50 pt-3">
                          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Recent orders</p>
                          <div className="space-y-1.5">
                            {method.orders.map((o) => (
                              <Link key={o._id} href={`/orders/${o._id}`}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors text-sm">
                                <span className="font-label-md text-primary">{getOrderIdDisplay(o._id)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-on-surface">₹{o.totalAmount.toLocaleString("en-IN")}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    o.paymentStatus === "paid" ? "bg-[#dcfce7] text-[#166534]" :
                                    o.paymentStatus === "pending" ? "bg-surface-container-high text-on-surface-variant" :
                                    o.paymentStatus === "failed" ? "bg-[#fee2e2] text-[#991b1b]" :
                                    "bg-[#fef3c7] text-[#92400e]"
                                  }`}>{o.paymentStatus}</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="bg-white rounded-xl border border-outline-variant p-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
                  </div>
                  <div>
                    <p className="font-label-md text-on-surface">Across {totalOrders} total order{totalOrders !== 1 ? "s" : ""}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      {methods.length} payment method{methods.length !== 1 ? "s" : ""} used
                      {methods.some((m) => m.method === "cod") && " \u2014 Cash on Delivery is available on all orders"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : !loading && !error ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-surface-container-high rounded-full flex items-center justify-center mb-md">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant">credit_card_off</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary">No payment methods yet</h3>
              <p className="text-on-surface-variant max-w-sm mb-lg font-body-md">
                When you place your first order, your payment methods will appear here.
              </p>
              <Link href="/marketplace" className="px-xl py-md bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 transition-all active:scale-95 inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">storefront</span>Browse Marketplace
              </Link>
            </div>
          ) : null}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-outline-variant flex justify-around items-center z-50">
        <MobileNavLink href="/" icon="home" label="Home" />
        <MobileNavLink href="/marketplace" icon="search" label="Explore" />
        <MobileNavLink href="/orders" icon="history" label="Orders" />
        <MobileNavLink href="/profile" icon="person" label="Profile" active />
      </nav>
    </div>
  );
}

/* ─── Sidebar Link ──────────────────────────── */
function SidebarLink({ href, icon, label, active }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={"flex items-center gap-md p-md rounded-lg transition-all active:scale-95 " + (active ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface-variant hover:bg-surface-container-high")}>
      <span className="material-symbols-outlined">{icon}</span>
      <span className="font-label-md">{label}</span>
    </Link>
  );
}

/* ─── Mobile Nav Link ───────────────────────── */
function MobileNavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={"flex flex-col items-center gap-0.5 " + (active ? "text-primary" : "text-on-surface-variant")}>
      <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
      <span className={"text-[10px] font-label-sm " + (active ? "font-bold" : "")}>{label}</span>
    </Link>
  );
}
