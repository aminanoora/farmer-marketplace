"use client";

import Link from "next/link";
import { useWishlist } from "@/lib/wishlist-context";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import SiteHeader from "@/components/site-header";

export default function WishlistPage() {
  const { items, toggleItem, getCount, clearAll } = useWishlist();
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();

  const count = getCount();

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SiteHeader activePage="" />

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-lg">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Wishlist ({count})</span>
        </nav>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[48px] text-outline" style={{ fontVariationSettings: "'FILL' 0" }}>favorite</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary mb-2">Your wishlist is empty</h1>
            <p className="text-on-surface-variant font-body-md max-w-md mb-8">
              Save your favorite farm-fresh products by tapping the heart icon. Start browsing and create your wishlist!
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
          <>
            {/* Header with clear */}
            <div className="flex items-center justify-between mb-lg">
              <h1 className="font-headline-lg text-headline-lg text-primary">My Wishlist</h1>
              <button onClick={clearAll} className="text-error font-label-md hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Clear All
              </button>
            </div>

            {/* Wishlist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-lg">
              {items.map((item) => (
                <div key={item.productId} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden group flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  {/* Image */}
                  <Link href={"/marketplace/" + item.productId} className="relative aspect-[4/3] overflow-hidden bg-surface-container-high block">
                    {item.image ? (
                      <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src={item.image} alt={item.name} loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[64px] text-outline">eco</span>
                      </div>
                    )}
                    {item.isOrganic && (
                      <span className="absolute top-3 left-3 px-3 py-1 bg-primary text-on-primary text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-[12px]">eco</span>Organic
                      </span>
                    )}
                    {/* Heart button overlay */}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleItem(item); }}
                      className="absolute top-3 right-3 w-9 h-9 bg-surface-container-lowest/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                      title="Remove from wishlist"
                    >
                      <span className="material-symbols-outlined text-[20px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    </button>
                  </Link>

                  {/* Info */}
                  <div className="p-lg flex flex-col flex-grow">
                    <Link href={"/marketplace/" + item.productId} className="font-headline-md text-[18px] text-primary hover:underline mb-1">{item.name}</Link>
                    <p className="font-label-sm text-on-surface-variant mb-2 truncate">{item.farmerName}</p>
                    <div className="flex items-center justify-between mt-auto pt-3">
                      <span className="font-headline-md text-[20px] text-on-tertiary-container">
                        ₹{item.price}
                        <span className="text-label-sm font-normal text-on-surface-variant">/{item.unit}</span>
                      </span>
                      <button
                        onClick={() => addItem({
                          productId: item.productId,
                          name: item.name,
                          price: item.price,
                          unit: item.unit,
                          image: item.image,
                          farmerId: item.farmerId || "",
                          farmerName: item.farmerName,
                          isOrganic: item.isOrganic,
                          isAvailable: true,
                          maxQuantity: 100,
                        })}
                        className="px-4 py-2 bg-primary text-on-primary font-label-sm text-label-sm rounded-lg hover:opacity-90 transition-all active:scale-95 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 md:hidden shadow-lg z-50 rounded-t-xl border-t border-outline-variant/30 bg-surface-container-lowest">
        <Link href="/marketplace" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined">storefront</span>
          <span className="font-label-sm text-[10px]">Shop</span>
        </Link>
        <Link href="/wishlist" className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-2xl px-6 py-2">
          <span className="material-symbols-outlined">favorite</span>
          <span className="font-label-sm text-[10px]">Wishlist</span>
        </Link>
        <Link href="/cart" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="font-label-sm text-[10px]">Cart</span>
        </Link>
        {isAuthenticated ? (
          <Link href="/profile" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
            <span className="material-symbols-outlined">person</span>
            <span className="font-label-sm text-[10px]">Profile</span>
          </Link>
        ) : (
          <Link href="/auth/login" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
            <span className="material-symbols-outlined">person</span>
            <span className="font-label-sm text-[10px]">Sign In</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
