"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";

/* --- Types ----------------------------------- */
export interface HeaderProps {
  activePage?: string;
  showAuth?: boolean;
}

/* --- Component ------------------------------- */
export default function SiteHeader({ activePage, showAuth = true }: HeaderProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { getItemCount } = useCart();
  const { getCount: getWishlistCount } = useWishlist();
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const cartCount = getItemCount();
  const wishlistCount = getWishlistCount();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    logout();
    setProfileOpen(false);
    router.push("/");
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <header
      className={"w-full top-0 sticky z-50 bg-surface-container-lowest border-b border-outline-variant transition-shadow " + (scrolled ? "shadow-md" : "")}
    >
      <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 max-w-max-width mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display-lg text-headline-md text-primary">
            Krishi Market
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/marketplace"
              className={"transition-colors font-label-md " + (activePage === "marketplace" ? "text-primary border-b-2 border-primary font-bold pb-1" : "text-on-surface-variant hover:text-primary")}
            >
              Marketplace
            </Link>
            <Link
              href="/farmers"
              className={"transition-colors font-label-md " + (activePage === "farmers" ? "text-primary border-b-2 border-primary font-bold pb-1" : "text-on-surface-variant hover:text-primary")}
            >
              Farmers
            </Link>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Wishlist */}
              <Link href="/wishlist" className="relative p-2 text-primary hover:bg-surface-container-high rounded-full transition-all active:opacity-70" aria-label="Wishlist">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: wishlistCount > 0 ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-error text-white text-[8px] font-bold rounded-full flex items-center justify-center">{wishlistCount > 9 ? "9+" : wishlistCount}</span>
                )}
              </Link>

              {/* Cart */}
              <Link href="/cart" className="relative p-2 text-primary hover:bg-surface-container-high rounded-full transition-all active:opacity-70" aria-label="Cart">
                <span className="material-symbols-outlined">shopping_basket</span>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-on-primary text-[8px] font-bold rounded-full flex items-center justify-center">{cartCount > 9 ? "9+" : cartCount}</span>
                )}
              </Link>

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileOpen((p) => !p)}
                  className="w-9 h-9 rounded-full bg-primary text-on-primary font-label-md flex items-center justify-center hover:opacity-90 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Profile menu"
                  aria-expanded={profileOpen}
                >
                  {userInitial}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xl z-50 overflow-hidden">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-outline-variant/50">
                      <p className="font-label-md text-primary truncate">{user?.name || "User"}</p>
                      <p className="text-label-sm text-on-surface-variant truncate">{user?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase">
                        {user?.role === "farmer" ? "Farmer" : user?.role === "admin" ? "Admin" : "Consumer"}
                      </span>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-on-surface hover:bg-surface-container-high transition-colors font-body-md">
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">person</span>
                        My Profile
                      </Link>
                      <Link href="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-on-surface hover:bg-surface-container-high transition-colors font-body-md">
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">receipt_long</span>
                        My Orders
                      </Link>
                      {user?.role === "farmer" && (
                        <Link href="/farmer/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-on-surface hover:bg-surface-container-high transition-colors font-body-md">
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">agriculture</span>
                          Farmer Dashboard
                        </Link>
                      )}
                    </div>

                    {/* Sign out */}
                    <div className="border-t border-outline-variant/50 py-1">
                      <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error/5 transition-colors font-body-md">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : showAuth ? (
            <>
              <Link href="/auth/login" className="hidden md:inline-flex px-5 py-2 border-2 border-secondary text-secondary font-label-md rounded-xl hover:bg-secondary-container transition-colors">
                Sign In
              </Link>
              <Link href="/auth/register" className="px-5 py-2 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all active:scale-95">
                Register
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
