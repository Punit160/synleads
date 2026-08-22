export const ROLES = ["owner", "admin", "manager", "employee", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Sales Manager",
  employee: "Sales Executive",
  viewer: "Viewer",
  super_admin: "Owner",
  sales_manager: "Sales Manager",
  sales_executive: "Sales Executive",
  telecaller: "Sales Executive",
  marketing: "Sales Executive",
  accountant: "Viewer",
  member: "Sales Executive",
};

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

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ["view", "add", "edit", "delete", "export", "import", "assign", "reports", "manage_users", "manage_team"],
  admin: ["view", "add", "edit", "delete", "export", "import", "assign", "reports", "manage_users", "manage_team"],
  manager: ["view", "add", "edit", "export", "import", "assign", "reports", "manage_team"],
  employee: ["view", "add", "edit", "export"],
  viewer: ["view", "reports"],
};

const LEGACY_ROLE_MAP: Record<string, Role> = {
  super_admin: "owner",
  owner: "owner",
  admin: "admin",
  sales_manager: "manager",
  manager: "manager",
  sales_executive: "employee",
  telecaller: "employee",
  marketing: "employee",
  accountant: "viewer",
  viewer: "viewer",
  member: "employee",
  employee: "employee",
};

export function normalizeRole(role: string): Role {
  return LEGACY_ROLE_MAP[role] || "employee";
}

export function hasPermission(role: string, permission: Permission): boolean {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized]?.includes(permission) ?? false;
}

/** Higher rank = more authority in the role hierarchy */
export const ROLE_RANK: Record<Role, number> = {
  owner: 100,
  admin: 90,
  manager: 70,
  employee: 40,
  viewer: 20,
};

export function roleRank(role: string): number {
  return ROLE_RANK[normalizeRole(role)] ?? 0;
}

export function isAdminRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "owner" || r === "admin";
}

export function canViewAllLeads(role: string): boolean {
  const r = normalizeRole(role);
  return r === "owner" || r === "admin" || r === "viewer";
}

export function canManageTeam(role: string): boolean {
  const r = normalizeRole(role);
  return r === "owner" || r === "admin" || r === "manager";
}

export const SUBSCRIPTION_PACKAGES = [
  "trial_7d",
  "yearly_5",
  "yearly_10",
  "yearly_20",
  "yearly_50",
  "yearly_100",
  "yearly_200",
  "yearly_500",
] as const;
export type SubscriptionPackage = (typeof SUBSCRIPTION_PACKAGES)[number];

/** Platform admin labels (include pricing). */
export const PACKAGE_LABELS: Record<SubscriptionPackage, string> = {
  trial_7d: "7-Day Trial · 5 Users",
  yearly_5: "Yearly · 5 Users · ₹2,999",
  yearly_10: "Yearly · 10 Users · ₹5,499",
  yearly_20: "Yearly · 20 Users · ₹9,499",
  yearly_50: "Yearly · 50 Users · ₹19,999",
  yearly_100: "Yearly · 100 Users · ₹37,999",
  yearly_200: "Yearly · 200 Users · ₹69,999",
  yearly_500: "Yearly · 500 Users · ₹1,49,999",
};

export const PACKAGE_MAX_USERS: Record<SubscriptionPackage, number> = {
  trial_7d: 5,
  yearly_5: 5,
  yearly_10: 10,
  yearly_20: 20,
  yearly_50: 50,
  yearly_100: 100,
  yearly_200: 200,
  yearly_500: 500,
};

export const PACKAGE_PRICE_INR: Record<SubscriptionPackage, number> = {
  trial_7d: 0,
  yearly_5: 2999,
  yearly_10: 5499,
  yearly_20: 9499,
  yearly_50: 19999,
  yearly_100: 37999,
  yearly_200: 69999,
  yearly_500: 149999,
};

export function packageMaxUsers(pkg: string): number | null {
  if (pkg in PACKAGE_MAX_USERS) {
    return PACKAGE_MAX_USERS[pkg as SubscriptionPackage];
  }
  return null;
}

/** Customer-facing label — no pricing, no trial wording. */
export function packageCustomerLabel(pkg: string): string {
  const max = packageMaxUsers(pkg);
  if (max) return `Yearly plan · up to ${max} users`;
  return "Yearly plan";
}

export function isTrialPackage(pkg: string): boolean {
  return pkg === "trial_7d";
}

export function isPaidPackage(pkg: string): boolean {
  return pkg !== "trial_7d" && pkg in PACKAGE_PRICE_INR;
}

export function packageUserTier(pkg: string): number {
  return PACKAGE_MAX_USERS[pkg as SubscriptionPackage] ?? 0;
}

export function comparePackageTier(a: string, b: string): -1 | 0 | 1 {
  const ta = packageUserTier(a);
  const tb = packageUserTier(b);
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  return 0;
}

export function packageExpiresAt(pkg: SubscriptionPackage, from: Date = new Date()): Date {
  if (pkg === "trial_7d") {
    const d = new Date(from);
    d.setDate(d.getDate() + 7);
    return d;
  }
  return addMonths(from, 12);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** @deprecated use packageExpiresAt */
export function packageDurationMonths(pkg: SubscriptionPackage): number {
  return pkg === "trial_7d" ? 0 : 12;
}
