import "@testing-library/jest-dom/vitest";

// Polyfill scrollIntoView for jsdom (used by login page scroll-to-error)
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

