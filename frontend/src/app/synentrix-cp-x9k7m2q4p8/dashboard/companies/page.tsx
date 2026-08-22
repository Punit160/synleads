"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, RefreshCw, Eye, Pencil, Key, Filter, Upload, Building2, Copy, Check, ExternalLink } from "lucide-react";
import { apiFetch, apiUpload, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { formatPlatformCurrency } from "@/components/platform/platform-shell";
import { SubscriptionPlanSelector } from "@/components/platform/subscription-plan-selector";
import { cn } from "@/lib/utils";
import { PLATFORM_NAV } from "@/lib/platform-config";

type PackageOption = { id: string; label: string; maxUsers: number | null; priceInr: number | null };

type ProvisionResult = {
  id: string;
  name: string;
  slug?: string | null;
  portalLoginPath?: string | null;
  owner: { name: string; email: string };
};

function portalLoginUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

type Company = {
  id: string;
  name: string;
  slug?: string | null;
  portalLoginPath?: string | null;
  status: string;
  createdAt: string;
  hasLogo?: boolean;
  logoUrl?: string | null;
  owner: { name: string; email: string };
  memberCount: number;
  platformRevenue: number;
  platformSalesCount: number;
  interestedPackage: string | null;
  provisionedBy: { name: string } | null;
  subscription: {
    package: string;
    packageLabel: string;
    status: string;
    expiresAt: string;
  } | null;
};

type CompanyDetail = Company & {
  owner: { id: string; name: string; email: string };
  salesNotes: string | null;
  provisionedBy: { id: string; name: string; email: string } | null;
  companyLegalName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  gstin?: string | null;
  pan?: string | null;
  platformSales: Array<{
    id: string;
    packageLabel: string;
    changeType: string;
    amountInr: number;
    creditInr: number;
    soldBy: string | null;
    createdAt: string;
  }>;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const EMPTY_FORM = {
  companyName: "",
  companyLegalName: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  phone: "",
  email: "",
  website: "",
  gstin: "",
  pan: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  package: "trial_7d",
  interestedPackage: "",
};

type ProfileForm = {
  name: string;
  companyLegalName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  pan: string;
};

function profileFromDetail(d: CompanyDetail): ProfileForm {
  return {
    name: d.name,
    companyLegalName: d.companyLegalName || "",
    address: d.address || "",
    city: d.city || "",
    state: d.state || "",
    pincode: d.pincode || "",
    country: d.country || "India",
    phone: d.phone || "",
    email: d.email || "",
    website: d.website || "",
    gstin: d.gstin || "",
    pan: d.pan || "",
  };
}

export default function PlatformCompaniesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading companies...</div>}>
      <CompaniesPageContent />
    </Suspense>
  );
}

function CompaniesPageContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") || "all";
  const openId = searchParams.get("id");

  const { hasPermission } = usePlatformAuth();
  const canProvision = hasPermission("provision_companies") || hasPermission("manage_companies");
  const canManage = hasPermission("manage_companies");
  const canSubscriptions = hasPermission("manage_subscriptions");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selected, setSelected] = useState<CompanyDetail | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [interestPackage, setInterestPackage] = useState("");
  const [salesNotes, setSalesNotes] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editProfile, setEditProfile] = useState<ProfileForm>({
    name: "",
    companyLegalName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    phone: "",
    email: "",
    website: "",
    gstin: "",
    pan: "",
  });
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState<ProvisionResult | null>(null);
  const [copiedLoginFor, setCopiedLoginFor] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [list, pkgs] = await Promise.all([
        apiFetch<Company[]>("/api/platform/companies"),
        apiFetch<PackageOption[]>("/api/platform/packages"),
      ]);
      setCompanies(list);
      setPackages(pkgs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canProvision) load().catch(console.error);
  }, [canProvision]);

  useEffect(() => {
    if (openId && canProvision) {
      openDetail(openId).catch(console.error);
    }
  }, [openId, canProvision]);

  const filteredCompanies = useMemo(() => {
    const now = Date.now();
    return companies.filter((c) => {
      if (filter === "trial") return c.subscription?.package === "trial_7d";
      if (filter === "paid") return c.subscription?.package && c.subscription.package !== "trial_7d";
      if (filter === "interested") return !!c.interestedPackage;
      if (filter === "expiring") {
        if (!c.subscription?.expiresAt) return false;
        const days = Math.ceil((new Date(c.subscription.expiresAt).getTime() - now) / 86400000);
        return days <= 30;
      }
      return true;
    });
  }, [companies, filter]);

  async function openDetail(id: string) {
    const detail = await apiFetch<CompanyDetail>(`/api/platform/companies/${id}`);
    setSelected(detail);
    setEditProfile(profileFromDetail(detail));
    setEditingProfile(false);
    setEditLogoFile(null);
    if (editLogoPreview) URL.revokeObjectURL(editLogoPreview);
    setEditLogoPreview(null);
    setRemoveLogo(false);
    setDetailError("");
    setNewOwnerPassword("");
    setInterestPackage(detail.interestedPackage || "");
    setSalesNotes(detail.salesNotes || "");
  }

  function startEditProfile() {
    if (!selected) return;
    setEditProfile(profileFromDetail(selected));
    setEditLogoFile(null);
    if (editLogoPreview) URL.revokeObjectURL(editLogoPreview);
    setEditLogoPreview(null);
    setRemoveLogo(false);
    setDetailError("");
    setEditingProfile(true);
  }

  function cancelEditProfile() {
    if (selected) setEditProfile(profileFromDetail(selected));
    setEditLogoFile(null);
    if (editLogoPreview) URL.revokeObjectURL(editLogoPreview);
    setEditLogoPreview(null);
    setRemoveLogo(false);
    setDetailError("");
    setEditingProfile(false);
  }

  function handleEditLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (editLogoPreview) URL.revokeObjectURL(editLogoPreview);
    setEditLogoFile(file);
    setEditLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  }

  function resetAddForm() {
    setForm({ ...EMPTY_FORM });
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setError("");
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function copyLoginUrl(path: string | null | undefined, key: string) {
    const url = portalLoginUrl(path);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLoginFor(key);
      window.setTimeout(() => setCopiedLoginFor((current) => (current === key ? null : current)), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) fd.append(key, value);
      });
      if (logoFile) fd.append("logo", logoFile);
      const created = await apiUpload<ProvisionResult>("/api/platform/companies", fd);
      setShowAdd(false);
      resetAddForm();
      setProvisionSuccess(created);
      await load();
      await openDetail(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create company");
    } finally {
      setSubmitting(false);
    }
  }

  async function updatePackage(_id: string, _pkg: string) {
    await load();
    if (selected?.id === _id) await openDetail(_id);
  }

  async function toggleStatus(id: string, status: "active" | "suspended") {
    setUpdating(id);
    try {
      await apiFetch(`/api/platform/companies/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      if (selected?.id === id) await openDetail(id);
    } finally {
      setUpdating(null);
    }
  }

  async function saveCompanyProfile() {
    if (!selected || !editProfile.name.trim()) return;
    setUpdating(selected.id);
    setDetailError("");
    try {
      await apiFetch(`/api/platform/companies/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editProfile.name.trim(),
          companyLegalName: editProfile.companyLegalName || null,
          address: editProfile.address || null,
          city: editProfile.city || null,
          state: editProfile.state || null,
          pincode: editProfile.pincode || null,
          country: editProfile.country || null,
          phone: editProfile.phone || null,
          email: editProfile.email || null,
          website: editProfile.website || null,
          gstin: editProfile.gstin || null,
          pan: editProfile.pan || null,
        }),
      });

      if (removeLogo && selected.logoUrl) {
        await apiFetch(`/api/platform/companies/${selected.id}/logo`, { method: "DELETE" });
      } else if (editLogoFile) {
        const fd = new FormData();
        fd.append("logo", editLogoFile);
        await apiUpload(`/api/platform/companies/${selected.id}/logo`, fd);
      }

      setEditingProfile(false);
      await load();
      await openDetail(selected.id);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Failed to save company details");
    } finally {
      setUpdating(null);
    }
  }

  async function saveInterest() {
    if (!selected) return;
    setUpdating(selected.id);
    try {
      await apiFetch(`/api/platform/companies/${selected.id}/interest`, {
        method: "PATCH",
        body: JSON.stringify({
          interestedPackage: interestPackage || null,
          salesNotes: salesNotes || null,
        }),
      });
      await load();
      await openDetail(selected.id);
    } finally {
      setUpdating(null);
    }
  }

  async function removeInterest() {
    if (!selected) return;
    setUpdating(selected.id);
    try {
      await apiFetch(`/api/platform/companies/${selected.id}/interest`, {
        method: "PATCH",
        body: JSON.stringify({ clearInterest: true }),
      });
      setInterestPackage("");
      await load();
      await openDetail(selected.id);
    } finally {
      setUpdating(null);
    }
  }

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "trial", label: "Free trials" },
    { id: "paid", label: "Paid" },
    { id: "interested", label: "Interested" },
    { id: "expiring", label: "Expiring" },
  ];

  async function resetOwnerPassword() {
    if (!selected || newOwnerPassword.length < 6) return;
    setUpdating(selected.id);
    try {
      await apiFetch(`/api/platform/companies/${selected.id}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ ownerPassword: newOwnerPassword }),
      });
      setNewOwnerPassword("");
      alert("Owner password updated");
    } finally {
      setUpdating(null);
    }
  }

  if (!canProvision) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">You don&apos;t have permission to view companies.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500 mt-1">
            {canManage ? "Add tenants, manage packages, and monitor usage" : "Add new customer companies to Synentrix Flow"}
          </p>
        </div>
        <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
        {canProvision && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Add company
          </button>
        )}
      </div>

      {provisionSuccess?.portalLoginPath && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">
              {provisionSuccess.name} provisioned successfully
            </p>
            <p className="text-xs text-emerald-800 mt-1">
              Share this login URL with the company admin ({provisionSuccess.owner.email}):
            </p>
            <code className="mt-2 block text-xs font-mono text-emerald-900 bg-white/80 border border-emerald-200 rounded px-2 py-1.5 break-all">
              {portalLoginUrl(provisionSuccess.portalLoginPath)}
            </code>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => copyLoginUrl(provisionSuccess.portalLoginPath, "success")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-white text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              {copiedLoginFor === "success" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLoginFor === "success" ? "Copied" : "Copy URL"}
            </button>
            <a
              href={provisionSuccess.portalLoginPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open login
            </a>
            <button
              type="button"
              onClick={() => setProvisionSuccess(null)}
              className="px-2 py-2 text-xs text-emerald-700 hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-slate-400" />
        {filterTabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "all" ? PLATFORM_NAV.companies : `${PLATFORM_NAV.companies}?filter=${tab.id}`}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              filter === tab.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            )}
          >
            {tab.label}
            {tab.id !== "all" && (
              <span className="ml-1 opacity-70">
                ({companies.filter((c) => {
                  if (tab.id === "trial") return c.subscription?.package === "trial_7d";
                  if (tab.id === "paid") return c.subscription?.package && c.subscription.package !== "trial_7d";
                  if (tab.id === "interested") return !!c.interestedPackage;
                  if (tab.id === "expiring") {
                    if (!c.subscription?.expiresAt) return false;
                    return Math.ceil((new Date(c.subscription.expiresAt).getTime() - Date.now()) / 86400000) <= 30;
                  }
                  return false;
                }).length})
              </span>
            )}
          </Link>
        ))}
      </div>

      {showAdd && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-1">Provision new company</h2>
          <p className="text-sm text-slate-500 mb-5">Company details and logo will appear on the tenant CRM portal.</p>
          <form onSubmit={handleAdd} className="space-y-6 max-w-3xl">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Company profile
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="pro-input text-sm" placeholder="Display name *" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                <input className="pro-input text-sm" placeholder="Legal / registered name" value={form.companyLegalName} onChange={(e) => setForm({ ...form, companyLegalName: e.target.value })} />
                <input className="pro-input text-sm sm:col-span-2" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <input className="pro-input text-sm" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <input className="pro-input text-sm" placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                <input className="pro-input text-sm" placeholder="PIN / ZIP" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                <input className="pro-input text-sm" placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                <input className="pro-input text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <input className="pro-input text-sm" type="email" placeholder="Company email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className="pro-input text-sm" placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                <input className="pro-input text-sm" placeholder="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
                <input className="pro-input text-sm" placeholder="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50">
                  <Upload className="h-4 w-4" />
                  {logoFile ? "Change logo" : "Upload company logo"}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleLogoChange} />
                </label>
                {logoPreview && (
                  <img src={logoPreview} alt="Logo preview" className="h-12 w-12 rounded-lg object-contain border border-slate-200 bg-white" />
                )}
                <p className="text-xs text-slate-400">PNG, JPG or WEBP · max 5 MB · shown in CRM sidebar</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Subscription & admin</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <select className="pro-input text-sm" value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })}>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <select className="pro-input text-sm" value={form.interestedPackage} onChange={(e) => setForm({ ...form, interestedPackage: e.target.value })}>
                  <option value="">Package interest (optional)</option>
                  {packages.filter((p) => p.id !== "trial_7d").map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <input className="pro-input text-sm" placeholder="Admin full name *" required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
                <input className="pro-input text-sm" type="email" placeholder="Admin email (login) *" required value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
                <input className="pro-input text-sm sm:col-span-2" type="password" placeholder="Admin password (min 6 chars) *" required minLength={6} value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
                {submitting ? "Creating…" : "Create company"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); resetAddForm(); }} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading companies...</p>
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className={cn("lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden", selected && "lg:col-span-2")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-medium">Company</th>
                    <th className="px-4 py-3 text-left font-medium">Users</th>
                    <th className="px-4 py-3 text-left font-medium">Sub revenue</th>
                    <th className="px-4 py-3 text-left font-medium">Plan / expiry</th>
                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompanies.map((c) => {
                    const days = c.subscription ? daysUntil(c.subscription.expiresAt) : null;
                    return (
                      <tr key={c.id} className={cn("hover:bg-slate-50", selected?.id === c.id && "bg-blue-50/50")}>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2.5">
                            {c.logoUrl ? (
                              <img src={c.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain border border-slate-200 bg-white shrink-0 mt-0.5" />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-[10px] font-bold text-slate-400">{c.name.slice(0, 2).toUpperCase()}</span>
                              </div>
                            )}
                            <div className="min-w-0">
                          <p className="font-medium text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.owner.email}</p>
                          {c.portalLoginPath && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <code className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1 rounded truncate max-w-[140px]">
                                {c.portalLoginPath}
                              </code>
                              <button
                                type="button"
                                title="Copy login URL"
                                onClick={() => copyLoginUrl(c.portalLoginPath, c.id)}
                                className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                              >
                                {copiedLoginFor === c.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                          {c.interestedPackage && (
                            <p className="text-[10px] text-violet-600 mt-0.5">
                              Interested: {packages.find((p) => p.id === c.interestedPackage)?.label ?? c.interestedPackage}
                            </p>
                          )}
                          {c.provisionedBy && (
                            <p className="text-[10px] text-slate-400">Added by {c.provisionedBy.name}</p>
                          )}
                          <span className={cn("inline-flex mt-1 text-[10px] px-1.5 py-0.5 rounded border capitalize", c.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")}>{c.status}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{c.memberCount}</td>
                        <td className="px-4 py-3">
                          <p className="tabular-nums text-emerald-700 font-medium">{formatPlatformCurrency(c.platformRevenue)}</p>
                          {c.platformSalesCount > 0 && (
                            <p className="text-[10px] text-slate-400">{c.platformSalesCount} sale{c.platformSalesCount !== 1 ? "s" : ""}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canSubscriptions ? (
                            <SubscriptionPlanSelector
                              workspaceId={c.id}
                              currentPackage={c.subscription?.package || "trial_7d"}
                              disabled={updating === c.id}
                              compact
                              onSuccess={() => updatePackage(c.id, "")}
                            />
                          ) : (
                            <p className="text-xs">{c.subscription?.packageLabel || "—"}</p>
                          )}
                          {c.subscription && (
                            <p className={cn("text-[10px]", days !== null && days <= 7 ? "text-red-600 font-medium" : "text-slate-400")}>
                              {days !== null && days < 0 ? "Expired" : days !== null && days <= 30 ? `${days}d left` : formatDate(c.subscription.expiresAt)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openDetail(c.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="View">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {canManage && (
                              <button type="button" disabled={updating === c.id} onClick={() => toggleStatus(c.id, c.status === "active" ? "suspended" : "active")} className="text-[10px] text-blue-600 hover:underline">
                                {c.status === "active" ? "Suspend" : "Activate"}
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
          </div>

          {selected && (
            <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {(editLogoPreview || (selected.logoUrl && !removeLogo)) ? (
                    <img
                      src={editLogoPreview || `${selected.logoUrl}?t=${selected.id}`}
                      alt={selected.name}
                      className="h-12 w-12 rounded-lg object-contain border border-slate-200 bg-white shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-slate-400">{editProfile.name.slice(0, 2).toUpperCase() || selected.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                    <p className="text-sm text-slate-500">{selected.owner.name} · {selected.owner.email}</p>
                    {selected.subscription && (
                      <p className="text-xs text-slate-400 mt-1">
                        {selected.subscription.packageLabel} · expires {formatDate(selected.subscription.expiresAt)}
                      </p>
                    )}
                    {selected.portalLoginPath && (
                      <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-800 mb-1">Company login URL</p>
                        <code className="block text-xs font-mono text-blue-900 break-all">
                          {portalLoginUrl(selected.portalLoginPath)}
                        </code>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => copyLoginUrl(selected.portalLoginPath, `detail-${selected.id}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-200 bg-white text-[10px] font-medium text-blue-700 hover:bg-blue-100"
                          >
                            {copiedLoginFor === `detail-${selected.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            Copy
                          </button>
                          <a
                            href={selected.portalLoginPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-[10px] font-medium text-white hover:bg-blue-700"
                          >
                            <ExternalLink className="h-3 w-3" /> Open
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canManage && !editingProfile && (
                    <button
                      type="button"
                      onClick={startEditProfile}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil className="h-3 w-3" /> Edit details
                    </button>
                  )}
                  <button type="button" onClick={() => { setSelected(null); cancelEditProfile(); }} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
                </div>
              </div>

              {editingProfile && canManage ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Edit company profile</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input className="pro-input text-xs" placeholder="Display name *" required value={editProfile.name} onChange={(e) => setEditProfile({ ...editProfile, name: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="Legal / registered name" value={editProfile.companyLegalName} onChange={(e) => setEditProfile({ ...editProfile, companyLegalName: e.target.value })} />
                    <input className="pro-input text-xs sm:col-span-2" placeholder="Address" value={editProfile.address} onChange={(e) => setEditProfile({ ...editProfile, address: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="City" value={editProfile.city} onChange={(e) => setEditProfile({ ...editProfile, city: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="State" value={editProfile.state} onChange={(e) => setEditProfile({ ...editProfile, state: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="PIN / ZIP" value={editProfile.pincode} onChange={(e) => setEditProfile({ ...editProfile, pincode: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="Country" value={editProfile.country} onChange={(e) => setEditProfile({ ...editProfile, country: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="Phone" value={editProfile.phone} onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })} />
                    <input className="pro-input text-xs" type="email" placeholder="Company email" value={editProfile.email} onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="Website" value={editProfile.website} onChange={(e) => setEditProfile({ ...editProfile, website: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="GSTIN" value={editProfile.gstin} onChange={(e) => setEditProfile({ ...editProfile, gstin: e.target.value })} />
                    <input className="pro-input text-xs" placeholder="PAN" value={editProfile.pan} onChange={(e) => setEditProfile({ ...editProfile, pan: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 bg-white text-xs text-slate-600 cursor-pointer hover:border-blue-400">
                      <Upload className="h-3.5 w-3.5" />
                      {editLogoFile ? "Change logo" : "Upload logo"}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleEditLogoChange} />
                    </label>
                    {selected.logoUrl && !editLogoFile && (
                      <button
                        type="button"
                        onClick={() => setRemoveLogo((v) => !v)}
                        className={cn(
                          "text-xs px-2.5 py-1.5 rounded-lg border",
                          removeLogo ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {removeLogo ? "Logo will be removed" : "Remove logo"}
                      </button>
                    )}
                  </div>
                  {detailError && <p className="text-xs text-red-600">{detailError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveCompanyProfile}
                      disabled={updating === selected.id || !editProfile.name.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium disabled:opacity-60"
                    >
                      {updating === selected.id ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" onClick={cancelEditProfile} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                  <p className="font-medium text-slate-700 mb-1.5">Company profile</p>
                  {selected.companyLegalName ? (
                    <p><span className="text-slate-400">Legal name:</span> {selected.companyLegalName}</p>
                  ) : null}
                  {selected.address ? (
                    <p>
                      <span className="text-slate-400">Address:</span>{" "}
                      {[selected.address, selected.city, selected.state, selected.pincode, selected.country].filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                  {selected.phone && <p><span className="text-slate-400">Phone:</span> {selected.phone}</p>}
                  {selected.email && <p><span className="text-slate-400">Email:</span> {selected.email}</p>}
                  {selected.website && <p><span className="text-slate-400">Website:</span> {selected.website}</p>}
                  {selected.gstin && <p><span className="text-slate-400">GSTIN:</span> {selected.gstin}</p>}
                  {selected.pan && <p><span className="text-slate-400">PAN:</span> {selected.pan}</p>}
                  {!selected.companyLegalName && !selected.address && !selected.phone && !selected.email && !selected.gstin && !selected.pan && (
                    <p className="text-slate-400 italic">No profile details recorded yet.</p>
                  )}
                </div>
              )}

              {canManage && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-1"><Key className="h-3.5 w-3.5" /> Reset admin password</p>
                  <div className="flex gap-2">
                    <input className="pro-input text-xs flex-1" type="password" placeholder="New password (min 6)" value={newOwnerPassword} onChange={(e) => setNewOwnerPassword(e.target.value)} minLength={6} />
                    <button type="button" onClick={resetOwnerPassword} disabled={newOwnerPassword.length < 6 || updating === selected.id} className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium">Update</button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                <p className="text-xs font-medium text-violet-800 mb-2">Package interest & sales notes</p>
                {selected.interestedPackage && selected.subscription && selected.subscription.package !== "trial_7d" && (
                  <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 mb-2">
                    On paid plan — remove interest if upgrade is done or no longer needed.
                  </p>
                )}
                <select className="pro-input text-xs mb-2 w-full" value={interestPackage} onChange={(e) => setInterestPackage(e.target.value)}>
                  <option value="">No interest recorded</option>
                  {packages.filter((p) => p.id !== "trial_7d").map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <textarea className="pro-input text-xs w-full mb-2 min-h-[60px]" placeholder="Sales notes (follow-up, pricing discussion…)" value={salesNotes} onChange={(e) => setSalesNotes(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={saveInterest} disabled={updating === selected.id} className="px-3 py-1.5 rounded bg-violet-600 text-white text-xs font-medium">Save interest</button>
                  {(interestPackage || selected.interestedPackage) && (
                    <button type="button" onClick={removeInterest} disabled={updating === selected.id} className="px-3 py-1.5 rounded border border-violet-300 bg-white text-violet-700 text-xs font-medium hover:bg-violet-50">
                      Remove interest
                    </button>
                  )}
                </div>
              </div>

              {selected.provisionedBy && (
                <p className="text-xs text-slate-500">Provisioned by <span className="font-medium">{selected.provisionedBy.name}</span></p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Sub revenue", value: formatPlatformCurrency(selected.platformRevenue) },
                  { label: "Users", value: selected.memberCount },
                  { label: "Sales", value: selected.platformSalesCount },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[10px] text-slate-500 uppercase">{s.label}</p>
                    <p className="text-lg font-bold text-slate-900">{s.value}</p>
                  </div>
                ))}
              </div>

              {selected.platformSales.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                    Subscription sales ({selected.platformSalesCount})
                  </h3>
                  <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selected.platformSales.map((s) => (
                      <li key={s.id} className="text-xs flex justify-between gap-2 border-b border-slate-50 pb-1.5">
                        <span className="text-slate-700 min-w-0 truncate">
                          {s.packageLabel}
                          <span className="text-slate-400 ml-1 capitalize">({s.changeType.replace("_", " ")})</span>
                        </span>
                        <span className="font-semibold text-emerald-700 tabular-nums shrink-0">{formatPlatformCurrency(s.amountInr)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
