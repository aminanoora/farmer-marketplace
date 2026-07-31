import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { AuthRequest } from "../middleware/auth.middleware";
import { sendPasswordResetEmail } from "../utils/email";

const generateToken = (userId: string, role: string): string => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || "fallback-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as jwt.SignOptions
  );
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, phone, farmName } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "Email already registered." });
      return;
    }

    const user = new User({
      name,
      email,
      password,
      role: role || "consumer",
      phone,
      farmName: role === "farmer" ? farmName : undefined,
    });

    await user.save();

    const token = generateToken(user._id.toString(), user.role);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: user.toJSON(),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Registration failed" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    // Reject inactive users
    if (!user.isActive) {
      res.status(403).json({
        message:
          "Account has been deactivated. Please contact support at support@krishimarket.in.",
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const token = generateToken(user._id.toString(), user.role);

    res.json({
      message: "Login successful",
      token,
      user: user.toJSON(),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Login failed" });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    res.json({ user: user.toJSON() });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Forgot password — generate reset token
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required." });
      return;
    }

    const user = await User.findOne({ email });
    // Always return success to prevent email enumeration
    if (!user) {
      res.json({
        message:
          "If an account with that email exists, a reset link has been sent.",
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send the reset email
    await sendPasswordResetEmail(email, user.name, resetToken);

    res.json({
      message:
        "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Reset password — validate token and update password
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
      return;
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: "Invalid or expired reset token." });
      return;
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully. You can now sign in." });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
