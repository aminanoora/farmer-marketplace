"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authAPI, getApiErrorMessage } from "@/lib/api";
import SiteHeader from "@/components/site-header";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, login } = useAuth();

  // Profile form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/auth/login?redirect=/profile/edit");
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  // Clear messages after a delay
  useEffect(() => {
    if (profileSuccess) {
      const t = setTimeout(() => setProfileSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [profileSuccess]);
  useEffect(() => {
    if (passwordSuccess) {
      const t = setTimeout(() => setPasswordSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [passwordSuccess]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const userInitial = user.name?.charAt(0)?.toUpperCase() || "?";

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!name.trim()) {
      setProfileError("Name cannot be empty.");
      return;
    }

    setProfileSaving(true);
    try {
      const res = await authAPI.updateProfile({ name: name.trim(), phone: phone.trim() });
      const updatedUser = res.data.user;
      // Update auth context so the UI reflects the new values
      const token = localStorage.getItem("krishi_token");
      if (token && updatedUser) {
        login(token, updatedUser);
      }
      setProfileSuccess("Profile updated successfully.");
    } catch (err: unknown) {
      setProfileError(getApiErrorMessage(err, "Failed to update profile."));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordError(getApiErrorMessage(err, "Failed to change password."));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SiteHeader activePage="" />

      <main className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-lg">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/profile" className="hover:text-primary transition-colors">My Profile</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Edit Profile</span>
        </nav>

        <div className="flex items-center gap-4 mb-lg">
          <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center text-headline-md font-bold shadow-md">
            {userInitial}
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">Edit Profile</h1>
            <p className="text-on-surface-variant font-body-md">{user.email}</p>
          </div>
        </div>

        {/* ─── Profile Info Form ──────────────────── */}
        <form onSubmit={handleProfileSubmit} className="bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden mb-8">
          <div className="px-8 py-5 border-b border-outline-variant">
            <h2 className="font-headline-md text-headline-md text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">badge</span>
              Personal Information
            </h2>
          </div>
          <div className="p-8 space-y-6">
            {profileError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="p-3 rounded-xl bg-primary-fixed/20 text-primary text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {profileSuccess}
              </div>
            )}

            <div>
              <label className="block font-label-md mb-1.5 ml-1 text-on-surface" htmlFor="edit-name">Full Name</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-on-surface-variant">badge</span>
                <input
                  id="edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0 font-body-md text-on-surface transition-colors"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-label-md mb-1.5 ml-1 text-on-surface" htmlFor="edit-phone">Phone Number</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-on-surface-variant">call</span>
                <input
                  id="edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0 font-body-md text-on-surface transition-colors"
                  placeholder="+91 98765 43210"
                />
              </div>
              <p className="mt-1.5 ml-1 text-label-sm text-on-surface-variant">Optional — used for order delivery notifications.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {profileSaving ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">save</span>
                    Save Changes
                  </>
                )}
              </button>
              <Link
                href="/profile"
                className="px-6 py-3 border-2 border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>

        {/* ─── Change Password Form ───────────────── */}
        <form onSubmit={handlePasswordSubmit} className="bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden mb-8">
          <div className="px-8 py-5 border-b border-outline-variant">
            <h2 className="font-headline-md text-headline-md text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">lock</span>
              Change Password
            </h2>
          </div>
          <div className="p-8 space-y-6">
            {passwordError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-primary-fixed/20 text-primary text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {passwordSuccess}
              </div>
            )}

            <div>
              <label className="block font-label-md mb-1.5 ml-1 text-on-surface" htmlFor="current-password">Current Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-on-surface-variant">lock</span>
                <input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-12 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0 font-body-md text-on-surface transition-colors"
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[20px]">{showCurrentPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-label-md mb-1.5 ml-1 text-on-surface" htmlFor="new-password">New Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-on-surface-variant">lock_reset</span>
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-12 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0 font-body-md text-on-surface transition-colors"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[20px]">{showNewPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-label-md mb-1.5 ml-1 text-on-surface" htmlFor="confirm-password">Confirm New Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-on-surface-variant">lock_reset</span>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0 font-body-md text-on-surface transition-colors"
                  placeholder="Re-enter new password"
                  required
                  minLength={6}
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1.5 ml-1 text-label-sm text-error">Passwords do not match.</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={passwordSaving}
                className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {passwordSaving ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                    Updating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">lock</span>
                    Update Password
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* ─── Danger Zone ────────────────────────── */}
        <div className="bg-surface-container-low rounded-xl border border-error/30 overflow-hidden mb-8">
          <div className="px-8 py-5 border-b border-error/20">
            <h2 className="font-headline-md text-headline-md text-error flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>
              Account
            </h2>
          </div>
          <div className="p-8">
            <p className="text-on-surface-variant font-body-md mb-4">
              Need to sign out? You can always log back in with your email and password.
            </p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Back to Profile
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
