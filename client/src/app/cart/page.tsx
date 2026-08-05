"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import SiteHeader from "@/components/site-header";
import { useNotification } from "@/lib/notification-context";

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, getTotal, getItemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const { showInfo, showError, showWarning } = useNotification();

  const total = getTotal();
  const itemCount = getItemCount();

  const handleCheckout = () => {
    if (!isAuthenticated) {
      showError("Please sign in to continue with your order.");
      setTimeout(() => router.push("/auth/login?redirect=/checkout"), 800);
      return;
    }
    router.push("/checkout");
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SiteHeader activePage="" />

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-lg">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Cart ({itemCount})</span>
        </nav>

        {items.length === 0 ? (
          /* Empty Cart */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[48px] text-outline">shopping_cart</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary mb-2">Your cart is empty</h1>
            <p className="text-on-surface-variant font-body-md max-w-md mb-8">
              Looks like you haven&apos;t added any fresh produce yet. Browse the marketplace to find farm-fresh items!
            </p>
            <Link href="/marketplace" className="px-8 py-4 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2">
              <span className="material-symbols-outlined">storefront</span>
              Browse Marketplace
            </Link>
            <div className="mt-12 flex items-center gap-8 text-on-surface-variant font-label-sm">
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">verified</span>Direct from Farms</div>
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">eco</span>Organic Options</div>
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">local_shipping</span>Free Delivery</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-lg">
              <div className="flex items-center justify-between">
                <h1 className="font-headline-lg text-headline-lg text-primary">Shopping Cart</h1>
                <button onClick={() => { clearCart(); showWarning("Cart cleared."); }} className="text-error font-label-md hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Clear All
                </button>
              </div>

              {items.map((item) => (
                <div key={item.productId} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md md:p-lg flex flex-col sm:flex-row gap-md transition-all hover:shadow-md">
                  {/* Image */}
                  <div className="relative w-full sm:w-28 h-28 rounded-xl overflow-hidden bg-surface-variant flex-shrink-0">
                    {item.image ? (
                      <Image fill sizes="112px" className="object-cover" src={item.image} alt={item.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[36px] text-outline">eco</span>
                      </div>
                    )}
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <Link href={"/marketplace/" + item.productId} className="font-headline-md text-[18px] text-primary hover:underline">{item.name}</Link>
                        <p className="text-label-sm text-on-surface-variant mt-1">{item.farmerName}</p>
                        {item.isOrganic && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase">
                            <span className="material-symbols-outlined text-[12px]">eco</span>Organic
                          </span>
                        )}
                      </div>
                      <span className="font-headline-md text-[20px] text-on-tertiary-container whitespace-nowrap">₹{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      {/* Quantity Controls */}
                      <div className="flex items-center border border-outline-variant rounded-lg overflow-hidden bg-white">
                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="px-3 py-2 hover:bg-surface-container transition-colors">
                          <span className="material-symbols-outlined text-[18px]">remove</span>
                        </button>
                        <input className="w-12 text-center border-none focus:ring-0 font-label-md text-on-surface" type="number" min={1} max={item.maxQuantity} value={item.quantity} readOnly />
                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= item.maxQuantity} className="px-3 py-2 hover:bg-surface-container transition-colors disabled:opacity-30">
                          <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                      </div>
                      <span className="text-label-sm text-on-surface-variant">₹{item.price}/{item.unit}</span>
                      {/* Remove */}
                      <button onClick={() => { removeItem(item.productId); showInfo("Removed \"" + item.name + "\" from cart."); }} className="p-2 text-on-surface-variant hover:text-error transition-colors" title="Remove item">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-surface-container-low rounded-xl border border-outline-variant p-lg sticky top-24">
                <h2 className="font-headline-md text-headline-md text-primary mb-lg">Order Summary</h2>
                <div className="space-y-md mb-lg">
                  <div className="flex justify-between text-on-surface-variant font-body-md">
                    <span>Items ({itemCount})</span>
                    <span>₹{total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant font-body-md">
                    <span>Delivery</span>
                    <span className="text-primary font-label-md">Free</span>
                  </div>
                  <div className="border-t border-outline-variant pt-md flex justify-between font-headline-md text-[20px] text-primary">
                    <span>Total</span>
                    <span>₹{total.toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={handleCheckout} className="w-full py-4 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-md">
                  <span className="material-symbols-outlined">lock</span>
                  Place Order
                </button>
                <Link href="/marketplace" className="w-full py-3 text-primary font-label-md rounded-xl border-2 border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Continue Shopping
                </Link>
                <div className="mt-lg pt-lg border-t border-outline-variant space-y-sm">
                  <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-primary">verified</span>Secure checkout
                  </div>
                  <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-primary">cycle</span>Support local farmers
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 md:hidden shadow-lg z-50 rounded-t-xl border-t border-outline-variant/30 bg-surface-container-lowest">
        <Link href="/marketplace" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined">storefront</span>
          <span className="font-label-sm text-[10px]">Shop</span>
        </Link>
        <Link href="/cart" className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-2xl px-6 py-2">
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="font-label-sm text-[10px]">Cart</span>
        </Link>
        <Link href="/orders" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="font-label-sm text-[10px]">Orders</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-[10px]">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
