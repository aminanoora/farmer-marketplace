"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { farmerAPI, consumerAPI } from "@/lib/api";
import { useNotification } from "@/lib/notification-context";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
interface Product {
  _id: string;
  name: string;
  description?: string;
  category: { _id: string; name: string; slug?: string; icon?: string } | null;
  price: number;
  unit: string;
  quantity: number;
  images: string[];
  isAvailable: boolean;
  isOrganic: boolean;
  discountPrice?: number;
  harvestDate?: string;
  createdAt: string;
  approvalStatus?: "pending" | "approved" | "rejected";
}

interface Stats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function getStockInfo(qty: number) {
  if (qty <= 0) return { label: "Out of Stock", color: "bg-error-container text-error" };
  if (qty <= 20) return { label: "Low Stock", color: "bg-tertiary-fixed text-on-tertiary-fixed-variant" };
  if (qty <= 50) return { label: "Moderate", color: "bg-secondary-fixed text-on-secondary-fixed-variant" };
  return { label: "In Stock", color: "bg-primary-fixed text-on-primary-fixed-variant" };
}

function getStockBarWidth(qty: number): string {
  if (qty <= 0) return "0%";
  if (qty <= 100) return Math.round((qty / 100) * 100) + "%";
  return "100%";
}

function getStockBarColor(qty: number): string {
  if (qty <= 0) return "bg-error";
  if (qty <= 20) return "bg-on-tertiary-container";
  if (qty <= 50) return "bg-secondary";
  return "bg-primary";
}

// ─────────────────────────────────────────────────
// Stat Card Component
// ─────────────────────────────────────────────────
function StatCard({
  icon, iconBg, iconColor, label, value, sub, barWidth, barColor, accentBorder,
}: {
  icon: string; iconBg: string; iconColor: string; label: string;
  value: string | number; sub?: string; barWidth?: string; barColor?: string; accentBorder?: string;
}) {
  return (
    <div className={`bg-white p-6 rounded-2xl border ${accentBorder || "border-outline-variant"} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconColor} text-2xl`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        {sub && (
          <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-full whitespace-nowrap">
            {sub}
          </span>
        )}
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">{label}</p>
      <p className="font-headline-md text-headline-md text-primary">{value}</p>
      {barWidth && (
        <div className="h-1.5 w-full bg-outline-variant rounded-full mt-3 overflow-hidden">
          <div className={`h-full rounded-full ${barColor || "bg-primary"}`} style={{ width: barWidth }} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Products Page
// ─────────────────────────────────────────────────
export default function FarmerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, activeProducts: 0, lowStockProducts: 0, outOfStockProducts: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const { showSuccess, showError } = useNotification();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<{ product: Product; index: number } | null>(null);
  const touchStartX = useRef(0);
  const swipeDeltaX = useRef(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, statusFilter, sort]);

  // Fetch categories on mount
  useEffect(() => {
    consumerAPI.getCategories()
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => {});
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: 10, sort };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (statusFilter !== "all") params.status = statusFilter;

      const res = await farmerAPI.getProducts(params);
      const data = res.data;
      setProducts(data.products || []);
      setStats(data.stats || stats);
      setPagination(data.pagination || pagination);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle status toggle
  const handleToggleStatus = async (productId: string, current: boolean) => {
    try {
      await farmerAPI.updateProduct(productId, { isAvailable: !current });
      fetchProducts();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update product status.");
      fetchProducts(); // Revert UI
    }
  };

  // Keyboard navigation for image preview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!previewProduct) return;
      const images = previewProduct.product.images;
      if (!images || images.length === 0) return;
      if (e.key === "ArrowLeft") {
        setPreviewProduct({
          ...previewProduct,
          index: (previewProduct.index - 1 + images.length) % images.length,
        });
      } else if (e.key === "ArrowRight") {
        setPreviewProduct({
          ...previewProduct,
          index: (previewProduct.index + 1) % images.length,
        });
      } else if (e.key === "Escape") {
        setPreviewProduct(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewProduct]);

  // Handle delete
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await farmerAPI.deleteProduct(id);
      setDeleteId(null);
      showSuccess("Product deleted successfully!");
      fetchProducts();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to delete product.";
      showError(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary mb-2">Failed to load products</h2>
          <p className="text-on-surface-variant font-body-md mb-8">{error}</p>
          <button onClick={fetchProducts} className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all">Try Again</button>
        </div>
      </div>
    );
  }

  const totalActivePercent = stats.totalProducts > 0
    ? Math.round((stats.activeProducts / stats.totalProducts) * 100) + "%"
    : "0%";
  const lowStockPercent = stats.totalProducts > 0
    ? Math.round((stats.lowStockProducts / stats.totalProducts) * 100) + "%"
    : "0%";
  const outOfStockPercent = stats.totalProducts > 0
    ? Math.round((stats.outOfStockProducts / stats.totalProducts) * 100) + "%"
    : "0%";

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary mb-1">Products & Inventory</h1>
          <p className="text-on-surface-variant max-w-lg">
            Manage your produce listings, track stock levels, and update market availability in real-time.
          </p>
        </div>
        <Link
          href="/farmer/products/add"
          className="bg-primary text-on-primary px-6 py-3 rounded-xl font-label-md flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          Add New Product
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="inventory_2" iconBg="bg-primary-fixed" iconColor="text-primary" label="Total Products" value={stats.totalProducts} sub={stats.totalProducts > 0 ? `${stats.activeProducts} active` : undefined} barWidth={totalActivePercent} barColor="bg-primary" />
        <StatCard icon="inventory" iconBg="bg-tertiary-fixed" iconColor="text-on-tertiary-container" label="Low Stock Alerts" value={stats.lowStockProducts} sub={stats.lowStockProducts > 0 ? "Action Needed" : "All good"} barWidth={lowStockPercent} barColor="bg-on-tertiary-container" />
        <StatCard icon="remove_shopping_cart" iconBg="bg-error-container" iconColor="text-error" label="Out of Stock" value={stats.outOfStockProducts} barWidth={outOfStockPercent} barColor="bg-error" accentBorder="border-l-4 border-l-error" />
        <StatCard icon="checklist" iconBg="bg-secondary-fixed" iconColor="text-secondary" label="Active Listings" value={stats.activeProducts} sub={stats.totalProducts > 0 ? `${Math.round((stats.activeProducts / stats.totalProducts) * 100)}% of total` : undefined} barWidth={totalActivePercent} barColor="bg-secondary" />
      </div>

      {/* Filters & Table Section */}
      <section className="bg-white rounded-3xl border border-outline-variant overflow-hidden">
        {/* Filter Bar */}
        <div className="p-6 border-b border-outline-variant flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="relative w-full md:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent w-full transition-all text-body-md"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-surface-container-low border border-outline-variant rounded-xl font-label-sm text-on-surface-variant focus:ring-primary focus:border-primary px-3 py-2.5 flex-grow md:flex-grow-0">
              <option value="all">All Categories</option>
              {categories.map((cat) => (<option key={cat._id} value={cat._id}>{cat.name}</option>))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-surface-container-low border border-outline-variant rounded-xl font-label-sm text-on-surface-variant focus:ring-primary focus:border-primary px-3 py-2.5 flex-grow md:flex-grow-0">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="lowStock">Low Stock</option>
              <option value="outOfStock">Out of Stock</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-surface-container-low border border-outline-variant rounded-xl font-label-sm text-on-surface-variant focus:ring-primary focus:border-primary px-3 py-2.5 flex-grow md:flex-grow-0">
              <option value="-createdAt">Newest First</option>
              <option value="createdAt">Oldest First</option>
              <option value="-price">Price: High to Low</option>
              <option value="price">Price: Low to High</option>
              <option value="name">Name: A-Z</option>
              <option value="-name">Name: Z-A</option>
              <option value="-quantity">Stock: High to Low</option>
              <option value="quantity">Stock: Low to High</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-6 py-3 border-b border-outline-variant/50 bg-surface-container-low/50 overflow-x-auto hide-scrollbar">
          <div className="flex gap-1">
            {categories.slice(0, 7).map((cat) => (
              <button key={cat._id} onClick={() => setCategoryFilter(cat._id)} className={`px-4 py-2 rounded-lg font-label-sm transition-all whitespace-nowrap ${categoryFilter === cat._id ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {products.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 mx-auto bg-surface-container-high rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[40px] text-outline">inventory_2</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-2">No Products Found</h3>
            <p className="text-on-surface-variant max-w-sm mx-auto mb-8">
              {debouncedSearch || categoryFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria."
                : "You haven't added any products yet. Start listing your farm produce!"}
            </p>
            {!debouncedSearch && categoryFilter === "all" && statusFilter === "all" && (
              <Link href="/farmer/products/add" className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all">
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                Add Your First Product
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-6 py-4 font-label-sm text-on-surface-variant uppercase tracking-widest">Product</th>
                    <th className="px-6 py-4 font-label-sm text-on-surface-variant uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 font-label-sm text-on-surface-variant uppercase tracking-widest text-right">Price</th>
                    <th className="px-6 py-4 font-label-sm text-on-surface-variant uppercase tracking-widest">Stock Level</th>
                    <th className="px-6 py-4 font-label-sm text-on-surface-variant uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 font-label-sm text-on-surface-variant uppercase tracking-widest">Approval</th>
                    <th className="px-6 py-4 font-label-sm text-on-surface-variant uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {products.map((product) => {
                    const stock = getStockInfo(product.quantity);
                    return (
                      <tr key={product._id} className="hover:bg-surface-container-lowest transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => {
                                if (product.images && product.images.length > 0) {
                                  setPreviewProduct({ product, index: 0 });
                                }
                              }}
                              className="w-14 h-14 rounded-xl bg-surface-container-high flex-shrink-0 overflow-hidden border border-outline-variant cursor-pointer group/preview"
                              title="Click to preview"
                            >
                              {product.images && product.images.length > 0 ? (
                                <div className="relative w-full h-full">
                                  <Image fill sizes="56px" src={product.images[0]} alt={product.name} className="object-cover group-hover/preview:scale-110 transition-transform duration-300" />
                                  <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white/0 group-hover/preview:text-white/90 text-lg transition-all">zoom_in</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="material-symbols-outlined text-outline text-2xl">image</span>
                                </div>
                              )}
                            </button>
                            <div>
                              <p className="font-label-md text-on-surface">
                                {product.name}
                                {product.isOrganic && (
                                  <span className="ml-2 text-[10px] bg-primary-fixed text-on-primary-fixed-variant px-1.5 py-0.5 rounded-full font-bold align-text-top">Organic</span>
                                )}
                              </p>
                              <p className="text-[11px] text-on-surface-variant">SKU: KM-{product._id.slice(-6).toUpperCase()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="bg-surface-container-high px-3 py-1 rounded-full text-[11px] font-bold text-on-surface-variant whitespace-nowrap">
                            {product.category?.name || "Uncategorized"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="font-label-md text-primary">{formatCurrency(product.price)}</span>
                          <span className="text-[11px] text-on-surface-variant ml-1">/ {product.unit}</span>
                          {product.discountPrice && product.discountPrice < product.price && (
                            <div className="text-[10px] text-error font-bold">
                              {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="w-36">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-xs font-bold">{product.quantity} {product.unit}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${stock.color}`}>{stock.label}</span>
                            </div>
                            <div className="h-1.5 w-full bg-outline-variant rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${getStockBarColor(product.quantity)}`} style={{ width: getStockBarWidth(product.quantity) }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={product.isAvailable}
                              onChange={() => handleToggleStatus(product._id, product.isAvailable)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                            <span className={`ml-3 text-[11px] font-bold ${product.isAvailable ? "text-primary" : "text-on-surface-variant"}`}>
                              {product.isAvailable ? "Active" : "Hidden"}
                            </span>
                          </label>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            product.approvalStatus === "approved"
                              ? "bg-primary-fixed text-on-primary-fixed-variant"
                              : product.approvalStatus === "rejected"
                              ? "bg-error-container text-error"
                              : "bg-tertiary-fixed text-on-tertiary-fixed-variant"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              product.approvalStatus === "approved"
                                ? "bg-primary"
                                : product.approvalStatus === "rejected"
                                ? "bg-error"
                                : "bg-on-tertiary-container"
                            }`} />
                            {product.approvalStatus === "approved"
                              ? "Approved"
                              : product.approvalStatus === "rejected"
                              ? "Rejected"
                              : "Pending"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Link href={`/farmer/products/${product._id}`} className="p-2 hover:bg-primary-fixed rounded-lg text-primary transition-all" title="View Details">
                              <span className="material-symbols-outlined text-[20px]">visibility</span>
                            </Link>
                            <Link href={`/farmer/products/${product._id}/edit`} className="p-2 hover:bg-surface-variant rounded-lg text-on-surface-variant transition-all" title="Edit">
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </Link>
                            {deleteId === product._id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDelete(product._id)} disabled={deleting} className="p-2 bg-error-container rounded-lg text-error hover:bg-error hover:text-on-error transition-all" title="Confirm">
                                  <span className="material-symbols-outlined text-[20px]">{deleting ? "hourglass_top" : "check"}</span>
                                </button>
                                <button onClick={() => setDeleteId(null)} className="p-2 bg-surface-container-high rounded-lg text-on-surface-variant hover:bg-surface-variant transition-all" title="Cancel">
                                  <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteId(product._id)} className="p-2 hover:bg-error-container rounded-lg text-error transition-all" title="Delete">
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-6 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-low">
              <span className="text-sm text-on-surface-variant">
                Showing <span className="font-bold text-on-surface">{Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}</span>
                - <span className="font-bold text-on-surface">{Math.min(pagination.page * pagination.limit, pagination.total)}</span>
                of <span className="font-bold text-on-surface">{pagination.total}</span> products
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`w-10 h-10 rounded-lg font-label-md transition-all ${p === pagination.page ? "bg-primary text-on-primary shadow-sm" : "hover:bg-surface-container-high text-on-surface-variant"}`}>{p}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ─── Image Preview Modal ─── */}
      {previewProduct && (() => {
        const { product, index } = previewProduct;
        const images = product.images || [];
        const hasMultiple = images.length > 1;
        const totalCount = images.length;
        const currentIndex = Math.min(index, totalCount - 1);
        const goTo = (i: number) => setPreviewProduct({ ...previewProduct, index: i });
        const next = () => goTo((currentIndex + 1) % totalCount);
        const prev = () => goTo((currentIndex - 1 + totalCount) % totalCount);

        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            onClick={() => setPreviewProduct(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Content */}
            <div
              className="relative max-w-3xl w-full mx-4 animate-fadeIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setPreviewProduct(null)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-2 z-10"
                title="Close (Esc)"
              >
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>

              {/* Image container with swipe support */}
              <div
                className="relative rounded-2xl overflow-hidden bg-black/40 shadow-2xl select-none"
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                  swipeDeltaX.current = 0;
                }}
                onTouchMove={(e) => {
                  swipeDeltaX.current = e.touches[0].clientX - touchStartX.current;
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if (!hasMultiple) return;
                  const threshold = 50;
                  if (swipeDeltaX.current > threshold) {
                    prev();
                  } else if (swipeDeltaX.current < -threshold) {
                    next();
                  }
                  touchStartX.current = 0;
                  swipeDeltaX.current = 0;
                }}
              >
                <Image
                  src={images[currentIndex]}
                  alt={product.name + " — Image " + (currentIndex + 1)}
                  className="w-full max-h-[75vh] object-contain pointer-events-none"
                  width={1024}
                  height={768}
                  unoptimized
                  draggable={false}
                />

                {/* Navigation arrows */}
                {hasMultiple && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); prev(); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/30 transition-colors flex items-center justify-center hidden md:flex"
                      title="Previous (←)"
                    >
                      <span className="material-symbols-outlined text-2xl">chevron_left</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); next(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/30 transition-colors flex items-center justify-center hidden md:flex"
                      title="Next (→)"
                    >
                      <span className="material-symbols-outlined text-2xl">chevron_right</span>
                    </button>
                  </>
                )}
              </div>

              {/* Caption bar */}
              <div className="mt-4 flex items-center justify-between text-white/80">
                <div className="flex items-center gap-3 min-w-0">
                  <p className="font-label-md truncate">{product.name}</p>
                  {product.isOrganic && (
                    <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">Organic</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasMultiple && (
                    <div className="flex items-center gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => goTo(i)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            i === currentIndex
                              ? "bg-white w-4"
                              : "bg-white/40 hover:bg-white/70"
                          }`}
                          title={`Image ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                  <span className="text-sm tabular-nums ml-2">
                    {currentIndex + 1} / {totalCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Inline styles for fadeIn animation ─── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
