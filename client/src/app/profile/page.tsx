"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SiteHeader from "@/components/site-header";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/auth/login?redirect=/profile");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const userInitial = user.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SiteHeader activePage="" />

      <main className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-lg">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">My Profile</span>
        </nav>

        {/* Profile Card */}
        <div className="bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden">
          {/* Cover + Avatar */}
          <div className="h-32 bg-gradient-to-r from-primary to-primary-container relative">
            <div className="absolute -bottom-12 left-8">
              <div className="w-24 h-24 rounded-full bg-primary text-on-primary border-4 border-surface-container-lowest flex items-center justify-center text-headline-lg font-bold shadow-lg">
                {userInitial}
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="pt-16 px-8 pb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="font-headline-lg text-headline-lg text-primary">{user.name}</h1>
                <p className="text-on-surface-variant font-body-md">{user.email}</p>
              </div>
              <span className={"px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider " + (user.role === "farmer" ? "bg-[#dcfce7] text-[#166534]" : user.role === "admin" ? "bg-[#dbeafe] text-[#1e40af]" : "bg-primary/10 text-primary")}>
                {user.role === "farmer" ? "Farmer" : user.role === "admin" ? "Admin" : "Consumer"}
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-outline-variant pt-6">
              <DetailField label="Full Name" value={user.name} icon="badge" />
              <DetailField label="Email" value={user.email} icon="mail" />
              <DetailField label="Phone" value={user.phone || "Not provided"} icon="call" />
              <DetailField label="Account Type" value={user.role === "farmer" ? "Farmer" : user.role === "admin" ? "Admin" : "Consumer"} icon="person" />
              {user.role === "farmer" && (
                <DetailField label="Farm Name" value={user.farmName || "Not set"} icon="agriculture" />
              )}
              <DetailField label="User ID" value={user._id.slice(-8).toUpperCase()} icon="fingerprint" />
            </div>

            {/* Actions */}
            <div className="border-t border-outline-variant pt-6 mt-6 flex flex-wrap gap-4">
              {user.role === "farmer" && (
                <Link href="/farmer/dashboard" className="px-6 py-3 bg-primary-container text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2">
                  <span className="material-symbols-outlined">agriculture</span>
                  Farmer Dashboard
                </Link>
              )}
              <Link href="/orders" className="px-6 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2">
                <span className="material-symbols-outlined">receipt_long</span>
                View My Orders
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="px-6 py-3 border-2 border-error text-error font-label-md rounded-xl hover:bg-error/5 transition-all inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Account Info Card */}
        <div className="mt-6 bg-surface-container-low rounded-xl border border-outline-variant p-8">
          <h2 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">info</span>
            Account Information
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>Your account is active and in good standing.</span>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">shield</span>
              <span>Your personal information is protected and never shared.</span>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">support</span>
              <span>Need help? Contact us at <a href="mailto:support@krishimarket.in" className="text-primary hover:underline">support@krishimarket.in</a></span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* --- Detail Field Component ------------------ */
function DetailField({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
      </div>
      <div>
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</p>
        <p className="font-body-md text-body-md text-on-surface">{value}</p>
      </div>
    </div>
  );
}
