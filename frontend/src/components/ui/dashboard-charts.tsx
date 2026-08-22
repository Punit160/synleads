"use client";

import { TenantLink } from "@/components/ui/tenant-link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function ClickableShell({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return <div className={className}>{children}</div>;
  }
  return (
    <TenantLink
      href={href}
      className={cn(
        "block rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
        className
      )}
    >
      {children}
    </TenantLink>
  );
}

/* ── KPI hero cards ── */
const KPI_THEMES = {
  blue: { bg: "bg-indigo-50", border: "border-indigo-100", icon: "bg-indigo-600 text-white", value: "text-indigo-700", ring: "stroke-indigo-600" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-100", icon: "bg-emerald-600 text-white", value: "text-emerald-700", ring: "stroke-emerald-600" },
  violet: { bg: "bg-violet-50", border: "border-violet-100", icon: "bg-violet-600 text-white", value: "text-violet-700", ring: "stroke-violet-600" },
  amber: { bg: "bg-amber-50", border: "border-amber-100", icon: "bg-amber-500 text-white", value: "text-amber-700", ring: "stroke-amber-500" },
  rose: { bg: "bg-rose-50", border: "border-rose-100", icon: "bg-rose-500 text-white", value: "text-rose-700", ring: "stroke-rose-600" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-100", icon: "bg-cyan-600 text-white", value: "text-cyan-700", ring: "stroke-cyan-600" },
  teal: { bg: "bg-teal-50", border: "border-teal-100", icon: "bg-teal-600 text-white", value: "text-teal-700", ring: "stroke-teal-600" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", icon: "bg-indigo-600 text-white", value: "text-indigo-700", ring: "stroke-indigo-600" },
  slate: { bg: "bg-slate-50", border: "border-slate-200", icon: "bg-slate-700 text-white", value: "text-slate-800", ring: "stroke-slate-600" },
} as const;

export type KpiTheme = keyof typeof KPI_THEMES;

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  theme = "blue",
  progress,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  theme?: KpiTheme;
  progress?: number;
  href?: string;
}) {
  const t = KPI_THEMES[theme];
  return (
    <ClickableShell href={href} className={cn("rounded-xl border p-4", t.bg, t.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={cn("text-2xl font-bold tabular-nums mt-1 tracking-tight", t.value)}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", t.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-white/80 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", t.icon.split(" ")[0])}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </ClickableShell>
  );
}

/* ── Horizontal bar rows ── */
const BAR_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-sky-500",
];

export function BarRow({
  label,
  value,
  pct,
  colorIndex = 0,
  suffix,
  href,
}: {
  label: string;
  value: string | number;
  pct: number;
  colorIndex?: number;
  suffix?: string;
  href?: string;
}) {
  const barColor = BAR_COLORS[colorIndex % BAR_COLORS.length];
  const row = (
    <div className={cn("group", href && "cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-slate-50/80")}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-700">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-slate-900 shrink-0">
          {value}{suffix && <span className="text-slate-400 font-normal ml-1">{suffix}</span>}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out group-hover:opacity-90", barColor)}
          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{pct.toFixed(1)}% of total</p>
    </div>
  );
  if (href) return <TenantLink href={href}>{row}</TenantLink>;
  return row;
}

export function BarChartList({
  items,
  className,
}: {
  items: Array<{ label: string; value: number; pct: number; href?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 p-4", className)}>
      {items.map((item, i) => (
        <BarRow key={item.label} label={item.label} value={item.value} pct={item.pct} colorIndex={i} href={item.href} />
      ))}
    </div>
  );
}

/* ── Stacked distribution bar ── */
export function StackedBar({
  segments,
  className,
}: {
  segments: Array<{ label: string; pct: number; color: string; href?: string }>;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 shadow-inner">
        {segments.filter((s) => s.pct > 0).map((s) => (
          <div
            key={s.label}
            className={cn("h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full", s.color)}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${s.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
        {segments.map((s) => {
          const chip = (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={cn("h-2.5 w-2.5 rounded-sm shrink-0", s.color)} />
              <span>{s.label}</span>
              <span className="font-semibold text-slate-800 tabular-nums">{s.pct.toFixed(0)}%</span>
            </div>
          );
          if (s.href) {
            return (
              <TenantLink key={s.label} href={s.href} className="rounded-md px-1 py-0.5 hover:bg-slate-100 transition-colors">
                {chip}
              </TenantLink>
            );
          }
          return <div key={s.label}>{chip}</div>;
        })}
      </div>
    </div>
  );
}

/* ── Pipeline funnel bars ── */
export function PipelineBars({
  stages,
  totalValue,
  href = "/dashboard/pipeline",
}: {
  stages: Array<{ id?: string; name: string; dealCount: number; totalValue: number; probability?: number }>;
  totalValue: number;
  href?: string;
}) {
  const maxVal = Math.max(...stages.map((s) => s.totalValue), 1);
  return (
    <div className="p-4 space-y-3">
      {stages.map((stage, i) => {
        const widthPct = (stage.totalValue / maxVal) * 100;
        const sharePct = totalValue > 0 ? (stage.totalValue / totalValue) * 100 : 0;
        const row = (
          <div className="flex items-center gap-3 group cursor-pointer rounded-lg px-1 py-1 -mx-1 hover:bg-slate-50/80">
            <div className="w-24 shrink-0">
              <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700">{stage.name}</p>
              <p className="text-[10px] text-slate-400">{stage.dealCount} deals</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-8 rounded-lg bg-slate-100 overflow-hidden relative">
                <div
                  className={cn(
                    "h-full rounded-lg flex items-center px-2 transition-all duration-700",
                    BAR_COLORS[i % BAR_COLORS.length],
                    "opacity-90 group-hover:opacity-100"
                  )}
                  style={{ width: `${Math.max(widthPct, 8)}%` }}
                >
                  <span className="text-[10px] font-bold text-white truncate drop-shadow-sm">
                    {sharePct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="w-20 text-right shrink-0">
              <p className="text-sm font-bold text-slate-900 tabular-nums">
                {stage.totalValue >= 100000
                  ? `₹${(stage.totalValue / 100000).toFixed(1)}L`
                  : `₹${(stage.totalValue / 1000).toFixed(0)}K`}
              </p>
              {stage.probability !== undefined && (
                <p className="text-[10px] text-slate-400">{stage.probability}% prob</p>
              )}
            </div>
          </div>
        );
        return href ? <TenantLink key={stage.name} href={href}>{row}</TenantLink> : <div key={stage.name}>{row}</div>;
      })}
    </div>
  );
}

/* ── Ring stat ── */
export function RingStat({
  label,
  value,
  pct,
  theme = "blue",
  size = 88,
  href,
}: {
  label: string;
  value: string | number;
  pct: number;
  theme?: KpiTheme;
  size?: number;
  href?: string;
}) {
  const t = KPI_THEMES[theme];
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  const content = (
    <div className="flex flex-col items-center text-center p-3 rounded-xl hover:bg-slate-50/80 transition-colors">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className={t.ring}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-lg font-bold tabular-nums leading-none", t.value)}>{value}</span>
          <span className="text-[9px] text-slate-400 mt-0.5">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-600 mt-2">{label}</p>
    </div>
  );

  if (href) return <TenantLink href={href}>{content}</TenantLink>;
  return content;
}

/* ── Compact stat pill row ── */
export function StatPill({
  label,
  value,
  icon: Icon,
  color = "blue",
  href,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: KpiTheme;
  href?: string;
}) {
  const t = KPI_THEMES[color];
  return (
    <ClickableShell href={href} className={cn("rounded-lg border px-3 py-2.5", t.bg, t.border)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", t.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
          <p className={cn("text-base font-bold tabular-nums", t.value)}>{value}</p>
        </div>
      </div>
    </ClickableShell>
  );
}

/* ── Team member working row ── */
export function TeamMemberRow({
  name,
  roleLabel,
  leadCount,
  activitiesToday,
  followUpsDue,
  followUpsOverdue,
  communicationsToday,
}: {
  name: string;
  roleLabel: string;
  leadCount: number;
  activitiesToday: number;
  followUpsDue: number;
  followUpsOverdue: number;
  communicationsToday: number;
}) {
  const workingScore = activitiesToday + communicationsToday;
  const isActive = workingScore > 0 || followUpsDue > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 text-xs font-bold">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              isActive ? "bg-emerald-500" : "bg-slate-300"
            )} title={isActive ? "Active today" : "No activity yet"} />
          </div>
          <p className="text-[10px] text-slate-500 capitalize">{roleLabel}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <span className="text-slate-500">Leads <span className="font-semibold text-slate-800">{leadCount}</span></span>
            <span className="text-slate-500">Today <span className="font-semibold text-slate-800">{activitiesToday + communicationsToday}</span></span>
            <span className="text-slate-500">Due <span className="font-semibold text-amber-700">{followUpsDue}</span></span>
            <span className="text-slate-500">Overdue <span className={cn("font-semibold", followUpsOverdue > 0 ? "text-rose-600" : "text-slate-800")}>{followUpsOverdue}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Connection card ── */
export function ConnectionCard({
  name,
  category,
  connected,
  href = "/dashboard/integrations",
}: {
  name: string;
  category: string;
  connected: boolean;
  href?: string;
}) {
  const card = (
    <div className={cn(
      "rounded-lg border px-3 py-2.5 flex items-center gap-3 transition-colors hover:shadow-sm",
      connected ? "bg-emerald-50/50 border-emerald-100" : "bg-slate-50 border-slate-200"
    )}>
      <div className={cn(
        "h-2 w-2 rounded-full shrink-0",
        connected ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-slate-300"
      )} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
        <p className="text-[10px] text-slate-500">{category}</p>
      </div>
      <span className={cn(
        "text-[10px] font-semibold uppercase tracking-wide",
        connected ? "text-emerald-700" : "text-slate-400"
      )}>
        {connected ? "Live" : "Off"}
      </span>
    </div>
  );
  if (href) return <TenantLink href={href}>{card}</TenantLink>;
  return card;
}

/* ── Activity timeline row ── */
export function ActivityRow({
  title,
  meta,
  href,
  dotColor = "bg-blue-500",
}: {
  title: string;
  meta: string;
  href?: string;
  dotColor?: string;
}) {
  const content = (
    <div className="flex gap-3 py-2.5 px-4 hover:bg-slate-50/80 transition-colors">
      <div className="flex flex-col items-center pt-1.5">
        <div className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
        <div className="w-px flex-1 bg-slate-100 mt-1 min-h-[12px]" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{meta}</p>
      </div>
    </div>
  );
  if (href) return <TenantLink href={href} className="block">{content}</TenantLink>;
  return content;
}

/* ── Lead row card ── */
export function LeadRow({
  leadNumber,
  name,
  company,
  status,
  score,
  href,
  statusClass,
}: {
  leadNumber: string;
  name: string;
  company?: string | null;
  status: string;
  score: number;
  href: string;
  statusClass?: string;
}) {
  const scoreColor = score >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : score >= 60 ? "text-blue-700 bg-blue-50 border-blue-200" : "text-slate-600 bg-slate-100 border-slate-200";
  return (
    <TenantLink href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
      <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold shrink-0">
        {name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-slate-500 font-medium">{leadNumber}</span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", statusClass)}>{status}</span>
        </div>
        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">{name}</p>
        <p className="text-xs text-slate-500 truncate">{company || "No company"}</p>
      </div>
      <div className={cn("h-8 min-w-8 px-2 rounded-lg border flex items-center justify-center text-xs font-bold tabular-nums", scoreColor)}>
        {score}
      </div>
    </TenantLink>
  );
}

/* ── Deal row ── */
export function DealRow({
  id,
  name,
  stage,
  account,
  amount,
}: {
  id?: string;
  name: string;
  stage: string;
  account?: string | null;
  amount: string;
}) {
  const inner = (
    <>
      <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
        <span className="text-slate-700 text-xs font-bold">₹</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">{stage}</span>
          <span className="text-xs text-slate-500 truncate">{account || "—"}</span>
        </div>
      </div>
      <p className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{amount}</p>
    </>
  );

  if (id) {
    return (
      <TenantLink href={`/dashboard/deals/${id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
        {inner}
      </TenantLink>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
      {inner}
    </div>
  );
}

export const STATUS_CHART_COLORS: Record<string, string> = {
  new: "bg-slate-400",
  contacted: "bg-blue-500",
  qualified: "bg-indigo-500",
  proposal_sent: "bg-violet-500",
  negotiation: "bg-amber-500",
  follow_up: "bg-cyan-500",
  won: "bg-emerald-500",
  lost: "bg-rose-500",
  on_hold: "bg-orange-400",
};

export const PRIORITY_COLORS: Record<string, KpiTheme> = {
  urgent: "rose",
  high: "amber",
  medium: "blue",
  low: "slate",
};
