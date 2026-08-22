"use client";

import { useParams } from "next/navigation";
import { TenantLoginPage } from "@/components/auth/tenant-login-page";

/** Path-based company login: localhost:3000/{slug}/login */
export default function TenantLoginRoutePage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : null;
  return <TenantLoginPage slugFromPath={slug} />;
}
