import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  consumer: mongoose.Types.ObjectId;
  product?: mongoose.Types.ObjectId;
  farmer: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    consumer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product" },
    farmer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

// Prevent duplicate reviews from same consumer on same product
reviewSchema.index({ consumer: 1, product: 1 }, { unique: true, sparse: true });
// Farmer review lookups (farmer profile page, public reviews)
reviewSchema.index({ farmer: 1, createdAt: -1 });
// Product review lookups (product detail page)
reviewSchema.index({ product: 1, createdAt: -1 });

export default mongoose.model<IReview>("Review", reviewSchema);
