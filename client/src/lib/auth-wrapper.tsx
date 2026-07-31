"use client";

import { AuthProvider } from "./auth-context";
import { CartProvider } from "./cart-context";
import { WishlistProvider } from "./wishlist-context";
import { NotificationProvider } from "./notification-context";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            {children}
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}
