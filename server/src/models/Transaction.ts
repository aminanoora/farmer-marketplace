import mongoose, { Document, Schema } from "mongoose";

export interface ITransaction extends Document {
  order: mongoose.Types.ObjectId;
  farmer: mongoose.Types.ObjectId;
  consumer: mongoose.Types.ObjectId;
  subtotal: number;
  commissionPercent: number;
  commissionAmount: number;
  farmerPayout: number;
  status: "pending" | "processed" | "cancelled" | "refunded";
  processedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    farmer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    consumer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subtotal: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    farmerPayout: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "processed", "cancelled", "refunded"],
      default: "pending",
    },
    processedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

transactionSchema.index({ order: 1 });
transactionSchema.index({ farmer: 1 });
transactionSchema.index({ status: 1 });

export default mongoose.model<ITransaction>("Transaction", transactionSchema);
