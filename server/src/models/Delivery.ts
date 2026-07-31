import mongoose, { Document, Schema } from "mongoose";

export interface IDelivery extends Document {
  order: mongoose.Types.ObjectId;
  partnerName: string;
  partnerPhone: string;
  vehicleNumber?: string;
  status: "assigned" | "picked-up" | "in-transit" | "delivered" | "failed";
  estimatedDelivery: Date;
  actualDelivery?: Date;
  pickupLocation?: string;
  deliveryLocation: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  trackingNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const deliverySchema = new Schema<IDelivery>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    partnerName: { type: String, required: true, trim: true },
    partnerPhone: { type: String, required: true, trim: true },
    vehicleNumber: { type: String, trim: true },
    status: {
      type: String,
      enum: ["assigned", "picked-up", "in-transit", "delivered", "failed"],
      default: "assigned",
    },
    estimatedDelivery: { type: Date, required: true },
    actualDelivery: { type: Date },
    pickupLocation: { type: String },
    deliveryLocation: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    trackingNotes: { type: String },
  },
  { timestamps: true }
);

deliverySchema.index({ order: 1 });
deliverySchema.index({ status: 1 });

export default mongoose.model<IDelivery>("Delivery", deliverySchema);
