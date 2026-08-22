"use client";

import { TenantLink } from "@/components/ui/tenant-link";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  TrendingUp,
  IndianRupee,
  Target,
  Percent,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const KPI_ICONS: Record<string, LucideIcon> = {
  Pipeline: TrendingUp,
  "Won Revenue": IndianRupee,
  Forecast: Target,
  Conversion: Percent,
  "At Risk": AlertTriangle,
};

const KPI_ACCENTS: Record<string, string> = {
  Pipeline: "from-indigo-500 to-violet-500",
  "Won Revenue": "from-emerald-500 to-teal-500",
  Forecast: "from-blue-500 to-indigo-500",
  Conversion: "from-violet-500 to-purple-500",
  "At Risk": "from-amber-500 to-orange-500",
};

const STAGE_BAR_COLORS = [
  "from-indigo-400 to-indigo-600",
  "from-violet-400 to-violet-600",
  "from-blue-400 to-blue-600",
  "from-cyan-400 to-cyan-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
];

const AGENDA_TYPE_STYLES: Record<string, { dot: string; badge: string }> = {
  call: { dot: "bg-blue-500 ring-blue-100", badge: "bg-blue-50 text-blue-700 border-blue-100" },
  meeting: { dot: "bg-violet-500 ring-violet-100", badge: "bg-violet-50 text-violet-700 border-violet-100" },
  follow_up: { dot: "bg-cyan-500 ring-cyan-100", badge: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  followup: { dot: "bg-cyan-500 ring-cyan-100", badge: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  task: { dot: "bg-amber-500 ring-amber-100", badge: "bg-amber-50 text-amber-700 border-amber-100" },
  email: { dot: "bg-slate-400 ring-slate-100", badge: "bg-slate-50 text-slate-600 border-slate-100" },
};

/* ── KPI card with icon + accent strip ── */
export function NeutralKpiCard({
  label,
  value,
  trend,
  trendLabel,
  href,
  highlight,
}: {
  label: string;
  value: string | number;
  trend?: number | null;
  trendLabel?: string;
  href?: string;
  highlight?: "warn" | "danger" | "success";
}) {
  const Icon = KPI_ICONS[label] || TrendingUp;
  const accent = KPI_ACCENTS[label] || "from-indigo-500 to-violet-500";

  const content = (
    <div className="group relative rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm hover:shadow-lg hover:border-indigo-200/60 transition-all duration-300 h-full overflow-hidden">
      <div className={cn("absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity", accent)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums text-slate-900 mt-1.5 tracking-tight",
              highlight === "warn" && "text-amber-700",
              highlight === "danger" && "text-red-700",
              highlight === "success" && "text-emerald-700"
            )}
          >
            {value}
          </p>
          {(trend !== undefined && trend !== null) || trendLabel ? (
            <div className="flex items-center gap-1 mt-2">
              {trend !== undefined && trend !== null && (
                <>
                  {trend > 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                  ) : trend < 0 ? (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      trend > 0 ? "text-emerald-700" : trend < 0 ? "text-red-600" : "text-slate-500"
                    )}
                  >
                    {trend > 0 ? "+" : ""}
                    {trend}%
                  </span>
                </>
              )}
              {trendLabel && <span className="text-[11px] text-slate-400">{trendLabel}</span>}
            </div>
          ) : null}
        </div>
        <div className={cn("shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm", accent)}>
          <Icon className="h-4 w-4 text-white" strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <TenantLink href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl">
        {content}
      </TenantLink>
    );
  }
  return content;
}

/* ── Attention metric chip ── */
export function AttentionChip({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: "neutral" | "warn" | "danger" | "brand";
}) {
  const inner = (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-2.5 min-w-0 flex-1 sm:flex-none sm:min-w-[108px] transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
        tone === "neutral" && "border-slate-200/90 bg-white/80 backdrop-blur-sm shadow-sm",
        tone === "warn" && "border-amber-200/80 bg-gradient-to-br from-amber-50 to-white shadow-sm shadow-amber-100/50",
        tone === "danger" && "border-red-200/80 bg-gradient-to-br from-red-50 to-white shadow-sm shadow-red-100/50",
        tone === "brand" && "border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white shadow-sm shadow-indigo-100/50"
      )}
    >
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p
        className={cn(
          "text-lg font-bold tabular-nums mt-0.5",
          tone === "danger" && "text-red-700",
          tone === "warn" && "text-amber-800",
          tone === "brand" && "text-indigo-700",
          tone === "neutral" && "text-slate-900"
        )}
      >
        {value}
      </p>
    </div>
  );
  if (href) return <TenantLink href={href} className="block">{inner}</TenantLink>;
  return inner;
}

/* ── Date / filter bar ── */
export function DashboardFilterBar({
  range,
  ownerId,
  owners,
  onRangeChange,
  onOwnerChange,
}: {
  range: string;
  ownerId: string;
  owners: Array<{ id: string; name: string }>;
  onRangeChange: (r: string) => void;
  onOwnerChange: (id: string) => void;
}) {
  const ranges = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "quarter", label: "This Quarter" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 max-w-full">
      <div className="inline-flex rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-1 shadow-sm overflow-x-auto max-w-full">
        {ranges.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onRangeChange(r.key)}
            className={cn(
              "px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0",
              range === r.key
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <span className="hidden sm:inline">{r.label}</span>
            <span className="sm:hidden">{r.key === "quarter" ? "Qtr" : r.label.split(" ").pop()}</span>
          </button>
        ))}
      </div>
      <select
        value={ownerId}
        onChange={(e) => onOwnerChange(e.target.value)}
        className="text-xs font-medium border border-slate-200/90 rounded-xl px-3 py-2 bg-white/90 backdrop-blur-sm text-slate-700 shadow-sm max-w-full min-w-0 w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      >
        <option value="all">All Owners</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Pipeline hero — gradient stage bars ── */
export function PipelineHero({
  stages,
  totalValue,
  openDeals,
  weightedPipeline,
  avgDealSize,
  avgSalesCycleDays,
}: {
  stages: Array<{ name: string; dealCount: number; totalValue: number }>;
  totalValue: number;
  openDeals: number;
  weightedPipeline: number;
  avgDealSize: number;
  avgSalesCycleDays: number;
}) {
  const maxVal = Math.max(...stages.map((s) => s.totalValue), 1);
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;

  const stats = [
    { label: "Open deals", value: openDeals },
    { label: "Weighted", value: fmt(weightedPipeline) },
    { label: "Avg size", value: fmt(avgDealSize) },
    { label: "Avg cycle", value: `${avgSalesCycleDays}d` },
  ];

  return (
    <div>
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-indigo-50/30 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total pipeline</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight mt-0.5">{fmt(totalValue)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <div key={s.label} className="px-3 py-1.5 rounded-lg bg-white/80 border border-slate-200/80 text-[11px] shadow-sm">
              <span className="text-slate-500">{s.label}</span>{" "}
              <strong className="text-slate-800 font-semibold">{s.value}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="p-5 space-y-3">
        {stages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No pipeline stages configured yet.</p>
        ) : (
          stages.map((stage, i) => {
            const widthPct = (stage.totalValue / maxVal) * 100;
            const barColor = STAGE_BAR_COLORS[i % STAGE_BAR_COLORS.length];
            return (
              <TenantLink
                key={stage.name}
                href="/dashboard/pipeline"
                className="flex items-center gap-3 group rounded-lg px-2 py-1.5 -mx-2 hover:bg-indigo-50/40 transition-colors"
              >
                <div className="w-24 shrink-0">
                  <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">
                    {stage.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">{stage.dealCount} deals</p>
                </div>
                <div className="flex-1 h-7 rounded-lg bg-slate-100/80 overflow-hidden shadow-inner">
                  <div
                    className={cn("h-full rounded-lg bg-gradient-to-r shadow-sm transition-all duration-500 group-hover:brightness-110", barColor)}
                    style={{ width: `${Math.max(widthPct, stage.totalValue > 0 ? 5 : 0)}%` }}
                  />
                </div>
                <p className="w-16 text-right text-sm font-bold text-slate-900 tabular-nums shrink-0">
                  {fmt(stage.totalValue)}
                </p>
              </TenantLink>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Today's agenda — timeline style ── */
export function AgendaTimeline({
  items,
}: {
  items: Array<{
    id: string;
    time: string;
    title: string;
    subtitle: string;
    type: string;
    href: string;
  }>;
}) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-slate-100 items-center justify-center mb-3">
          <Sparkles className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500">Nothing scheduled for today.</p>
        <TenantLink href="/dashboard/activities" className="inline-block mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          Schedule activity →
        </TenantLink>
      </div>
    );
  }

  return (
    <div className="py-2">
      {items.map((item, i) => {
        const styles = AGENDA_TYPE_STYLES[item.type] || AGENDA_TYPE_STYLES.email;
        return (
          <TenantLink
            key={item.id}
            href={item.href}
            className="flex gap-3 px-5 py-3 hover:bg-slate-50/80 transition-colors relative"
          >
            <div className="flex flex-col items-center shrink-0 w-12">
              <span className="text-[11px] font-bold font-mono text-indigo-600">{item.time}</span>
              <div className={cn("mt-1.5 h-2.5 w-2.5 rounded-full ring-4 shrink-0", styles.dot)} />
              {i < items.length - 1 && (
                <div className="w-px flex-1 min-h-[12px] bg-slate-200 mt-1" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
              <span className={cn("inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize", styles.badge)}>
                {item.type.replace(/_/g, " ")}
              </span>
            </div>
          </TenantLink>
        );
      })}
    </div>
  );
}

/* ── Deal at risk row ── */
export function DealAtRiskRow({
  id,
  name,
  amount,
  stage,
  reason,
}: {
  id: string;
  name: string;
  amount: number;
  stage: string;
  reason: string;
}) {
  const fmt =
    amount >= 100000 ? `₹${(amount / 100000).toFixed(1)}L` : `₹${amount.toLocaleString("en-IN")}`;

  return (
    <TenantLink
      href={`/dashboard/deals/${id}`}
      className="flex items-start gap-3 px-5 py-3.5 hover:bg-gradient-to-r hover:from-red-50/40 hover:to-transparent border-b border-slate-50 last:border-0 transition-all group"
    >
      <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {fmt} · <span className="text-slate-600">{stage}</span>
        </p>
        <p className="text-xs text-amber-700 font-medium mt-1">{reason}</p>
      </div>
      <span className="text-xs text-indigo-600 font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
    </TenantLink>
  );
}

/* ── Revenue trend chart with area fills ── */
export function RevenueTrendChart({
  points,
}: {
  points: Array<{ month: string; pipeline: number; won: number; forecast: number }>;
}) {
  if (points.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">Not enough data for trend chart yet.</div>
    );
  }

  const w = 320;
  const h = 130;
  const pad = { t: 12, r: 8, b: 28, l: 8 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const maxY = Math.max(...points.flatMap((p) => [p.pipeline, p.won, p.forecast]), 1);

  const toX = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * innerW;
  const toY = (v: number) => pad.t + innerH - (v / maxY) * innerH;

  const line = (key: "pipeline" | "won" | "forecast") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p[key]).toFixed(1)}`).join(" ");

  const area = (key: "pipeline" | "won" | "forecast") => {
    const baseline = pad.t + innerH;
    const first = `${toX(0).toFixed(1)} ${baseline}`;
    const last = `${toX(points.length - 1).toFixed(1)} ${baseline}`;
    return `${line(key)} L ${last} L ${first} Z`;
  };

  return (
    <div className="p-5">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={pad.l}
            x2={w - pad.r}
            y1={pad.t + innerH * (1 - pct)}
            y2={pad.t + innerH * (1 - pct)}
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ))}
        <path d={area("pipeline")} fill="url(#pipeGrad)" opacity="0.5" />
        <path d={area("won")} fill="url(#wonGrad)" opacity="0.4" />
        <defs>
          <linearGradient id="pipeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={line("pipeline")} fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
        <path d={line("forecast")} fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        <path d={line("won")} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <text key={p.month} x={toX(i)} y={h - 6} textAnchor="middle" className="fill-slate-500 text-[9px] font-medium">
            {p.month}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 mt-3 text-[11px] font-medium text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-indigo-300" /> Pipeline
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-emerald-600" /> Won
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-indigo-500 opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg, #6366f1 0 4px, transparent 4px 8px)" }} /> Forecast
        </span>
      </div>
    </div>
  );
}

/* ── Lead funnel ── */
export function LeadFunnelChart({
  stages,
  overallConversion,
}: {
  stages: Array<{ stage: string; label: string; count: number; conversionPct: number | null }>;
  overallConversion: number;
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const funnelColors = [
    "from-slate-400 to-slate-500",
    "from-indigo-400 to-indigo-500",
    "from-violet-400 to-violet-500",
    "from-blue-400 to-blue-500",
    "from-emerald-400 to-emerald-500",
  ];

  return (
    <div className="p-5 space-y-2.5">
      {stages.map((s, i) => (
        <div key={s.stage}>
          <TenantLink
            href={`/dashboard/leads?status=${encodeURIComponent(s.stage)}`}
            className="flex items-center gap-3 group rounded-lg py-1.5 px-2 -mx-2 hover:bg-indigo-50/40 transition-colors"
          >
            <div className="w-20 shrink-0">
              <p className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700">{s.label}</p>
              <p className="text-base font-bold text-slate-900 tabular-nums">{s.count}</p>
            </div>
            <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-300", funnelColors[i % funnelColors.length])}
                style={{ width: `${Math.max((s.count / max) * 100, s.count > 0 ? 4 : 0)}%` }}
              />
            </div>
          </TenantLink>
          {s.conversionPct !== null && i < stages.length - 1 && (
            <p className="text-[10px] font-medium text-indigo-500 pl-[5.5rem] py-0.5">↓ {s.conversionPct}% conversion</p>
          )}
        </div>
      ))}
      <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">Overall conversion</span>
        <span className="text-sm font-bold text-indigo-700 tabular-nums">{overallConversion}%</span>
      </div>
    </div>
  );
}

/* ── Forecast panel ── */
export function ForecastPanel({
  commit,
  bestCase,
  pipeline,
  target,
  attainmentPct,
  won,
}: {
  commit: number;
  bestCase: number;
  pipeline: number;
  target: number;
  attainmentPct: number;
  won: number;
}) {
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;

  const rows = [
    { label: "Commit", value: commit },
    { label: "Best case", value: bestCase },
    { label: "Pipeline", value: pipeline },
    { label: "Won", value: won },
    { label: "Target", value: target },
  ];

  return (
    <div className="px-5 pb-5 space-y-2.5 border-t border-slate-100">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between text-sm py-0.5">
          <span className="text-slate-500 font-medium">{r.label}</span>
          <span className="font-bold text-slate-900 tabular-nums">{fmt(r.value)}</span>
        </div>
      ))}
      <div className="pt-3 border-t border-slate-100">
        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
          <span>Forecast attainment</span>
          <span className="text-indigo-700">{attainmentPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
            style={{ width: `${Math.min(100, attainmentPct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sales target progress ── */
export function TargetProgress({
  target,
  achieved,
  pct,
  remaining,
}: {
  target: number;
  achieved: number;
  pct: number;
  remaining: number;
}) {
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;

  return (
    <div className="p-5">
      <div className="flex justify-between items-end mb-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Monthly target</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight mt-0.5">{fmt(target)}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-indigo-600 tabular-nums">{pct}%</p>
          <p className="text-[10px] text-slate-400 font-medium">achieved</p>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 transition-all duration-700"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-2.5 font-medium">
        <span className="text-emerald-700 font-semibold">{fmt(achieved)}</span> won ·{" "}
        <span className="text-slate-700">{fmt(remaining)}</span> to target
      </p>
    </div>
  );
}

/* ── AI brief card ── */
export function AiBriefCard({
  items,
}: {
  items: Array<{
    dealId: string;
    dealName: string;
    amount: number;
    stage: string;
    message?: string;
    recommendation: string;
  }>;
}) {
  if (items.length === 0) return null;

  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;

  return (
    <div className="dash-ai-glow rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">AI Sales Brief</p>
          <p className="text-[11px] text-slate-500">Personalized actions for your pipeline</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.dealId} className="rounded-xl border border-white/80 bg-white/90 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-semibold text-slate-900 truncate" title={item.dealName}>
              {item.dealName}
            </p>
            <p className="text-xs text-indigo-600 font-medium mt-0.5">
              {fmt(item.amount)} · {item.stage}
            </p>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.recommendation}</p>
            <TenantLink
              href={`/dashboard/deals/${item.dealId}`}
              className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              Follow up →
            </TenantLink>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sales performance table ── */
export function SalesPerformanceTable({
  rows,
  topPerformer,
}: {
  rows: Array<{
    userId: string;
    name: string;
    role: string;
    leads: number;
    qualified: number;
    deals: number;
    won: number;
    revenue: number;
  }>;
  topPerformer?: { name: string; revenue: number } | null;
}) {
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n > 0 ? `₹${(n / 1000).toFixed(0)}K` : "₹0";

  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-slate-500">
        No team performance data for this period.
      </div>
    );
  }

  return (
    <div>
      {topPerformer && topPerformer.revenue > 0 && (
        <div className="px-5 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50/50 border-b border-amber-100/80 text-xs font-semibold text-amber-900">
          🏆 Top performer: <strong>{topPerformer.name}</strong> · {fmt(topPerformer.revenue)}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-5 py-2.5 font-bold">Salesperson</th>
              <th className="text-right px-2 py-2.5 font-bold">Leads</th>
              <th className="text-right px-2 py-2.5 font-bold">Qualified</th>
              <th className="text-right px-2 py-2.5 font-bold">Deals</th>
              <th className="text-right px-2 py-2.5 font-bold">Won</th>
              <th className="text-right px-5 py-2.5 font-bold">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.userId} className={cn("border-b border-slate-50 hover:bg-indigo-50/30 transition-colors", i === 0 && "bg-indigo-50/20")}>
                <td className="px-5 py-3 font-semibold text-slate-900">{r.name}</td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-700">{r.leads}</td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-700">{r.qualified}</td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-700">{r.deals}</td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-700">{r.won}</td>
                <td className="px-5 py-3 text-right tabular-nums font-bold text-indigo-700">{fmt(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Lead source table ── */
export function LeadSourceTable({
  rows,
  bestSource,
}: {
  rows: Array<{ source: string; leads: number; qualified: number; won: number; revenue: number }>;
  bestSource?: string | null;
}) {
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n > 0 ? `₹${(n / 1000).toFixed(0)}K` : "₹0";

  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-slate-500">
        No lead source data for this period.
      </div>
    );
  }

  return (
    <div>
      {bestSource && (
        <div className="px-5 py-2.5 border-b border-slate-100 bg-indigo-50/40 text-xs font-semibold text-slate-600">
          Best source → <strong className="text-indigo-700">{bestSource}</strong>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-5 py-2.5 font-bold">Source</th>
              <th className="text-right px-2 py-2.5 font-bold">Leads</th>
              <th className="text-right px-2 py-2.5 font-bold">Qualified</th>
              <th className="text-right px-2 py-2.5 font-bold">Won</th>
              <th className="text-right px-5 py-2.5 font-bold">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 6).map((r) => (
              <tr key={r.source} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                <td className="px-5 py-3">
                  <TenantLink
                    href={`/dashboard/leads?source=${encodeURIComponent(r.source)}`}
                    className="font-semibold text-slate-900 hover:text-indigo-700 transition-colors"
                  >
                    {r.source}
                  </TenantLink>
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{r.leads}</td>
                <td className="px-2 py-3 text-right tabular-nums">{r.qualified}</td>
                <td className="px-2 py-3 text-right tabular-nums">{r.won}</td>
                <td className="px-5 py-3 text-right tabular-nums font-bold text-slate-900">{fmt(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QuickActionBtn({
  href,
  children,
  primary,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <TenantLink
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
        primary
          ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/50 hover:brightness-105"
          : "border border-slate-200/90 bg-white/90 text-slate-700 hover:bg-white hover:border-indigo-200 hover:shadow-sm"
      )}
    >
      {children}
    </TenantLink>
  );
}

/** Section divider label for dashboard layout */
export function DashboardSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="dash-section-label shrink-0">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
    </div>
  );
}

/** Employee quick-action tile */
export function QuickActionTile({
  href,
  label,
  sub,
  icon: Icon,
  accent,
}: {
  href: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <TenantLink
      href={href}
      className="group flex items-start gap-3 bg-white px-5 py-4 hover:bg-gradient-to-br hover:from-indigo-50/80 hover:to-white transition-all duration-200 border-b border-r border-slate-100 last:border-b-0"
    >
      <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform", accent)}>
        <Icon className="h-5 w-5 text-white" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
      </div>
    </TenantLink>
  );
}
