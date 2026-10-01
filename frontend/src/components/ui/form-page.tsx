"use client";

import { ArrowLeft, LucideIcon, Lightbulb, CheckCircle2 } from "lucide-react";
import { TenantLink } from "@/components/ui/tenant-link";
import { cn } from "@/lib/utils";

export function FormPage({
  backHref,
  backLabel,
  title,
  description,
  children,
  aside,
  maxWidth = "wide",
  badge,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  maxWidth?: "narrow" | "wide" | "full";
  badge?: string;
}) {
  const widthClass =
    maxWidth === "narrow"
      ? "max-w-3xl"
      : maxWidth === "full"
        ? "max-w-[1400px]"
        : "max-w-[1200px]";

  return (
    <div className={cn("form-page-wrap mx-auto pb-8", widthClass)}>
      <TenantLink
        href={backHref}
        className="form-page-back inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </TenantLink>

      <div className="form-page-hero mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {badge && (
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-brand bg-brand-muted border border-brand-light px-2 py-0.5 rounded-md mb-2">
                {badge}
              </span>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-slate-600 mt-1.5 max-w-3xl leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      </div>

      <div className={cn("form-page-grid", aside && "form-page-grid--split")}>
        <div className="form-page-main min-w-0">{children}</div>
        {aside && <aside className="form-page-aside">{aside}</aside>}
      </div>
    </div>
  );
}

export function FormAside({
  title = "Tips",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-aside-card">
      <div className="form-aside-head">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span>{title}</span>
      </div>
      <div className="form-aside-body">{children}</div>
    </div>
  );
}

export function FormTipList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function FormAsideLinks({
  links,
}: {
  links: Array<{ href: string; label: string; sub?: string }>;
}) {
  return (
    <div className="space-y-1.5 pt-3 mt-3 border-t border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Related</p>
      {links.map((l) => (
        <TenantLink
          key={l.href}
          href={l.href}
          className="block rounded-lg px-2.5 py-2 hover:bg-brand-muted/70 transition-colors"
        >
          <span className="text-xs font-semibold text-brand">{l.label}</span>
          {l.sub && <span className="block text-[10px] text-slate-500 mt-0.5">{l.sub}</span>}
        </TenantLink>
      ))}
    </div>
  );
}

export function FormShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("form-shell", className)}>{children}</div>;
}

export function FormSection({
  title,
  description,
  icon: Icon,
  children,
  compact,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={cn("form-section", compact && "form-section--compact")}>
      <div className="form-section-head">
        {Icon && (
          <div className="form-section-icon">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="form-section-title">{title}</h2>
          {description && <p className="form-section-desc">{description}</p>}
        </div>
      </div>
      <div className="form-section-body">{children}</div>
    </section>
  );
}

export function FormRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-6", className)}>
      {children}
    </div>
  );
}

export function FormGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-4 sm:gap-x-5 sm:gap-y-5",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FormField({
  label,
  required,
  hint,
  className,
  span,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  span?: "full" | 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        className,
        span === "full" && "sm:col-span-2 lg:col-span-full",
        span === 2 && "sm:col-span-2",
        span === 3 && "lg:col-span-3"
      )}
    >
      <label className="form-field-label">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="form-field-hint">{hint}</p>}
    </div>
  );
}

export function FormActions({
  error,
  children,
  sticky,
}: {
  error?: string;
  children: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <div className={cn("form-actions", sticky && "form-actions--sticky")}>
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function FormSubmitButton({
  loading,
  children,
  variant = "primary",
}: {
  loading?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={variant === "primary" ? "form-btn-primary" : "form-btn-secondary"}
    >
      {loading ? "Saving…" : children}
    </button>
  );
}

export function FormCancelButton({ href, children = "Cancel" }: { href: string; children?: React.ReactNode }) {
  return (
    <TenantLink href={href} className="form-btn-secondary">
      {children}
    </TenantLink>
  );
}
