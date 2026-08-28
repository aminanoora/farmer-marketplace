"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useNotification } from "@/lib/notification-context";
import SiteHeader from "@/components/site-header";
import { consumerAPI, getApiErrorMessage } from "@/lib/api";

interface AddressForm {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

type PaymentMethod = "cod" | "online";

interface FormErrors {
  fullName?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  payment?: string;
  cart?: string;
}

function validateForm(data: AddressForm): FormErrors {
  const errors: FormErrors = {};
  if (!data.fullName.trim()) errors.fullName = "Full name is required.";
  else if (data.fullName.trim().length < 2) errors.fullName = "Name must be at least 2 characters.";
  if (!data.phone.trim()) errors.phone = "Phone number is required.";
  else if (data.phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a valid phone number (at least 10 digits).";
  if (!data.street.trim()) errors.street = "Street address is required.";
  if (!data.city.trim()) errors.city = "City is required.";
  if (!data.state.trim()) errors.state = "State is required.";
  if (!data.pincode.trim()) errors.pincode = "Pincode is required.";
  else if (!/^\d{6}$/.test(data.pincode.trim())) errors.pincode = "Pincode must be 6 digits.";
  return errors;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotal, getItemCount, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError: showErrorToast } = useNotification();
  const [address, setAddress] = useState<AddressForm>({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [deliverySlot, setDeliverySlot] = useState<{ date: string; timeSlot: string }>({
    date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    timeSlot: "morning",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Redirect to cart if empty
  useEffect(() => {
    if (items.length === 0 && !submitted) {
      router.push("/cart");
    }
  }, [items, router, submitted]);

  const total = getTotal();
  const itemCount = getItemCount();

  const handleChange = (field: keyof AddressForm, value: string) => {
    setAddress((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      router.push("/auth/login?redirect=/checkout");
      return;
    }

    const validationErrors = validateForm(address);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showErrorToast("Please fix the form errors before placing your order.");
      return;
    }

    setSubmitting(true);
    setOrderError(null);

    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        deliveryAddress: {
          fullName: address.fullName.trim(),
          phone: address.phone.trim(),
          street: address.street.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          pincode: address.pincode.trim(),
        },
        deliverySlot: {
          date: new Date(deliverySlot.date).toISOString(),
          timeSlot: deliverySlot.timeSlot,
        },
        paymentMethod,
        notes: notes.trim() || undefined,
      };

      const res = await consumerAPI.placeOrder(payload);
      clearCart();
      showSuccess("Order placed successfully! 🎉");
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "Failed to place order. Please try again.");
      setOrderError(msg);
      showErrorToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-20 h-20 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-[40px]" style={{ color: "#166534", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary mb-2">Order Placed! ✅</h1>
          <p className="text-on-surface-variant font-body-md mb-8">
            Your order has been placed successfully. You will receive a confirmation shortly. The farmer will prepare your fresh produce!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/marketplace" className="px-8 py-4 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all inline-flex items-center gap-2">
              <span className="material-symbols-outlined">storefront</span>
              Continue Shopping
            </Link>
            <Link href="/marketplace" className="px-8 py-4 border-2 border-primary text-primary font-label-md rounded-xl hover:bg-primary/5 transition-all inline-flex items-center gap-2">
              <span className="material-symbols-outlined">storefront</span>
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SiteHeader activePage="" />

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl">
        <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-lg">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/cart" className="hover:text-primary transition-colors">Cart</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Checkout</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-xl">
          {/* Delivery Address Form */}
          <div className="lg:col-span-3">
            <h1 className="font-headline-lg text-headline-lg text-primary mb-lg">Delivery Address</h1>

            <form onSubmit={handleSubmit} className="space-y-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="fullName">Full Name</label>
                  <input
                    id="fullName"
                    className={"w-full h-12 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-colors " + (errors.fullName ? "border-error focus:border-error" : "border-surface-container-highest focus:border-primary")}
                    placeholder="Your full name"
                    value={address.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                  />
                  {errors.fullName && <p className="mt-1 ml-1 text-error text-label-sm flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">error</span>{errors.fullName}</p>}
                </div>
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    className={"w-full h-12 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-colors " + (errors.phone ? "border-error focus:border-error" : "border-surface-container-highest focus:border-primary")}
                    placeholder="+91 98765 43210"
                    value={address.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                  {errors.phone && <p className="mt-1 ml-1 text-error text-label-sm flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">error</span>{errors.phone}</p>}
                </div>
              </div>

              <div>
                <label className="block font-label-md mb-1.5 ml-1" htmlFor="street">Street Address</label>
                <input
                  id="street"
                  className={"w-full h-12 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-colors " + (errors.street ? "border-error focus:border-error" : "border-surface-container-highest focus:border-primary")}
                  placeholder="House number, street, area"
                  value={address.street}
                  onChange={(e) => handleChange("street", e.target.value)}
                />
                {errors.street && <p className="mt-1 ml-1 text-error text-label-sm flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">error</span>{errors.street}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="city">City</label>
                  <input
                    id="city"
                    className={"w-full h-12 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-colors " + (errors.city ? "border-error focus:border-error" : "border-surface-container-highest focus:border-primary")}
                    placeholder="City"
                    value={address.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                  />
                  {errors.city && <p className="mt-1 ml-1 text-error text-label-sm flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">error</span>{errors.city}</p>}
                </div>
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="state">State</label>
                  <input
                    id="state"
                    className={"w-full h-12 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-colors " + (errors.state ? "border-error focus:border-error" : "border-surface-container-highest focus:border-primary")}
                    placeholder="State"
                    value={address.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                  />
                  {errors.state && <p className="mt-1 ml-1 text-error text-label-sm flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">error</span>{errors.state}</p>}
                </div>
                <div>
                  <label className="block font-label-md mb-1.5 ml-1" htmlFor="pincode">Pincode</label>
                  <input
                    id="pincode"
                    maxLength={6}
                    className={"w-full h-12 px-4 rounded-xl border-2 bg-surface-container-low focus:ring-0 transition-colors " + (errors.pincode ? "border-error focus:border-error" : "border-surface-container-highest focus:border-primary")}
                    placeholder="6-digit pincode"
                    value={address.pincode}
                    onChange={(e) => handleChange("pincode", e.target.value.replace(/\D/g, ""))}
                  />
                  {errors.pincode && <p className="mt-1 ml-1 text-error text-label-sm flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">error</span>{errors.pincode}</p>}
                </div>
              </div>

              {/* ─── Delivery Slot ──────────────── */}
              <div className="border-t border-outline-variant pt-lg">
                <h2 className="font-headline-md text-[20px] text-primary mb-md">Delivery Slot</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <div>
                    <label className="block font-label-md mb-1.5 ml-1" htmlFor="deliveryDate">Delivery Date</label>
                    <input
                      id="deliveryDate"
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full h-12 px-4 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0 transition-colors"
                      value={deliverySlot.date}
                      onChange={(e) => setDeliverySlot((p) => ({ ...p, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block font-label-md mb-1.5 ml-1">Time Slot</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "morning", label: "Morning", time: "9:00 AM - 12:00 PM", icon: "wb_sunny" },
                        { value: "afternoon", label: "Afternoon", time: "12:00 PM - 5:00 PM", icon: "light_mode" },
                        { value: "evening", label: "Evening", time: "5:00 PM - 8:00 PM", icon: "nightlight" },
                      ].map((slot) => (
                        <button
                          key={slot.value}
                          type="button"
                          onClick={() => setDeliverySlot((p) => ({ ...p, timeSlot: slot.value }))}
                          className={"flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left " + (deliverySlot.timeSlot === slot.value ? "border-primary bg-primary/5" : "border-surface-container-highest hover:border-primary/50")}
                        >
                          <span className={"material-symbols-outlined " + (deliverySlot.timeSlot === slot.value ? "text-primary" : "text-on-surface-variant")}>{slot.icon}</span>
                          <div>
                            <p className={"font-label-md " + (deliverySlot.timeSlot === slot.value ? "text-primary" : "text-on-surface")}>{slot.label}</p>
                            <p className="text-label-sm text-on-surface-variant">{slot.time}</p>
                          </div>
                          {deliverySlot.timeSlot === slot.value && (
                            <span className="material-symbols-outlined text-primary ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Payment Method ──────────────── */}
              <div className="border-t border-outline-variant pt-lg">
                <h2 className="font-headline-md text-[20px] text-primary mb-md">Payment Method</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    className={"flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left " + (paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-surface-container-highest hover:border-primary/50")}
                  >
                    <div className={"w-12 h-12 rounded-full flex items-center justify-center " + (paymentMethod === "cod" ? "bg-primary/10" : "bg-surface-container-high")}>
                      <span className={"material-symbols-outlined text-[24px] " + (paymentMethod === "cod" ? "text-primary" : "text-on-surface-variant")} style={{ fontVariationSettings: "'FILL' 0" }}>payments</span>
                    </div>
                    <div className="flex-1">
                      <p className={"font-label-md " + (paymentMethod === "cod" ? "text-primary" : "text-on-surface")}>Cash on Delivery</p>
                      <p className="text-label-sm text-on-surface-variant">Pay when you receive</p>
                    </div>
                    {paymentMethod === "cod" && (
                      <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online")}
                    className={"flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left " + (paymentMethod === "online" ? "border-primary bg-primary/5" : "border-surface-container-highest hover:border-primary/50")}
                  >
                    <div className={"w-12 h-12 rounded-full flex items-center justify-center " + (paymentMethod === "online" ? "bg-primary/10" : "bg-surface-container-high")}>
                      <span className={"material-symbols-outlined text-[24px] " + (paymentMethod === "online" ? "text-primary" : "text-on-surface-variant")} style={{ fontVariationSettings: "'FILL' 0" }}>credit_card</span>
                    </div>
                    <div className="flex-1">
                      <p className={"font-label-md " + (paymentMethod === "online" ? "text-primary" : "text-on-surface")}>Online Payment</p>
                      <p className="text-label-sm text-on-surface-variant">Card / UPI / Net Banking</p>
                    </div>
                    {paymentMethod === "online" && (
                      <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                  </button>
                </div>

                {/* Online payment method details */}
                {paymentMethod === "online" && (
                  <div className="mt-md p-4 rounded-xl bg-surface-container-high border border-outline-variant">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-primary">credit_score</span>
                      <span className="font-label-md text-primary">Pay with</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: "credit_card", label: "Card" },
                        { icon: "phone_android", label: "UPI" },
                        { icon: "account_balance", label: "Net Banking" },
                      ].map((opt) => (
                        <div key={opt.label} className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg border border-outline-variant bg-white">
                          <span className="material-symbols-outlined text-on-surface-variant">{opt.icon}</span>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">{opt.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-label-sm text-on-surface-variant mt-3 text-center">You will be redirected to complete payment after placing the order.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-label-md mb-1.5 ml-1" htmlFor="notes">Order Notes (optional)</label>
                <textarea
                  id="notes"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border-2 border-surface-container-highest bg-surface-container-low focus:border-primary focus:ring-0 transition-colors resize-none"
                  placeholder="Any special instructions for the farmer..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                />
                <p className="text-label-sm text-on-surface-variant text-right mt-1">{notes.length}/500</p>
              </div>

              {orderError && (
                <div className="p-4 rounded-xl bg-error-container text-on-error-container flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {orderError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Placing Order...</>
                ) : (
                  <><span className="material-symbols-outlined">lock</span> Place Order — Rs.{total.toLocaleString()}</>
                )}
              </button>
            </form>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-surface-container-low rounded-xl border border-outline-variant p-lg sticky top-24">
              <h2 className="font-headline-md text-headline-md text-primary mb-lg">Order Summary</h2>

              {/* Cart items */}
              <div className="space-y-md mb-lg max-h-80 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-surface-variant flex-shrink-0">
                      {item.image ? (
                        <Image fill sizes="56px" className="object-cover" src={item.image} alt={item.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px] text-outline">eco</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-primary truncate">{item.name}</p>
                      <p className="text-label-sm text-on-surface-variant">Qty: {item.quantity} × Rs.{item.price}</p>
                    </div>
                    <span className="font-label-md text-on-surface whitespace-nowrap">Rs.{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-outline-variant pt-md space-y-md">
                <div className="flex justify-between text-on-surface-variant font-body-md">
                  <span>Subtotal ({itemCount} items)</span>
                  <span>Rs.{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant font-body-md">
                  <span>Delivery</span>
                  <span className="text-primary font-label-md">Free</span>
                </div>
                <div className="border-t border-outline-variant pt-md flex justify-between font-headline-md text-[20px] text-primary">
                  <span>Total</span>
                  <span>Rs.{total.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-lg pt-lg border-t border-outline-variant space-y-sm">
                <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
                  Secure &amp; encrypted checkout
                </div>
                <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary">cycle</span>
                  Supporting local farmers
                </div>
                <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary">return</span>
                  Easy returns policy
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 md:hidden shadow-lg z-50 rounded-t-xl border-t border-outline-variant/30 bg-surface-container-lowest">
        <Link href="/marketplace" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined">storefront</span>
          <span className="font-label-sm text-[10px]">Shop</span>
        </Link>
        <Link href="/cart" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="font-label-sm text-[10px]">Cart</span>
        </Link>
        <Link href="/checkout" className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-2xl px-6 py-2">
          <span className="material-symbols-outlined">checklist</span>
          <span className="font-label-sm text-[10px]">Checkout</span>
        </Link>
        {isAuthenticated ? (
          <Link href="/marketplace" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1">
            <span className="material-symbols-outlined">storefront</span>
            <span className="font-label-sm text-[10px]">Shop</span>
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
