/**
 * Generate a URL-friendly slug from a string
 */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Format a number as Indian Rupees
 */
export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Calculate freshness score based on harvest date (1-10)
 */
export const calculateFreshness = (harvestDate: Date): number => {
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - harvestDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 1) return 10;
  if (diffDays <= 3) return 8;
  if (diffDays <= 5) return 6;
  if (diffDays <= 7) return 4;
  return 2;
};
