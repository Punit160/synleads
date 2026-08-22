"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { UserPlus, Upload, Trash2, Building2 } from "lucide-react";
import { apiFetch, apiUpload, ApiError, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/crm-constants";
import { PageHeader, Panel, ProTable, Th, Td, BtnPrimary, BtnSecondary } from "@/components/ui/dashboard-ui";
import { SupportContact } from "@/components/support/support-contact";
import { RolePermissionsMatrix } from "@/components/auth/role-permissions-matrix";
import { PRODUCT_NAME } from "@/lib/brand";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

type Member = {
  id: string;
  role: string;
  roleLabel: string;
  status: string;
  managerName: string | null;
  user: { name: string; email: string };
};

type CompanyProfile = {
  name: string;
  companyLegalName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  pan: string | null;
  authorizedSignatoryName: string | null;
  authorizedSignatoryTitle: string | null;
  quoteTerms: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
};

function BrandUpload({
  label,
  hint,
  url,
  onUpload,
  onRemove,
  disabled,
}: {
  label: string;
  hint: string;
  url: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
      <p className="text-sm font-medium text-slate-800 mb-1">{label}</p>
      <p className="text-xs text-slate-500 mb-3">{hint}</p>
      <div className="flex items-center gap-4 min-h-[80px]">
        {url ? (
          <img src={url} alt={label} className="max-h-20 max-w-[160px] object-contain border border-slate-200 rounded bg-white p-2" />
        ) : (
          <div className="h-20 w-32 border border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400 bg-white">
            No image
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => ref.current?.click()}
            className="pro-btn-secondary text-xs !inline-flex items-center gap-1"
          >
            <Upload className="h-3.5 w-3.5" /> {url ? "Replace" : "Upload"}
          </button>
          {url && (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => onRemove()}
              className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function SettingsPage() {
  const auth = useAuth();
  const canManageTeam = auth.hasPermission("manage_team");
  const isFullAdmin = auth.hasPermission("manage_users");

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile() {
    const data = await apiFetch<CompanyProfile>("/api/workspace");
    setProfile(data);
  }

  useEffect(() => {
    loadProfile().catch(console.error);
    apiFetch<Member[]>("/api/workspace/members").then(setMembers).catch(() => {});
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !isFullAdmin) return;
    setError("");
    try {
      const updated = await apiFetch<CompanyProfile>("/api/workspace", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    }
  }

  async function uploadBrand(type: "logo" | "signature" | "stamp", file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await apiUpload(`/api/workspace/branding/${type}`, fd);
    await loadProfile();
  }

  async function removeBrand(type: "logo" | "signature" | "stamp") {
    await apiFetch(`/api/workspace/branding/${type}`, { method: "DELETE" });
    await loadProfile();
  }

  const managers = members.filter((m) => m.role === "manager");
  const executives = members.filter((m) => m.role === "employee");

  if (!profile) {
    return <p className="text-sm text-slate-500 p-6">Loading settings...</p>;
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        meta="Configuration"
        title="Settings"
        description="Company profile, quotation branding, team, and integrations"
      />

      <div className="space-y-4">
        {auth.subscription && (
          <Panel title="Your plan" subtitle="Managed by Synentrix Technologies">
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500 text-xs">Plan</dt>
                <dd className="font-medium text-slate-900">{auth.subscription.packageLabel || auth.subscription.package}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Status</dt>
                <dd className="font-medium capitalize text-slate-900">{auth.subscription.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Valid until</dt>
                <dd className="font-medium text-slate-900">{formatDate(auth.subscription.expiresAt)}</dd>
              </div>
              {auth.subscription.maxUsers != null && (
                <div>
                  <dt className="text-slate-500 text-xs">Team usage</dt>
                  <dd className="font-medium text-slate-900">
                    {auth.subscription.memberCount ?? members.length} / {auth.subscription.maxUsers} users
                  </dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-slate-500 mt-3">
              To change plan or add more users, contact the Synentrix team at{" "}
              <a href={SUPPORT_MAILTO} className="text-blue-600 hover:underline">{SUPPORT_EMAIL}</a>.
              See the <TenantLink href="/dashboard/manual" className="text-blue-600 hover:underline">User Manual</TenantLink> for how team limits work.
            </p>
          </Panel>
        )}

        <Panel title="Your access" subtitle={`Signed in as ${auth.roleLabel}`}>
          <RolePermissionsMatrix compact />
          <p className="text-xs text-slate-500 mt-3">
            Full role matrix in the{" "}
            <TenantLink href="/dashboard/manual#roles-permissions" className="text-blue-600 hover:underline">
              User Manual
            </TenantLink>
            . Contact an admin to change your role.
          </p>
        </Panel>

        {isFullAdmin && (
          <>
            <Panel title="Company Profile" subtitle="Appears on quotations and official documents">
              <form onSubmit={saveProfile} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Display name</label>
                    <input className="pro-input w-full" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Legal company name</label>
                    <input className="pro-input w-full" value={profile.companyLegalName || ""} onChange={(e) => setProfile({ ...profile, companyLegalName: e.target.value })} placeholder="Registered business name" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                    <input className="pro-input w-full" value={profile.address || ""} onChange={(e) => setProfile({ ...profile, address: e.target.value })} placeholder="Street, building, area" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                    <input className="pro-input w-full" value={profile.city || ""} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                    <input className="pro-input w-full" value={profile.state || ""} onChange={(e) => setProfile({ ...profile, state: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">PIN code</label>
                    <input className="pro-input w-full" value={profile.pincode || ""} onChange={(e) => setProfile({ ...profile, pincode: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input className="pro-input w-full" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input type="email" className="pro-input w-full" value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
                    <input className="pro-input w-full" value={profile.website || ""} onChange={(e) => setProfile({ ...profile, website: e.target.value })} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">GSTIN</label>
                    <input className="pro-input w-full" value={profile.gstin || ""} onChange={(e) => setProfile({ ...profile, gstin: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">PAN</label>
                    <input className="pro-input w-full" value={profile.pan || ""} onChange={(e) => setProfile({ ...profile, pan: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Authorized signatory</label>
                    <input className="pro-input w-full" value={profile.authorizedSignatoryName || ""} onChange={(e) => setProfile({ ...profile, authorizedSignatoryName: e.target.value })} placeholder="Name on signature" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Signatory title</label>
                    <input className="pro-input w-full" value={profile.authorizedSignatoryTitle || ""} onChange={(e) => setProfile({ ...profile, authorizedSignatoryTitle: e.target.value })} placeholder="Director / Sales Manager" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Default quotation terms</label>
                    <textarea className="pro-input w-full min-h-[72px]" value={profile.quoteTerms || ""} onChange={(e) => setProfile({ ...profile, quoteTerms: e.target.value })} placeholder="Payment terms, validity, delivery timeline..." />
                  </div>
                </div>
                {error && <p className="text-sm text-red-700">{error}</p>}
                {saved && <p className="text-sm text-emerald-700">Company profile saved</p>}
                <button type="submit" className="pro-btn-primary">Save company profile</button>
              </form>
            </Panel>

            <Panel title="Quotation Branding" subtitle="Logo, signature & stamp used on PDF quotations">
              <div className="grid sm:grid-cols-3 gap-4">
                <BrandUpload
                  label="Company logo"
                  hint="PNG or JPG, max 5MB. Shown in quotation header."
                  url={profile.logoUrl}
                  onUpload={(f) => uploadBrand("logo", f)}
                  onRemove={() => removeBrand("logo")}
                />
                <BrandUpload
                  label="Authorized signature"
                  hint="Scanned signature image for signatory block."
                  url={profile.signatureUrl}
                  onUpload={(f) => uploadBrand("signature", f)}
                  onRemove={() => removeBrand("signature")}
                />
                <BrandUpload
                  label="Company stamp"
                  hint="Round/rectangular stamp or seal image."
                  url={profile.stampUrl}
                  onUpload={(f) => uploadBrand("stamp", f)}
                  onRemove={() => removeBrand("stamp")}
                />
              </div>
              <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Open any quotation → Download PDF to preview with your branding.
              </p>
            </Panel>
          </>
        )}

        {!isFullAdmin && (
          <Panel title="Workspace">
            <p className="text-sm text-slate-600"><strong>{profile.name}</strong></p>
            <p className="text-xs text-slate-500 mt-1">Contact your admin to update company profile and quotation branding.</p>
          </Panel>
        )}

        <Panel
          title="Sales Team"
          subtitle={`${managers.length} manager${managers.length !== 1 ? "s" : ""} · ${executives.length} executive${executives.length !== 1 ? "s" : ""}`}
          action={
            canManageTeam ? (
              <div className="flex gap-2">
                {isFullAdmin && (
                  <TenantLink href="/dashboard/users">
                    <BtnSecondary className="!inline-flex items-center gap-1 text-xs">
                      <UserPlus className="h-3.5 w-3.5" /> Add Manager
                    </BtnSecondary>
                  </TenantLink>
                )}
                <TenantLink href="/dashboard/users">
                  <BtnPrimary className="!inline-flex items-center gap-1 text-xs">
                    <UserPlus className="h-3.5 w-3.5" /> Add Executive
                  </BtnPrimary>
                </TenantLink>
              </div>
            ) : undefined
          }
          noPadding
        >
          <ProTable>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Reports to</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="font-medium !text-slate-900">{m.user.name}</Td>
                  <Td>{m.user.email}</Td>
                  <Td>{m.roleLabel || ROLE_LABELS[m.role] || m.role}</Td>
                  <Td>{m.managerName || (m.role === "manager" ? "—" : "Unassigned")}</Td>
                  <Td className="capitalize">{m.status}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
          {canManageTeam && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
              <TenantLink href="/dashboard/users" className="text-sm font-medium text-blue-600 hover:underline">
                Open full team management →
              </TenantLink>
            </div>
          )}
        </Panel>

        {isFullAdmin && (
          <Panel title="Integrations & lead capture" subtitle="Connect email, ads, forms, and automation">
            <p className="text-sm text-slate-600 mb-3">
              Configure SMTP, WhatsApp, SMS, website webhooks, Facebook/Google/LinkedIn leads, and Zapier from your company Integrations portal.
            </p>
            <TenantLink href="/dashboard/integrations" className="pro-btn-primary inline-flex items-center gap-2 text-sm">
              Open Integrations →
            </TenantLink>
          </Panel>
        )}

        <Panel title="Help & Support">
          <div className="text-sm text-slate-600 space-y-3">
            <p>
              Open the{" "}
              <TenantLink href="/dashboard/manual" className="text-blue-600 font-medium hover:underline">
                User Manual
              </TenantLink>{" "}
              (last item in the sidebar) for step-by-step instructions on leads, pipeline, quotations, and team setup.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-500">Contact Synentrix support:</span>
              <SupportContact />
            </div>
          </div>
        </Panel>

        <Panel title="About">
          <div className="text-sm text-slate-600 space-y-2">
            <p>{PRODUCT_NAME} — lead management & sales CRM by Synentrix Technologies Private Limited.</p>
            <p className="text-xs text-slate-500">
              Support:{" "}
              <a href={SUPPORT_MAILTO} className="text-blue-600 hover:underline">{SUPPORT_EMAIL}</a>
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
