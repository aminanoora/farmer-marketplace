"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/farmer/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/farmer/products", label: "Products", icon: "potted_plant" },
  { href: "/farmer/orders", label: "Orders", icon: "receipt_long" },
  { href: "/farmer/profile", label: "Profile", icon: "person" },
];

const MOBILE_NAV = [
  { href: "/farmer/dashboard", label: "Home", icon: "dashboard" },
  { href: "/farmer/products", label: "Products", icon: "potted_plant" },
  { href: "/farmer/orders", label: "Orders", icon: "receipt_long" },
  { href: "/farmer/profile", label: "Profile", icon: "person" },
];

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.push("/auth/login?redirect=/farmer/dashboard");
    } else if (user?.role !== "farmer") {
      router.push(user?.role === "admin" ? "/admin/dashboard" : "/");
    }
  }, [loading, isAuthenticated, user, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitial = user.name?.charAt(0)?.toUpperCase() || "F";
  const pageTitle = NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.label || "Dashboard";

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      {/* ─── Desktop Sidebar ─── */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant flex-col p-4 gap-2 z-40 print:hidden">
        <div className="mb-8 px-4">
          <Link href="/farmer/dashboard" className="font-headline-md text-headline-md font-bold text-primary">
            Krishi Market
          </Link>
          <p className="font-label-sm text-label-sm text-on-surface-variant opacity-70">Producer Dashboard</p>
        </div>

        <nav className="flex flex-col gap-1 flex-grow">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-all active:scale-95 duration-200 ${
                  isActive
                    ? "bg-primary-container text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                <span className="font-label-md text-label-md">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-outline-variant">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
              {userInitial}
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface truncate max-w-[140px]">{user.name}</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-primary">Verified Producer</span>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push("/"); }}
            className="w-full mt-2 flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error/5 rounded-xl transition-colors font-body-md"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <div className="md:ml-64 min-h-screen flex flex-col">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-30 print:hidden">
          <div>
            <h2 className="font-headline-md text-headline-md text-primary">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen((p) => !p)}
                className="flex items-center gap-2 bg-surface-container-low hover:bg-surface-container-high transition-colors rounded-xl px-4 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">
                  {userInitial}
                </div>
                <span className="font-label-md text-label-md text-on-surface hidden lg:block">{user.name}</span>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-outline-variant/50">
                    <p className="font-label-md text-primary truncate">{user.name}</p>
                    <p className="text-label-sm text-on-surface-variant truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link href="/farmer/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-on-surface hover:bg-surface-container-high transition-colors font-body-md">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">person</span>
                      My Profile
                    </Link>
                    <button onClick={() => { logout(); router.push("/"); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error/5 transition-colors font-body-md">
                      <span className="material-symbols-outlined text-[20px]">logout</span>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-30 print:hidden">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined">{mobileMenuOpen ? "close" : "menu"}</span>
          </button>
          <span className="font-headline-md text-headline-md text-primary">{pageTitle}</span>
          <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">
            {userInitial}
          </div>
        </header>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/40 print:hidden" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-72 h-full bg-surface-container-lowest shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-4 mb-4 border-b border-outline-variant">
                <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold">
                  {userInitial}
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{user.name}</p>
                  <p className="text-label-sm text-on-surface-variant">{user.email}</p>
                </div>
              </div>
              <nav className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-all ${
                        isActive ? "bg-primary-container text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                      <span className="font-label-md text-label-md">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto pt-4 border-t border-outline-variant">
                <button onClick={() => { logout(); router.push("/"); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error/5 rounded-xl transition-colors font-body-md">
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 lg:p-12 pb-24 md:pb-12">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 bg-surface-container-lowest shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40 rounded-t-xl border-t border-outline-variant/30 print:hidden">
          {MOBILE_NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center px-6 py-2 active:scale-90 transition-transform duration-150 ${
                  isActive ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {item.icon}
                </span>
                <span className="font-label-sm text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
