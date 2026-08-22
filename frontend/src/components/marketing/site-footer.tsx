import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { PRODUCT_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div>
            <p className="text-slate-900 font-semibold text-lg mb-1">{PRODUCT_NAME}</p>
            <p className="text-sm text-slate-500 max-w-sm">
              Lead management & sales CRM by{" "}
              <span className="text-slate-700">Synentrix Technologies Private Limited</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-600">
            <a href="#platform" className="hover:text-blue-700 transition-colors">Platform</a>
            <a href="#workflow" className="hover:text-blue-700 transition-colors">Workflow</a>
            <a href="#teams" className="hover:text-blue-700 transition-colors">Teams</a>
            <a href="#synentrix" className="hover:text-blue-700 transition-colors">About Synentrix</a>
            <a href={SUPPORT_MAILTO} className="hover:text-blue-700 transition-colors font-medium">Contact us</a>
            <a href={SUPPORT_MAILTO} className="hover:text-blue-700 transition-colors">{SUPPORT_EMAIL}</a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Synentrix Technologies Pvt. Ltd.</p>
          <p>Made in India · Privacy · Terms</p>
        </div>
      </div>
    </footer>
  );
}
