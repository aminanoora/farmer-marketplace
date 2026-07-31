"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { adminAPI } from "./api";

/* ─── Types ──────────────────────────────────── */
export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: "admin";
  phone?: string;
  avatar?: string;
}

interface AdminAuthContextType {
  user: AdminUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
}

/* ─── Helpers ────────────────────────────────── */
const ADMIN_CACHE_KEY = "krishi_admin_user_cache";
const ADMIN_CACHE_TTL = 30_000; // 30 seconds

interface AdminAuthCache {
  user: AdminUser;
  expiry: number;
}

function readAdminCache(): AdminUser | null {
  try {
    const raw = localStorage.getItem(ADMIN_CACHE_KEY);
    if (!raw) return null;
    const cached: AdminAuthCache = JSON.parse(raw);
    if (Date.now() < cached.expiry) {
      return cached.user;
    }
    localStorage.removeItem(ADMIN_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function writeAdminCache(user: AdminUser) {
  try {
    const cache: AdminAuthCache = { user, expiry: Date.now() + ADMIN_CACHE_TTL };
    localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore quota errors */ }
}

function clearAdminCache() {
  localStorage.removeItem(ADMIN_CACHE_KEY);
}

/* ─── Context ────────────────────────────────── */
const AdminAuthContext = createContext<AdminAuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

/* ─── Provider ────────────────────────────────── */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("krishi_admin_token");
    if (token) {
      // Try cached admin user first — avoids API call on every page navigation
      const cached = readAdminCache();
      if (cached) {
        setUser(cached);
        setLoading(false);
        return;
      }

      adminAPI
        .getMe()
        .then((res) => {
          setUser(res.data.user);
          writeAdminCache(res.data.user);
        })
        .catch(() => {
          localStorage.removeItem("krishi_admin_token");
          clearAdminCache();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string, userData: AdminUser) => {
    localStorage.setItem("krishi_admin_token", token);
    writeAdminCache(userData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("krishi_admin_token");
    clearAdminCache();
    setUser(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

/* ─── Hook ────────────────────────────────────── */
export const useAdminAuth = () => useContext(AdminAuthContext);
