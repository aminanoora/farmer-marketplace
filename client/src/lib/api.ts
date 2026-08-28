import axios, { AxiosError } from "axios";

/**
 * Safely extract an error message from an Axios or unknown error.
 * Use in catch blocks to avoid `any` casts.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.message || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * Safely extract the HTTP status code from an Axios or unknown error.
 */
export function getApiErrorStatus(err: unknown): number | undefined {
  if (err instanceof AxiosError) return err.response?.status;
  return undefined;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  // NOTE: No global Content-Type header! Axios auto-detects it:
  //   - plain objects  → application/json
  //   - FormData       → multipart/form-data with boundary
  // Hardcoding "application/json" here broke image uploads (FormData was
  // serialized as JSON, turning File objects into {}).
});

// Attach JWT token to every request
// - Admin routes (/admin/*) use krishi_admin_token
// - All other routes use krishi_token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const isAdminRoute = config.url?.startsWith("/admin/");
    const key = isAdminRoute ? "krishi_admin_token" : "krishi_token";
    const token = localStorage.getItem(key);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 and 503 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const config = error.config;
    const url: string = config?.url || "";

    // 503 Maintenance Mode — redirect to maintenance page
    // Skip for admin routes (admins need access to disable maintenance)
    // and auth routes (so the maintenance page can still load)
    if (status === 503) {
      const isAdminRoute = url.startsWith("/admin/");
      const isMaintenancePage = typeof window !== "undefined" && window.location.pathname === "/maintenance";
      if (!isAdminRoute && !isMaintenancePage && typeof window !== "undefined") {
        window.location.href = "/maintenance";
      }
    }

    // 401 Unauthorized
    if (status === 401) {
      const isAdminRoute = url.startsWith("/admin/");
      if (isAdminRoute) {
        localStorage.removeItem("krishi_admin_token");
        window.location.href = "/admin/login";
      } else {
        localStorage.removeItem("krishi_token");
        window.location.href = "/auth/login";
      }
    }

    return Promise.reject(error);
  }
);




export default api;

/* ─── Homepage API ────────────────────────────── */
export const homepageAPI = {
  getHomepage: () => api.get("/homepage"),
  getFeaturedFarmers: () => api.get("/featured-farmers"),
  searchAll: (params: {
    q: string;
    page?: number;
    limit?: number;
    category?: string;
    isOrganic?: boolean;
    minPrice?: number;
    maxPrice?: number;
    sort?: "relevance" | "price_asc" | "price_desc" | "newest";
  }) => api.get("/search", { params }),
  subscribeToNewsletter: (email: string) =>
    api.post("/newsletter/subscribe", { email }),
};

/* ─── Auth API ────────────────────────────────── */
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: "farmer" | "consumer";
    phone?: string;
    farmName?: string;
  }) => api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) =>
    api.post(`/auth/reset-password/${token}`, { password }),
  updateProfile: (data: { name?: string; phone?: string }) =>
    api.put("/auth/profile", data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put("/auth/password", data),
};

/* ─── Farmer API ──────────────────────────────── */
export const farmerAPI = {
  getProfile: () => api.get("/farmers/me"),
  updateProfile: (data: Record<string, unknown>) => api.put("/farmers/me", data),
  getProducts: (params?: Record<string, string | number>) => api.get("/farmers/products", { params }),
  getProduct: (id: string) => api.get(`/farmers/products/${id}`),
  addProduct: (data: Record<string, unknown>) => api.post("/farmers/products", data),
  addProductWithImages: (formData: FormData) =>
    // Axios auto-detects FormData and sets Content-Type with boundary
    api.post("/farmers/products", formData),
  updateProduct: (id: string, data: Record<string, unknown>) =>
    api.put(`/farmers/products/${id}`, data),
  updateProductWithImages: (id: string, formData: FormData) =>
    api.put(`/farmers/products/${id}`, formData),
  deleteProduct: (id: string) => api.delete(`/farmers/products/${id}`),
  getOrders: () => api.get("/farmers/orders"),
  getOrder: (id: string) => api.get(`/farmers/orders/${id}`),
  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/farmers/orders/${id}`, { status }),
  confirmOrder: (id: string) =>
    api.patch(`/farmers/orders/${id}/confirm`),
  cancelOrder: (id: string) =>
    api.patch(`/farmers/orders/${id}/cancel`),
  getEarnings: () => api.get("/farmers/earnings"),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post("/farmers/change-password", data),
};

/* ─── Consumer API ────────────────────────────── */
export const consumerAPI = {
  getProducts: (params?: Record<string, string | number>) => api.get("/products", { params }),
  getProduct: (id: string) => api.get(`/products/${id}`),
  getFarmers: (params?: Record<string, string | number>) => api.get("/farmers", { params }),
  getFarmer: (id: string) => api.get(`/farmers/${id}`),
  placeOrder: (data: Record<string, unknown>) => api.post("/orders", data),
  getOrders: () => api.get("/orders"),
  getOrder: (id: string) => api.get(`/orders/${id}`),
  cancelOrder: (id: string) => api.patch(`/orders/${id}/cancel`),
  getReviews: (params?: { product?: string; farmer?: string }) =>
    api.get("/reviews", { params }),
  addReview: (data: Record<string, unknown>) => api.post("/reviews", data),
  getCategories: () => api.get("/categories"),
  getOrderDelivery: (orderId: string) => api.get(`/deliveries/order/${orderId}`),
};

/* ─── Payment Methods API ──────────────────────── */
export const paymentAPI = {
  getPaymentMethods: () => api.get("/orders/payment-methods/summary"),
};

/* ─── Address API ──────────────────────────────── */
export const addressAPI = {
  getAddresses: () => api.get("/addresses"),
  createAddress: (data: {
    label?: string;
    phone?: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    isDefault?: boolean;
  }) => api.post("/addresses", data),
  updateAddress: (id: string, data: Partial<{
    label: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
  }>) => api.put(`/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/addresses/${id}`),
  setDefaultAddress: (id: string) => api.patch(`/addresses/${id}/default`),
};

/* ─── Admin API ───────────────────────────────── */
export const adminAPI = {
  login: (data: { email: string; password: string }) =>
    api.post("/admin/login", data),
  getMe: () => api.get("/admin/me"),
  getDashboard: () => api.get("/admin/dashboard"),
  getDashboardOverview: () => api.get("/admin/dashboard/overview"),
  getDashboardTransactions: () => api.get("/admin/dashboard/transactions"),
  getFarmers: (params?: Record<string, string | number>) => api.get("/admin/farmers", { params }),
  approveFarmer: (id: string) => api.patch(`/admin/farmers/${id}/approve`),
  rejectFarmer: (id: string) => api.patch(`/admin/farmers/${id}/reject`),
  getCategories: () => api.get("/admin/categories"),
  createCategory: (data: Record<string, unknown>) => api.post("/admin/categories", data),
  updateCategory: (id: string, data: Record<string, unknown>) =>
    api.put(`/admin/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/admin/categories/${id}`),
  getOrders: (params?: Record<string, string | number>) => api.get("/admin/orders", { params }),
  getOrder: (id: string) => api.get("/admin/orders/" + id),
  updateOrderStatus: (id: string, status: string) =>
    api.patch("/admin/orders/" + id + "/status", { status }),
  updateOrderDetails: (id: string, data: { trackingId?: string; notes?: string }) =>
    api.patch("/admin/orders/" + id + "/details", data),
  getAnalytics: () => api.get("/admin/analytics"),
  getSettings: () => api.get("/admin/settings"),
  updateSettings: (data: Record<string, unknown>) => api.patch("/admin/settings", data),
  getUser: (id: string) => api.get("/admin/farmers/" + id),
  toggleUserStatus: (id: string, isActive: boolean) =>
    api.patch("/admin/farmers/" + id + "/status", { isActive }),
  getProducts: (params?: Record<string, string | number>) => api.get("/admin/products", { params }),
  getProduct: (id: string) => api.get("/admin/products/" + id),
  toggleProductStatus: (id: string, isAvailable: boolean) =>
    api.patch("/admin/products/" + id + "/status", { isAvailable }),
  approveProduct: (id: string) =>
    api.patch("/admin/products/" + id + "/approve"),
  rejectProduct: (id: string) =>
    api.patch("/admin/products/" + id + "/reject"),

  // ─── Delivery Management ──────────────────
  getDeliveries: (params?: Record<string, string | number>) => api.get("/deliveries", { params }),
  getDelivery: (id: string) => api.get("/deliveries/" + id),
  createDelivery: (data: Record<string, unknown>) => api.post("/deliveries", data),
  updateDeliveryStatus: (id: string, status: string, trackingNotes?: string) =>
    api.patch("/deliveries/" + id + "/status", { status, trackingNotes }),
  updateDeliveryDetails: (id: string, data: Record<string, unknown>) =>
    api.patch("/deliveries/" + id + "/details", data),
  deleteDelivery: (id: string) => api.delete("/deliveries/" + id),
};
