import Link from "next/link";
import { Building2, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Invite-only access"
      subtitle="Company workspaces are created and managed by Synentrix"
      footer={
        <p className="text-center text-sm text-slate-500">
          Already have credentials?{" "}
          <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 leading-relaxed">
          <div className="flex gap-3">
            <Building2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Synentrix Flow is provided to companies onboarded by{" "}
              <span className="font-medium text-slate-800">Synentrix Technologies</span>.
              You cannot create a workspace yourself — your admin will share your company login URL
              (for example <code className="text-xs bg-white px-1 rounded border">your-company.yourdomain.com</code>).
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-sm font-medium text-slate-900 mb-2">Need a company account?</p>
          <p className="text-sm text-slate-600 mb-4">
            Contact Synentrix to request Synentrix Flow for your organization.
          </p>
          <a
            href={SUPPORT_MAILTO}
            className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Mail className="h-4 w-4" />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </AuthShell>
  );
}
