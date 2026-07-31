"use client";

import React from "react";

// Known category names/slugs mapped to Material Symbols icon names.
// Keep in sync with server seed data (scripts/seed.ts CATEGORY_ICONS).
const CATEGORY_ICON_MAP: Record<string, string> = {
  vegetables: "eco",
  fruits: "spa",
  dairy: "egg",
  grains: "grass",
};

const DEFAULT_ICON = "category";

const isUrl = (value: string): boolean => /^https?:\/\//i.test(value);

/**
 * Resolve a category icon value to a safe Material Symbols name.
 *
 * - If `icon` is a short, non-URL, symbol-like name (e.g. "eco"), it is used as-is.
 * - If `icon` is missing, a URL, or otherwise unsafe, falls back to the name/slug
 *   mapping, then to the generic "category" icon.
 */
export function getCategoryIconName(icon?: string, name?: string): string {
  const raw = (icon || "").trim();
  if (raw && !isUrl(raw) && !raw.includes(" ") && raw.length <= 64) {
    return raw;
  }
  const key = (name || "").trim().toLowerCase();
  return CATEGORY_ICON_MAP[key] || DEFAULT_ICON;
}

/**
 * Renders a Material Symbols icon for a category. Guaranteed to never render a
 * long URL or unsafe string as visible text.
 */
export function CategoryIcon({
  icon,
  name,
  className = "",
}: {
  icon?: string;
  name?: string;
  className?: string;
}) {
  const iconName = getCategoryIconName(icon, name);
  return (
    <span className={`material-symbols-outlined ${className}`.trim()} aria-hidden="true">
      {iconName}
    </span>
  );
}
