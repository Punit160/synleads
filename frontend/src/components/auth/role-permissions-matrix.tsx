"use client";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  ROLE_ACCESS_SUMMARY,
  ROLE_PERMISSIONS,
  normalizeRole,
  type Permission,
  type Role,
} from "@/lib/route-access";

const PERMISSION_LABELS: Record<Permission, string> = {
  view: "View records",
  add: "Create records",
  edit: "Edit records",
  delete: "Delete records",
  export: "Export data",
  import: "Import data",
  assign: "Assign leads & deals",
  reports: "Reports & audit",
  manage_users: "Full team admin",
  manage_team: "Manage team",
};

export function RolePermissionsMatrix({ compact = false }: { compact?: boolean }) {
  const auth = useAuth();
  const currentRole = normalizeRole(auth.role);

  if (compact) {
    return (
      <div className="text-sm text-slate-600 space-y-2">
        <p>
          Signed in as <span className="font-semibold text-slate-900">{auth.roleLabel}</span> —{" "}
          {ROLE_ACCESS_SUMMARY[currentRole]}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {auth.permissions.map((p) => (
            <span
              key={p}
              className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-medium"
            >
              {PERMISSION_LABELS[p as Permission] || p.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[640px] text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-2 font-semibold text-slate-500">Permission</th>
            {ROLES.map((role) => (
              <th
                key={role}
                className={cn(
                  "py-2 px-2 font-semibold text-center whitespace-nowrap",
                  role === currentRole ? "text-indigo-700 bg-indigo-50/80" : "text-slate-600"
                )}
              >
                {ROLE_LABELS[role]}
                {role === currentRole && (
                  <span className="block text-[9px] font-normal text-indigo-500 mt-0.5">You</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((perm) => (
            <tr key={perm} className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="py-2 px-2 text-slate-700">{PERMISSION_LABELS[perm]}</td>
              {ROLES.map((role) => {
                const allowed = ROLE_PERMISSIONS[role as Role].includes(perm);
                return (
                  <td
                    key={role}
                    className={cn(
                      "py-2 px-2 text-center",
                      role === currentRole && "bg-indigo-50/40"
                    )}
                  >
                    {allowed ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Allowed" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-200" title="Not allowed" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 space-y-2">
        {ROLES.map((role) => (
          <div key={role} className={cn("text-xs", role === currentRole && "font-medium")}>
            <span className="text-slate-800">{ROLE_LABELS[role]}:</span>{" "}
            <span className="text-slate-500">{ROLE_ACCESS_SUMMARY[role]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
