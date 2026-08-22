import { parseTenantSlugFromPath } from "@/lib/tenant-config";

export const PERMISSIONS = [
  "view",
  "add",
  "edit",
  "delete",
  "export",
  "import",
  "assign",
  "reports",
  "manage_users",
  "manage_team",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["owner", "admin", "manager", "employee", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ["view", "add", "edit", "delete", "export", "import", "assign", "reports", "manage_users", "manage_team"],
  admin: ["view", "add", "edit", "delete", "export", "import", "assign", "reports", "manage_users", "manage_team"],
  manager: ["view", "add", "edit", "export", "import", "assign", "reports", "manage_team"],
  employee: ["view", "add", "edit", "export"],
  viewer: ["view", "reports"],
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Sales Manager",
  employee: "Sales Executive",
  viewer: "Viewer",
};

/** What each role can access in the product */
export const ROLE_ACCESS_SUMMARY: Record<Role, string> = {
  owner: "Full workspace access — all data, team, settings, and reports",
  admin: "Full workspace access — all data, team, settings, and reports",
  manager: "Team leads & deals, assign work, reports, automation (no delete users)",
  employee: "Own leads, deals, tasks, and activities only",
  viewer: "Read-only access to workspace data and reports",
};

type RouteRule = {
  /** Dashboard path prefix, e.g. /dashboard/leads */
  pattern: string;
  /** User must have this permission */
  permission?: Permission;
  /** User must have at least one of these permissions */
  anyOf?: Permission[];
};

/** Longest match wins. Order doesn't matter — sorted at runtime. */
export const ROUTE_RULES: RouteRule[] = [
  { pattern: "/dashboard/users", anyOf: ["manage_team", "manage_users"] },
  { pattern: "/dashboard/automation", permission: "manage_team" },
  { pattern: "/dashboard/assignment", permission: "manage_team" },
  { pattern: "/dashboard/reports", permission: "reports" },
  { pattern: "/dashboard/audit", permission: "reports" },
  { pattern: "/dashboard/leads/new", permission: "add" },
  { pattern: "/dashboard/leads", permission: "view" },
  { pattern: "/dashboard/deals/new", permission: "add" },
  { pattern: "/dashboard/deals", permission: "view" },
  { pattern: "/dashboard/pipeline", permission: "view" },
  { pattern: "/dashboard/activities", permission: "view" },
  { pattern: "/dashboard/quotations", permission: "view" },
  { pattern: "/dashboard/contacts", permission: "view" },
  { pattern: "/dashboard/accounts", permission: "view" },
  { pattern: "/dashboard/documents", permission: "view" },
  { pattern: "/dashboard/tasks", permission: "view" },
  { pattern: "/dashboard/calendar", permission: "view" },
  { pattern: "/dashboard/notifications", permission: "view" },
  { pattern: "/dashboard/follow-ups", permission: "view" },
  { pattern: "/dashboard/customers", permission: "view" },
  { pattern: "/dashboard/integrations", permission: "view" },
  { pattern: "/dashboard/settings", permission: "view" },
  { pattern: "/dashboard/manual", permission: "view" },
  { pattern: "/dashboard", permission: "view" },
];

export function normalizeRole(role: string): Role {
  const map: Record<string, Role> = {
    owner: "owner",
    admin: "admin",
    manager: "manager",
    employee: "employee",
    viewer: "viewer",
    super_admin: "owner",
    sales_manager: "manager",
    sales_executive: "employee",
    telecaller: "employee",
    marketing: "employee",
    accountant: "viewer",
    member: "employee",
  };
  return map[role] ?? "employee";
}

export function normalizeDashboardPath(pathname: string): string {
  const slug = parseTenantSlugFromPath(pathname);
  if (slug && pathname.startsWith(`/${slug}/dashboard`)) {
    return pathname.slice(`/${slug}`.length);
  }
  if (pathname.startsWith("/dashboard")) return pathname;
  return "/dashboard";
}

export function getRouteRule(pathname: string): RouteRule {
  const path = normalizeDashboardPath(pathname);
  const matches = ROUTE_RULES.filter(
    (r) => path === r.pattern || path.startsWith(`${r.pattern}/`)
  );
  if (matches.length === 0) {
    return { pattern: "/dashboard", permission: "view" };
  }
  return matches.sort((a, b) => b.pattern.length - a.pattern.length)[0];
}

export function canAccessRoute(
  pathname: string,
  permissions: string[]
): { allowed: boolean; rule: RouteRule; missing?: Permission | Permission[] } {
  const rule = getRouteRule(pathname);
  if (rule.anyOf) {
    const ok = rule.anyOf.some((p) => permissions.includes(p));
    return ok ? { allowed: true, rule } : { allowed: false, rule, missing: rule.anyOf };
  }
  const perm = rule.permission ?? "view";
  return permissions.includes(perm)
    ? { allowed: true, rule }
    : { allowed: false, rule, missing: perm };
}

export function isReadOnlyRole(role: string): boolean {
  return normalizeRole(role) === "viewer";
}

export function isManagerOrAbove(role: string): boolean {
  const r = normalizeRole(role);
  return r === "owner" || r === "admin" || r === "manager";
}

export function isAdminRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "owner" || r === "admin";
}

export function hasPermissionForRole(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)]?.includes(permission) ?? false;
}
