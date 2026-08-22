"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarItem = {
  id: string;
  title: string;
  type: string;
  startAt: string;
  endAt?: string | null;
  source?: string;
  completed?: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_DOT: Record<string, string> = {
  meeting: "bg-indigo-500",
  call: "bg-blue-500",
  followup: "bg-cyan-500",
  task: "bg-amber-500",
  event: "bg-violet-500",
};

const TYPE_CHIP: Record<string, string> = {
  meeting: "bg-indigo-50 text-indigo-800 border-indigo-100",
  call: "bg-blue-50 text-blue-800 border-blue-100",
  followup: "bg-cyan-50 text-cyan-800 border-cyan-100",
  task: "bg-amber-50 text-amber-900 border-amber-100",
  event: "bg-violet-50 text-violet-800 border-violet-100",
};

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function monthRange(cursor: Date): { from: string; to: string } {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function buildMonthGrid(cursor: Date): Array<{ date: Date; inMonth: boolean; key: string }> {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];

  for (let i = startPad; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    cells.push({ date: d, inMonth: false, key: dateKey(d) });
  }
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(year, month, day);
    cells.push({ date: d, inMonth: true, key: dateKey(d) });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const nextDay = cells.length - startPad - last.getDate() + 1;
    const d = new Date(year, month + 1, nextDay);
    cells.push({ date: d, inMonth: false, key: dateKey(d) });
  }
  return cells.slice(0, 42);
}

export function groupEventsByDate(events: CalendarItem[]): Record<string, CalendarItem[]> {
  const map: Record<string, CalendarItem[]> = {};
  for (const e of events) {
    const key = dateKey(new Date(e.startAt));
    if (!map[key]) map[key] = [];
    map[key].push(e);
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }
  return map;
}

type CalendarMonthGridProps = {
  cursorMonth: Date;
  selectedDate: string;
  eventsByDate: Record<string, CalendarItem[]>;
  onSelectDate: (key: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export function CalendarMonthGrid({
  cursorMonth,
  selectedDate,
  eventsByDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarMonthGridProps) {
  const cells = buildMonthGrid(cursorMonth);
  const todayKey = dateKey(new Date());

  return (
    <div className="cal-month">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-indigo-50/30">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevMonth} className="cal-nav-btn" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onNextMonth} className="cal-nav-btn" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="text-base font-bold text-slate-900 min-w-[160px]">{monthLabel(cursorMonth)}</h2>
        </div>
        <button type="button" onClick={onToday} className="cal-today-btn">
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 cal-month-grid">
        {cells.map((cell) => {
          const dayEvents = eventsByDate[cell.key] || [];
          const isSelected = cell.key === selectedDate;
          const isToday = cell.key === todayKey;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDate(cell.key)}
              className={cn(
                "cal-day-cell text-left min-h-[72px] sm:min-h-[88px] lg:min-h-[100px] p-1.5 sm:p-2 border-b border-r border-slate-100 transition-colors",
                !cell.inMonth && "cal-day-cell--muted",
                isSelected && "cal-day-cell--selected",
                isToday && !isSelected && "cal-day-cell--today"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mb-1",
                  isToday && "bg-indigo-600 text-white",
                  !isToday && cell.inMonth && "text-slate-800",
                  !cell.inMonth && "text-slate-400"
                )}
              >
                {cell.date.getDate()}
              </span>
              <div className="space-y-0.5 hidden sm:block">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={`${ev.source || "e"}-${ev.id}`}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[10px] font-medium border",
                      TYPE_CHIP[ev.type] || TYPE_CHIP.event,
                      ev.completed && "opacity-50 line-through"
                    )}
                    title={ev.title}
                  >
                    {new Date(ev.startAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}{" "}
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] font-semibold text-indigo-600 px-1">+{dayEvents.length - 3} more</p>
                )}
              </div>
              <div className="flex flex-wrap gap-0.5 sm:hidden mt-0.5">
                {dayEvents.slice(0, 4).map((ev) => (
                  <span
                    key={`${ev.source || "e"}-${ev.id}-dot`}
                    className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[ev.type] || TYPE_DOT.event)}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarDayAgenda({
  dateKey: key,
  events,
  typeBadge,
  showHeader = true,
}: {
  dateKey: string;
  events: CalendarItem[];
  typeBadge: Record<string, string>;
  showHeader?: boolean;
}) {
  const label = parseDateKey(key).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (events.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        {showHeader && <p className="font-medium text-slate-700">{label}</p>}
        <p className={showHeader ? "mt-2" : ""}>No events scheduled</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {showHeader && (
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{events.length} item{events.length !== 1 ? "s" : ""}</p>
        </div>
      )}
      {events.map((ev) => (
        <div key={`${ev.source || "event"}-${ev.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80">
          <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase border shrink-0", typeBadge[ev.type] || typeBadge.event)}>
            {ev.type}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-semibold text-slate-900", ev.completed && "line-through text-slate-500")}>{ev.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date(ev.startAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              {ev.endAt && ` – ${new Date(ev.endAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
          {ev.completed && (
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
              Done
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export { TYPE_CHIP as CALENDAR_TYPE_BADGE };
