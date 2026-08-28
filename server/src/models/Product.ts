import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  farmer: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category: mongoose.Types.ObjectId;
  price: number;
  unit: string;
  quantity: number;
  images: string[];
  harvestDate?: Date;
  isOrganic: boolean;
  isAvailable: boolean;
  discountPrice?: number;
  isFeatured: boolean;
  seoDescription?: string;
  approvalStatus: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    farmer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
    harvestDate: { type: Date },
    isOrganic: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    discountPrice: { type: Number, min: 0 },
    isFeatured: { type: Boolean, default: false },
    seoDescription: { type: String, trim: true },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Index for efficient querying
productSchema.index({ category: 1, isAvailable: 1 });
productSchema.index({ farmer: 1 });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ approvalStatus: 1 });
// Farmer products page: filter by farmer + approval status
productSchema.index({ farmer: 1, approvalStatus: 1 });
// Featured products query on homepage
productSchema.index({ isFeatured: 1, isAvailable: 1, approvalStatus: 1 });

export default mongoose.model<IProduct>("Product", productSchema);
