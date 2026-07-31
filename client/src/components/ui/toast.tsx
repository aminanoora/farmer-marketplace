"use client";

import { useEffect, useState } from "react";

/* ─── Types ──────────────────────────────────── */
export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

/* ─── Icons & Styles ──────────────────────────── */
const icons: Record<ToastType, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
  warning: "warning",
};

function getToastClasses(type: ToastType, visible: boolean, exiting: boolean): string {
  const bg = {
    success: "bg-success-container text-on-success-container border-success/30",
    error: "bg-error-container text-on-error-container border-error/30",
    info: "bg-primary-fixed-dim text-primary-fixed border-primary/30",
    warning: "bg-tertiary-container text-on-tertiary-container border-tertiary/30",
  }[type];

  const state = visible && !exiting ? "translate-x-0 opacity-100" : "translate-x-full opacity-0";

  return [
    "flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-sm",
    "transition-all duration-300 ease-out",
    bg,
    state,
  ].join(" ");
}

/* ─── Single Toast Item ──────────────────────── */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(enter);
  }, []);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      role="alert"
      className={getToastClasses(toast.type, visible, exiting)}
    >
      <span
        className="material-symbols-outlined text-[22px] shrink-0 mt-0.5"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icons[toast.type]}
      </span>
      <p className="flex-1 font-body-md text-sm">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 rounded-full hover:opacity-80 transition-opacity"
        aria-label="Dismiss"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

/* ─── Toast Container ─────────────────────────── */
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
