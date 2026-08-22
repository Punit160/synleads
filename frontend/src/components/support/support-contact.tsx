import { Mail } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export function SupportContact({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a
        href={SUPPORT_MAILTO}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
      >
        <Mail className="h-3.5 w-3.5 shrink-0" />
        {SUPPORT_EMAIL}
      </a>
    );
  }

  return (
    <a
      href={SUPPORT_MAILTO}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50 transition-colors"
    >
      <Mail className="h-4 w-4 text-blue-600" />
      {SUPPORT_EMAIL}
    </a>
  );
}
