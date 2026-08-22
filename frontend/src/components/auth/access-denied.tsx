"use client";

import { ShieldX } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { TenantLink } from "@/components/ui/tenant-link";
import { BtnPrimary } from "@/components/ui/dashboard-ui";
import { ROLE_LABELS, normalizeRole } from "@/lib/route-access";

export function AccessDenied({
  title = "Access restricted",
  description,
  requiredPermission,
}: {
  title?: string;
  description?: string;
  requiredPermission?: string;
}) {
  const auth = useAuth();
  const roleLabel = ROLE_LABELS[normalizeRole(auth.role)] || auth.roleLabel;

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
        <ShieldX className="h-7 w-7 text-red-500" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-md">
        {description ||
          `Your role (${roleLabel}) doesn't include permission to view this page.`}
      </p>
      {requiredPermission && (
        <p className="text-xs text-slate-400 mt-2">
          Required: <span className="font-medium text-slate-600">{requiredPermission.replace(/_/g, " ")}</span>
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        <BtnPrimary href="/dashboard">Back to dashboard</BtnPrimary>
        <TenantLink href="/dashboard/manual" className="pro-btn-secondary text-sm">
          View permissions guide
        </TenantLink>
      </div>
    </div>
  );
}
