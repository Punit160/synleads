/** Handoff from apex portal lookup → company subdomain login (clean /login URL). */

export const PORTAL_EMAIL_STORAGE_KEY = "synentrix_portal_email";
export const PORTAL_SIGNIN_COOKIE = "portal_signin";
export const PORTAL_EMAIL_COOKIE = "portal_email";

function sharedCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.location.hostname;
  if (host === "localhost" || host.endsWith(".localhost")) return ".localhost";
  const parts = host.split(".");
  if (parts.length >= 2) return `.${parts.slice(-2).join(".")}`;
  return undefined;
}

function setSharedCookie(name: string, value: string) {
  if (typeof window === "undefined") return;
  const domain = sharedCookieDomain();
  const domainPart = domain ? `; domain=${domain}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=120; SameSite=Lax${domainPart}`;
}

function readSharedCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return "";
}

function clearSharedCookie(name: string) {
  if (typeof window === "undefined") return;
  const domain = sharedCookieDomain();
  const domainPart = domain ? `; domain=${domain}` : "";
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${domainPart}`;
}

export function stashPortalLoginHandoff(email: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PORTAL_EMAIL_STORAGE_KEY, email);
  setSharedCookie(PORTAL_SIGNIN_COOKIE, "1");
  setSharedCookie(PORTAL_EMAIL_COOKIE, email);
}

export function consumePortalLoginEmail(): string {
  const fromCookie = readSharedCookie(PORTAL_EMAIL_COOKIE);
  const fromStorage =
    typeof window !== "undefined"
      ? sessionStorage.getItem(PORTAL_EMAIL_STORAGE_KEY)?.trim() || ""
      : "";
  return fromCookie || fromStorage;
}

export function clearPortalSignInCookie() {
  clearSharedCookie(PORTAL_SIGNIN_COOKIE);
  clearSharedCookie(PORTAL_EMAIL_COOKIE);
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PORTAL_EMAIL_STORAGE_KEY);
  }
}

/** Remove legacy ?email=&signin=&company= from the address bar after handoff. */
export function cleanPortalLoginQueryFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("email") && !params.has("signin") && !params.has("company")) return;
  if (params.has("error")) return;
  window.history.replaceState({}, "", window.location.pathname);
}
