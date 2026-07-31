import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";

// Shared mock user for tests
const baseUser = {
  _id: "user123",
  name: "Test User",
  email: "test@example.com",
  role: "consumer",
  isActive: true,
  toJSON: vi.fn().mockReturnValue({
    _id: "user123",
    name: "Test User",
    email: "test@example.com",
    role: "consumer",
    isActive: true,
  }),
  comparePassword: vi.fn(),
};

const mockUserFindOne = vi.fn();

vi.mock("../models/User", () => ({
  default: {
    findOne: (...args: any[]) => mockUserFindOne(...args),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn().mockReturnValue("mocked-jwt-token"),
  },
}));

import { login, register, getMe } from "../controllers/auth.controller";
import { adminLogin } from "../controllers/admin.controller";

function mockReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, params: {}, query: {}, headers: {}, ...overrides } as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("Auth Controller — mocked User model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore toJSON mock after clearAllMocks resets it
    baseUser.toJSON = vi.fn().mockReturnValue({
      _id: "user123",
      name: "Test User",
      email: "test@example.com",
      role: "consumer",
      isActive: true,
    });
    baseUser.comparePassword = vi.fn();
  });

  describe("login", () => {
    it("should return 401 when user is not found", async () => {
      mockUserFindOne.mockResolvedValue(null);
      const req = mockReq({ body: { email: "noone@test.com", password: "pwd" } });
      const res = mockRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid email or password." });
    });

    it("should return 403 when user is inactive", async () => {
      mockUserFindOne.mockResolvedValue({ ...baseUser, isActive: false });
      const req = mockReq({ body: { email: "inactive@test.com", password: "pwd" } });
      const res = mockRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("deactivated") })
      );
    });

    it("should return 401 when password does not match", async () => {
      mockUserFindOne.mockResolvedValue(baseUser);
      baseUser.comparePassword.mockResolvedValue(false);
      const req = mockReq({ body: { email: "test@test.com", password: "wrong" } });
      const res = mockRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 200 with token on successful login", async () => {
      mockUserFindOne.mockResolvedValue(baseUser);
      baseUser.comparePassword.mockResolvedValue(true);
      const req = mockReq({ body: { email: "test@test.com", password: "correct" } });
      const res = mockRes();
      await login(req, res);
      // Controller calls res.json() directly (Express defaults to 200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Login successful",
          token: "mocked-jwt-token",
          user: expect.objectContaining({ email: "test@example.com" }),
        })
      );
    });
  });

  describe("register", () => {
    it("should return 400 when email already exists", async () => {
      mockUserFindOne.mockResolvedValue(baseUser);
      const req = mockReq({
        body: { name: "New", email: "existing@test.com", password: "password123", role: "consumer" },
      });
      const res = mockRes();
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Email already registered." });
    });
  });

  describe("getMe", () => {
    it("should return 401 when not authenticated", async () => {
      const req = mockReq() as any;
      const res = mockRes();
      await getMe(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Not authenticated" });
    });

    it("should return user data when authenticated", async () => {
      const req = mockReq() as any;
      req.user = baseUser;
      const res = mockRes();
      await getMe(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ email: "test@example.com" }),
        })
      );
    });
  });

  describe("adminLogin", () => {
    it("should return 403 when consumer tries admin login", async () => {
      mockUserFindOne.mockResolvedValue({ ...baseUser, role: "consumer" });
      baseUser.comparePassword.mockResolvedValue(true);
      const req = mockReq({ body: { email: "user@test.com", password: "pwd" } });
      const res = mockRes();
      await adminLogin(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Access denied") })
      );
    });

    it("should return 200 with token for admin login", async () => {
      const adminUser = { ...baseUser, role: "admin" };
      adminUser.comparePassword = vi.fn().mockResolvedValue(true);
      adminUser.toJSON = vi.fn().mockReturnValue({
        _id: "user123",
        name: "Test User",
        email: "admin@test.com",
        role: "admin",
        isActive: true,
      });
      mockUserFindOne.mockResolvedValue(adminUser);
      const req = mockReq({ body: { email: "admin@test.com", password: "admin123" } });
      const res = mockRes();
      await adminLogin(req, res);
      // Controller calls res.json() directly (Express defaults to 200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Admin login successful",
          user: expect.objectContaining({ role: "admin", email: "admin@test.com" }),
        })
      );
    });
  });
});
