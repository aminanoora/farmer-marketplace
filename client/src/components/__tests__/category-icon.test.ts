import { describe, it, expect } from "vitest";
import { getCategoryIconName } from "@/components/category-icon";

describe("getCategoryIconName", () => {
  describe("valid Material Symbols names", () => {
    it("passes through a short valid icon name", () => {
      expect(getCategoryIconName("eco")).toBe("eco");
    });

    it("passes through snake_case icon names", () => {
      expect(getCategoryIconName("add_circle")).toBe("add_circle");
    });

    it("trims surrounding whitespace", () => {
      expect(getCategoryIconName("  eco  ")).toBe("eco");
    });

    it("prefers the icon value over the name fallback", () => {
      expect(getCategoryIconName("storefront", "Vegetables")).toBe("storefront");
    });
  });

  describe("URLs are never rendered as text", () => {
    it("rejects an https URL and falls back to the name mapping", () => {
      const url =
        "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80";
      expect(getCategoryIconName(url, "Vegetables")).toBe("eco");
    });

    it("rejects an http URL and falls back to the default icon", () => {
      expect(getCategoryIconName("http://example.com/icon.png", "Unknown")).toBe(
        "category"
      );
    });

    it("rejects a URL even when the name is not mapped", () => {
      expect(getCategoryIconName("https://example.com/icon.png", "Bakery")).toBe(
        "category"
      );
    });
  });

  describe("empty and missing values", () => {
    it("returns the name-mapped icon when icon is undefined", () => {
      expect(getCategoryIconName(undefined, "Vegetables")).toBe("eco");
    });

    it("returns the name-mapped icon when icon is an empty string", () => {
      expect(getCategoryIconName("", "Grains")).toBe("grass");
    });

    it("returns the default icon when both icon and name are missing", () => {
      expect(getCategoryIconName()).toBe("category");
    });

    it("returns the default icon when icon and name are empty", () => {
      expect(getCategoryIconName("", "")).toBe("category");
    });
  });

  describe("fallbacks", () => {
    it("maps known category names to their icons case-insensitively", () => {
      expect(getCategoryIconName(undefined, "Vegetables")).toBe("eco");
      expect(getCategoryIconName(undefined, "vegetables")).toBe("eco");
      expect(getCategoryIconName(undefined, "Fruits")).toBe("spa");
      expect(getCategoryIconName(undefined, "Dairy")).toBe("egg");
      expect(getCategoryIconName(undefined, "Grains")).toBe("grass");
    });

    it("returns the default icon for unknown category names", () => {
      expect(getCategoryIconName(undefined, "Bakery")).toBe("category");
    });

    it("falls back to the name mapping when the icon contains spaces", () => {
      expect(getCategoryIconName("not valid", "Vegetables")).toBe("eco");
    });

    it("falls back to the name mapping when the icon is longer than 64 chars", () => {
      const longName = "a".repeat(65);
      expect(getCategoryIconName(longName, "Vegetables")).toBe("eco");
    });
  });
});
