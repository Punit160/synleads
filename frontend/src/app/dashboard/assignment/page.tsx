"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { Plus, Users, GitBranch, Gauge, Trash2, Pencil } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Panel, ProTable, Th, Td, PageLoader, BtnPrimary } from "@/components/ui/dashboard-ui";
import { ASSIGNMENT_METHODS, LEAD_SOURCES } from "@/lib/lead-constants";
import { cn } from "@/lib/utils";

type Team = {
  id: string;
  name: string;
  description: string | null;
  leader: { id: string; name: string } | null;
  members: Array<{ id: string; name: string }>;
  memberCount: number;
};

type Rule = {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  teamId: string | null;
  team: { id: string; name: string } | null;
  distributionMethod: string;
  sourceFilter: string | null;
  cityFilter: string | null;
  stateFilter: string | null;
  productFilter: string | null;
  maxLeadLimit: number | null;
  backupUserId: string | null;
  backupUser: { id: string; name: string } | null;
  assigneeUserIds: string[];
};

type Assignable = { userId: string; name: string; email: string; role: string };
type Workload = {
  memberId: string;
  userId: string;
  name: string;
  role: string;
  managerName: string | null;
  isAvailable: boolean;
  maxLeadLimit: number | null;
  openLeads: number;
  totalLeads: number;
  atCapacity: boolean;
};

const TABS = ["queue", "teams", "rules", "workload"] as const;

const emptyRule = {
  name: "",
  priority: 0,
  isActive: true,
  teamId: "",
  distributionMethod: "round_robin",
  sourceFilter: "",
  cityFilter: "",
  stateFilter: "",
  productFilter: "",
  maxLeadLimit: "",
  backupUserId: "",
  assigneeUserIds: [] as string[],
};

const emptyTeam = { name: "", description: "", leaderId: "", memberUserIds: [] as string[] };

export default function AssignmentPage() {
  const auth = useAuth();
  const canManage = auth.hasPermission("manage_team");
  const canAssign = auth.hasPermission("assign");

  const [tab, setTab] = useState<(typeof TABS)[number]>(canAssign ? "queue" : "rules");
  const [teams, setTeams] = useState<Team[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [workload, setWorkload] = useState<Workload[]>([]);
  const [assignable, setAssignable] = useState<Assignable[]>([]);
  const [unassigned, setUnassigned] = useState<Array<{
    id: string;
    leadNumber: string;
    firstName: string;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    source: string | null;
  }>>([]);
  const [queueSelected, setQueueSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ ...emptyRule });
  const [teamForm, setTeamForm] = useState({ ...emptyTeam });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [t, r, w, a, u] = await Promise.all([
        apiFetch<Team[]>("/api/teams"),
        canManage ? apiFetch<Rule[]>("/api/assignment-rules") : Promise.resolve([]),
        apiFetch<Workload[]>("/api/teams/workload/members"),
        canAssign ? apiFetch<Assignable[]>("/api/users/assignable") : Promise.resolve([]),
        canAssign
          ? apiFetch<Array<{ id: string; leadNumber: string; firstName: string; lastName: string | null; company: string | null; phone: string | null; source: string | null }> | { items: Array<{ id: string; leadNumber: string; firstName: string; lastName: string | null; company: string | null; phone: string | null; source: string | null }> }>("/api/leads?unassigned=1&pageSize=100")
          : Promise.resolve([]),
      ]);
      setTeams(t);
      setRules(r);
      setWorkload(w);
      setAssignable(a);
      setUnassigned(Array.isArray(u) ? u : u.items);
      setQueueSelected([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, [canManage, canAssign]);

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      name: ruleForm.name.trim(),
      priority: Number(ruleForm.priority) || 0,
      isActive: ruleForm.isActive,
      teamId: ruleForm.teamId || null,
      distributionMethod: ruleForm.distributionMethod,
      sourceFilter: ruleForm.sourceFilter || null,
      cityFilter: ruleForm.cityFilter || null,
      stateFilter: ruleForm.stateFilter || null,
      productFilter: ruleForm.productFilter || null,
      maxLeadLimit: ruleForm.maxLeadLimit ? Number(ruleForm.maxLeadLimit) : null,
      backupUserId: ruleForm.backupUserId || null,
      assigneeUserIds: ruleForm.assigneeUserIds,
    };
    try {
      if (editingRuleId) {
        await apiFetch(`/api/assignment-rules/${editingRuleId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/assignment-rules", { method: "POST", body: JSON.stringify(body) });
      }
      setShowRuleForm(false);
      setEditingRuleId(null);
      setRuleForm({ ...emptyRule });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save rule");
    }
  }

  async function saveTeam(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/api/teams", {
        method: "POST",
        body: JSON.stringify({
          name: teamForm.name.trim(),
          description: teamForm.description || undefined,
          leaderId: teamForm.leaderId || null,
          memberUserIds: teamForm.memberUserIds,
        }),
      });
      setShowTeamForm(false);
      setTeamForm({ ...emptyTeam });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create team");
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this assignment rule?")) return;
    await apiFetch(`/api/assignment-rules/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleAvailability(memberId: string, current: boolean) {
    await apiFetch(`/api/users/${memberId}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ isAvailable: !current }),
    });
    await load();
  }

  function editRule(rule: Rule) {
    setEditingRuleId(rule.id);
    setRuleForm({
      name: rule.name,
      priority: rule.priority,
      isActive: rule.isActive,
      teamId: rule.teamId || "",
      distributionMethod: rule.distributionMethod,
      sourceFilter: rule.sourceFilter || "",
      cityFilter: rule.cityFilter || "",
      stateFilter: rule.stateFilter || "",
      productFilter: rule.productFilter || "",
      maxLeadLimit: rule.maxLeadLimit?.toString() || "",
      backupUserId: rule.backupUserId || "",
      assigneeUserIds: rule.assigneeUserIds,
    });
    setShowRuleForm(true);
  }

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl space-y-5">
      <PageHeader
        title="Lead Assignment"
        description="Teams, assignment rules, round-robin, load-based routing, and employee workload"
        action={<TenantLink href="/dashboard/leads" className="pro-btn-secondary">← Leads</TenantLink>}
      />

      <div className="flex gap-1 border-b border-slate-200 pb-1">
        {[
          ...(canAssign ? [{ id: "queue" as const, label: "Unassigned queue", icon: Gauge }] : []),
          { id: "rules" as const, label: "Assignment Rules", icon: GitBranch },
          { id: "teams" as const, label: "Teams", icon: Users },
          { id: "workload" as const, label: "Workload", icon: Gauge },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 -mb-px",
              tab === id ? "border-blue-600 text-blue-700 bg-blue-50/50" : "border-transparent text-slate-500"
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "queue" && canAssign && (
        <Panel title={`${unassigned.length} unassigned leads`} noPadding>
          {unassigned.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">Unassigned queue is empty.</p>
          ) : (
            <>
              {queueSelected.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100 bg-brand-muted">
                  <p className="text-sm font-semibold">{queueSelected.length} selected</p>
                  <select
                    className="pro-input text-xs py-1.5 w-auto"
                    defaultValue=""
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      await apiFetch("/api/leads/bulk", {
                        method: "PATCH",
                        body: JSON.stringify({ ids: queueSelected, ownerId: e.target.value }),
                      });
                      e.target.value = "";
                      await load();
                    }}
                  >
                    <option value="">Assign to…</option>
                    {assignable.map((u) => (
                      <option key={u.userId} value={u.userId}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <ProTable>
                <thead>
                  <tr>
                    <Th className="w-10">
                      <input
                        type="checkbox"
                        checked={unassigned.length > 0 && queueSelected.length === unassigned.length}
                        onChange={() => setQueueSelected((prev) => prev.length === unassigned.length ? [] : unassigned.map((l) => l.id))}
                      />
                    </Th>
                    <Th>Lead</Th>
                    <Th>Company</Th>
                    <Th>Phone</Th>
                    <Th>Source</Th>
                    <Th>Assign</Th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <Td>
                        <input
                          type="checkbox"
                          checked={queueSelected.includes(lead.id)}
                          onChange={() => setQueueSelected((prev) => prev.includes(lead.id) ? prev.filter((x) => x !== lead.id) : [...prev, lead.id])}
                        />
                      </Td>
                      <Td>
                        <TenantLink href={`/dashboard/leads/${lead.id}`} className="font-medium hover:underline">
                          {lead.firstName} {lead.lastName} <span className="text-xs text-slate-400 font-mono">{lead.leadNumber}</span>
                        </TenantLink>
                      </Td>
                      <Td>{lead.company || "—"}</Td>
                      <Td>{lead.phone || "—"}</Td>
                      <Td>{lead.source || "—"}</Td>
                      <Td>
                        <select
                          className="pro-input text-xs py-1"
                          defaultValue=""
                          onChange={async (e) => {
                            if (!e.target.value) return;
                            await apiFetch(`/api/leads/${lead.id}/assign`, {
                              method: "PATCH",
                              body: JSON.stringify({ ownerId: e.target.value }),
                            });
                            await load();
                          }}
                        >
                          <option value="">Assign…</option>
                          {assignable.map((u) => (
                            <option key={u.userId} value={u.userId}>{u.name}</option>
                          ))}
                        </select>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </ProTable>
            </>
          )}
        </Panel>
      )}

      {tab === "rules" && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <BtnPrimary onClick={() => { setShowRuleForm(true); setEditingRuleId(null); setRuleForm({ ...emptyRule }); }}>
                <Plus className="h-4 w-4" /> Create rule
              </BtnPrimary>
            </div>
          )}
          {showRuleForm && canManage && (
            <Panel title={editingRuleId ? "Edit assignment rule" : "New assignment rule"}>
              <form onSubmit={saveRule} className="grid sm:grid-cols-2 gap-3 p-4">
                <input className="pro-input text-sm sm:col-span-2" placeholder="Rule name *" required value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} />
                <input className="pro-input text-sm" type="number" placeholder="Priority (higher first)" value={ruleForm.priority} onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })} />
                <select className="pro-input text-sm" value={ruleForm.distributionMethod} onChange={(e) => setRuleForm({ ...ruleForm, distributionMethod: e.target.value })}>
                  {ASSIGNMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <select className="pro-input text-sm" value={ruleForm.teamId} onChange={(e) => setRuleForm({ ...ruleForm, teamId: e.target.value })}>
                  <option value="">No team (use employees below)</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input className="pro-input text-sm" type="number" placeholder="Max leads per employee" value={ruleForm.maxLeadLimit} onChange={(e) => setRuleForm({ ...ruleForm, maxLeadLimit: e.target.value })} />
                <select className="pro-input text-sm" value={ruleForm.sourceFilter} onChange={(e) => setRuleForm({ ...ruleForm, sourceFilter: e.target.value })}>
                  <option value="">Any source</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="pro-input text-sm" placeholder="City filter" value={ruleForm.cityFilter} onChange={(e) => setRuleForm({ ...ruleForm, cityFilter: e.target.value })} />
                <input className="pro-input text-sm" placeholder="State filter" value={ruleForm.stateFilter} onChange={(e) => setRuleForm({ ...ruleForm, stateFilter: e.target.value })} />
                <input className="pro-input text-sm" placeholder="Product / industry filter" value={ruleForm.productFilter} onChange={(e) => setRuleForm({ ...ruleForm, productFilter: e.target.value })} />
                <select className="pro-input text-sm" value={ruleForm.backupUserId} onChange={(e) => setRuleForm({ ...ruleForm, backupUserId: e.target.value })}>
                  <option value="">No backup employee</option>
                  {assignable.map((u) => <option key={u.userId} value={u.userId}>{u.name}</option>)}
                </select>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-slate-600 mb-2">Select employees</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
                    {assignable.map((u) => (
                      <label key={u.userId} className="inline-flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={ruleForm.assigneeUserIds.includes(u.userId)}
                          onChange={(e) => {
                            setRuleForm({
                              ...ruleForm,
                              assigneeUserIds: e.target.checked
                                ? [...ruleForm.assigneeUserIds, u.userId]
                                : ruleForm.assigneeUserIds.filter((id) => id !== u.userId),
                            });
                          }}
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={ruleForm.isActive} onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })} />
                  Rule active
                </label>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" className="pro-btn-primary text-sm">Save rule</button>
                  <button type="button" onClick={() => { setShowRuleForm(false); setEditingRuleId(null); }} className="pro-btn-secondary text-sm">Cancel</button>
                </div>
              </form>
            </Panel>
          )}
          <Panel title="Assignment rules" subtitle="Rules run by priority — first match wins" noPadding>
            {rules.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No rules yet. Create one to auto-assign leads by source, location, or product.</p>
            ) : (
              <ProTable>
                <thead>
                  <tr>
                    <Th>Rule</Th>
                    <Th>Method</Th>
                    <Th>Filters</Th>
                    <Th>Team</Th>
                    <Th className="text-right">Priority</Th>
                    {canManage && <Th className="text-right">Actions</Th>}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <Td>
                        <p className="font-medium !text-slate-900">{r.name}</p>
                        <p className={cn("text-[10px]", r.isActive ? "text-emerald-600" : "text-slate-400")}>{r.isActive ? "Active" : "Inactive"}</p>
                      </Td>
                      <Td>{ASSIGNMENT_METHODS.find((m) => m.id === r.distributionMethod)?.label || r.distributionMethod}</Td>
                      <Td className="text-xs text-slate-600">
                        {[r.sourceFilter, r.cityFilter, r.stateFilter, r.productFilter].filter(Boolean).join(" · ") || "Any"}
                      </Td>
                      <Td>{r.team?.name || `${r.assigneeUserIds.length} employees`}</Td>
                      <Td className="text-right font-semibold">{r.priority}</Td>
                      {canManage && (
                        <Td>
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => editRule(r)} className="p-1.5 rounded hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => deleteRule(r.id)} className="p-1.5 rounded hover:bg-slate-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </ProTable>
            )}
          </Panel>
          <p className="text-xs text-slate-500">
            Manual assignment is available on each lead. Workspace auto-assign (Settings → Automation) is used when no rule matches.
          </p>
        </div>
      )}

      {tab === "teams" && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <BtnPrimary onClick={() => setShowTeamForm(true)}><Plus className="h-4 w-4" /> Add team</BtnPrimary>
            </div>
          )}
          {showTeamForm && canManage && (
            <Panel title="New team">
              <form onSubmit={saveTeam} className="grid sm:grid-cols-2 gap-3 p-4">
                <input className="pro-input text-sm sm:col-span-2" placeholder="Team name *" required value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
                <textarea className="pro-input text-sm sm:col-span-2 min-h-[60px]" placeholder="Description" value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} />
                <select className="pro-input text-sm" value={teamForm.leaderId} onChange={(e) => setTeamForm({ ...teamForm, leaderId: e.target.value })}>
                  <option value="">Team leader / manager</option>
                  {assignable.map((u) => <option key={u.userId} value={u.userId}>{u.name}</option>)}
                </select>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-slate-600 mb-2">Team members</p>
                  <div className="flex flex-wrap gap-2 border border-slate-200 rounded-lg p-2">
                    {assignable.map((u) => (
                      <label key={u.userId} className="inline-flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={teamForm.memberUserIds.includes(u.userId)}
                          onChange={(e) => setTeamForm({
                            ...teamForm,
                            memberUserIds: e.target.checked
                              ? [...teamForm.memberUserIds, u.userId]
                              : teamForm.memberUserIds.filter((id) => id !== u.userId),
                          })}
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" className="pro-btn-primary text-sm">Create team</button>
                  <button type="button" onClick={() => setShowTeamForm(false)} className="pro-btn-secondary text-sm">Cancel</button>
                </div>
              </form>
            </Panel>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {teams.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">{t.name}</p>
                {t.leader && <p className="text-xs text-slate-500 mt-0.5">Leader: {t.leader.name}</p>}
                <p className="text-xs text-slate-600 mt-2">{t.memberCount} member{t.memberCount !== 1 ? "s" : ""}</p>
                <p className="text-[11px] text-slate-400 mt-1 truncate">{t.members.map((m) => m.name).join(", ") || "No members"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "workload" && (
        <Panel title="Employee workload" subtitle="Open leads vs capacity — used for load-based assignment" noPadding>
          <ProTable>
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Manager</Th>
                <Th className="text-right">Open leads</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Limit</Th>
                <Th>Availability</Th>
              </tr>
            </thead>
            <tbody>
              {workload.map((w) => (
                <tr key={w.userId} className={cn("hover:bg-slate-50", w.atCapacity && "bg-red-50/30")}>
                  <Td className="font-medium !text-slate-900">{w.name}</Td>
                  <Td className="text-xs">{w.managerName || "—"}</Td>
                  <Td className={cn("text-right font-semibold", w.atCapacity && "text-red-600")}>{w.openLeads}</Td>
                  <Td className="text-right">{w.totalLeads}</Td>
                  <Td className="text-right">{w.maxLeadLimit ?? "—"}</Td>
                  <Td>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => toggleAvailability(w.memberId, w.isAvailable)}
                        className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", w.isAvailable ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500")}
                      >
                        {w.isAvailable ? "Available" : "Unavailable"}
                      </button>
                    ) : (
                      <span className="text-xs">{w.isAvailable ? "Available" : "Unavailable"}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        </Panel>
      )}
    </div>
  );
}
