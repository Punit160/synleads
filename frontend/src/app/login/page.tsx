import { headers } from "next/headers";
import { parseTenantSlugFromHost } from "@/lib/tenant-config";
import { PortalLookupForm } from "@/components/auth/portal-lookup-form";
import { TenantLoginPage } from "@/components/auth/tenant-login-page";

/**
 * Apex (localhost:3000/login) → email/phone portal lookup
 * Company subdomain (synentrix-demo.localhost:3000/login) → email + password
 */
export default async function LoginPage() {
  const host = (await headers()).get("host") || "";
  const tenantSlug = parseTenantSlugFromHost(host);

  if (tenantSlug) {
    return <TenantLoginPage initialSlug={tenantSlug} />;
  }

  return <PortalLookupForm />;
}
