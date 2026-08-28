"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { authAPI, getApiErrorMessage } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [sp, setSp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPwd) { setError("Passwords do not match."); return; }
    setError(null); setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Reset failed. The link may have expired."));
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-white">
      <section className="hidden md:flex md:w-1/2 lg:w-3/5 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image className="w-full h-full object-cover opacity-60" alt="farm" src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80" fill sizes="50vw" priority style={{ objectFit: "cover", mixBlendMode: "overlay" }} />
        </div>
        <div className="relative z-10 p-margin-desktop flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary-fixed text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>agriculture</span>
            <h1 className="font-headline-lg text-headline-lg text-primary-fixed">Krishi Market</h1>
          </div>
          <div className="max-w-xl">
            <h2 className="font-display-lg text-display-lg text-surface mb-6">Set a New Password</h2>
            <p className="font-body-lg text-body-lg text-primary-fixed-dim">Choose a strong password to secure your account.</p>
          </div>
          <div className="flex gap-8 items-center text-primary-fixed">
            <div><span className="font-headline-md text-headline-md">Secure</span><span className="font-label-sm text-label-sm uppercase opacity-80">End-to-end</span></div>
            <div className="w-px h-12 bg-white/20" />
            <div><span className="font-headline-md text-headline-md">Encrypted</span><span className="font-label-sm text-label-sm uppercase opacity-80">Data Protection</span></div>
          </div>
        </div>
      </section>
      <section className="flex-1 flex flex-col justify-center px-margin-mobile md:px-12 py-12 bg-white">
        <div className="max-w-md mx-auto w-full">
          <div className="flex md:hidden items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>agriculture</span>
            <span className="font-headline-md text-headline-md text-primary">Krishi Market</span>
          </div>
          <header className="mb-10">
            <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">Reset your password</h3>
            <p className="font-body-md text-on-surface-variant">{success ? "Your password has been updated." : "Enter your new password below."}</p>
          </header>

          {success ? (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-primary-fixed/20 text-primary flex items-center gap-4">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <div>
                  <p className="font-label-md">Password reset successful!</p>
                  <p className="text-sm">You can now sign in with your new password.</p>
                </div>
              </div>
              <Link href="/auth/login" className="block w-full h-14 bg-primary text-white font-label-md rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2">
                Sign In Now
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={hs} className="space-y-6">
              {error && <div className="p-4 rounded-xl bg-error-container text-on-error-container">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="new-password">New Password</label>
                  <div className="relative">
                    <input className="w-full h-14 px-4 pr-12 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0" id="new-password" placeholder="Min 6 characters" required type={sp ? "text" : "password"} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" onClick={() => setSp(!sp)} className="absolute right-4 top-1/2 -translate-y-1/2"><span className="material-symbols-outlined">{sp ? "visibility_off" : "visibility"}</span></button>
                  </div>
                </div>
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="confirm-password">Confirm Password</label>
                  <input className="w-full h-14 px-4 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0" id="confirm-password" placeholder="Re-enter password" required type={sp ? "text" : "password"} minLength={6} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white font-label-md rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><span className="animate-spin material-symbols-outlined">progress_activity</span> Resetting...</> : <>Reset Password<span className="material-symbols-outlined text-xl">arrow_forward</span></>}
              </button>
              <p className="text-center font-body-md text-on-surface-variant pt-2">
                Remember your password? <Link href="/auth/login" className="text-primary font-bold hover:underline">Sign In</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
