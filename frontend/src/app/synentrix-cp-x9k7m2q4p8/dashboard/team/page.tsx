"use client";

import { useEffect, useState } from "react";
import { Plus, Key } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { PLATFORM_ROLE_LABELS } from "@/lib/platform-config";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  createdAt: string;
  canEdit: boolean;
};

type RoleOption = { id: string; label: string; permissions: string[] };

export default function PlatformTeamPage() {
  const { hasPermission } = usePlatformAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sales" });

  async function load() {
    const [team, roleList] = await Promise.all([
      apiFetch<TeamMember[]>("/api/platform/team"),
      apiFetch<{ roles: RoleOption[] }>("/api/platform/team/roles"),
    ]);
    setMembers(team);
    setRoles(roleList.roles);
  }

  useEffect(() => {
    if (hasPermission("manage_team")) {
      load().catch(console.error);
    }
  }, [hasPermission]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/api/platform/team", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "sales" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add member");
    }
  }

  async function updateMember(id: string, data: { role?: string; status?: string; password?: string }) {
    await apiFetch(`/api/platform/team/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    setResetId(null);
    setResetPassword("");
    await load();
  }

  if (!hasPermission("manage_team")) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">You don&apos;t have permission to manage the Synentrix team.</p>
      </div>
    );
  }

  const roleOptions = roles.length > 0 ? roles : Object.entries(PLATFORM_ROLE_LABELS).map(([id, label]) => ({ id, label, permissions: [] }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Synentrix Team</h1>
          <p className="text-sm text-slate-500 mt-1">Manage admins, operators, and sales executives who onboard customer companies</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Add team member
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Add Synentrix user</h2>
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3">
            <input className="pro-input text-sm" placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="pro-input text-sm" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="pro-input text-sm" type="password" placeholder="Password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select className="pro-input text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">Add member</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="px-5 py-3 text-left font-medium">Name</th>
              <th className="px-5 py-3 text-left font-medium">Email</th>
              <th className="px-5 py-3 text-left font-medium">Role</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-left font-medium">Password</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-medium text-slate-900">{m.name}</td>
                <td className="px-5 py-3.5 text-slate-600">{m.email}</td>
                <td className="px-5 py-3.5">
                  {m.canEdit ? (
                    <select className="pro-input text-xs py-1 px-2" value={m.role} onChange={(e) => updateMember(m.id, { role: e.target.value })}>
                      {roleOptions.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-medium">{m.roleLabel}</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  {m.canEdit ? (
                    <select className="pro-input text-xs py-1 px-2" value={m.status} onChange={(e) => updateMember(m.id, { status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  ) : (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded border capitalize",
                      m.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
                    )}>{m.status}</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  {m.canEdit && (
                    resetId === m.id ? (
                      <div className="flex gap-1">
                        <input className="pro-input text-xs w-24" type="password" placeholder="New pwd" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={6} />
                        <button type="button" onClick={() => updateMember(m.id, { password: resetPassword })} disabled={resetPassword.length < 6} className="text-[10px] text-blue-600">Save</button>
                        <button type="button" onClick={() => { setResetId(null); setResetPassword(""); }} className="text-[10px] text-slate-400">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setResetId(m.id)} className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1">
                        <Key className="h-3 w-3" /> Reset
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 space-y-2">
        <p className="font-semibold text-slate-800">Role permissions</p>
        <ul className="space-y-1 text-xs">
          <li><strong>Super Admin</strong> — Full platform access including team management</li>
          <li><strong>Admin</strong> — Companies, subscriptions, sales (no team management)</li>
          <li><strong>Operator</strong> — Full company management and sales data</li>
          <li><strong>Sales Executive</strong> — Add new customer companies, view overview and cross-tenant sales</li>
        </ul>
      </div>
    </div>
  );
}
