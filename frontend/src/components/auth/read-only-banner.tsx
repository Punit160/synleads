"use client";

import { Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isReadOnlyRole } from "@/lib/route-access";

export function ReadOnlyBanner() {
  const auth = useAuth();
  if (!isReadOnlyRole(auth.role)) return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
      <Eye className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>Viewer mode</strong> — you can browse data and reports but cannot create or edit records.
      </span>
    </div>
  );
}
