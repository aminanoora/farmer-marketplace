"use client";

import { useState, useEffect } from "react";
import { authAPI } from "@/lib/api";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "sent" | "done">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever modal opens (hooks must be called before any early return)
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setStep("email");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    setError(null);
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setStep("sent");
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h3 className="font-headline-md text-headline-md text-primary">
            {step === "done" ? "Password Reset" : "Reset Password"}
          </h3>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-high transition-colors" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {step === "email" && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">              <p className="font-body-md text-on-surface-variant">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

            {error && <div className="p-3 rounded-xl bg-error-container text-on-error-container text-sm">{error}</div>}
            <div>
              <label className="block font-label-md mb-1.5 ml-1" htmlFor="reset-email">Email Address</label>
              <input className="w-full h-14 px-4 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0" id="reset-email" placeholder="name@example.com" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 h-12 border-2 border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container-high transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 h-12 bg-primary text-white font-label-md rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><span className="animate-spin material-symbols-outlined text-lg">progress_activity</span> Sending...</> : <>Send Reset Link</>}
              </button>
            </div>
          </form>
        )}

        {step === "sent" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-fixed/20 text-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
              <p className="font-body-md">Check your email for the reset link. If you don&apos;t see it, check your spam folder.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-12 border-2 border-outline-variant text-on-surface font-label-md rounded-xl hover:bg-surface-container-high transition-colors">Close</button>
              <button onClick={() => { setStep("email"); setError(null); }} className="flex-1 h-12 text-primary font-label-md rounded-xl hover:bg-surface-container-high transition-colors">Send again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
