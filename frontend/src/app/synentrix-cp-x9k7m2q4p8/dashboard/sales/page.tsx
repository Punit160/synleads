"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { PLATFORM_NAV } from "@/lib/platform-config";

/** Tenant CRM data is not exposed on the platform portal. */
export default function PlatformSalesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(PLATFORM_NAV.overview);
  }, [router]);

  return (
    <div className="p-8 max-w-lg">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-700 mb-2">
          <Shield className="h-4 w-4" />
          <p className="font-semibold text-sm">Not available</p>
        </div>
        <p className="text-sm text-slate-500">
          Customer CRM data (leads, deals, client revenue) is not shown on the platform portal for security and privacy.
        </p>
      </div>
    </div>
  );
}
