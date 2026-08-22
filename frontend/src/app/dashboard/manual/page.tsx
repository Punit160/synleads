"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { ChevronRight } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/dashboard-ui";
import { USER_MANUAL_SECTIONS } from "@/lib/user-manual";
import { RolePermissionsMatrix } from "@/components/auth/role-permissions-matrix";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { cn } from "@/lib/utils";

export default function UserManualPage() {
  const [activeId, setActiveId] = useState(USER_MANUAL_SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    for (const section of USER_MANUAL_SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }

  return (
    <div className="max-w-[1200px]">
      <PageHeader
        meta="Help"
        title="User Manual"
        description="Step-by-step guide for your company — how to use Synentrix Flow from login to quotations, pipeline, and team setup."
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        This manual explains how your team uses Synentrix Flow after Synentrix sets up your company account.
        For plans, pricing, upgrades, or support, contact the Synentrix team at{" "}
        <a href={SUPPORT_MAILTO} className="text-blue-600 font-medium hover:underline">{SUPPORT_EMAIL}</a>.
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-56 shrink-0">
          <div className="lg:sticky lg:top-16 pro-panel p-2">
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Contents
            </p>
            <ul className="space-y-0.5 max-h-[70vh] overflow-y-auto">
              {USER_MANUAL_SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
                      activeId === s.id
                        ? "bg-blue-50 text-blue-700 border border-blue-100"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <ChevronRight className={cn("h-3 w-3 shrink-0", activeId === s.id ? "opacity-100" : "opacity-0")} />
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="flex-1 min-w-0 space-y-6 pb-12">
          {USER_MANUAL_SECTIONS.map((section, idx) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <Panel title={`${idx + 1}. ${section.title}`}>
                <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                  {section.content.map((block, i) => (
                    <div key={i}>
                      {block.heading && (
                        <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{block.heading}</h3>
                      )}
                      {block.body && <p>{block.body}</p>}
                      {block.bullets && block.bullets.length > 0 && (
                        <ul className="mt-2 space-y-1.5 list-disc list-inside text-slate-600 marker:text-blue-400">
                          {block.bullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                  {section.id === "roles-permissions" && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Permission matrix</h3>
                      <RolePermissionsMatrix />
                    </div>
                  )}
                </div>
              </Panel>
            </section>
          ))}

          <Panel title="Quick links">
            <div className="flex flex-wrap gap-2 text-sm">
              <TenantLink href="/dashboard/leads" className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Leads</TenantLink>
              <TenantLink href="/dashboard/pipeline" className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Pipeline</TenantLink>
              <TenantLink href="/dashboard/quotations" className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Quotations</TenantLink>
              <TenantLink href="/dashboard/users" className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Team</TenantLink>
              <TenantLink href="/dashboard/settings" className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Settings</TenantLink>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
