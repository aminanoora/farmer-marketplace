"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authAPI, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";

function validateName(name: string): string | null {
  if (!name.trim()) return "Full name is required.";
  if (name.trim().length < 2) return "Name must be at least 2 characters.";
  return null;
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Please enter a valid email address.";
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return "Phone number is required.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "Please enter a valid 10-digit phone number.";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showError, showSuccess } = useNotification();
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<"consumer" | "farmer">("consumer");
  const [fd, setFd] = useState({ name: "", email: "", phone: "", password: "", farmName: "" });
  const [sp, setSp] = useState(false);
  const [at, setAt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const scrollToFirstError = () => {
    setTimeout(() => {
      const firstError = formRef.current?.querySelector('[data-error="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const hc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFd((p) => ({ ...p, [id]: value }));
    if (fieldErrors[id]) setFieldErrors((p) => ({ ...p, [id]: undefined }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const nameErr = validateName(fd.name);
    const emailErr = validateEmail(fd.email);
    const phoneErr = validatePhone(fd.phone);
    const passErr = validatePassword(fd.password);
    if (nameErr) errors.name = nameErr;
    if (emailErr) errors.email = emailErr;
    if (phoneErr) errors.phone = phoneErr;
    if (passErr) errors.password = passErr;
    if (!at) errors.terms = "Please agree to the Terms & Privacy Policy.";
    if (role === "farmer" && !fd.farmName.trim()) errors.farmName = "Farm name is required for farmers.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      triggerShake();
      scrollToFirstError();
    }
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (id: string) => {
    let err: string | null = null;
    switch (id) {
      case "name": err = validateName(fd.name); break;
      case "email": err = validateEmail(fd.email); break;
      case "phone": err = validatePhone(fd.phone); break;
      case "password": err = validatePassword(fd.password); break;
      case "farmName": if (role === "farmer" && !fd.farmName.trim()) err = "Farm name is required for farmers."; break;
    }
    if (err) setFieldErrors((p) => ({ ...p, [id]: err }));
  };

  const hs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError(null);
    setLoading(true);
    try {
      const payload: {
        name: string;
        email: string;
        password: string;
        role: "farmer" | "consumer";
        phone: string;
        farmName?: string;
      } = {
        name: fd.name.trim(),
        email: fd.email.trim(),
        password: fd.password,
        role: role as "farmer" | "consumer",
        phone: fd.phone.trim(),
      };
      if (role === "farmer") payload.farmName = fd.farmName.trim();
      const r = await authAPI.register(payload);
      login(r.data.token, r.data.user);
      showSuccess("Account created successfully! Welcome to Krishi Market.");
      setTimeout(() => router.push("/"), 800);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "Registration failed. Please try again.");
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
            <h2 className="font-display-lg text-display-lg text-surface mb-6">Rooted in Tradition, Growing with Tech.</h2>
            <p className="font-body-lg text-body-lg text-primary-fixed-dim">Join 50,000+ farmers and consumers.</p>
          </div>
          <div className="flex gap-8 items-center text-primary-fixed">
            <div><span className="font-headline-md text-headline-md">100%</span><span className="font-label-sm text-label-sm uppercase opacity-80">Verified Farmers</span></div>
            <div className="w-px h-12 bg-white/20" />
            <div><span className="font-headline-md text-headline-md">Direct</span><span className="font-label-sm text-label-sm uppercase opacity-80">Farm to Table</span></div>
          </div>
        </div>
      </section>

      {/* Right: Registration Form */}
      <section className="flex-1 flex flex-col justify-center px-margin-mobile md:px-12 py-12 overflow-y-auto bg-white">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile Logo */}
          <div className="flex md:hidden items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>agriculture</span>
            <span className="font-headline-md text-headline-md text-primary">Krishi Market</span>
          </div>

          <header className="mb-10">
            <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">Create your account</h3>
            <p className="font-body-md text-on-surface-variant">Welcome! Let&apos;s get you set up.</p>
          </header>

          <form
            ref={formRef}
            onSubmit={hs}
            className={`space-y-6 transition-all duration-300 ${shake ? "animate-shake" : ""}`}
            noValidate
          >
            {/* API Error Banner */}
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

            {/* Role Selection */}
            <div className="space-y-3">
              <label className="font-label-md text-label-md text-on-surface">I am a...</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole("consumer")}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-2 text-left ${
                    role === "consumer"
                      ? "border-primary bg-surface-container ring-2 ring-primary/20"
                      : "border-outline-variant hover:border-outline"
                  }`}
                >
                  <span className={`material-symbols-outlined ${role === "consumer" ? "text-primary" : "text-on-surface-variant"}`}>shopping_basket</span>
                  <span className={`material-symbols-outlined text-primary ${role === "consumer" ? "block" : "hidden"}`} style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <p className="font-label-md text-label-md text-on-surface">Consumer</p>
                  <p className="text-[12px] text-on-surface-variant">Buying fresh products</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("farmer")}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-2 text-left ${
                    role === "farmer"
                      ? "border-primary bg-surface-container ring-2 ring-primary/20"
                      : "border-outline-variant hover:border-outline"
                  }`}
                >
                  <span className={`material-symbols-outlined ${role === "farmer" ? "text-primary" : "text-on-surface-variant"}`}>agriculture</span>
                  <span className={`material-symbols-outlined text-primary ${role === "farmer" ? "block" : "hidden"}`} style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <p className="font-label-md text-label-md text-on-surface">Farmer</p>
                  <p className="text-[12px] text-on-surface-variant">Selling farm produce</p>
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block font-label-md mb-1.5 ml-1" htmlFor="name">
                  Full Name
                  {fieldErrors.name && <span className="text-error ml-1">*</span>}
                </label>
                <input
                  className={`w-full h-14 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-all duration-200 ${
                    fieldErrors.name
                      ? "border-error focus:border-error ring-2 ring-error/20"
                      : "border-surface-container-highest focus:border-primary"
                  }`}
                  id="name"
                  placeholder="Legal name"
                  required
                  type="text"
                  value={fd.name}
                  onChange={hc}
                  onBlur={() => handleBlur("name")}
                  aria-invalid={fieldErrors.name ? "true" : "false"}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                />
                {fieldErrors.name && (
                  <p id="name-error" data-error="true" className="mt-1.5 ml-1 text-error text-label-sm flex items-center gap-1 animate-slideDown">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="email">
                    Email
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
                    value={fd.email}
                    onChange={hc}
                    onBlur={() => handleBlur("email")}
                    aria-invalid={fieldErrors.email ? "true" : "false"}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  />
                  {fieldErrors.email && (
                    <p id="email-error" data-error="true" className="mt-1.5 ml-1 text-error text-label-sm flex items-center gap-1 animate-slideDown">
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="phone">
                    Phone
                    {fieldErrors.phone && <span className="text-error ml-1">*</span>}
                  </label>
                  <input
                    className={`w-full h-14 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-all duration-200 ${
                      fieldErrors.phone
                        ? "border-error focus:border-error ring-2 ring-error/20"
                        : "border-surface-container-highest focus:border-primary"
                    }`}
                    id="phone"
                    placeholder="+91 00000 00000"
                    required
                    type="tel"
                    value={fd.phone}
                    onChange={hc}
                    onBlur={() => handleBlur("phone")}
                    aria-invalid={fieldErrors.phone ? "true" : "false"}
                    aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                  />
                  {fieldErrors.phone && (
                    <p id="phone-error" data-error="true" className="mt-1.5 ml-1 text-error text-label-sm flex items-center gap-1 animate-slideDown">
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                      {fieldErrors.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Farm Name (conditional) */}
              {role === "farmer" && (
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="farmName">
                    Farm Name
                    {fieldErrors.farmName && <span className="text-error ml-1">*</span>}
                  </label>
                  <input
                    className={`w-full h-14 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-all duration-200 ${
                      fieldErrors.farmName
                        ? "border-error focus:border-error ring-2 ring-error/20"
                        : "border-surface-container-highest focus:border-primary"
                    }`}
                    id="farmName"
                    placeholder="Your farm name"
                    type="text"
                    value={fd.farmName}
                    onChange={hc}
                    onBlur={() => handleBlur("farmName")}
                    aria-invalid={fieldErrors.farmName ? "true" : "false"}
                    aria-describedby={fieldErrors.farmName ? "farmName-error" : undefined}
                  />
                  {fieldErrors.farmName && (
                    <p id="farmName-error" data-error="true" className="mt-1.5 ml-1 text-error text-label-sm flex items-center gap-1 animate-slideDown">
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                      {fieldErrors.farmName}
                    </p>
                  )}
                </div>
              )}

              {/* Password */}
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
                    placeholder="Min 6 characters"
                    required
                    type={sp ? "text" : "password"}
                    minLength={6}
                    value={fd.password}
                    onChange={hc}
                    onBlur={() => handleBlur("password")}
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
                  <p id="password-error" data-error="true" className="mt-1.5 ml-1 text-error text-label-sm flex items-center gap-1 animate-slideDown">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                className={`w-5 h-5 rounded border-2 text-primary focus:ring-primary transition-all duration-200 ${
                  fieldErrors.terms ? "border-error ring-2 ring-error/20" : "border-outline-variant"
                }`}
                id="terms"
                required
                type="checkbox"
                checked={at}
                onChange={(e) => {
                  setAt(e.target.checked);
                  if (fieldErrors.terms) setFieldErrors((p) => ({ ...p, terms: undefined }));
                }}
                aria-invalid={fieldErrors.terms ? "true" : "false"}
              />
              <label className="font-body-md text-on-surface-variant" htmlFor="terms">
                I agree to the <span className="text-primary font-medium hover:underline cursor-pointer">Terms of Service</span> &amp; <span className="text-primary font-medium hover:underline cursor-pointer">Privacy Policy</span>.
              </label>
            </div>
            {fieldErrors.terms && (
              <p data-error="true" className="mt-0 text-error text-label-sm flex items-center gap-1 animate-slideDown">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                {fieldErrors.terms}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary text-white font-label-md rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="animate-spin material-symbols-outlined">progress_activity</span>
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </>
              )}
            </button>

            <p className="text-center font-body-md text-on-surface-variant pt-2">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary font-bold hover:underline underline-offset-2 transition-all">
                Sign In
              </Link>
            </p>
          </form>

          <footer className="mt-12 pt-8 border-t border-outline-variant flex justify-center gap-8 grayscale opacity-50">
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span className="text-[10px] font-bold uppercase">Secure Data</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
