import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "farmer" | "consumer" | "admin";
  phone?: string;
  avatar?: string;
  isActive: boolean;
  // Farmer-specific fields
  farmName?: string;
  farmLocation?: {
    village: string;
    district: string;
    state: string;
  };
  cropTypes?: string[];
  description?: string;
  farmingMethod?: "organic" | "conventional" | "both";
  verificationStatus: "pending" | "verified" | "rejected";
  verificationDoc?: string;
  // Payout / Banking
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
  payoutMethod?: "bank_transfer" | "upi" | "krishi_wallet";
  // Notification preferences
  notificationSettings?: {
    orderAlerts?: boolean;
    priceUpdates?: boolean;
    platformNews?: boolean;
  };
  // Password reset
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  // Common
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["farmer", "consumer", "admin"],
      default: "consumer",
    },
    phone: { type: String, trim: true },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    farmName: { type: String, trim: true },
    farmLocation: {
      village: { type: String },
      district: { type: String },
      state: { type: String },
    },
    cropTypes: [{ type: String }],
    description: { type: String, trim: true },
    farmingMethod: {
      type: String,
      enum: ["organic", "conventional", "both"],
    },
    bankDetails: {
      accountHolderName: { type: String },
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
    },
    payoutMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "krishi_wallet"],
      default: "bank_transfer",
    },
    notificationSettings: {
      orderAlerts: { type: Boolean, default: true },
      priceUpdates: { type: Boolean, default: true },
      platformNews: { type: Boolean, default: false },
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verificationDoc: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// ═══ Performance Indexes ═══════════════════════
// Fast role-based queries (admin dashboard counts, public farmers listing)
userSchema.index({ role: 1, isActive: 1 });
// Fast farmer verification lookups (public.getFarmers, featured farmers)
userSchema.index({ role: 1, verificationStatus: 1, createdAt: -1 });
// Fast admin search by verification status
userSchema.index({ verificationStatus: 1 });
// Text index for full-text farmer search
userSchema.index({ name: "text", farmName: "text", "farmLocation.village": "text", "farmLocation.district": "text", "farmLocation.state": "text", cropTypes: "text" });

// Remove password from JSON output
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const { password: _, ...safeRet } = ret;
    return safeRet;
  },
});

export default mongoose.model<IUser>("User", userSchema);
