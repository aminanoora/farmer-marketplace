import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatPrice,
  getOrderStatusColor,
  getVerificationColor,
  daysSince,
} from "../../utils/index";

// ──────────────────────────────────────────────────
// formatPrice
// ──────────────────────────────────────────────────
describe("formatPrice", () => {
  it("formats zero as ₹0", () => {
    expect(formatPrice(0)).toBe("₹0");
  });

  it("formats whole hundreds correctly", () => {
    expect(formatPrice(500)).toBe("₹500");
  });

  it("formats one thousand with Indian comma style", () => {
    // en-IN: 1,000
    expect(formatPrice(1000)).toBe("₹1,000");
  });

  it("formats one lakh with Indian comma style (1,00,000)", () => {
    // en-IN: 1,00,000  (Indian grouping: thousands, then lakhs)
    expect(formatPrice(100000)).toBe("₹1,00,000");
  });

  it("formats one crore with Indian comma style (1,00,00,000)", () => {
    expect(formatPrice(10000000)).toBe("₹1,00,00,000");
  });

  it("formats mixed amounts correctly", () => {
    expect(formatPrice(1250)).toBe("₹1,250");
    expect(formatPrice(12500)).toBe("₹12,500");
    expect(formatPrice(125000)).toBe("₹1,25,000");
  });

  it("rounds down decimal amounts (maxFractionDigits: 0)", () => {
    expect(formatPrice(99.9)).toBe("₹100");
  });

  it("handles negative amounts", () => {
    expect(formatPrice(-500)).toBe("-₹500");
  });

  it("handles large numbers", () => {
    expect(formatPrice(99999999)).toBe("₹9,99,99,999");
  });
});

// ──────────────────────────────────────────────────
// getOrderStatusColor
// ──────────────────────────────────────────────────
describe("getOrderStatusColor", () => {
  it("returns green for delivered", () => {
    expect(getOrderStatusColor("delivered")).toBe("green");
  });

  it("returns blue for confirmed", () => {
    expect(getOrderStatusColor("confirmed")).toBe("blue");
  });

  it("returns yellow for preparing", () => {
    expect(getOrderStatusColor("preparing")).toBe("yellow");
  });

  it("returns blue for out-for-delivery", () => {
    expect(getOrderStatusColor("out-for-delivery")).toBe("blue");
  });

  it("returns yellow for pending", () => {
    expect(getOrderStatusColor("pending")).toBe("yellow");
  });

  it("returns red for cancelled", () => {
    expect(getOrderStatusColor("cancelled")).toBe("red");
  });

  it("returns gray for unknown statuses", () => {
    expect(getOrderStatusColor("unknown")).toBe("gray");
    expect(getOrderStatusColor("")).toBe("gray");
    expect(getOrderStatusColor("shipped")).toBe("gray");
  });

  it("is case-sensitive", () => {
    // The function uses exact string matching
    expect(getOrderStatusColor("Delivered")).toBe("gray");
    expect(getOrderStatusColor("PENDING")).toBe("gray");
  });

  it("returns gray for undefined or null status", () => {
    expect(getOrderStatusColor(undefined as any)).toBe("gray");
    expect(getOrderStatusColor(null as any)).toBe("gray");
  });
});

// ──────────────────────────────────────────────────
// getVerificationColor
// ──────────────────────────────────────────────────
describe("getVerificationColor", () => {
  it("returns green for verified", () => {
    expect(getVerificationColor("verified")).toBe("green");
  });

  it("returns yellow for pending", () => {
    expect(getVerificationColor("pending")).toBe("yellow");
  });

  it("returns red for rejected", () => {
    expect(getVerificationColor("rejected")).toBe("red");
  });

  it("returns yellow as default for unknown statuses", () => {
    expect(getVerificationColor("unknown")).toBe("yellow");
    expect(getVerificationColor("")).toBe("yellow");
    expect(getVerificationColor("submitted")).toBe("yellow");
  });

  it("is case-sensitive", () => {
    expect(getVerificationColor("Verified")).toBe("yellow");
    expect(getVerificationColor("PENDING")).toBe("yellow");
  });
});

// ──────────────────────────────────────────────────
// daysSince
// ──────────────────────────────────────────────────
describe("daysSince", () => {
  // Pin the clock so tests are deterministic
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 for today's date", () => {
    expect(daysSince("2026-07-30")).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    expect(daysSince("2026-07-29")).toBe(1);
  });

  it("returns 7 for a week ago", () => {
    expect(daysSince("2026-07-23")).toBe(7);
  });

  it("returns a negative number for future dates", () => {
    expect(daysSince("2026-08-01")).toBe(-2);
  });

  it("returns ~365 for approximately one year ago", () => {
    expect(daysSince("2025-07-30")).toBe(365);
  });

  it("handles full ISO datetime strings", () => {
    // Same day, just different time
    expect(daysSince("2026-07-30T06:00:00Z")).toBe(0);
  });

  it("handles dates at midnight boundary", () => {
    // Just before midnight
    expect(daysSince("2026-07-29T23:59:59Z")).toBe(0); // Same UTC day... 
    // Actually: 2026-07-30T12:00:00 - 2026-07-29T23:59:59 = ~12 hours = 0 days
    // Since Math.floor(12/24) = 0, this returns 0
    // This test verifies the behavior is based on 24h difference, not calendar days
  });

  it("handles dates roughly 24 hours apart as 1 day", () => {
    // Slightly over 24 hours
    expect(daysSince("2026-07-29T11:00:00Z")).toBe(1);
    // Slightly under 24 hours
    expect(daysSince("2026-07-29T13:00:00Z")).toBe(0);
  });
});
