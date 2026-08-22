/** Obscure internal path — do not link from public site */
export const PLATFORM_ADMIN_BASE = "/synentrix-cp-x9k7m2q4p8";

export const PLATFORM_LOGIN_PATH = PLATFORM_ADMIN_BASE;
export const PLATFORM_DASHBOARD_PATH = `${PLATFORM_ADMIN_BASE}/dashboard`;

export const PLATFORM_NAV = {
  overview: `${PLATFORM_ADMIN_BASE}/dashboard`,
  companies: `${PLATFORM_ADMIN_BASE}/dashboard/companies`,
  subscriptions: `${PLATFORM_ADMIN_BASE}/dashboard/subscriptions`,
  usage: `${PLATFORM_ADMIN_BASE}/dashboard/usage`,
  sales: `${PLATFORM_ADMIN_BASE}/dashboard/sales`,
  team: `${PLATFORM_ADMIN_BASE}/dashboard/team`,
  errors: `${PLATFORM_ADMIN_BASE}/dashboard/errors`,
} as const;

export function isPlatformPath(pathname: string): boolean {
  return pathname === PLATFORM_ADMIN_BASE || pathname.startsWith(`${PLATFORM_ADMIN_BASE}/`);
}

export const PLATFORM_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operator: "Operator",
  sales: "Sales Executive",
};
