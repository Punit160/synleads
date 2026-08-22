export const PLATFORM_ROLES = ["super_admin", "admin", "operator", "sales"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operator: "Operator",
  sales: "Sales Executive",
};

export const PLATFORM_PERMISSIONS = [
  "view_overview",
  "provision_companies",
  "manage_companies",
  "manage_sales",
  "manage_subscriptions",
  "manage_team",
  "manage_errors",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  super_admin: [
    "view_overview",
    "provision_companies",
    "manage_companies",
    "manage_subscriptions",
    "manage_team",
    "manage_errors",
  ],
  admin: [
    "view_overview",
    "provision_companies",
    "manage_companies",
    "manage_subscriptions",
    "manage_errors",
  ],
  operator: ["view_overview", "provision_companies", "manage_companies"],
  sales: ["view_overview", "provision_companies"],
};

export function platformHasPermission(role: string, permission: PlatformPermission): boolean {
  const r = (PLATFORM_ROLES.includes(role as PlatformRole) ? role : "operator") as PlatformRole;
  return PLATFORM_ROLE_PERMISSIONS[r]?.includes(permission) ?? false;
}

export function normalizePlatformRole(role: string): PlatformRole {
  if (PLATFORM_ROLES.includes(role as PlatformRole)) return role as PlatformRole;
  return "operator";
}

export function canProvisionCompanies(role: string): boolean {
  return platformHasPermission(role, "provision_companies") || platformHasPermission(role, "manage_companies");
}

export function canManageCompanySettings(role: string): boolean {
  return platformHasPermission(role, "manage_companies");
}
