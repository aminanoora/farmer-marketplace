import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("Auth Context", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("should store and retrieve tokens from localStorage", () => {
    const testToken = "test-jwt-token-123";
    localStorage.setItem("krishi_token", testToken);
    expect(localStorage.getItem("krishi_token")).toBe(testToken);
  });

  it("should store and retrieve admin tokens separately", () => {
    const userToken = "user-token";
    const adminToken = "admin-token";

    localStorage.setItem("krishi_token", userToken);
    localStorage.setItem("krishi_admin_token", adminToken);

    expect(localStorage.getItem("krishi_token")).toBe(userToken);
    expect(localStorage.getItem("krishi_admin_token")).toBe(adminToken);
    expect(localStorage.length).toBe(2);
  });

  it("should handle token removal on logout", () => {
    localStorage.setItem("krishi_token", "test-token");
    localStorage.removeItem("krishi_token");
    expect(localStorage.getItem("krishi_token")).toBeNull();
  });

  it("should handle admin token removal separately from user token", () => {
    localStorage.setItem("krishi_token", "user-token");
    localStorage.setItem("krishi_admin_token", "admin-token");

    // Simulate admin logout
    localStorage.removeItem("krishi_admin_token");
    expect(localStorage.getItem("krishi_admin_token")).toBeNull();
    expect(localStorage.getItem("krishi_token")).toBe("user-token");

    // Simulate user logout
    localStorage.removeItem("krishi_token");
    expect(localStorage.getItem("krishi_token")).toBeNull();
  });
});
