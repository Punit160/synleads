"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, List, Plus } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  Panel,
  BtnPrimary,
  BtnSecondary,
  PageLoader,
  EmptyState,
} from "@/components/ui/dashboard-ui";
import {
  CalendarMonthGrid,
  CalendarDayAgenda,
  CALENDAR_TYPE_BADGE,
  dateKey,
  groupEventsByDate,
  monthRange,
  type CalendarItem,
} from "@/components/calendar/calendar-month-grid";

type CalendarEvent = CalendarItem & {
  endAt: string | null;
  location: string | null;
  description: string | null;
  owner?: { name: string } | null;
};

const EVENT_TYPES = [
  { id: "", label: "All Types" },
  { id: "meeting", label: "Meeting" },
  { id: "call", label: "Call" },
  { id: "followup", label: "Follow-up" },
  { id: "task", label: "Task" },
  { id: "event", label: "Event" },
];

type ViewMode = "month" | "list";

export default function CalendarPage() {
  const auth = useAuth();
  const canAdd = auth.hasPermission("add");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [view, setView] = useState<ViewMode>("month");
  const [cursorMonth, setCursorMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("meeting");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      const { from, to } = monthRange(cursorMonth);
      params.set("from", from);
      params.set("to", to);
      setEvents(await apiFetch<CalendarEvent[]>(`/api/calendar?${params}`));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [type, cursorMonth]);

  useEffect(() => {
    setLoading(true);
    load().catch(console.error);
  }, [load]);

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const selectedEvents = eventsByDate[selectedDate] || [];
  const sortedDates = useMemo(
    () => Object.keys(eventsByDate).sort(),
    [eventsByDate]
  );

  function goPrevMonth() {
    setCursorMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setCursorMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function goToday() {
    const now = new Date();
    setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(dateKey(now));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startAt) return;
    setSaving(true);
    try {
      await apiFetch("/api/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          type: eventType,
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : null,
          location: location || undefined,
          description: description || undefined,
        }),
      });
      setTitle("");
      setStartAt("");
      setEndAt("");
      setLocation("");
      setDescription("");
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading && events.length === 0) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Schedule"
        title="Calendar"
        description="Meetings, calls, follow-ups, and tasks in one view"
        action={
          canAdd ? (
            <BtnPrimary onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4" /> Add Event
            </BtnPrimary>
          ) : undefined
        }
      />

      {canAdd && showForm && (
        <Panel title="New Event" className="mb-4">
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Title</label>
              <input className="pro-input w-full text-sm" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Type</label>
              <select className="pro-input w-full text-sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {EVENT_TYPES.filter((t) => t.id).map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Start</label>
              <input type="datetime-local" className="pro-input w-full text-sm" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">End</label>
              <input type="datetime-local" className="pro-input w-full text-sm" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Location</label>
              <input className="pro-input w-full text-sm" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Description</label>
              <input className="pro-input w-full text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="pro-btn-primary" disabled={saving}>{saving ? "Saving..." : "Create Event"}</button>
              <BtnSecondary onClick={() => setShowForm(false)}>Cancel</BtnSecondary>
            </div>
          </form>
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="cal-view-toggle">
          <button
            type="button"
            className={cn("cal-view-btn", view === "month" && "cal-view-btn--active")}
            onClick={() => setView("month")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Month
          </button>
          <button
            type="button"
            className={cn("cal-view-btn", view === "list" && "cal-view-btn--active")}
            onClick={() => setView("list")}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
        <select className="pro-input text-sm py-1.5 px-2" value={type} onChange={(e) => setType(e.target.value)}>
          {EVENT_TYPES.map((t) => (
            <option key={t.id || "all"} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {view === "month" ? (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="dash-panel rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
            <CalendarMonthGrid
              cursorMonth={cursorMonth}
              selectedDate={selectedDate}
              eventsByDate={eventsByDate}
              onSelectDate={setSelectedDate}
              onPrevMonth={goPrevMonth}
              onNextMonth={goNextMonth}
              onToday={goToday}
            />
          </div>

          <Panel title="Day schedule" className="p-0 overflow-hidden lg:sticky lg:top-4 lg:self-start" noPadding>
            <CalendarDayAgenda
              dateKey={selectedDate}
              events={selectedEvents}
              typeBadge={CALENDAR_TYPE_BADGE}
            />
          </Panel>
        </div>
      ) : (
        <Panel title={`${events.length} events`}>
          {sortedDates.length === 0 ? (
            <EmptyState title="No events this month" description="Add an event or adjust the type filter" />
          ) : (
            <div className="space-y-6">
              {sortedDates.map((date) => (
                <div key={date}>
                  <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 pb-1 border-b border-slate-200">
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-2">
                    {eventsByDate[date].map((ev) => (
                      <div key={`${ev.source || "event"}-${ev.id}`} className="flex items-start gap-3 p-3 rounded border border-slate-200 bg-white hover:bg-slate-50">
                        <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase border shrink-0", CALENDAR_TYPE_BADGE[ev.type] || CALENDAR_TYPE_BADGE.event)}>
                          {ev.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium text-sm text-slate-900", ev.completed && "line-through text-slate-500")}>{ev.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(ev.startAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            {ev.endAt && ` – ${new Date(ev.endAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                            {(ev as CalendarEvent).location && ` · ${(ev as CalendarEvent).location}`}
                            {(ev as CalendarEvent).owner?.name && ` · ${(ev as CalendarEvent).owner?.name}`}
                          </p>
                          {(ev as CalendarEvent).description && (
                            <p className="text-xs text-slate-400 mt-1 truncate">{(ev as CalendarEvent).description}</p>
                          )}
                        </div>
                        {ev.completed && (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Done</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {view === "month" && (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
          {Object.entries(CALENDAR_TYPE_BADGE).map(([t, cls]) => (
            <span key={t} className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded border", cls)}>
              <span className="capitalize">{t}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
