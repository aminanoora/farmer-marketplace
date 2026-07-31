"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authAPI } from "./api";

/* ─── Types ──────────────────────────────────── */
export interface User {
  _id: string;
  name: string;
  email: string;
  role: "consumer" | "farmer" | "admin";
  phone?: string;
  farmName?: string;
  avatar?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

/* ─── Helpers ────────────────────────────────── */
const AUTH_CACHE_KEY = "krishi_user_cache";
const AUTH_CACHE_TTL = 30_000; // 30 seconds

interface AuthCache {
  user: User;
  expiry: number;
}

function readAuthCache(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const cached: AuthCache = JSON.parse(raw);
    if (Date.now() < cached.expiry) {
      return cached.user;
    }
    localStorage.removeItem(AUTH_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function writeAuthCache(user: User) {
  try {
    const cache: AuthCache = { user, expiry: Date.now() + AUTH_CACHE_TTL };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore quota errors */ }
}

function clearAuthCache() {
  localStorage.removeItem(AUTH_CACHE_KEY);
}

/* ─── Context ────────────────────────────────── */
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

/* ─── Provider ────────────────────────────────── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("krishi_token");
    if (token) {
      // Try cached user first — avoids API call on every page navigation
      const cached = readAuthCache();
      if (cached) {
        setUser(cached);
        setLoading(false);
        return;
      }

      authAPI
        .me()
        .then((res) => {
          setUser(res.data.user);
          writeAuthCache(res.data.user);
        })
        .catch(() => {
          localStorage.removeItem("krishi_token");
          clearAuthCache();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem("krishi_token", token);
    writeAuthCache(userData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("krishi_token");
    clearAuthCache();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Hook ────────────────────────────────────── */
export const useAuth = () => useContext(AuthContext);
