/**
 * Format a number as Indian Rupees (₹).
 *
 * This is the simple currency formatter used across admin & farmer pages.
 * For the homepage price-per-unit display, use a template literal instead.
 */
export function formatCurrency(
  amount: number,
  opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const defaults: Intl.NumberFormatOptions = {
    minimumFractionDigits: opts?.minimumFractionDigits ?? 0,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  };
  return "\u20B9" + amount.toLocaleString("en-IN", defaults);
}

/**
 * Format a price in Indian Rupees using Intl.NumberFormat.
 *
 * Kept for backward compatibility — new code should prefer `formatCurrency`.
 */
export const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format an ISO date string to a human-readable Indian date.
 *
 * Default format: "15 Jan 2024" (day short-month year).
 * Pass custom `Intl.DateTimeFormatOptions` for other layouts.
 * Returns "---" for falsy input.
 */
export function formatDate(
  dateStr: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "---";
  const defaults: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  return new Date(dateStr).toLocaleDateString("en-IN", options ?? defaults);
}

/**
 * Format an ISO date/time string to Indian time (e.g. "02:30 PM").
 * Returns "---" for falsy input.
 */
export function formatTime(
  dateStr: string | Date | null | undefined
): string {
  if (!dateStr) return "---";
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format an ISO date/time string to a human-readable Indian date + time.
 *
 * Default format: "15 Jan 2024 at 02:30 PM".
 * Returns "---" for falsy input.
 */
export function formatDateTime(
  dateStr: string | Date | null | undefined
): string {
  if (!dateStr) return "---";
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

/**
 * Display a MongoDB ObjectId as a short human-readable order ID.
 *
 * Default prefix is "KM" → "#KM-A1B2C"
 * Admin pages can pass prefix="ORD" → "#ORD-A1B2C"
 */
export function getOrderIdDisplay(id: string, prefix = "KM"): string {
  return `#${prefix}-${id.slice(-5).toUpperCase()}`;
}

/**
 * Extract up to 2 uppercase initials from a name.
 * Returns "??" for empty / falsy input.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get status badge color for order status
 */
export const getOrderStatusColor = (
  status: string
): "green" | "yellow" | "red" | "blue" | "gray" => {
  const colors: Record<string, "green" | "yellow" | "red" | "blue" | "gray"> = {
    delivered: "green",
    confirmed: "blue",
    preparing: "yellow",
    "out-for-delivery": "blue",
    pending: "yellow",
    cancelled: "red",
  };
  return colors[status] || "gray";
};

/**
 * Get verification status color
 */
export const getVerificationColor = (
  status: string
): "green" | "yellow" | "red" => {
  const colors: Record<string, "green" | "yellow" | "red"> = {
    verified: "green",
    pending: "yellow",
    rejected: "red",
  };
  return colors[status] || "yellow";
};

/**
 * Calculate days since a given date
 */
export const daysSince = (dateString: string): number => {
  const date = new Date(dateString);
  const now = new Date();
  return Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
};
