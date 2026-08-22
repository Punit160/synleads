"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useTenantPath } from "@/lib/use-tenant-path";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Link that prefixes dashboard paths with the current company slug. */
export function TenantLink({ href, ...props }: Props) {
  const tp = useTenantPath();
  return <Link href={tp(href)} {...props} />;
}
