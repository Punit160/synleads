"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLES, ROLE_LABELS } from "@/lib/crm-constants";
import { cn } from "@/lib/utils";
import { UserPlus, Users, ChevronDown, ChevronRight } from "lucide-react";
import {
  PageHeader,
  Panel,
  ProTable,
  Th,
  Td,
  PageLoader,
  EmptyState,
  BtnPrimary,
  BtnSecondary,
} from "@/components/ui/dashboard-ui";

type Member = {
  id: string;
  role: string;
  roleLabel: string;
  status: string;
  managerUserId: string | null;
  managerName: string | null;
  permissions: string[];
  canEdit: boolean;
  canChangeRole: boolean;
  canChangeManager: boolean;
  user: { id: string; name: string; email: string; createdAt: string };
};

type RolesResponse = {
  roles: Array<{ id: string; label: string; permissions: string[] }>;
  permissions: string[];
};

type InviteMode = "manager" | "employee" | null;

export default function UsersPage() {
  const auth = useAuth();
  const canManageTeam = auth.hasPermission("manage_team");
  const isFullAdmin = auth.hasPermission("manage_users");

  const [members, setMembers] = useState<Member[]>([]);
  const [rolesData, setRolesData] = useState<RolesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [inviteMode, setInviteMode] = useState<InviteMode>(null);
  const [inviteError, setInviteError] = useState("");
  const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({});
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee" as string,
    managerUserId: "",
  });

  const managers = members.filter((m) => ["owner", "admin", "manager"].includes(m.role) && m.status === "active");
  const salesManagers = members.filter((m) => m.role === "manager" && m.status === "active");

  const hierarchy = useMemo(() => {
    const execsByManager = new Map<string, Member[]>();
    const unassigned: Member[] = [];

    members
      .filter((m) => m.role === "employee")
      .forEach((m) => {
        if (m.managerUserId) {
          const list = execsByManager.get(m.managerUserId) || [];
          list.push(m);
          execsByManager.set(m.managerUserId, list);
        } else {
          unassigned.push(m);
        }
      });

    return { execsByManager, unassigned };
  }, [members]);

  async function load() {
    try {
      const [m, r] = await Promise.all([
        apiFetch<Member[]>("/api/users"),
        apiFetch<RolesResponse>("/api/users/roles"),
      ]);
      setMembers(m);
      setRolesData(r);
      const expanded: Record<string, boolean> = {};
      m.filter((x) => x.role === "manager").forEach((mg) => {
        expanded[mg.user.id] = true;
      });
      setExpandedManagers(expanded);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canManageTeam) return;
    load().catch(console.error);
  }, [canManageTeam]);

  function openInvite(mode: InviteMode) {
    setInviteError("");
    setInviteMode(mode);
    if (mode === "manager") {
      setInviteForm({ name: "", email: "", password: "", role: "manager", managerUserId: "" });
    } else {
      setInviteForm({
        name: "",
        email: "",
        password: "",
        role: "employee",
        managerUserId: isFullAdmin ? "" : auth.user?.id || "",
      });
    }
  }

  async function changeRole(memberId: string, role: string, managerUserId?: string) {
    setUpdating(memberId);
    try {
      await apiFetch(`/api/users/${memberId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role, managerUserId: managerUserId || null }),
      });
      await load();
    } finally {
      setUpdating(null);
    }
  }

  async function changeManager(memberId: string, managerUserId: string) {
    setUpdating(memberId);
    try {
      await apiFetch(`/api/users/${memberId}/manager`, {
        method: "PATCH",
        body: JSON.stringify({ managerUserId: managerUserId || null }),
      });
      await load();
    } finally {
      setUpdating(null);
    }
  }

  async function toggleStatus(member: Member) {
    setUpdating(member.id);
    try {
      await apiFetch(`/api/users/${member.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: member.status === "active" ? "inactive" : "active" }),
      });
      await load();
    } finally {
      setUpdating(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    try {
      await apiFetch("/api/users/invite", {
        method: "POST",
        body: JSON.stringify({
          ...inviteForm,
          managerUserId: inviteForm.role === "employee" ? inviteForm.managerUserId || null : null,
        }),
      });
      setInviteMode(null);
      setInviteForm({ name: "", email: "", password: "", role: "employee", managerUserId: "" });
      await load();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Failed to add user");
    }
  }

  if (!canManageTeam) {
    return (
      <div className="max-w-[1400px]">
        <PageHeader title="Access denied" description="You don't have permission to manage the team." />
      </div>
    );
  }

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Administration"
        title="Team"
        description={
          isFullAdmin
            ? "Add sales managers and executives. One company can have multiple managers; each manager leads their sales team."
            : "Add sales executives to your team and manage their access"
        }
        action={
          <div className="flex flex-wrap gap-2">
            {isFullAdmin && (
              <BtnSecondary onClick={() => openInvite("manager")} className="!inline-flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" /> Add Sales Manager
              </BtnSecondary>
            )}
            <BtnPrimary onClick={() => openInvite("employee")} className="!inline-flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> Add Sales Executive
            </BtnPrimary>
          </div>
        }
      />

      {inviteMode && (
        <Panel
          title={inviteMode === "manager" ? "Add Sales Manager" : "Add Sales Executive"}
          className="mb-4"
        >
          <form onSubmit={handleInvite} className="grid sm:grid-cols-2 gap-3 max-w-2xl">
            <input
              className="pro-input text-sm"
              placeholder="Full name"
              required
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            />
            <input
              className="pro-input text-sm"
              type="email"
              placeholder="Work email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
            <input
              className="pro-input text-sm sm:col-span-2"
              type="password"
              placeholder="Temporary password (min 6 characters)"
              required
              minLength={6}
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
            />
            {inviteMode === "employee" && isFullAdmin && salesManagers.length > 0 && (
              <select
                className="pro-input text-sm sm:col-span-2"
                value={inviteForm.managerUserId}
                onChange={(e) => setInviteForm({ ...inviteForm, managerUserId: e.target.value })}
              >
                <option value="">Select sales manager (optional)</option>
                {salesManagers.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            )}
            {!isFullAdmin && inviteMode === "employee" && (
              <p className="text-sm text-slate-600 sm:col-span-2">
                This executive will report to you ({auth.user?.name}).
              </p>
            )}
            {inviteError && <p className="text-sm text-red-600 sm:col-span-2">{inviteError}</p>}
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="pro-btn-primary text-sm px-4">
                Add user
              </button>
              <button type="button" className="pro-btn-secondary text-sm px-4" onClick={() => setInviteMode(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Organization" className="mb-4">
        <div className="space-y-3">
          {salesManagers.length === 0 && (
            <p className="text-sm text-slate-500">No sales managers yet. Add a manager to build your team hierarchy.</p>
          )}
          {salesManagers.map((mgr) => {
            const team = hierarchy.execsByManager.get(mgr.user.id) || [];
            const open = expandedManagers[mgr.user.id] !== false;
            return (
              <div key={mgr.id} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
                  onClick={() => setExpandedManagers((p) => ({ ...p, [mgr.user.id]: !open }))}
                >
                  {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  <Users className="h-4 w-4 text-brand" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{mgr.user.name}</p>
                    <p className="text-xs text-slate-500">{mgr.user.email} · Sales Manager</p>
                  </div>
                  <span className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {team.length} executive{team.length !== 1 ? "s" : ""}
                  </span>
                </button>
                {open && (
                  <div className="divide-y divide-slate-100">
                    {team.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-500">No sales executives assigned yet.</p>
                    ) : (
                      team.map((exec) => (
                        <div key={exec.id} className="flex items-center gap-3 px-4 py-2.5 pl-12">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{exec.user.name}</p>
                            <p className="text-xs text-slate-500">{exec.user.email}</p>
                          </div>
                          <span className={cn(
                            "text-[11px] font-medium px-2 py-0.5 rounded border",
                            exec.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {exec.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {hierarchy.unassigned.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">Unassigned executives ({hierarchy.unassigned.length})</p>
              <ul className="space-y-1">
                {hierarchy.unassigned.map((m) => (
                  <li key={m.id} className="text-sm text-amber-800">
                    {m.user.name} — assign a sales manager in the table below
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Panel>

      <Panel title={`All members (${members.length})`} noPadding>
        {members.length === 0 ? (
          <EmptyState title="No team members" description="Add your first sales manager or executive" />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Reports to</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{m.user.name}</Td>
                  <Td>{m.user.email}</Td>
                  <Td>
                    {m.canChangeRole ? (
                      <select
                        className="pro-input text-sm py-1 px-2 w-full sm:w-auto sm:min-w-[140px]"
                        value={m.role}
                        disabled={updating === m.id}
                        onChange={(e) => changeRole(m.id, e.target.value, m.managerUserId || undefined)}
                      >
                        {ROLES.filter((r) => r !== "owner").map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm font-medium">{m.roleLabel}</span>
                    )}
                  </Td>
                  <Td>
                    {m.role === "employee" && m.canChangeManager ? (
                      <select
                        className="pro-input text-sm py-1 px-2 w-full sm:w-auto sm:min-w-[140px]"
                        value={m.managerUserId || ""}
                        disabled={updating === m.id}
                        onChange={(e) => changeManager(m.id, e.target.value)}
                      >
                        <option value="">No manager</option>
                        {managers.filter((mg) => mg.user.id !== m.user.id && mg.role === "manager").map((mg) => (
                          <option key={mg.user.id} value={mg.user.id}>{mg.user.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-600">{m.managerName || "—"}</span>
                    )}
                  </Td>
                  <Td>
                    <span className={cn(
                      "inline-flex px-2 py-0.5 rounded text-[11px] font-medium border",
                      m.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {m.status}
                    </span>
                  </Td>
                  <Td>
                    {m.canEdit && (
                      <button
                        type="button"
                        disabled={updating === m.id}
                        onClick={() => toggleStatus(m)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                      >
                        {m.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </Panel>

      {rolesData && isFullAdmin && (
        <Panel title="Role Permissions" className="mt-4">
          <ProTable>
            <thead>
              <tr>
                <Th>Role</Th>
                {rolesData.permissions.map((p) => (
                  <Th key={p} className="text-center capitalize">{p.replace(/_/g, " ")}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rolesData.roles.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-medium">{r.label}</Td>
                  {rolesData.permissions.map((p) => (
                    <Td key={p} className="text-center">
                      {r.permissions.includes(p) ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </ProTable>
        </Panel>
      )}
    </div>
  );
}
