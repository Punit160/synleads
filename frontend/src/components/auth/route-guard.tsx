"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { canAccessRoute } from "@/lib/route-access";
import { AccessDenied } from "@/components/auth/access-denied";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();

  const { allowed, missing } = canAccessRoute(pathname, auth.permissions);

  if (!allowed) {
    const permLabel = Array.isArray(missing)
      ? missing.map((p) => p.replace(/_/g, " ")).join(" or ")
      : typeof missing === "string"
        ? missing.replace(/_/g, " ")
        : undefined;

    return (
      <AccessDenied
        requiredPermission={permLabel}
        description={`Contact your workspace admin if you need access. You are signed in as ${auth.roleLabel}.`}
      />
    );
  }

  return <>{children}</>;
}
