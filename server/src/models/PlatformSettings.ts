import mongoose, { Document, Schema } from "mongoose";

export interface IPlatformSettings extends Document {
  commissionPercent: number;
  minPayoutThreshold: number;
  maxDeliveryRadiusKm: number;
  supportEmail: string;
  supportPhone: string;
  aboutUs?: string;
  termsUrl?: string;
  privacyUrl?: string;
  isPlatformActive: boolean;
  maintenanceMode: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    commissionPercent: { type: Number, required: true, min: 0, max: 100, default: 5 },
    minPayoutThreshold: { type: Number, default: 500 },
    maxDeliveryRadiusKm: { type: Number, default: 50 },
    supportEmail: { type: String, default: "support@krishimarket.in" },
    supportPhone: { type: String, default: "1800-123-4567" },
    aboutUs: { type: String },
    termsUrl: { type: String },
    privacyUrl: { type: String },
    isPlatformActive: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model<IPlatformSettings>("PlatformSettings", platformSettingsSchema);
