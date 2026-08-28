"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authAPI, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";
import ForgotPasswordModal from "@/components/forgot-password-modal";

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Please enter a valid email address.";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showError, showSuccess } = useNotification();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sp, setSp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const scrollToFirstError = () => {
    // Find the first error message and scroll to it
    setTimeout(() => {
      const firstError = formRef.current?.querySelector('[data-error="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr) errors.email = emailErr;
    if (passErr) errors.password = passErr;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      triggerShake();
      scrollToFirstError();
    }
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError(null);
    setLoading(true);
    try {
      const r = await authAPI.login({ email: email.trim(), password });
      login(r.data.token, r.data.user);
      showSuccess("Welcome back! You've been signed in successfully.");
      setTimeout(() => router.push("/"), 800);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "Login failed. Please try again.");
      setError(msg);
      showError(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left: Visual Narrative */}
      <section className="hidden md:flex md:w-1/2 lg:w-3/5 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            className="w-full h-full object-cover opacity-60"
            alt="farm"
            src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80"
            fill
            sizes="50vw"
            priority
            style={{ objectFit: "cover", mixBlendMode: "overlay" }}
          />
        </div>
        <div className="relative z-10 p-margin-desktop flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary-fixed text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>agriculture</span>
            <h1 className="font-headline-lg text-headline-lg text-primary-fixed">Krishi Market</h1>
          </div>
          <div className="max-w-xl">
            <h2 className="font-display-lg text-display-lg text-surface mb-6">Welcome Back to the Marketplace</h2>
            <p className="font-body-lg text-body-lg text-primary-fixed-dim">Access your farm-fresh dashboard. Your trusted source for local, organic produce is just a sign-in away.</p>
          </div>
          <div className="flex gap-8 items-center text-primary-fixed">
            <div><span className="font-headline-md text-headline-md">10K+</span><span className="font-label-sm text-label-sm uppercase opacity-80">Happy Customers</span></div>
            <div className="w-px h-12 bg-white/20" />
            <div><span className="font-headline-md text-headline-md">500+</span><span className="font-label-sm text-label-sm uppercase opacity-80">Verified Farmers</span></div>
          </div>
        </div>
      </section>

      {/* Right: Login Form */}
      <section className="flex-1 flex flex-col justify-center px-margin-mobile md:px-12 py-12 overflow-y-auto bg-white">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile Logo */}
          <div className="flex md:hidden items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>agriculture</span>
            <span className="font-headline-md text-headline-md text-primary">Krishi Market</span>
          </div>

          <header className="mb-10">
            <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">Welcome back</h3>
            <p className="font-body-md text-on-surface-variant">Sign in to your account to continue.</p>
          </header>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className={`space-y-6 transition-all duration-300 ${shake ? "animate-shake" : ""}`}
            noValidate
          >
            {/* API Error Banner - only shows if there's a non-field error */}
            {error && (
              <div className="p-4 rounded-xl bg-error-container text-on-error-container border border-error/20 flex items-start gap-3 animate-slideDown">
                <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                <p className="font-body-md text-sm flex-1">{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="shrink-0 p-0.5 rounded-full hover:opacity-80 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block font-label-md mb-1.5 ml-1" htmlFor="email">
                  Email Address
                  {fieldErrors.email && <span className="text-error ml-1">*</span>}
                </label>
                <input
                  className={`w-full h-14 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-all duration-200 ${
                    fieldErrors.email
                      ? "border-error focus:border-error ring-2 ring-error/20"
                      : "border-surface-container-highest focus:border-primary"
                  }`}
                  id="email"
                  placeholder="name@example.com"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                  }}
                  onBlur={() => {
                    const err = validateEmail(email);
                    if (err) {
                      setFieldErrors((p) => ({ ...p, email: err }));
                    }
                  }}
                  aria-invalid={fieldErrors.email ? "true" : "false"}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
                {fieldErrors.email && (
                  <p
                    id="email-error"
                    data-error="true"
                    className="mt-1.5 ml-1 text-error text-label-sm flex items-center gap-1 animate-slideDown"
                  >
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-label-md mb-1.5 ml-1" htmlFor="password">
                  Password
                  {fieldErrors.password && <span className="text-error ml-1">*</span>}
                </label>
                <div className="relative">
                  <input
                    className={`w-full h-14 px-4 pr-12 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-all duration-200 ${
                      fieldErrors.password
                        ? "border-error focus:border-error ring-2 ring-error/20"
                        : "border-surface-container-highest focus:border-primary"
                    }`}
                    id="password"
                    placeholder="Enter your password"
                    required
                    type={sp ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                    }}
                    onBlur={() => {
                      const err = validatePassword(password);
                      if (err) {
                        setFieldErrors((p) => ({ ...p, password: err }));
                      }
                    }}
                    aria-invalid={fieldErrors.password ? "true" : "false"}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setSp(!sp)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
                    aria-label={sp ? "Hide password" : "Show password"}
                  >
                    <span className="material-symbols-outlined">{sp ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                {fieldErrors.password && (
                  <p
                    id="password-error"
                    data-error="true"
                    className="mt-1.5 ml-1 text-error text-label-sm flex items-center gap-1 animate-slideDown"
                  >
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  className="w-4 h-4 rounded border-2 border-outline-variant text-primary focus:ring-primary"
                  id="remember"
                  type="checkbox"
                />
                <label className="font-body-md text-on-surface-variant text-sm" htmlFor="remember">Remember me</label>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPwd(true)}
                className="text-primary text-sm font-semibold hover:underline underline-offset-2 transition-all"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary text-white font-label-md rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="animate-spin material-symbols-outlined">progress_activity</span>
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </>
              )}
            </button>

            <p className="text-center font-body-md text-on-surface-variant pt-2">
              Don&apos;t have an account?{" "}
              <Link href="/auth/register" className="text-primary font-bold hover:underline underline-offset-2 transition-all">
                Create one
              </Link>
            </p>
          </form>

          <ForgotPasswordModal isOpen={showForgotPwd} onClose={() => setShowForgotPwd(false)} />

          <footer className="mt-12 pt-8 border-t border-outline-variant flex justify-center gap-8 grayscale opacity-50">
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span className="text-[10px] font-bold uppercase">Secure Data</span>
            <span className="material-symbols-outlined text-sm">workspace_premium</span>
            <span className="text-[10px] font-bold uppercase">Certified Platform</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
