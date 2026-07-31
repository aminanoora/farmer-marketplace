/**
 * Format a price in Indian Rupees
 */
export const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

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
