"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";
import { addressAPI, getApiErrorMessage } from "@/lib/api";

interface Address {
  _id: string;
  label: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
}

interface AddressFormData {
  label: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const INITIAL_FORM: AddressFormData = {
  label: "Home",
  phone: "",
  street: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
};

const LABEL_OPTIONS = ["Home", "Work", "Farm", "Other"];

export default function AddressPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AddressFormData>(INITIAL_FORM);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login?redirect=/profile/address");
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

  const fetchAddresses = () => {
    setLoading(true);
    setError(null);
    addressAPI
      .getAddresses()
      .then((res) => setAddresses(res.data.addresses || []))
      .catch((err) => {
        setError(getApiErrorMessage(err, "Failed to load addresses."));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) fetchAddresses();
  }, [isAuthenticated]);

  const openAddForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (addr: Address) => {
    setForm({
      label: addr.label,
      phone: addr.phone || "",
      street: addr.street,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      isDefault: addr.isDefault,
    });
    setEditingId(addr._id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.street || !form.city || !form.state || !form.pincode) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await addressAPI.updateAddress(editingId, form);
        showSuccess("Address updated successfully.");
      } else {
        await addressAPI.createAddress(form);
        showSuccess("Address added successfully.");
      }
      setShowForm(false);
      fetchAddresses();
    } catch (err: unknown) {
      showError(getApiErrorMessage(err, "Failed to save address."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      await addressAPI.deleteAddress(id);
      showSuccess("Address deleted.");
      fetchAddresses();
    } catch (err: unknown) {
      showError(getApiErrorMessage(err, "Failed to delete address."));
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await addressAPI.setDefaultAddress(id);
      showSuccess("Default address updated.");
      fetchAddresses();
    } catch (err: unknown) {
      showError(getApiErrorMessage(err, "Failed to update default address."));
    }
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface">
      <aside className="hidden lg:flex flex-col p-lg gap-sm h-screen w-64 fixed left-0 top-0 bg-surface border-r border-outline-variant z-40">
        <div className="mb-xl px-sm">
          <Link href="/profile" className="font-headline-md text-headline-md text-primary hover:underline">My Account</Link>
          <p className="text-on-surface-variant font-label-md">Manage your saved addresses</p>
        </div>
        <nav className="flex flex-col gap-xs flex-grow">
          <SidebarLink href="/profile" icon="dashboard" label="Dashboard" />
          <SidebarLink href="/profile" icon="person" label="Personal Info" />
          <SidebarLink href="/profile/address" icon="location_on" label="Saved Addresses" active />
          <SidebarLink href="/profile/payments" icon="payments" label="Payment Methods" />
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

      <main className="lg:ml-64 p-margin-mobile md:p-margin-desktop min-h-[calc(100vh-3.5rem)]">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md mb-xl">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary mb-xs">Saved Addresses</h2>
              <p className="font-body-lg text-on-surface-variant">Manage your delivery addresses.</p>
            </div>
            <button onClick={openAddForm} className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all active:scale-95 self-start">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add New Address
            </button>
          </div>

          {error && (
            <div className="mb-lg p-md rounded-xl bg-error-container text-on-error-container border border-error/20 flex items-center gap-3 animate-slideDown">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <p className="font-body-md flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-on-error-container/70 hover:text-on-error-container">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : addresses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              {addresses.map((addr) => (
                <div key={addr._id} className="relative bg-white rounded-xl border border-outline-variant p-lg hover:shadow-md transition-all duration-300">
                  {addr.isDefault && (
                    <span className="absolute -top-2 right-4 px-3 py-0.5 bg-primary text-on-primary text-[10px] font-bold rounded-full uppercase tracking-wider shadow-sm">Default</span>
                  )}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[20px] text-primary">
                        {addr.label === "Work" ? "work" : addr.label === "Farm" ? "agriculture" : "home"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-label-md text-primary">{addr.label}</span>
                      <p className="text-body-md text-on-surface mt-1">{addr.street}</p>
                      <p className="text-body-md text-on-surface-variant">{addr.city}, {addr.state} &mdash; {addr.pincode}</p>
                      {addr.phone && (
                        <p className="text-label-sm text-on-surface-variant mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          {addr.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/50">
                    {!addr.isDefault && (
                      <button onClick={() => handleSetDefault(addr._id)} className="text-xs text-primary font-label-md hover:underline flex items-center gap-1 active:scale-95">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Set as Default
                      </button>
                    )}
                    <button onClick={() => openEditForm(addr)} className="text-xs text-on-surface-variant font-label-md hover:text-primary hover:underline flex items-center gap-1 active:scale-95 ml-auto">
                      <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                    </button>
                    <button onClick={() => handleDelete(addr._id)} className="text-xs text-error font-label-md hover:underline flex items-center gap-1 active:scale-95">
                      <span className="material-symbols-outlined text-[14px]">delete</span>Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-surface-container-high rounded-full flex items-center justify-center mb-md">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant">location_off</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary">No addresses saved</h3>
              <p className="text-on-surface-variant max-w-sm mb-lg font-body-md">Add a delivery address so you can receive fresh farm produce at your doorstep.</p>
              <button onClick={openAddForm} className="px-xl py-md bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 transition-all active:scale-95 inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">add</span>Add Address
              </button>
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submitting && setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant p-xl animate-slideDown max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-lg">
              <h3 className="font-headline-md text-headline-md text-primary">{editingId ? "Edit Address" : "Add New Address"}</h3>
              <button onClick={() => setShowForm(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-lg">
              <div>
                <label className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs block mb-sm">Label</label>
                <div className="flex gap-2 flex-wrap">
                  {LABEL_OPTIONS.map((l) => (
                    <button key={l} type="button" onClick={() => setForm((f) => ({ ...f, label: l }))}
                      className={"px-4 py-2 rounded-lg font-label-md text-sm transition-all active:scale-95 " + (form.label === l ? "bg-primary-container text-on-primary-container shadow-sm" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high")}>
                      {l === "Home" ? <><span className="material-symbols-outlined text-[14px] align-middle mr-1">home</span>Home</> : l === "Work" ? <><span className="material-symbols-outlined text-[14px] align-middle mr-1">work</span>Work</> : l === "Farm" ? <><span className="material-symbols-outlined text-[14px] align-middle mr-1">agriculture</span>Farm</> : l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs block mb-sm">Street / Area</label>
                <input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                  className="w-full px-4 py-3 border border-outline-variant rounded-xl bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="House number, street, landmark" required />
              </div>
              <div>
                <label className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs block mb-sm">Phone (for delivery contact)</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-outline-variant rounded-xl bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="10-digit mobile number" pattern="[0-9]{10}" maxLength={10} />
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs block mb-sm">City</label>
                  <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full px-4 py-3 border border-outline-variant rounded-xl bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder="City" required />
                </div>
                <div>
                  <label className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs block mb-sm">State</label>
                  <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="w-full px-4 py-3 border border-outline-variant rounded-xl bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder="State" required />
                </div>
              </div>
              <div>
                <label className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs block mb-sm">Pincode</label>
                <input value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                  className="w-full px-4 py-3 border border-outline-variant rounded-xl bg-surface-container-low text-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="6-digit pincode" required pattern="[0-9]{6}" maxLength={6} />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="font-body-md text-on-surface">Set as default delivery address</span>
              </label>
              <div className="flex gap-3 pt-md">
                <button type="button" onClick={() => setShowForm(false)} disabled={submitting}
                  className="flex-1 px-6 py-3 border border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container transition-all disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting || !form.street || !form.city || !form.state || !form.pincode}
                  className="flex-1 px-6 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 inline-flex items-center justify-center gap-2">
                  {submitting ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : editingId ? "Update Address" : "Add Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-outline-variant flex justify-around items-center z-50">
        <MobileNavLink href="/" icon="home" label="Home" />
        <MobileNavLink href="/marketplace" icon="search" label="Explore" />
        <MobileNavLink href="/orders" icon="history" label="Orders" />
        <MobileNavLink href="/profile" icon="person" label="Profile" active />
      </nav>
    </div>
  );
}

function SidebarLink({ href, icon, label, active }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={"flex items-center gap-md p-md rounded-lg transition-all active:scale-95 " + (active ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface-variant hover:bg-surface-container-high")}>
      <span className="material-symbols-outlined">{icon}</span>
      <span className="font-label-md">{label}</span>
    </Link>
  );
}

function MobileNavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={"flex flex-col items-center gap-0.5 " + (active ? "text-primary" : "text-on-surface-variant")}>
      <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
      <span className={"text-[10px] font-label-sm " + (active ? "font-bold" : "")}>{label}</span>
    </Link>
  );
}
