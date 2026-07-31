"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { farmerAPI, consumerAPI } from "@/lib/api";
import { useNotification } from "@/lib/notification-context";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface ExistingImage {
  url: string;
  isExisting: true;
}

interface EditFormData {
  name: string;
  description: string;
  category: string;
  price: string;
  unit: string;
  quantity: string;
  existingImages: ExistingImage[];
  newImages: File[];
  harvestDate: string;
  isOrganic: boolean;
  isAvailable: boolean;
  discountPrice: string;
  isFeatured: boolean;
  seoDescription: string;
}

interface FormErrors {
  [key: string]: string;
}

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────
const UNITS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "ton", label: "Ton" },
  { value: "quintal", label: "Quintal" },
  { value: "litre", label: "Litre" },
  { value: "ml", label: "Millilitre (ml)" },
  { value: "piece", label: "Piece" },
  { value: "dozen", label: "Dozen" },
  { value: "bunch", label: "Bunch" },
  { value: "box", label: "Box" },
  { value: "bag", label: "Bag" },
  { value: "unit", label: "Unit" },
];

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// ─────────────────────────────────────────────────
// Form Field Components
// ─────────────────────────────────────────────────
function FormField({
  label, required = false, error, children, hint,
}: {
  label: string; required?: boolean; error?: string;
  children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
        {label}
        {required && <span className="text-error">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-on-surface-variant/70">{hint}</p>}
      {error && (
        <p className="text-[11px] text-error flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </p>
      )}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", step, min, max,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; step?: string; min?: string; max?: string;
}) {
  return (
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} step={step} min={min} max={max}
      className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-body-md text-on-surface placeholder:text-on-surface-variant/50"
    />
  );
}

function TextArea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-body-md text-on-surface placeholder:text-on-surface-variant/50 resize-y"
    />
  );
}

function Select({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-body-md text-on-surface appearance-none cursor-pointer"
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
  );
}

function Toggle({
  checked, onChange, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
      <span className={`font-label-sm text-label-sm ${checked ? "text-primary" : "text-on-surface-variant"}`}>{label}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────
// Edit Product Page
// ─────────────────────────────────────────────────
export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { showSuccess, showError: showErrorToast } = useNotification();

  const [loadingProduct, setLoadingProduct] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [productName, setProductName] = useState("");

  const [form, setForm] = useState<EditFormData>({
    name: "",
    description: "",
    category: "",
    price: "",
    unit: "kg",
    quantity: "",
    existingImages: [],
    newImages: [],
    harvestDate: "",
    isOrganic: false,
    isAvailable: true,
    discountPrice: "",
    isFeatured: false,
    seoDescription: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch product and categories
  useEffect(() => {
    if (!productId) return;

    const fetchData = async () => {
      setLoadingProduct(true);
      try {
        const [productRes, categoriesRes] = await Promise.all([
          farmerAPI.getProduct(productId),
          consumerAPI.getCategories(),
        ]);

        const p = productRes.data.product;
        const cats = categoriesRes.data.categories || [];
        setCategories(cats);
        setProductName(p.name);

        setForm({
          name: p.name || "",
          description: p.description || "",
          category: p.category?._id || (cats.length > 0 ? cats[0]._id : ""),
          price: p.price?.toString() || "",
          unit: p.unit || "kg",
          quantity: p.quantity?.toString() || "",
          existingImages: (p.images || []).map((url: string) => ({ url, isExisting: true as const })),
          newImages: [],
          harvestDate: p.harvestDate ? p.harvestDate.split("T")[0] : "",
          isOrganic: p.isOrganic || false,
          isAvailable: p.isAvailable !== undefined ? p.isAvailable : true,
          discountPrice: p.discountPrice?.toString() || "",
          isFeatured: p.isFeatured || false,
          seoDescription: p.seoDescription || "",
        });
      } catch (err: any) {
        setSubmitError(err?.response?.data?.message || err?.message || "Failed to load product.");
      } finally {
        setLoadingProduct(false);
        setLoadingCategories(false);
      }
    };

    fetchData();
  }, [productId]);

  const updateField = <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = form.existingImages.length + form.newImages.length;
    const remaining = 4 - totalImages;
    if (files.length > remaining) {
      setErrors((prev) => ({ ...prev, images: `You can only add ${remaining} more photo(s). Max 4 total.` }));
      return;
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const invalid = files.find((f) => !validTypes.includes(f.type));
    if (invalid) {
      setErrors((prev) => ({ ...prev, images: "Only JPEG, PNG, WebP, and GIF images are allowed." }));
      return;
    }
    const oversized = files.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) {
      setErrors((prev) => ({ ...prev, images: "Each image must be under 5MB." }));
      return;
    }
    setForm((prev) => ({ ...prev, newImages: [...prev.newImages, ...files].slice(0, 4 - prev.existingImages.length) }));
    setErrors((prev) => { const next = { ...prev }; delete next.images; return next; });
    e.target.value = "";
  };

  const removeExistingImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      existingImages: prev.existingImages.filter((_, i) => i !== index),
    }));
  };

  const removeNewImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      newImages: prev.newImages.filter((_, i) => i !== index),
    }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = "Product name is required";
    if (!form.category) newErrors.category = "Please select a category";
    if (!form.price.trim()) newErrors.price = "Price is required";
    else if (isNaN(Number(form.price)) || Number(form.price) < 0) newErrors.price = "Please enter a valid price";
    if (!form.quantity.trim()) newErrors.quantity = "Stock quantity is required";
    else if (isNaN(Number(form.quantity)) || Number(form.quantity) < 0) newErrors.quantity = "Please enter a valid quantity";
    if (form.discountPrice.trim()) {
      const discount = Number(form.discountPrice);
      const price = Number(form.price);
      if (isNaN(discount) || discount < 0) newErrors.discountPrice = "Invalid discount price";
      else if (price > 0 && discount >= price) newErrors.discountPrice = "Discount must be less than price";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    const totalImages = form.existingImages.length + form.newImages.length;
    if (totalImages < 2) {
      setErrors((prev) => ({ ...prev, images: "At least 2 photos are required." }));
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      if (form.description.trim()) formData.append("description", form.description.trim());
      formData.append("category", form.category);
      formData.append("price", String(Number(form.price)));
      formData.append("unit", form.unit);
      formData.append("quantity", String(Number(form.quantity)));
      formData.append("isOrganic", String(form.isOrganic));
      formData.append("isAvailable", String(form.isAvailable));
      formData.append("isFeatured", String(form.isFeatured));

      if (form.harvestDate) formData.append("harvestDate", form.harvestDate);
      if (form.discountPrice.trim()) formData.append("discountPrice", String(Number(form.discountPrice)));
      if (form.seoDescription.trim()) formData.append("seoDescription", form.seoDescription.trim());

      // Send remaining existing image URLs
      const remainingUrls = form.existingImages.map((img) => img.url);
      formData.append("existingImages", JSON.stringify(remainingUrls));

      // Append new image files
      form.newImages.forEach((file) => {
        formData.append("images", file);
      });

      await farmerAPI.updateProductWithImages(productId, formData);
      showSuccess("Product updated successfully! 🎉");
      router.push("/farmer/products");
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to update product.";
      showErrorToast(message);
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const priceValue = form.price ? Number(form.price) : 0;
  const discountValue = form.discountPrice ? Number(form.discountPrice) : 0;
  const showDiscount = form.discountPrice.trim() !== "";
  const discountPercent = showDiscount && priceValue > 0 && discountValue < priceValue
    ? Math.round(((priceValue - discountValue) / priceValue) * 100) : 0;
  const totalImages = form.existingImages.length + form.newImages.length;

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-1">
            <Link href="/farmer/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <Link href="/farmer/products" className="hover:text-primary transition-colors">Products</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-on-surface font-bold">Edit Product</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary">Edit Product</h1>
          <p className="text-on-surface-variant mt-1">
            Update details for <span className="font-bold text-primary">{productName}</span>
          </p>
        </div>
        <Link href="/farmer/products"
          className="inline-flex items-center gap-1 text-primary font-label-md hover:underline">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ─── Basic Information ─── */}
        <section className="bg-white rounded-2xl border border-outline-variant p-6 md:p-8">
          <h2 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">info</span>
            Basic Information
          </h2>

          <div className="space-y-5">
            <FormField label="Product Name" required error={errors.name}>
              <Input value={form.name} onChange={(v) => updateField("name", v)} placeholder="e.g., Fresh Organic Apples" />
            </FormField>

            <FormField label="Description" hint="Describe your product — quality, taste, origin, etc.">
              <TextArea value={form.description} onChange={(v) => updateField("description", v)}
                placeholder="Tell buyers about this product..." rows={4} />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Category" required error={errors.category}>
                {loadingCategories ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface-variant">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <Select value={form.category} onChange={(v) => updateField("category", v)}
                    options={categories.map((cat) => ({ value: cat._id, label: cat.name }))}
                    placeholder="Select a category" />
                )}
              </FormField>
              <FormField label="Unit" required>
                <Select value={form.unit} onChange={(v) => updateField("unit", v)}
                  options={UNITS.map((u) => ({ value: u.value, label: u.label }))} />
              </FormField>
            </div>
          </div>
        </section>

        {/* ─── Pricing & Stock ─── */}
        <section className="bg-white rounded-2xl border border-outline-variant p-6 md:p-8">
          <h2 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">sell</span>
            Pricing &amp; Stock
          </h2>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Price" required error={errors.price} hint={`Per ${form.unit}`}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md">₹</span>
                  <Input type="number" step="0.01" min="0" value={form.price} onChange={(v) => updateField("price", v)} placeholder="0" />
                </div>
              </FormField>

              <FormField label="Stock Quantity" required error={errors.quantity} hint={`In ${form.unit}s`}>
                <Input type="number" step="1" min="0" value={form.quantity} onChange={(v) => updateField("quantity", v)} placeholder="0" />
              </FormField>
            </div>

            {/* Discount Price */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Toggle checked={showDiscount} onChange={(v) => { if (!v) updateField("discountPrice", ""); }}
                  label="Add discounted price (offer price)" />
              </div>
              {showDiscount && (
                <div className="pl-6 border-l-2 border-primary-fixed">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField label="Discounted Price" error={errors.discountPrice}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md">₹</span>
                        <Input type="number" step="0.01" min="0" value={form.discountPrice}
                          onChange={(v) => updateField("discountPrice", v)} placeholder="0" />
                      </div>
                    </FormField>
                    {discountPercent > 0 && (
                      <div className="flex items-end pb-2.5">
                        <span className="bg-error-container text-error text-[12px] font-bold px-3 py-1 rounded-full">{discountPercent}% OFF</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Images ─── */}
        <section className="bg-white rounded-2xl border border-outline-variant p-6 md:p-8">
          <h2 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">image</span>
            Product Images
            <span className="text-sm font-label-md text-on-surface-variant font-normal ml-1">(Min 2, Max 4)</span>
          </h2>

          <div className="space-y-4">
            <p className="text-label-sm text-on-surface-variant mb-2">
              Upload photos from your device. The first image will be used as the cover photo.
            </p>

            {/* Upload Zone */}
            {totalImages < 4 && (
              <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                errors.images ? "border-error bg-error-container/10" : "border-outline-variant hover:border-primary hover:bg-primary-fixed/10"
              }`}>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Choose photos" />
                <span className="material-symbols-outlined text-[48px] text-outline mb-2">add_photo_alternate</span>
                <p className="font-label-md text-label-md text-on-surface-variant">Click to upload or drag &amp; drop</p>
                <p className="text-[11px] text-on-surface-variant/70 mt-1">JPEG, PNG, WebP, GIF — Max 5MB each</p>
                <p className="text-[11px] text-primary font-bold mt-1">{totalImages}/4 photos</p>
              </div>
            )}

            {errors.images && (
              <p className="text-[11px] text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>{errors.images}
              </p>
            )}

            {/* Image Grid */}
            {totalImages > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Existing images */}
                {form.existingImages.map((img, index) => (
                  <div key={`existing-${index}`}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-outline-variant bg-surface-container-high">
                    <img src={img.url} alt={`Existing ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => removeExistingImage(index)}
                        className="w-8 h-8 bg-error-container text-error rounded-full flex items-center justify-center hover:bg-error hover:text-on-error transition-colors" title="Remove image">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                    {index === 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow">Cover</span>
                    )}
                    <span className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded font-bold">Existing</span>
                  </div>
                ))}
                {/* New images */}
                {form.newImages.map((file, index) => (
                  <div key={`new-${index}`}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-outline-variant bg-surface-container-high">
                    <img src={URL.createObjectURL(file)} alt={`New ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => removeNewImage(index)}
                        className="w-8 h-8 bg-error-container text-error rounded-full flex items-center justify-center hover:bg-error hover:text-on-error transition-colors" title="Remove image">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                    <span className="absolute top-1.5 right-1.5 bg-emerald-600 text-white text-[8px] px-1.5 py-0.5 rounded font-bold">New</span>
                  </div>
                ))}
                {/* Empty placeholders */}
                {Array.from({ length: 4 - totalImages }).map((_, i) => (
                  <div key={`empty-${i}`}
                    className="aspect-square rounded-xl border border-dashed border-outline-variant bg-surface-container-low flex items-center justify-center">
                    <span className="material-symbols-outlined text-outline text-3xl">add</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── Additional Details ─── */}
        <section className="bg-white rounded-2xl border border-outline-variant p-6 md:p-8">
          <h2 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">tune</span>
            Additional Details
          </h2>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Harvest Date" hint="When was this harvested?">
                <Input type="date" value={form.harvestDate} onChange={(v) => updateField("harvestDate", v)} max={today} />
              </FormField>
              <FormField label="SEO Description" hint="Short description for search engines">
                <TextArea value={form.seoDescription} onChange={(v) => updateField("seoDescription", v)}
                  placeholder="Brief description for search results..." rows={2} />
              </FormField>
            </div>

            <div className="flex flex-wrap gap-6 pt-4 border-t border-outline-variant/50">
              <Toggle checked={form.isOrganic} onChange={(v) => updateField("isOrganic", v)} label="Certified Organic" />
              <Toggle checked={form.isAvailable} onChange={(v) => updateField("isAvailable", v)} label="Available for Sale" />
              <Toggle checked={form.isFeatured} onChange={(v) => updateField("isFeatured", v)} label="Featured Product" />
            </div>
          </div>
        </section>

        {/* ─── Price Preview ─── */}
        {priceValue > 0 && (
          <section className="bg-gradient-to-br from-primary/5 to-primary-fixed/20 rounded-2xl border border-primary/10 p-6">
            <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px]">receipt</span>
              Listing Preview
            </h3>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="bg-white rounded-xl px-5 py-3 border border-outline-variant">
                <p className="text-[11px] text-on-surface-variant">Your Price</p>
                <p className="font-headline-md text-headline-md text-primary">
                  {formatCurrency(discountValue > 0 ? discountValue : priceValue)}
                  <span className="text-body-md text-on-surface-variant"> / {form.unit}</span>
                </p>
              </div>
              {discountValue > 0 && (
                <>
                  <div className="bg-white rounded-xl px-5 py-3 border border-outline-variant">
                    <p className="text-[11px] text-on-surface-variant">Original Price</p>
                    <p className="font-headline-md text-headline-md text-on-surface-variant line-through">{formatCurrency(priceValue)}</p>
                  </div>
                  <span className="bg-error-container text-error text-[12px] font-bold px-3 py-1.5 rounded-full">
                    Save {formatCurrency(priceValue - discountValue)} ({discountPercent}% OFF)
                  </span>
                </>
              )}
              <div className="bg-white rounded-xl px-5 py-3 border border-outline-variant">
                <p className="text-[11px] text-on-surface-variant">Stock</p>
                <p className="font-headline-md text-headline-md text-primary">{form.quantity || "0"}<span className="text-body-md text-on-surface-variant"> {form.unit}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${form.isAvailable ? "bg-primary" : "bg-error"}`} />
                <span className="font-label-sm text-label-sm text-on-surface-variant">{form.isAvailable ? "Active" : "Hidden"}</span>
                {form.isOrganic && <span className="bg-primary-fixed text-on-primary-fixed-variant px-2 py-0.5 rounded-full text-[10px] font-bold">Organic</span>}
              </div>
            </div>
          </section>
        )}

        {/* ─── Error Banner ─── */}
        {submitError && (
          <div className="bg-error-container border border-error/30 rounded-2xl p-5 flex items-start gap-4">
            <span className="material-symbols-outlined text-error text-[24px] flex-shrink-0">error</span>
            <div>
              <p className="font-label-md text-label-md text-error mb-1">Failed to update product</p>
              <p className="text-on-surface-variant text-sm">{submitError}</p>
            </div>
            <button type="button" onClick={() => setSubmitError(null)}
              className="ml-auto p-1 hover:bg-error/10 rounded-lg text-error transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}

        {/* ─── Submit ─── */}
        <div className="flex flex-col sm:flex-row gap-4 justify-end sticky bottom-6">
          <Link href="/farmer/products"
            className="px-8 py-3.5 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container-high transition-all text-center">
            Cancel
          </Link>
          <button type="submit" disabled={submitting}
            className="px-10 py-3.5 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2">
            {submitting ? (
              <><div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />Saving Changes...</>
            ) : (
              <><span className="material-symbols-outlined text-[20px]">save</span>Save Changes</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
