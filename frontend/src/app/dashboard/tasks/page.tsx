"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/api";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_STATUS_BADGE,
} from "@/lib/crm-constants";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  Panel,
  ProTable,
  Th,
  Td,
  BtnPrimary,
  BtnSecondary,
  PageLoader,
  EmptyState,
} from "@/components/ui/dashboard-ui";
import { FilterBar } from "@/components/ui/filter-bar";
import { ExcelImportToolbar } from "@/components/ui/excel-import-toolbar";
import { useAuth } from "@/lib/auth-context";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  lead: { id: string; leadNumber: string; firstName: string; lastName: string | null } | null;
};

const selectCls = "pro-input text-sm py-1.5 px-2 w-full sm:w-auto sm:min-w-[120px]";

export default function TasksPage() {
  const auth = useAuth();
  const canImport = auth.hasPermission("import");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [due, setDue] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (due) params.set("due", due);
      const qs = params.toString();
      setTasks(await apiFetch<Task[]>(`/api/tasks${qs ? `?${qs}` : ""}`));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load().catch(console.error);
  }, [status, priority, due]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          priority: formPriority,
          dueDate: dueDate || null,
        }),
      });
      setTitle("");
      setDueDate("");
      setFormPriority("medium");
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function complete(id: string) {
    await apiFetch(`/api/tasks/${id}/complete`, { method: "PATCH" });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this task?")) return;
    await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading && tasks.length === 0) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Tasks"
        title="Task Management"
        description="Track assignments, priorities, and due dates across your team"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExcelImportToolbar
              apiBase="/api/tasks"
              entityLabel="Tasks"
              canImport={canImport}
              onImported={load}
            />
            <BtnPrimary onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4" /> New Task
            </BtnPrimary>
          </div>
        }
      />

      {showForm && (
        <Panel title="Create Task" className="mb-4">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-0 w-full sm:min-w-[200px]">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Title</label>
              <input
                className="pro-input w-full text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Due Date</label>
              <input
                type="date"
                className="pro-input text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Priority</label>
              <select className={selectCls} value={formPriority} onChange={(e) => setFormPriority(e.target.value)}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="pro-btn-primary" disabled={saving}>{saving ? "Saving..." : "Create"}</button>
            <BtnSecondary onClick={() => setShowForm(false)}>Cancel</BtnSecondary>
          </form>
        </Panel>
      )}

      <FilterBar
        className="mb-4"
        showClear={!!(status || priority || due)}
        onClear={() => {
          setStatus("");
          setPriority("");
          setDue("");
        }}
        fields={[
          {
            type: "select",
            key: "status",
            label: "Status",
            placeholder: "All statuses",
            value: status,
            onChange: setStatus,
            options: TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
          },
          {
            type: "select",
            key: "priority",
            label: "Priority",
            placeholder: "All priorities",
            value: priority,
            onChange: setPriority,
            options: TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] })),
          },
          {
            type: "select",
            key: "due",
            label: "Due",
            placeholder: "All due dates",
            value: due,
            onChange: setDue,
            options: [
              { value: "today", label: "Due today" },
              { value: "overdue", label: "Overdue" },
            ],
          },
        ]}
      />

      <Panel title={`${tasks.length} tasks`} noPadding>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks found" description="Create a task or adjust your filters" />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <Th>Task</Th>
                <Th>Assignee</Th>
                <Th>Due Date</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Linked Lead</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-medium text-slate-900">{t.title}</p>
                    {t.description && <p className="text-xs text-slate-500 truncate max-w-[240px]">{t.description}</p>}
                  </Td>
                  <Td>{t.assignee?.name || "Unassigned"}</Td>
                  <Td className="tabular-nums">{t.dueDate ? formatDate(t.dueDate) : "—"}</Td>
                  <Td>
                    <span className={cn("inline-flex px-2 py-0.5 rounded text-[11px] font-medium", TASK_PRIORITY_BADGE[t.priority])}>
                      {TASK_PRIORITY_LABELS[t.priority] || t.priority}
                    </span>
                  </Td>
                  <Td>
                    <span className={cn("inline-flex px-2 py-0.5 rounded text-[11px] font-medium", TASK_STATUS_BADGE[t.status])}>
                      {TASK_STATUS_LABELS[t.status] || t.status}
                    </span>
                  </Td>
                  <Td>
                    {t.lead ? (
                      <span className="text-xs font-mono text-slate-600">{t.lead.leadNumber}</span>
                    ) : "—"}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {t.status !== "completed" && (
                        <button type="button" onClick={() => complete(t.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Complete">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button type="button" onClick={() => remove(t.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-700" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </Panel>
    </div>
  );
}
