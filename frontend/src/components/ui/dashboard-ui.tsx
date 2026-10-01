"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox, ChevronRight } from "lucide-react";
import { TenantLink } from "@/components/ui/tenant-link";

/* ── Enterprise dashboard components — flat, data-first, no gradients ── */

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-slate-500 mb-2 flex-wrap">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-brand transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-700 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function HelpTip({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500 mt-1 leading-relaxed">{children}</p>;
}

export function PageHeader({
  title,
  description,
  action,
  meta,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  meta?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        {meta && <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em] mb-1">{meta}</p>}
        <h1 className="text-[1.5rem] font-semibold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  noPadding,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={cn("dash-panel rounded-[10px] border border-slate-200/90 bg-white overflow-hidden", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={noPadding ? undefined : "p-4"}>{children}</div>
    </div>
  );
}

export function MetricStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="pro-metric-strip grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
      {children}
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: "up" | "down" | "warn" | "primary";
}) {
  return (
    <div className="px-4 py-3 min-w-0">
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
      <p className={cn(
        "text-lg font-semibold tabular-nums text-slate-900 mt-0.5",
        highlight === "primary" && "text-brand",
        highlight === "up" && "text-emerald-700",
        highlight === "warn" && "text-amber-700",
        highlight === "down" && "text-red-700"
      )}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{sub}</p>}
    </div>
  );
}

export function ProTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="pro-table w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-3.5 py-2.5 text-left text-[11px] font-semibold text-slate-500 tracking-wide border-b border-slate-200 bg-[#f8fafc]", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan, title }: { children: React.ReactNode; className?: string; colSpan?: number; title?: string }) {
  return (
    <td colSpan={colSpan} title={title} className={cn("px-3.5 py-3 text-slate-700 border-b border-slate-100 tabular-nums", className)}>
      {children}
    </td>
  );
}

export function BtnPrimary({ children, href, onClick, className, disabled }: {
  children: React.ReactNode; href?: string; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  const cls = cn("pro-btn-primary", disabled && "opacity-50 pointer-events-none", className);
  if (href && !disabled) {
    if (href.startsWith("/dashboard")) {
      return <TenantLink href={href} className={cls}>{children}</TenantLink>;
    }
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

export function BtnSecondary({ children, onClick, className, disabled }: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("pro-btn-secondary", disabled && "opacity-50 cursor-not-allowed", className)}>{children}</button>
  );
}

export function StatusDot({ status }: { status: "connected" | "disconnected" | "warn" }) {
  return (
    <span className={cn(
      "inline-block h-2 w-2 rounded-full shrink-0",
      status === "connected" && "bg-emerald-600",
      status === "disconnected" && "bg-slate-300",
      status === "warn" && "bg-amber-500"
    )} />
  );
}

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
      <div className="h-7 w-7 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      <p className="text-sm text-slate-500">Loading data...</p>
    </div>
  );
}

export function FetchError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-slate-900">Could not load data</p>
      <p className="text-sm text-slate-500 max-w-md">{message || "Something went wrong. Please try again."}</p>
      {onRetry && <BtnSecondary onClick={onRetry}>Try again</BtnSecondary>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-11 w-11 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* Legacy aliases */
export const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("pro-panel", className)}>{children}</div>
);
export const DataTable = ({ children }: { children: React.ReactNode }) => (
  <div className="pro-panel overflow-hidden">{children}</div>
);
export const TableShell = ProTable;
export function KpiCard() { return null; }
export function GlassCardHeader() { return null; }
export function GlassCardBody() { return null; }
