"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

/* ─── Types ──────────────────────────────────── */
export interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  unit: string;
  image: string;
  farmerName: string;
  isOrganic: boolean;
  farmerId?: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  toggleItem: (item: WishlistItem) => void;
  isFavorite: (productId: string) => boolean;
  getCount: () => number;
  clearAll: () => void;
}

const STORAGE_KEY = "krishi_wishlist";

/* ─── Context ────────────────────────────────── */
const WishlistContext = createContext<WishlistContextType>({
  items: [],
  toggleItem: () => {},
  isFavorite: () => false,
  getCount: () => 0,
  clearAll: () => {},
});

/* ─── Provider ────────────────────────────────── */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever items change
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, hydrated]);

  const toggleItem = useCallback((item: WishlistItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.filter((i) => i.productId !== item.productId);
      }
      return [...prev, item];
    });
  }, []);

  const isFavorite = useCallback((productId: string) => {
    return items.some((i) => i.productId === productId);
  }, [items]);

  const getCount = useCallback(() => {
    return items.length;
  }, [items]);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <WishlistContext.Provider
      value={{
        items,
        toggleItem,
        isFavorite,
        getCount,
        clearAll,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

/* ─── Hook ────────────────────────────────────── */
export const useWishlist = () => useContext(WishlistContext);
