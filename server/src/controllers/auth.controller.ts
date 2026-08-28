import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { AuthRequest } from "../middleware/auth.middleware";
import { sendPasswordResetEmail } from "../utils/email";
import { env } from "../config/env";
import { getErrorMessage } from "../utils/response";

const generateToken = (userId: string, role: string): string => {
  return jwt.sign(
    { userId, role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as jwt.SignOptions
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
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) || "Registration failed" });
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
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) || "Login failed" });
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
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Update consumer profile (name, phone)
 */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { name, phone } = req.body;
    const updates: Record<string, string> = {};

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ message: "Name cannot be empty." });
        return;
      }
      updates.name = name.trim();
    }
    if (phone !== undefined) {
      updates.phone = phone.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No fields to update." });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ user: updatedUser?.toJSON(), message: "Profile updated successfully." });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

/**
 * Change password (requires current password)
 */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current password and new password are required." });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters." });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ message: "Current password is incorrect." });
      return;
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};
