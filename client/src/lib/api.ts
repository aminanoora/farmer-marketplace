import axios from "axios";

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

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const config = error.config;
      const isAdminRoute = config?.url?.startsWith("/admin/");
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
};

/* ─── Farmer API ──────────────────────────────── */
export const farmerAPI = {
  getProfile: () => api.get("/farmers/me"),
  updateProfile: (data: any) => api.put("/farmers/me", data),
  getProducts: (params?: any) => api.get("/farmers/products", { params }),
  getProduct: (id: string) => api.get(`/farmers/products/${id}`),
  addProduct: (data: any) => api.post("/farmers/products", data),
  addProductWithImages: (formData: FormData) =>
    // Axios auto-detects FormData and sets Content-Type with boundary
    api.post("/farmers/products", formData),
  updateProduct: (id: string, data: any) =>
    api.put(`/farmers/products/${id}`, data),
  updateProductWithImages: (id: string, formData: FormData) =>
    api.put(`/farmers/products/${id}`, formData),
  deleteProduct: (id: string) => api.delete(`/farmers/products/${id}`),
  getOrders: () => api.get("/farmers/orders"),
  getOrder: (id: string) => api.get(`/farmers/orders/${id}`),
  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/farmers/orders/${id}`, { status }),
  getEarnings: () => api.get("/farmers/earnings"),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post("/farmers/change-password", data),
};

/* ─── Consumer API ────────────────────────────── */
export const consumerAPI = {
  getProducts: (params?: any) => api.get("/products", { params }),
  getProduct: (id: string) => api.get(`/products/${id}`),
  getFarmers: (params?: any) => api.get("/farmers", { params }),
  getFarmer: (id: string) => api.get(`/farmers/${id}`),
  placeOrder: (data: any) => api.post("/orders", data),
  getOrders: () => api.get("/orders"),
  getOrder: (id: string) => api.get(`/orders/${id}`),
  cancelOrder: (id: string) => api.patch(`/orders/${id}/cancel`),
  getReviews: (params?: { product?: string; farmer?: string }) =>
    api.get("/reviews", { params }),
  addReview: (data: any) => api.post("/reviews", data),
  getCategories: () => api.get("/categories"),
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
  getFarmers: (params?: any) => api.get("/admin/farmers", { params }),
  approveFarmer: (id: string) => api.patch(`/admin/farmers/${id}/approve`),
  rejectFarmer: (id: string) => api.patch(`/admin/farmers/${id}/reject`),
  getCategories: () => api.get("/admin/categories"),
  createCategory: (data: any) => api.post("/admin/categories", data),
  updateCategory: (id: string, data: any) =>
    api.put(`/admin/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/admin/categories/${id}`),
  getOrders: (params?: any) => api.get("/admin/orders", { params }),
  getOrder: (id: string) => api.get("/admin/orders/" + id),
  updateOrderStatus: (id: string, status: string) =>
    api.patch("/admin/orders/" + id + "/status", { status }),
  updateOrderDetails: (id: string, data: { trackingId?: string; notes?: string }) =>
    api.patch("/admin/orders/" + id + "/details", data),
  getAnalytics: () => api.get("/admin/analytics"),
  getUser: (id: string) => api.get("/admin/farmers/" + id),
  toggleUserStatus: (id: string, isActive: boolean) =>
    api.patch("/admin/farmers/" + id + "/status", { isActive }),
  getProducts: (params?: any) => api.get("/admin/products", { params }),
  getProduct: (id: string) => api.get("/admin/products/" + id),
  toggleProductStatus: (id: string, isAvailable: boolean) =>
    api.patch("/admin/products/" + id + "/status", { isAvailable }),
  approveProduct: (id: string) =>
    api.patch("/admin/products/" + id + "/approve"),
  rejectProduct: (id: string) =>
    api.patch("/admin/products/" + id + "/reject"),
};
