"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { farmerAPI } from "@/lib/api";

interface BankDetails {
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

interface NotificationSettings {
  orderAlerts?: boolean;
  priceUpdates?: boolean;
  platformNews?: boolean;
}

interface FarmerProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: string;
  farmName?: string;
  farmLocation?: { village?: string; district?: string; state?: string };
  description?: string;
  cropTypes?: string[];
  farmingMethod?: string;
  verificationStatus: string;
  bankDetails?: BankDetails;
  payoutMethod?: string;
  notificationSettings?: NotificationSettings;
}

function SectionCard({
  icon, title, children, onSave, saving,
}: {
  icon: string; title: string; children: React.ReactNode;
  onSave?: () => void; saving?: boolean;
}) {
  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary-fixed/40 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
        <h3 className="text-headline-md font-headline-md text-primary">{title}</h3>
      </div>
      <div className="space-y-5">{children}</div>
      {onSave && (
        <div className="mt-6 pt-5 border-t border-outline-variant/50 flex justify-end">
          <button onClick={onSave} disabled={saving}
            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, type = "text", multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label-md font-label-md text-on-surface-variant">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4}
          className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none placeholder:text-on-surface-variant/50"
        />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="h-12 w-full bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-on-surface-variant/50 px-4"
        />
      )}
    </div>
  );
}

function ToggleSwitch({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col">
        <span className="font-label-md text-on-surface">{label}</span>
        <span className="text-sm text-on-surface-variant">{description}</span>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
      </label>
    </div>
  );
}

export default function FarmerProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [passwordModal, setPasswordModal] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");

  const [farmName, setFarmName] = useState("");
  const [farmVillage, setFarmVillage] = useState("");
  const [farmDistrict, setFarmDistrict] = useState("");
  const [farmState, setFarmState] = useState("");
  const [description, setDescription] = useState("");
  const [farmingMethod, setFarmingMethod] = useState("organic");
  const [verificationStatus, setVerificationStatus] = useState("pending");

  const [acctHolder, setAcctHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [acctNumber, setAcctNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");

  const [orderAlerts, setOrderAlerts] = useState(true);
  const [priceUpdates, setPriceUpdates] = useState(true);
  const [platformNews, setPlatformNews] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== "farmer")) {
      router.push(user?.role === "consumer" ? "/" : "/auth/login?redirect=/farmer/profile");
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "farmer") return;
    setLoading(true);
    setError(null);
    farmerAPI.getProfile()
      .then((res) => {
        const p: FarmerProfile = res.data.farmer;
        setName(p.name || "");
        setEmail(p.email || "");
        setPhone(p.phone || "");
        setAvatar(p.avatar || "");
        setFarmName(p.farmName || "");
        setFarmVillage(p.farmLocation?.village || "");
        setFarmDistrict(p.farmLocation?.district || "");
        setFarmState(p.farmLocation?.state || "");
        setDescription(p.description || "");
        setFarmingMethod(p.farmingMethod || "organic");
        setVerificationStatus(p.verificationStatus || "pending");
        setAcctHolder(p.bankDetails?.accountHolderName || "");
        setBankName(p.bankDetails?.bankName || "");
        setAcctNumber(p.bankDetails?.accountNumber || "");
        setIfscCode(p.bankDetails?.ifscCode || "");
        setPayoutMethod(p.payoutMethod || "bank_transfer");
        setOrderAlerts(p.notificationSettings?.orderAlerts ?? true);
        setPriceUpdates(p.notificationSettings?.priceUpdates ?? true);
        setPlatformNews(p.notificationSettings?.platformNews ?? false);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || "Failed to load profile.");
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const saveSection = async (section: string, data: Record<string, unknown>) => {
    setSavingSection(section);
    setError(null);
    try {
      await farmerAPI.updateProfile(data);
      setSuccessMsg(section + " saved successfully.");
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : (err as Error)?.message;
      setError(msg || "Failed to save " + section + ".");
    } finally {
      setSavingSection(null);
    }
  };

  const handleChangePassword = async () => {
    setPwdError("");
    if (!pwdCurrent || !pwdNew || !pwdConfirm) { setPwdError("All fields are required."); return; }
    if (pwdNew !== pwdConfirm) { setPwdError("New passwords do not match."); return; }
    if (pwdNew.length < 6) { setPwdError("New password must be at least 6 characters."); return; }
    setPwdSaving(true);
    try {
      await farmerAPI.changePassword({ currentPassword: pwdCurrent, newPassword: pwdNew });
      setSuccessMsg("Password changed successfully.");
      setPasswordModal(false);
      setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : (err as Error)?.message;
      setPwdError(msg || "Failed to change password.");
    } finally {
      setPwdSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setAvatar(url);
      saveSection("Profile", { name, phone, avatar: url });
    };
    reader.readAsDataURL(file);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "farmer") return null;

  if (error && !name) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-error-container rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-error">error</span>
          </div>
          <h2 className="text-headline-md font-headline-md text-primary mb-2">Failed to load profile</h2>
          <p className="text-on-surface-variant mb-8">{error}</p>
          <button onClick={() => window.location.reload()}
            className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 transition-all"
          >Try Again</button>
        </div>
      </div>
    );
  }

  const userInitial = name.charAt(0)?.toUpperCase() || "F";
  const locationStr = [farmVillage, farmDistrict, farmState].filter(Boolean).join(", ");

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-headline-lg font-headline-lg text-primary mb-1">Farmer Settings</h1>
        <p className="text-body-lg text-on-surface-variant">Manage your personal profile, farm details, and platform preferences.</p>
      </header>

      {successMsg && (
        <div className="mb-6 px-5 py-4 bg-primary-fixed/60 border border-primary/20 rounded-xl flex items-center gap-3 text-primary font-label-md">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {successMsg}
        </div>
      )}
      {error && name && (
        <div className="mb-6 px-5 py-4 bg-error-container/60 border border-error/20 rounded-xl flex items-center gap-3 text-error font-label-md">
          <span className="material-symbols-outlined text-lg">error</span>
          {error}
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-error/10 rounded">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Profile Management */}
          <SectionCard icon="person" title="Profile Management"
            onSave={() => saveSection("Profile", { name, phone })}
            saving={savingSection === "Profile"}
          >
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="relative group shrink-0">
                <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-surface-container-low overflow-hidden bg-surface-container-high">
                  {avatar ? (
                    <Image fill sizes="112px" src={avatar} alt="Profile" className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary text-on-primary flex items-center justify-center text-3xl font-bold">{userInitial}</div>
                  )}
                </div>
                <button onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-md" type="button"
                >
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <FormField label="Full Name" value={name} onChange={setName} placeholder="Your full name" />
                <FormField label="Email Address" value={email} onChange={() => {}} type="email" placeholder="email@example.com" />
                <div className="md:col-span-2">
                  <FormField label="Phone Number" value={phone} onChange={setPhone} type="tel" placeholder="+91 98765 43210" />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Farm Profile */}
          <SectionCard icon="agriculture" title="Farm Profile"
            onSave={() => saveSection("Farm Profile", {
              farmName, farmLocation: { village: farmVillage, district: farmDistrict, state: farmState },
              description, farmingMethod,
            })}
            saving={savingSection === "Farm Profile"}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Farm Name" value={farmName} onChange={setFarmName} placeholder="Green Valley Organics" />
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-label-md text-on-surface-variant">Farming Method</label>
                <select value={farmingMethod} onChange={(e) => setFarmingMethod(e.target.value)}
                  className="h-12 w-full bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all px-4"
                >
                  <option value="organic">Organic</option>
                  <option value="conventional">Conventional</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Village" value={farmVillage} onChange={setFarmVillage} placeholder="Village Malwa" />
              <FormField label="District" value={farmDistrict} onChange={setFarmDistrict} placeholder="Ludhiana" />
              <FormField label="State" value={farmState} onChange={setFarmState} placeholder="Punjab" />
            </div>
            {/* ⭐ Description field — the "about farmer" bio */}
            <FormField label="About Farm / Description" value={description} onChange={setDescription}
              placeholder="Tell customers about your farm, your farming philosophy, the quality of your produce, and what makes you unique..." multiline
            />
            {locationStr && (
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                {locationStr}
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <span className="text-label-sm font-label-md text-on-surface-variant">Verification:</span>
              {verificationStatus === "verified" ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant rounded-full text-xs font-bold">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span> Verified Producer
                </span>
              ) : verificationStatus === "rejected" ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-error-container text-error rounded-full text-xs font-bold">Rejected</span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full text-xs font-bold">
                  <span className="material-symbols-outlined text-[14px]">hourglass</span> Pending Verification
                </span>
              )}
            </div>
          </SectionCard>

          {/* Notification Settings */}
          <SectionCard icon="notifications_active" title="Notification Settings"
            onSave={() => saveSection("Notifications", { notificationSettings: { orderAlerts, priceUpdates, platformNews } })}
            saving={savingSection === "Notifications"}
          >
            <ToggleSwitch label="Order Alerts" description="Get notified when someone buys your produce" checked={orderAlerts} onChange={setOrderAlerts} />
            <div className="border-t border-outline-variant/30" />
            <ToggleSwitch label="Market Price Updates" description="Weekly trends for your core crops" checked={priceUpdates} onChange={setPriceUpdates} />
            <div className="border-t border-outline-variant/30" />
            <ToggleSwitch label="Platform News" description="Feature updates and seasonal tips" checked={platformNews} onChange={setPlatformNews} />
          </SectionCard>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Payment Preferences */}
          <SectionCard icon="account_balance_wallet" title="Payment Preferences"
            onSave={() => saveSection("Banking", {
              bankDetails: { accountHolderName: acctHolder, bankName, accountNumber: acctNumber, ifscCode: ifscCode },
              payoutMethod,
            })}
            saving={savingSection === "Banking"}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Account Holder Name" value={acctHolder} onChange={setAcctHolder} placeholder="Enter name" />
              <FormField label="Bank Name" value={bankName} onChange={setBankName} placeholder="e.g. State Bank of India" />
              <FormField label="Account Number" value={acctNumber} onChange={setAcctNumber} type="password" placeholder="•••• •••• ••••" />
              <FormField label="IFSC Code" value={ifscCode} onChange={setIfscCode} placeholder="SBIN0001234" />
            </div>
            <div className="mt-4">
              <p className="text-label-md font-bold mb-3 uppercase tracking-wider text-on-secondary-container">Payout Method</p>
              <div className="space-y-2.5">
                {[
                  { value: "bank_transfer", label: "Bank Transfer", desc: "Direct to account" },
                  { value: "upi", label: "UPI", desc: "Instant mobile payment" },
                  { value: "krishi_wallet", label: "Krishi Wallet", desc: "Platform credits" },
                ].map((opt) => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    payoutMethod === opt.value ? "border-primary bg-primary-fixed/10" : "border-outline-variant bg-white hover:bg-surface-container-low"
                  }`}>
                    <input type="radio" name="payout" value={opt.value} checked={payoutMethod === opt.value}
                      onChange={(e) => setPayoutMethod(e.target.value)} className="text-primary focus:ring-primary" />
                    <div className="flex flex-col">
                      <span className="font-bold text-on-surface">{opt.label}</span>
                      <span className="text-xs text-on-surface-variant">{opt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Security */}
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-error-container/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
              </div>
              <h3 className="text-headline-md font-headline-md text-primary">Security</h3>
            </div>
            <div className="space-y-3">
              <button onClick={() => setPasswordModal(true)}
                className="w-full flex items-center justify-between p-4 border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors group" type="button"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">lock_reset</span>
                  <span className="font-label-md text-on-surface">Change Password</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
              </button>
              <button className="w-full flex items-center justify-between p-4 border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors group" type="button">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">vibration</span>
                  <div className="flex flex-col items-start">
                    <span className="font-label-md text-on-surface">Two-Factor Authentication</span>
                    <span className="text-xs text-error font-medium">Disabled</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
              </button>
              <div className="p-4 bg-secondary-container/20 rounded-xl flex gap-3 items-start">
                <span className="material-symbols-outlined text-on-secondary-container shrink-0 mt-0.5">info</span>
                <p className="text-xs text-on-secondary-container">Your account is secured with industry-standard encryption. Last login was from the same device.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-10 py-6 border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-label-sm text-on-surface-variant">&copy; 2026 Krishi Market. All agricultural rights reserved.</p>
        <div className="flex gap-6">
          <span className="text-label-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer">Privacy Policy</span>
          <span className="text-label-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer">Terms of Service</span>
        </div>
      </footer>

      {passwordModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPasswordModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-outline-variant"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-headline-md font-headline-md text-primary">Change Password</h3>
              <button onClick={() => { setPasswordModal(false); setPwdError(""); }}
                className="p-2 rounded-lg hover:bg-surface-container-high transition-colors" type="button">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <FormField label="Current Password" value={pwdCurrent} onChange={setPwdCurrent} type="password" placeholder="Enter current password" />
              <FormField label="New Password" value={pwdNew} onChange={setPwdNew} type="password" placeholder="Enter new password" />
              <FormField label="Confirm New Password" value={pwdConfirm} onChange={setPwdConfirm} type="password" placeholder="Confirm new password" />
            </div>
            {pwdError && (
              <p className="mt-3 text-sm text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {pwdError}
              </p>
            )}
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => { setPasswordModal(false); setPwdError(""); }}
                className="px-5 py-3 rounded-xl font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors" type="button">Cancel</button>
              <button onClick={handleChangePassword} disabled={pwdSaving}
                className="px-6 py-3 bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2" type="button">
                {pwdSaving && <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />}
                {pwdSaving ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
