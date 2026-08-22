"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, Kanban, Target, Shield, Zap } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/brand";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

const features = [
  { icon: Target, label: "Lead capture & scoring", desc: "Track every source and priority" },
  { icon: Kanban, label: "Sales pipeline", desc: "Kanban boards with deal tracking" },
  { icon: BarChart3, label: "Reports & analytics", desc: "Conversion, source, and revenue data" },
];

const stats = [
  { value: "12+", label: "Lead sources" },
  { value: "9", label: "Pipeline stages" },
  { value: "5", label: "Comm channels" },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  logoUrl,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  logoUrl?: string | null;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="auth-brand-panel relative hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="auth-brand-grid absolute inset-0 pointer-events-none" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-200/80 hover:text-white text-sm mb-12 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to website
          </Link>

          <div className="flex items-center gap-3 mb-10">
            <div className="h-11 w-11 rounded-lg brand-logo flex items-center justify-center">
              <span className="text-white text-sm font-bold tracking-tight">SF</span>
            </div>
            <div>
              <p className="font-semibold text-white text-lg">{PRODUCT_NAME}</p>
              <p className="text-indigo-200/70 text-xs">by Synentrix Technologies</p>
            </div>
          </div>

          <h2 className="text-2xl xl:text-3xl font-semibold text-white leading-snug max-w-sm">
            Professional lead management for growing sales teams
          </h2>
          <p className="text-indigo-100/80 text-sm mt-3 max-w-md leading-relaxed">
            Capture leads, manage pipelines, schedule follow-ups, and connect your channels — all in one workspace.
          </p>

          <ul className="mt-10 space-y-4">
            {features.map((f) => (
              <li key={f.label} className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <f.icon className="h-4 w-4 text-indigo-200" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <p className="text-xs text-indigo-200/60 mt-0.5">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <div className="flex gap-6 pt-8 border-t border-white/10">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-xl font-semibold text-white tabular-nums">{s.value}</p>
                <p className="text-[11px] text-indigo-200/60 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-indigo-200/40 mt-6 flex items-center gap-1.5">
            <Shield className="h-3 w-3" /> Enterprise-grade security · SOC-ready architecture
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
        <div className="lg:hidden px-5 pt-5 pb-2 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg brand-logo flex items-center justify-center">
              <span className="text-white text-xs font-bold">SF</span>
            </div>
            <span className="font-semibold text-slate-900 text-sm">{PRODUCT_NAME}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 lg:py-12">
          <div className="w-full max-w-[420px]">
            <div className="mb-8">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-12 w-auto max-w-[180px] object-contain mb-4 rounded-lg border border-slate-200 bg-white p-1"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-medium mb-4">
                  <Zap className="h-3 w-3" /> CRM Workspace
                </div>
              )}
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 break-words">{title}</h1>
              <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
            </div>

            <div className="auth-form-card">{children}</div>

            <div className="mt-6">{footer}</div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 pb-2 px-5">
          Support:{" "}
          <a href={SUPPORT_MAILTO} className="text-indigo-600 hover:underline">{SUPPORT_EMAIL}</a>
        </p>
        <p className="text-center text-[11px] text-slate-400 pb-6 px-5">
          © {new Date().getFullYear()} Synentrix Technologies Private Limited
        </p>
      </div>
    </div>
  );
}
