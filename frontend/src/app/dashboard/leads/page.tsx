"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { Plus, Download, Copy, Trash2, Pencil, Archive, ArchiveRestore, LayoutGrid, List, Bookmark, BookmarkPlus, StickyNote } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
};

const emptyFilters: Filters = {
  q: "", status: "", source: "", priority: "", city: "", dateFrom: "", dateTo: "", ownerId: "",
  view: "active", sortBy: "createdAt", sortDir: "desc",
};

function buildQuery(f: Filters): string {
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assignable, setAssignable] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState("");

  const canImport = auth.hasPermission("import");
  const canExport = auth.hasPermission("export");
  const canAssign = auth.hasPermission("assign");
  const canDelete = auth.hasPermission("delete");
  const canAdd = auth.hasPermission("add");
  const canEdit = auth.hasPermission("edit");
  const [noteLead, setNoteLead] = useState<LeadNoteTarget | null>(null);

  useEffect(() => {
    apiFetch<SavedView[]>("/api/saved-views?entityType=lead").then(setSavedViews).catch(() => {});
  }, []);

  useEffect(() => {
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const priority = searchParams.get("priority");
    if (!status && !source && !priority) return;
    setFilters((f) => ({
      ...f,
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(priority ? { priority } : {}),
    }));
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

  async function load(activeFilters: Filters) {
    const qs = buildQuery({ ...activeFilters, q: debouncedQ });
    try {
      setError(null);
      setLeads(await apiFetch<Lead[]>(`/api/leads${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load(filters).catch(() => setLoading(false));
  }, [debouncedQ, filters.status, filters.source, filters.priority, filters.city, filters.dateFrom, filters.dateTo, filters.ownerId, filters.view, filters.sortBy, filters.sortDir]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setActiveViewId("");
    setFilters(emptyFilters);
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

  const hasActiveFilters = !!(filters.q || filters.status || filters.source || filters.priority || filters.city || filters.dateFrom || filters.dateTo || filters.ownerId || filters.view !== "active");

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

      <FilterBar
        className="mb-4"
        showClear={hasActiveFilters}
        onClear={clearFilters}
        fields={[
          {
            type: "search",
            key: "q",
            label: "Search",
            placeholder: "Name, email, phone, company...",
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
        <p className="text-sm text-slate-500">{leads.length} lead{leads.length !== 1 ? "s" : ""}</p>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "cards" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "table" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <List className="h-3.5 w-3.5" /> Table
          </button>
        </div>
      </div>

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
                <tr key={lead.id} className="hover:bg-slate-50 group">
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
                    <span className={cn("inline-flex px-2 py-0.5 rounded text-[11px] font-medium", STATUS_BADGE[lead.status] || STATUS_BADGE.new)}>
                      {LEAD_STATUS_LABELS[lead.status] || lead.status}
                    </span>
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

      <LeadNoteModal
        lead={noteLead}
        open={!!noteLead}
        onClose={() => setNoteLead(null)}
        onSaved={() => load(filters)}
      />
    </div>
  );
}
