"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Zap, Target, Clock, ListFilter, RefreshCw } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  PageHeader,
  Panel,
  PageLoader,
  BtnPrimary,
  BtnSecondary,
  ProTable,
  Th,
  Td,
  FetchError,
  EmptyState,
} from "@/components/ui/dashboard-ui";
import { cn } from "@/lib/utils";

type Tab = "workflows" | "scoring" | "sla" | "fields";

type WorkflowRule = {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  trigger: string;
  conditions: Array<{ field: string; operator: string; value?: string }>;
  actions: Array<Record<string, unknown>>;
};

type ScoringRule = {
  id: string;
  name: string;
  field: string;
  operator: string;
  value: string | null;
  points: number;
  isActive: boolean;
  priority: number;
};

type SlaPolicy = {
  enabled: boolean;
  firstResponseHours: number;
  escalateAfterHours: number;
  escalateToManager: boolean;
  notifyOnBreach: boolean;
};

type SlaStats = { open: number; breached: number; escalated: number; met: number };

type CustomField = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
  sortOrder: number;
};

const TABS: { id: Tab; label: string; icon: typeof Zap }[] = [
  { id: "workflows", label: "Workflows", icon: Zap },
  { id: "scoring", label: "Lead scoring", icon: Target },
  { id: "sla", label: "SLA & escalation", icon: Clock },
  { id: "fields", label: "Custom fields", icon: ListFilter },
];

const TRIGGERS = [
  { value: "lead.created", label: "Lead created" },
  { value: "lead.status_changed", label: "Status changed" },
];

const ACTION_TYPES = [
  { value: "create_followup", label: "Schedule follow-up" },
  { value: "create_task", label: "Create task" },
  { value: "notify_owner", label: "Notify owner" },
  { value: "notify_manager", label: "Notify manager" },
  { value: "set_priority", label: "Set priority" },
  { value: "set_status", label: "Set status" },
];

export default function AutomationPage() {
  const auth = useAuth();
  const canManage = auth.hasPermission("manage_team");
  const [tab, setTab] = useState<Tab>("workflows");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workflows, setWorkflows] = useState<WorkflowRule[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [sla, setSla] = useState<SlaPolicy | null>(null);
  const [slaStats, setSlaStats] = useState<SlaStats | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);

  const [wfForm, setWfForm] = useState({
    id: "",
    name: "",
    trigger: "lead.created",
    priority: 0,
    isActive: true,
    actionType: "create_followup",
    actionPriority: "high",
    followUpHours: 24,
  });

  const [scoreForm, setScoreForm] = useState({
    id: "",
    name: "",
    field: "source",
    operator: "equals",
    value: "",
    points: 10,
    priority: 0,
  });

  const [fieldForm, setFieldForm] = useState({
    id: "",
    key: "",
    label: "",
    fieldType: "text",
    options: "",
    required: false,
  });

  async function loadAll() {
    setError(null);
    try {
      const [wf, sr, slaData, stats, defs] = await Promise.all([
        apiFetch<WorkflowRule[]>("/api/automation/workflows"),
        apiFetch<ScoringRule[]>("/api/automation/scoring-rules"),
        apiFetch<SlaPolicy>("/api/automation/sla"),
        apiFetch<SlaStats>("/api/automation/sla/stats"),
        apiFetch<CustomField[]>("/api/custom-fields/definitions?entityType=lead"),
      ]);
      setWorkflows(wf);
      setScoringRules(sr);
      setSla(slaData);
      setSlaStats(stats);
      setFields(defs);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load automation settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canManage) return;
    loadAll().catch(console.error);
  }, [canManage]);

  async function saveWorkflow() {
    const actions =
      wfForm.actionType === "create_followup"
        ? [{ type: "create_followup", followUpType: "call", hoursFromNow: wfForm.followUpHours }]
        : wfForm.actionType === "create_task"
          ? [{ type: "create_task", title: "Follow up on new lead", priority: wfForm.actionPriority, dueHours: 48 }]
          : wfForm.actionType === "set_priority"
            ? [{ type: "set_priority", priority: wfForm.actionPriority }]
            : wfForm.actionType === "set_status"
              ? [{ type: "set_status", status: "qualified" }]
              : wfForm.actionType === "notify_manager"
                ? [{ type: "notify_manager", title: "Workflow alert", message: wfForm.name }]
                : [{ type: "notify_owner", title: "Workflow alert", message: wfForm.name }];

    const body = {
      name: wfForm.name,
      trigger: wfForm.trigger,
      priority: wfForm.priority,
      isActive: wfForm.isActive,
      conditions: [],
      actions,
    };

    if (wfForm.id) {
      await apiFetch(`/api/automation/workflows/${wfForm.id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch("/api/automation/workflows", { method: "POST", body: JSON.stringify(body) });
    }
    setWfForm({ id: "", name: "", trigger: "lead.created", priority: 0, isActive: true, actionType: "create_followup", actionPriority: "high", followUpHours: 24 });
    await loadAll();
  }

  async function saveScoringRule() {
    const body = {
      name: scoreForm.name,
      field: scoreForm.field,
      operator: scoreForm.operator,
      value: scoreForm.value || null,
      points: scoreForm.points,
      priority: scoreForm.priority,
    };
    if (scoreForm.id) {
      await apiFetch(`/api/automation/scoring-rules/${scoreForm.id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch("/api/automation/scoring-rules", { method: "POST", body: JSON.stringify(body) });
    }
    setScoreForm({ id: "", name: "", field: "source", operator: "equals", value: "", points: 10, priority: 0 });
    await loadAll();
  }

  async function saveSla() {
    if (!sla) return;
    await apiFetch("/api/automation/sla", { method: "PUT", body: JSON.stringify(sla) });
    await loadAll();
  }

  async function saveField() {
    const body = {
      key: fieldForm.key,
      label: fieldForm.label,
      fieldType: fieldForm.fieldType,
      options: fieldForm.options ? fieldForm.options.split(",").map((s) => s.trim()).filter(Boolean) : [],
      required: fieldForm.required,
    };
    if (fieldForm.id) {
      await apiFetch(`/api/custom-fields/definitions/${fieldForm.id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch("/api/custom-fields/definitions", { method: "POST", body: JSON.stringify(body) });
    }
    setFieldForm({ id: "", key: "", label: "", fieldType: "text", options: "", required: false });
    await loadAll();
  }

  if (!canManage) {
    return (
      <EmptyState
        title="Admin access required"
        description="Workflow automation, scoring, SLA policies, and custom fields are managed by admins and managers."
      />
    );
  }

  if (loading) return <PageLoader />;
  if (error) return <FetchError message={error} onRetry={() => { setLoading(true); loadAll().catch(console.error); }} />;

  return (
    <div className="max-w-[1200px]">
      <PageHeader
        title="Automation"
        description="Workflows, auto lead scoring, SLA policies, and custom fields for your CRM."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === id ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "workflows" && (
        <div className="space-y-6">
          <Panel title="Workflow rules" subtitle="Automate actions when leads are created or status changes.">
            <ProTable>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Trigger</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {workflows.length === 0 ? (
                  <tr><Td colSpan={5} className="text-center text-slate-500 py-8">No workflow rules yet.</Td></tr>
                ) : workflows.map((w) => (
                  <tr key={w.id}>
                    <Td>{w.name}</Td>
                    <Td>{TRIGGERS.find((t) => t.value === w.trigger)?.label ?? w.trigger}</Td>
                    <Td>{w.priority}</Td>
                    <Td>{w.isActive ? "Active" : "Paused"}</Td>
                    <Td className="text-right">
                      <button type="button" className="text-indigo-600 mr-2" onClick={() => setWfForm({ ...wfForm, id: w.id, name: w.name, trigger: w.trigger, priority: w.priority, isActive: w.isActive })}>
                        <Pencil className="h-4 w-4 inline" />
                      </button>
                      <button type="button" className="text-red-600" onClick={async () => { await apiFetch(`/api/automation/workflows/${w.id}`, { method: "DELETE" }); await loadAll(); }}>
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          </Panel>

          <Panel title={wfForm.id ? "Edit workflow" : "Add workflow"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-slate-600">Name</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={wfForm.name} onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Trigger</span>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={wfForm.trigger} onChange={(e) => setWfForm({ ...wfForm, trigger: e.target.value })}>
                  {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Action</span>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={wfForm.actionType} onChange={(e) => setWfForm({ ...wfForm, actionType: e.target.value })}>
                  {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </label>
              {wfForm.actionType === "create_followup" && (
                <label className="block text-sm">
                  <span className="text-slate-600">Follow-up in (hours)</span>
                  <input type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={wfForm.followUpHours} onChange={(e) => setWfForm({ ...wfForm, followUpHours: Number(e.target.value) })} />
                </label>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <BtnPrimary onClick={saveWorkflow} disabled={!wfForm.name.trim()}><Plus className="h-4 w-4" /> Save workflow</BtnPrimary>
              {wfForm.id && <BtnSecondary onClick={() => setWfForm({ id: "", name: "", trigger: "lead.created", priority: 0, isActive: true, actionType: "create_followup", actionPriority: "high", followUpHours: 24 })}>Cancel</BtnSecondary>}
            </div>
          </Panel>
        </div>
      )}

      {tab === "scoring" && (
        <div className="space-y-6">
          <Panel title="Scoring rules" subtitle="Points are summed and capped at 100. Rules run automatically on create and update.">
            <div className="mb-4 flex justify-end">
              <BtnSecondary onClick={async () => { await apiFetch("/api/automation/scoring-rules/recalculate", { method: "POST" }); await loadAll(); }}>
                <RefreshCw className="h-4 w-4" /> Recalculate all leads
              </BtnSecondary>
            </div>
            <ProTable>
              <thead><tr><Th>Rule</Th><Th>Field</Th><Th>Condition</Th><Th>Points</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {scoringRules.length === 0 ? (
                  <tr><Td colSpan={5} className="text-center text-slate-500 py-8">No scoring rules — add rules to auto-score leads.</Td></tr>
                ) : scoringRules.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.name}</Td>
                    <Td>{r.field}</Td>
                    <Td>{r.operator} {r.value ?? "—"}</Td>
                    <Td className={r.points >= 0 ? "text-emerald-600" : "text-red-600"}>{r.points > 0 ? "+" : ""}{r.points}</Td>
                    <Td className="text-right">
                      <button type="button" className="text-indigo-600 mr-2" onClick={() => setScoreForm({ id: r.id, name: r.name, field: r.field, operator: r.operator, value: r.value ?? "", points: r.points, priority: r.priority })}><Pencil className="h-4 w-4 inline" /></button>
                      <button type="button" className="text-red-600" onClick={async () => { await apiFetch(`/api/automation/scoring-rules/${r.id}`, { method: "DELETE" }); await loadAll(); }}><Trash2 className="h-4 w-4 inline" /></button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          </Panel>

          <Panel title={scoreForm.id ? "Edit rule" : "Add scoring rule"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm"><span className="text-slate-600">Name</span><input className="mt-1 w-full rounded-lg border px-3 py-2" value={scoreForm.name} onChange={(e) => setScoreForm({ ...scoreForm, name: e.target.value })} /></label>
              <label className="block text-sm"><span className="text-slate-600">Field</span>
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={scoreForm.field} onChange={(e) => setScoreForm({ ...scoreForm, field: e.target.value })}>
                  {["source", "priority", "status", "city", "state", "industry", "budget", "has_email", "has_phone", "has_company"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="block text-sm"><span className="text-slate-600">Operator</span>
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={scoreForm.operator} onChange={(e) => setScoreForm({ ...scoreForm, operator: e.target.value })}>
                  {["equals", "contains", "gte", "lte", "exists", "not_exists"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="block text-sm"><span className="text-slate-600">Value</span><input className="mt-1 w-full rounded-lg border px-3 py-2" value={scoreForm.value} onChange={(e) => setScoreForm({ ...scoreForm, value: e.target.value })} /></label>
              <label className="block text-sm"><span className="text-slate-600">Points</span><input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={scoreForm.points} onChange={(e) => setScoreForm({ ...scoreForm, points: Number(e.target.value) })} /></label>
            </div>
            <div className="mt-4"><BtnPrimary onClick={saveScoringRule} disabled={!scoreForm.name.trim()}><Plus className="h-4 w-4" /> Save rule</BtnPrimary></div>
          </Panel>
        </div>
      )}

      {tab === "sla" && sla && (
        <div className="space-y-6">
          {slaStats && (
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "Awaiting response", value: slaStats.open },
                { label: "Met SLA", value: slaStats.met, color: "text-emerald-600" },
                { label: "Breached", value: slaStats.breached, color: "text-amber-600" },
                { label: "Escalated", value: slaStats.escalated, color: "text-red-600" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className={cn("text-2xl font-semibold mt-1", s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <Panel title="SLA policy" subtitle="First-response deadlines and manager escalation for uncontacted leads.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sla.enabled} onChange={(e) => setSla({ ...sla, enabled: e.target.checked })} /> Enable SLA tracking</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sla.notifyOnBreach} onChange={(e) => setSla({ ...sla, notifyOnBreach: e.target.checked })} /> Notify owner on breach</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sla.escalateToManager} onChange={(e) => setSla({ ...sla, escalateToManager: e.target.checked })} /> Escalate to manager</label>
              <label className="block text-sm"><span className="text-slate-600">First response (hours)</span><input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={sla.firstResponseHours} onChange={(e) => setSla({ ...sla, firstResponseHours: Number(e.target.value) })} /></label>
              <label className="block text-sm"><span className="text-slate-600">Escalate after (hours)</span><input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={sla.escalateAfterHours} onChange={(e) => setSla({ ...sla, escalateAfterHours: Number(e.target.value) })} /></label>
            </div>
            <div className="mt-4 flex gap-2">
              <BtnPrimary onClick={saveSla}>Save SLA policy</BtnPrimary>
              <BtnSecondary onClick={async () => { await apiFetch("/api/automation/sla/run-checks", { method: "POST" }); await loadAll(); }}>Run checks now</BtnSecondary>
            </div>
          </Panel>
        </div>
      )}

      {tab === "fields" && (
        <div className="space-y-6">
          <Panel title="Lead custom fields" subtitle="Extra fields appear on lead forms and exports. Use smart lists on the Leads page to filter by saved views.">
            <ProTable>
              <thead><tr><Th>Label</Th><Th>Key</Th><Th>Type</Th><Th>Required</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {fields.length === 0 ? (
                  <tr><Td colSpan={5} className="text-center text-slate-500 py-8">No custom fields defined.</Td></tr>
                ) : fields.map((f) => (
                  <tr key={f.id}>
                    <Td>{f.label}</Td>
                    <Td><code className="text-xs">{f.key}</code></Td>
                    <Td>{f.fieldType}</Td>
                    <Td>{f.required ? "Yes" : "No"}</Td>
                    <Td className="text-right">
                      <button type="button" className="text-indigo-600 mr-2" onClick={() => setFieldForm({ id: f.id, key: f.key, label: f.label, fieldType: f.fieldType, options: (f.options || []).join(", "), required: f.required })}><Pencil className="h-4 w-4 inline" /></button>
                      <button type="button" className="text-red-600" onClick={async () => { await apiFetch(`/api/custom-fields/definitions/${f.id}`, { method: "DELETE" }); await loadAll(); }}><Trash2 className="h-4 w-4 inline" /></button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          </Panel>

          <Panel title={fieldForm.id ? "Edit field" : "Add custom field"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm"><span className="text-slate-600">Label</span><input className="mt-1 w-full rounded-lg border px-3 py-2" value={fieldForm.label} onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })} /></label>
              <label className="block text-sm"><span className="text-slate-600">Key (snake_case)</span><input className="mt-1 w-full rounded-lg border px-3 py-2" value={fieldForm.key} onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })} disabled={!!fieldForm.id} /></label>
              <label className="block text-sm"><span className="text-slate-600">Type</span>
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={fieldForm.fieldType} onChange={(e) => setFieldForm({ ...fieldForm, fieldType: e.target.value })}>
                  {["text", "number", "date", "select", "boolean"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {fieldForm.fieldType === "select" && (
                <label className="block text-sm"><span className="text-slate-600">Options (comma-separated)</span><input className="mt-1 w-full rounded-lg border px-3 py-2" value={fieldForm.options} onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })} /></label>
              )}
              <label className="flex items-center gap-2 text-sm pt-6"><input type="checkbox" checked={fieldForm.required} onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })} /> Required</label>
            </div>
            <div className="mt-4"><BtnPrimary onClick={saveField} disabled={!fieldForm.label.trim() || !fieldForm.key.trim()}><Plus className="h-4 w-4" /> Save field</BtnPrimary></div>
          </Panel>
        </div>
      )}
    </div>
  );
}
