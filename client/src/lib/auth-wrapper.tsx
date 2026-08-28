"use client";

import { AuthProvider } from "./auth-context";
import { CartProvider } from "./cart-context";
import { WishlistProvider } from "./wishlist-context";
import { NotificationProvider } from "./notification-context";
import { MaintenanceProvider } from "./maintenance-context";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MaintenanceProvider>
      <NotificationProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              {children}
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </NotificationProvider>
    </MaintenanceProvider>
  );
}
