"use client";

import { AdminAuthProvider } from "@/lib/admin-auth-context";

// Admin pages are fully client-side (use localStorage, context, hooks)
// Skip static prerendering to avoid SSR issues with browser-only APIs
export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
