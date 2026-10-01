"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { Plus, Download, Copy, Trash2, Pencil, Archive, ArchiveRestore, LayoutGrid, List, Bookmark, BookmarkPlus, StickyNote, Kanban } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import {
  LEAD_STATUS_LABELS,
  STATUS_BADGE,
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
} from "@/lib/lead-constants";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  BtnPrimary,
  BtnSecondary,
  Panel,
  ProTable,
  Th,
  PageLoader,
  EmptyState,
  Td,
  FetchError,
} from "@/components/ui/dashboard-ui";
import { FilterBar } from "@/components/ui/filter-bar";
import { ExcelImportToolbar } from "@/components/ui/excel-import-toolbar";
import { LeadCard, type LeadCardData } from "@/components/leads/lead-card";
import { LeadKanban } from "@/components/leads/lead-kanban";
import { LeadNoteModal, type LeadNoteTarget } from "@/components/leads/lead-note-modal";

type Lead = LeadCardData;

type AssignableUser = { userId: string; name: string; email: string; role: string };

type SavedView = { id: string; name: string; filters: Filters; isShared: boolean };

type Filters = {
  q: string;
  status: string;
  source: string;
  priority: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  ownerId: string;
  view: string;
  sortBy: string;
  sortDir: string;
  unassigned: boolean;
  mine: boolean;
  followUp: string;
};

const emptyFilters: Filters = {
  q: "", status: "", source: "", priority: "", city: "", dateFrom: "", dateTo: "", ownerId: "",
  view: "active", sortBy: "createdAt", sortDir: "desc",
  unassigned: false, mine: false, followUp: "",
};

function filtersFromSearch(sp: { get: (key: string) => string | null }): Filters {
  const unassigned = sp.get("unassigned") === "1" || sp.get("unassigned") === "true";
  const mine = sp.get("mine") === "1" || sp.get("mine") === "true";
  return {
    ...emptyFilters,
    status: sp.get("status") || "",
    source: sp.get("source") || "",
    priority: sp.get("priority") || "",
    unassigned,
    mine,
    followUp: sp.get("followUp") || "",
  };
}

const SMART_VIEWS = [
  { id: "all", label: "All Leads" },
  { id: "mine", label: "My Leads" },
  { id: "new", label: "New Leads" },
  { id: "hot", label: "Hot Leads" },
  { id: "today", label: "Follow-ups Today" },
  { id: "overdue", label: "Overdue Follow-ups" },
  { id: "unassigned", label: "Unassigned" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;

function buildQuery(f: Filters, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.status) params.set("status", f.status);
  if (f.source) params.set("source", f.source);
  if (f.priority) params.set("priority", f.priority);
  if (f.city.trim()) params.set("city", f.city.trim());
  if (f.dateFrom) params.set("dateFrom", f.dateFrom);
  if (f.dateTo) params.set("dateTo", f.dateTo);
  if (f.ownerId) params.set("ownerId", f.ownerId);
  if (f.view && f.view !== "active") params.set("view", f.view);
  if (f.sortBy && f.sortBy !== "createdAt") params.set("sortBy", f.sortBy);
  if (f.sortDir && f.sortDir !== "desc") params.set("sortDir", f.sortDir);
  if (f.unassigned) params.set("unassigned", "1");
  if (f.mine) params.set("mine", "1");
  if (f.followUp) params.set("followUp", f.followUp);
  if (pageSize) {
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LeadsPageContent />
    </Suspense>
  );
}

function LeadsPageContent() {
  const searchParams = useSearchParams();
  const auth = useAuth();
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assignable, setAssignable] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearch(searchParams));
  const [debouncedQ, setDebouncedQ] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table" | "kanban">("table");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState("");
  const [smartView, setSmartView] = useState(() => {
    const f = filtersFromSearch(searchParams);
    if (f.mine) return "mine";
    if (f.unassigned) return "unassigned";
    if (f.followUp === "overdue") return "overdue";
    if (f.followUp === "today") return "today";
    if (f.status === "new") return "new";
    if (f.status === "won") return "won";
    if (f.status === "lost") return "lost";
    if (f.priority === "high") return "hot";
    return "";
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = viewMode === "kanban" ? 200 : 50;
  const loadSeq = useRef(0);

  const canImport = auth.hasPermission("import");
  const canExport = auth.hasPermission("export");
  const canAssign = auth.hasPermission("assign");
  const canDelete = auth.hasPermission("delete");
  const canAdd = auth.hasPermission("add");
  const canEdit = auth.hasPermission("edit");
  const [noteLead, setNoteLead] = useState<LeadNoteTarget | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    apiFetch<SavedView[]>("/api/saved-views?entityType=lead").then(setSavedViews).catch(() => {});
  }, []);

  useEffect(() => {
    const status = searchParams.get("status") || "";
    const source = searchParams.get("source") || "";
    const priority = searchParams.get("priority") || "";
    const unassigned = searchParams.get("unassigned") === "1" || searchParams.get("unassigned") === "true";
    const mine = searchParams.get("mine") === "1" || searchParams.get("mine") === "true";
    const followUp = searchParams.get("followUp") || "";
    if (!status && !source && !priority && !unassigned && !mine && !followUp) return;
    setFilters((f) => ({
      ...f,
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(priority ? { priority } : {}),
      unassigned,
      mine,
      followUp,
    }));
    if (mine) setSmartView("mine");
    else if (unassigned) setSmartView("unassigned");
    else if (followUp === "overdue") setSmartView("overdue");
    else if (followUp === "today") setSmartView("today");
    else if (status === "new") setSmartView("new");
    else if (status === "won") setSmartView("won");
    else if (status === "lost") setSmartView("lost");
    else if (priority === "high") setSmartView("hot");
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  useEffect(() => {
    if (canAssign) {
      apiFetch<AssignableUser[]>("/api/users/assignable").then(setAssignable).catch(() => {});
    }
  }, [canAssign]);

  async function load(activeFilters: Filters, activePage = page) {
    const seq = ++loadSeq.current;
    const qs = buildQuery({ ...activeFilters, q: debouncedQ }, activePage, pageSize);
    try {
      setError(null);
      const next = await apiFetch<Lead[] | { items: Lead[]; total: number }>(`/api/leads${qs}`);
      if (seq !== loadSeq.current) return;
      const items = Array.isArray(next) ? next : next.items;
      const count = Array.isArray(next) ? next.length : next.total;
      setLeads(items);
      setTotal(count);
      setSelectedIds((prev) => prev.filter((id) => items.some((lead) => lead.id === id)));
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : "Could not load leads");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load(filters, page).catch(() => setLoading(false));
  }, [debouncedQ, filters.status, filters.source, filters.priority, filters.city, filters.dateFrom, filters.dateTo, filters.ownerId, filters.view, filters.sortBy, filters.sortDir, filters.unassigned, filters.mine, filters.followUp, page, viewMode]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setPage(1);
    setSmartView("");
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setActiveViewId("");
    setSmartView("");
    setPage(1);
    setFilters(emptyFilters);
  }

  function applySmartView(id: string) {
    setActiveViewId("");
    setSmartView(id);
    setPage(1);
    const next = { ...emptyFilters };
    if (id === "mine") next.mine = true;
    else if (id === "new") next.status = "new";
    else if (id === "hot") next.priority = "high";
    else if (id === "today") next.followUp = "today";
    else if (id === "overdue") next.followUp = "overdue";
    else if (id === "unassigned") next.unassigned = true;
    else if (id === "won") next.status = "won";
    else if (id === "lost") next.status = "lost";
    else if (id === "all") next.view = "all";
    setFilters(next);
  }

  async function saveCurrentView() {
    const name = prompt("Name this smart list:");
    if (!name?.trim()) return;
    const view = await apiFetch<SavedView>("/api/saved-views", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), entityType: "lead", filters, isShared: false }),
    });
    setSavedViews((prev) => [...prev, view]);
    setActiveViewId(view.id);
  }

  function applySavedView(viewId: string) {
    if (!viewId) {
      setActiveViewId("");
      return;
    }
    const view = savedViews.find((v) => v.id === viewId);
    if (!view) return;
    setActiveViewId(viewId);
    setFilters({ ...emptyFilters, ...(view.filters as Filters) });
  }

  async function handleExport() {
    window.open("/api/leads/export", "_blank");
  }

  async function handleAssign(leadId: string, ownerId: string) {
    await apiFetch(`/api/leads/${leadId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ ownerId }),
    });
    await load(filters);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead?")) return;
    await apiFetch(`/api/leads/${id}`, { method: "DELETE" });
    await load(filters);
  }

  async function handleDuplicate(id: string) {
    await apiFetch(`/api/leads/${id}/duplicate`, { method: "POST" });
    await load(filters);
  }

  function openNoteModal(lead: Lead) {
    setNoteLead({
      id: lead.id,
      leadNumber: lead.leadNumber,
      name: `${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`.trim(),
    });
  }

  async function handleArchive(id: string, restore = false) {
    await apiFetch(`/api/leads/${id}/${restore ? "unarchive" : "archive"}`, { method: "PATCH" });
    await load(filters);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelectedIds((prev) => (prev.length === leads.length ? [] : leads.map((l) => l.id)));
  }

  async function applyBulk(payload: { status?: string; priority?: string; ownerId?: string; archive?: boolean; unassign?: boolean; note?: string }) {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await apiFetch("/api/leads/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids: selectedIds, ...payload }),
      });
      toast.success(`Updated ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"}`);
      setSelectedIds([]);
      await load(filters, page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  const hasActiveFilters = !!(filters.q || filters.status || filters.source || filters.priority || filters.city || filters.dateFrom || filters.dateTo || filters.ownerId || filters.view !== "active" || filters.unassigned || filters.mine || filters.followUp);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (loading && leads.length === 0 && !error) return <PageLoader />;
  if (error && leads.length === 0) return <FetchError message={error} onRetry={() => { setLoading(true); load(filters).catch(console.error); }} />;

  return (
    <div className="max-w-[1500px]">
      <PageHeader
        title="Leads"
        description={
          auth.role === "employee"
            ? "Your assigned leads and follow-ups"
            : auth.role === "manager"
              ? "Leads for you and your team"
              : "Track every prospect from first contact to closed deal"
        }
        action={
          <>
            {canExport && (
              <BtnSecondary onClick={handleExport} className="!inline-flex">
                <Download className="h-4 w-4" /> Export
              </BtnSecondary>
            )}
            <ExcelImportToolbar
              apiBase="/api/leads"
              entityLabel="Leads"
              canImport={canImport}
              onImported={() => load(filters)}
              assignable={canAssign ? assignable : undefined}
            />
            {canAdd && (
              <BtnPrimary href="/dashboard/leads/new">
                <Plus className="h-4 w-4" /> Add Lead
              </BtnPrimary>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bookmark className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm w-full sm:w-auto min-w-0 flex-1 sm:flex-none"
          value={activeViewId}
          onChange={(e) => applySavedView(e.target.value)}
        >
          <option value="">All leads (default)</option>
          {savedViews.map((v) => (
            <option key={v.id} value={v.id}>{v.name}{v.isShared ? " (shared)" : ""}</option>
          ))}
        </select>
        </div>
        <BtnSecondary onClick={saveCurrentView} className="!inline-flex text-sm w-full sm:w-auto justify-center">
          <BookmarkPlus className="h-4 w-4" /> Save smart list
        </BtnSecondary>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {SMART_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => applySmartView(v.id)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors",
              smartView === v.id
                ? "bg-brand text-white border-brand"
                : "bg-white text-slate-600 border-slate-200 hover:border-brand/40"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <FilterBar
        className="mb-4"
        showClear={hasActiveFilters}
        onClear={clearFilters}
        fields={[
          {
            type: "search",
            key: "q",
            label: "Search",
            placeholder: "Name, company, phone, email, ID, notes...",
            value: filters.q,
            onChange: (v) => setFilter("q", v),
            className: "flex-1 min-w-0 w-full sm:min-w-[240px]",
          },
          {
            type: "select",
            key: "status",
            label: "Status",
            placeholder: "All statuses",
            value: filters.status,
            onChange: (v) => setFilter("status", v),
            options: LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
          },
          {
            type: "select",
            key: "source",
            label: "Source",
            placeholder: "All sources",
            value: filters.source,
            onChange: (v) => setFilter("source", v),
            options: LEAD_SOURCES.map((s) => ({ value: s, label: s })),
          },
          {
            type: "select",
            key: "priority",
            label: "Priority",
            placeholder: "All priorities",
            value: filters.priority,
            onChange: (v) => setFilter("priority", v),
            options: LEAD_PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })),
          },
          {
            type: "search",
            key: "city",
            label: "City",
            placeholder: "Filter by city",
            value: filters.city,
            onChange: (v) => setFilter("city", v),
          },
          ...(canAssign && assignable.length > 0
            ? [{
                type: "select" as const,
                key: "ownerId",
                label: "Assigned to",
                placeholder: "All assignees",
                value: filters.ownerId,
                onChange: (v: string) => setFilter("ownerId", v),
                options: assignable.map((u) => ({ value: u.userId, label: u.name })),
              }]
            : []),
          {
            type: "date",
            key: "dateFrom",
            label: "From date",
            value: filters.dateFrom,
            onChange: (v) => setFilter("dateFrom", v),
          },
          {
            type: "select",
            key: "view",
            label: "View",
            placeholder: "Active leads",
            value: filters.view,
            onChange: (v) => setFilter("view", v),
            options: [
              { value: "active", label: "Active leads" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" },
            ],
          },
          {
            type: "select",
            key: "sortBy",
            label: "Sort by",
            placeholder: "Date created",
            value: filters.sortBy,
            onChange: (v) => setFilter("sortBy", v),
            options: [
              { value: "createdAt", label: "Date created" },
              { value: "updatedAt", label: "Last updated" },
              { value: "firstName", label: "Name" },
              { value: "status", label: "Status" },
              { value: "priority", label: "Priority" },
              { value: "score", label: "Score" },
              { value: "city", label: "City" },
            ],
          },
          {
            type: "select",
            key: "sortDir",
            label: "Order",
            value: filters.sortDir,
            onChange: (v) => setFilter("sortDir", v),
            options: [
              { value: "desc", label: "Newest first" },
              { value: "asc", label: "Oldest first" },
            ],
          },
          {
            type: "date",
            key: "dateTo",
            label: "To date",
            value: filters.dateTo,
            onChange: (v) => setFilter("dateTo", v),
          },
        ]}
      />

      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">{total} lead{total !== 1 ? "s" : ""}{viewMode !== "kanban" && pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}</p>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => { setViewMode("table"); setPage(1); }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "table" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <List className="h-3.5 w-3.5" /> Table
          </button>
          <button
            type="button"
            onClick={() => { setViewMode("cards"); setPage(1); }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "cards" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            type="button"
            onClick={() => { setViewMode("kanban"); setPage(1); }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "kanban" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Kanban className="h-3.5 w-3.5" /> Pipeline
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-light bg-brand-muted px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-800 mr-1">{selectedIds.length} selected</p>
          {canEdit && (
            <select
              className="pro-input text-xs py-1.5 w-auto"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(e) => {
                if (e.target.value) applyBulk({ status: e.target.value }).catch(console.error);
                e.target.value = "";
              }}
            >
              <option value="">Set status…</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
              ))}
            </select>
          )}
          {canAssign && assignable.length > 0 && (
            <select
              className="pro-input text-xs py-1.5 w-auto"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(e) => {
                if (e.target.value === "__unassign") applyBulk({ unassign: true }).catch(console.error);
                else if (e.target.value) applyBulk({ ownerId: e.target.value }).catch(console.error);
                e.target.value = "";
              }}
            >
              <option value="">Assign to…</option>
              {assignable.map((u) => (
                <option key={u.userId} value={u.userId}>{u.name}</option>
              ))}
              <option value="__unassign">Unassign</option>
            </select>
          )}
          {canEdit && (
            <select
              className="pro-input text-xs py-1.5 w-auto"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(e) => {
                if (e.target.value) applyBulk({ priority: e.target.value }).catch(console.error);
                e.target.value = "";
              }}
            >
              <option value="">Set priority…</option>
              {LEAD_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          )}
          {canEdit && (
            <BtnSecondary
              disabled={bulkBusy}
              onClick={() => {
                const note = prompt("Add a note to selected leads:");
                if (note?.trim()) applyBulk({ note: note.trim() }).catch(console.error);
              }}
              className="!inline-flex text-xs"
            >
              Add note
            </BtnSecondary>
          )}
          {canDelete && (
            <BtnSecondary
              disabled={bulkBusy}
              onClick={() => {
                if (!confirm(`Delete ${selectedIds.length} selected leads?`)) return;
                Promise.all(selectedIds.map((id) => apiFetch(`/api/leads/${id}`, { method: "DELETE" })))
                  .then(() => { setSelectedIds([]); return load(filters, page); })
                  .catch(console.error);
              }}
              className="!inline-flex text-xs text-red-700"
            >
              Delete
            </BtnSecondary>
          )}
          {canEdit && (
            <BtnSecondary
              disabled={bulkBusy}
              onClick={() => applyBulk({ archive: filters.view !== "archived" }).catch(console.error)}
              className="!inline-flex text-xs"
            >
              {filters.view === "archived" ? "Restore" : "Archive"}
            </BtnSecondary>
          )}
          <button type="button" onClick={() => setSelectedIds([])} className="text-xs text-slate-500 hover:text-slate-800 ml-auto">
            Clear
          </button>
        </div>
      )}

      {leads.length === 0 ? (
        <Panel title="Leads" noPadding>
          <EmptyState
            title={hasActiveFilters ? "No leads match your filters" : "No leads yet"}
            description={
              hasActiveFilters
                ? "Try clearing filters or broadening your search."
                : "Add a lead manually or import from Excel/CSV to get started."
            }
            action={
              hasActiveFilters ? (
                <BtnSecondary onClick={clearFilters}>Clear filters</BtnSecondary>
              ) : canAdd ? (
                <BtnPrimary href="/dashboard/leads/new">
                  <Plus className="h-4 w-4" /> Add your first lead
                </BtnPrimary>
              ) : undefined
            }
          />
        </Panel>
      ) : viewMode === "kanban" ? (
        <LeadKanban leads={leads} canEdit={canEdit} onMoved={() => load(filters, page)} />
      ) : viewMode === "cards" ? (
        <div className="space-y-4">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              canAssign={canAssign}
              canEdit={canEdit}
              assignable={assignable.map((u) => ({ userId: u.userId, name: u.name }))}
              onAssign={handleAssign}
              onAddNote={canEdit ? () => openNoteModal(lead) : undefined}
            />
          ))}
        </div>
      ) : (
      <Panel title={`${leads.length} leads`} noPadding>
          <ProTable>
            <thead>
              <tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && selectedIds.length === leads.length}
                    onChange={toggleAll}
                    aria-label="Select all leads"
                  />
                </Th>
                <Th>Lead ID</Th>
                <Th>Customer</Th>
                <Th>Company</Th>
                <Th>Mobile</Th>
                <Th>Assigned To</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th className="text-right">Score</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className={cn("hover:bg-slate-50 group", selectedIds.includes(lead.id) && "bg-brand-muted/40")}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => toggleSelected(lead.id)}
                      aria-label={`Select ${lead.leadNumber}`}
                    />
                  </Td>
                  <Td>
                    <TenantLink href={`/dashboard/leads/${lead.id}`} className="font-mono text-xs font-medium text-slate-900 hover:underline">
                      {lead.leadNumber}
                    </TenantLink>
                  </Td>
                  <Td>
                    <TenantLink href={`/dashboard/leads/${lead.id}`} className="font-medium text-slate-900 hover:underline">
                      {lead.firstName} {lead.lastName}
                    </TenantLink>
                  </Td>
                  <Td className="max-w-[140px] truncate">{lead.company || "—"}</Td>
                  <Td className="max-w-[120px] truncate">{lead.phone || "—"}</Td>
                  <Td className="max-w-[130px]">
                    {canAssign && assignable.length > 0 ? (
                      <select
                        className="pro-input text-xs py-1 px-1.5 w-full max-w-[130px]"
                        value={lead.owner?.id || ""}
                        title={lead.owner?.name || "Unassigned"}
                        onChange={(e) => e.target.value && handleAssign(lead.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {assignable.map((u) => (
                          <option key={u.userId} value={u.userId}>{u.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-600">{lead.owner?.name || "—"}</span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{lead.source || "—"}</span>
                  </Td>
                  <Td>
                    {canEdit ? (
                      <select
                        className="pro-input text-xs py-1 px-1.5 w-full max-w-[140px]"
                        value={lead.status}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          apiFetch(`/api/leads/${lead.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ status: e.target.value }),
                          }).then(() => load(filters, page)).catch(console.error);
                        }}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn("inline-flex px-2 py-0.5 rounded text-[11px] font-medium", STATUS_BADGE[lead.status] || STATUS_BADGE.new)}>
                        {LEAD_STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right font-semibold">{lead.score}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-0.5">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openNoteModal(lead)}
                          className="p-1.5 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-700"
                          title="Add note"
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <TenantLink href={`/dashboard/leads/${lead.id}/edit`} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </TenantLink>
                      {canAdd && (
                        <button type="button" onClick={() => handleDuplicate(lead.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Duplicate">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {auth.hasPermission("edit") && (
                        <button
                          type="button"
                          onClick={() => handleArchive(lead.id, filters.view === "archived")}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                          title={filters.view === "archived" ? "Restore" : "Archive"}
                        >
                          {filters.view === "archived" ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => handleDelete(lead.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-700" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
      </Panel>
      )}

      {viewMode !== "kanban" && pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</p>
          <div className="flex gap-2">
            <BtnSecondary disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="!inline-flex text-xs">
              Previous
            </BtnSecondary>
            <BtnSecondary disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className="!inline-flex text-xs">
              Next
            </BtnSecondary>
          </div>
        </div>
      )}

      <LeadNoteModal
        lead={noteLead}
        open={!!noteLead}
        onClose={() => setNoteLead(null)}
        onSaved={() => load(filters)}
      />
    </div>
  );
}
