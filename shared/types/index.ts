export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: "farmer" | "consumer" | "admin";
  phone?: string;
  avatar?: string;
  isActive: boolean;
  farmName?: string;
  farmLocation?: {
    village: string;
    district: string;
    state: string;
  };
  cropTypes?: string[];
  farmingMethod?: "organic" | "conventional" | "both";
  verificationStatus: "pending" | "verified" | "rejected";
  createdAt: string;
}

export interface AddressItem {
  _id: string;
  user: string;
  label: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ProductItem {
  _id: string;
  farmer: UserProfile | string;
  name: string;
  description?: string;
  category: CategoryItem | string;
  price: number;
  unit: string;
  quantity: number;
  images: string[];
  harvestDate?: string;
  isOrganic: boolean;
  isAvailable: boolean;
  discountPrice?: number;
  isFeatured: boolean;
  seoDescription?: string;
  createdAt: string;
}

export interface CategoryItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}

export interface OrderItemEntry {
  product: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

export interface OrderItem {
  _id: string;
  consumer: UserProfile | string;
  farmer: UserProfile | string;
  items: OrderItemEntry[];
  totalAmount: number;
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "out-for-delivery"
    | "delivered"
    | "cancelled";
  deliverySlot?: {
    date: string;
    timeSlot: string;
  };
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  notes?: string;
  createdAt: string;
}

export interface ReviewItem {
  _id: string;
  consumer: { _id: string; name: string; avatar?: string };
  product?: string;
  farmer: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface DeliveryItem {
  _id: string;
  order: string;
  partnerName: string;
  partnerPhone: string;
  vehicleNumber?: string;
  status: "assigned" | "picked-up" | "in-transit" | "delivered" | "failed";
  estimatedDelivery: string;
  actualDelivery?: string;
  pickupLocation?: string;
  deliveryLocation: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  trackingNotes?: string;
  createdAt: string;
}

export interface TransactionItem {
  _id: string;
  order: string;
  farmer: string;
  consumer: string;
  subtotal: number;
  commissionPercent: number;
  commissionAmount: number;
  farmerPayout: number;
  status: "pending" | "processed" | "cancelled" | "refunded";
  processedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface PlatformSettingsItem {
  _id: string;
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
  updatedBy?: string;
  createdAt: string;
}
