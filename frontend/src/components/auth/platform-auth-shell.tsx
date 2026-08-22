"use client";

import { Building2, Shield, Users } from "lucide-react";
import { PLATFORM_ADMIN_NAME } from "@/lib/brand";

const capabilities = [
  { icon: Building2, label: "Tenants & subscriptions" },
  { icon: Users, label: "Plans & billing" },
];

export function PlatformAuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-slate-950">
      <div className="platform-auth-panel relative hidden lg:flex lg:w-[380px] xl:w-[400px] shrink-0 h-screen flex-col justify-between p-8 xl:p-10 overflow-hidden">
        <div className="platform-auth-grid absolute inset-0 pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 text-[10px] font-medium mb-6">
            <Shield className="h-3 w-3" />
            Synentrix Internal
          </div>

          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-lg tracking-tight">{PLATFORM_ADMIN_NAME}</p>
              <p className="text-slate-400 text-[11px]">Platform console</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-white leading-snug">
            Manage tenants, plans & revenue
          </h2>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Provision companies, upgrade subscriptions, and track sales.
          </p>

          <ul className="mt-6 space-y-2.5">
            {capabilities.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <item.icon className="h-3.5 w-3.5 text-slate-300" />
                </div>
                <p className="text-sm text-white/90">{item.label}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[10px] text-slate-500 pt-4 border-t border-white/10">
          Synentrix Technologies · Internal use only
        </p>
      </div>

      <div className="flex-1 h-screen flex flex-col min-w-0 bg-slate-50 overflow-y-auto">
        <div className="lg:hidden px-4 pt-4 pb-1 flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{PLATFORM_ADMIN_NAME}</p>
            <p className="text-[10px] text-slate-500">Platform</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
          <div className="w-full max-w-[400px]">
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 text-[10px] font-medium mb-3 border border-slate-800">
                <Shield className="h-3 w-3 text-indigo-400" /> Operator access
              </div>
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
            </div>

            <div className="auth-form-card platform-form-card">{children}</div>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 pb-4 px-4 shrink-0">
          © {new Date().getFullYear()} Synentrix Technologies
        </p>
      </div>
    </div>
  );
}
