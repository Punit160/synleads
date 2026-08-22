import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Globe,
  Phone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PipelineVisual } from "@/components/marketing/pipeline-visual";
import { LeadInboxPreview } from "@/components/marketing/lead-inbox-preview";
import { FunnelAnalyticsPreview } from "@/components/marketing/funnel-analytics-preview";
import { Hero3DShowcase } from "@/components/marketing/hero-3d-showcase";
import { Bento3DGrid } from "@/components/marketing/bento-3d-grid";
import { Team3DGrid } from "@/components/marketing/team-3d-grid";

const tickerItems = [
  "Lead scoring",
  "Pipeline forecasting",
  "Activity timelines",
  "Team assignments",
  "Deal tracking",
  "Contact management",
  "Revenue reports",
  "Workflow automation",
  "Synentrix Technologies",
  "Built in India",
];

const workflowSteps = [
  {
    phase: "Capture",
    title: "Leads arrive from everywhere",
    desc: "Web forms, CSV imports, manual entry, or API — every lead lands in one inbox with source tracking and auto-assignment rules.",
  },
  {
    phase: "Qualify",
    title: "Score, segment, and route",
    desc: "Lead scoring surfaces hot prospects. Saved views filter by budget, industry, or owner. The right rep gets the right lead.",
  },
  {
    phase: "Convert",
    title: "Work deals through your pipeline",
    desc: "Log calls, schedule meetings, send proposals. Every touchpoint lives on the deal timeline until it closes.",
  },
  {
    phase: "Analyze",
    title: "Learn and forecast",
    desc: "See what converts, where deals stall, and what revenue is coming next quarter. Iterate your process with data.",
  },
];

const faqs = [
  {
    q: "Is Synentrix Flow a Salesforce alternative?",
    a: "Synentrix Flow covers the CRM essentials — leads, contacts, pipeline, activities, and forecasting — without enterprise complexity or pricing.",
  },
  {
    q: "Who makes Synentrix Flow?",
    a: "Synentrix Technologies Private Limited — the same team behind BillFlow, India's GST invoicing platform.",
  },
  {
    q: "Can my whole team use it?",
    a: "Yes. Assign ownership, track rep performance, and keep everyone on the same timeline.",
  },
  {
    q: "How do we get started?",
    a: "Contact Synentrix Technologies to onboard your company. We provision your workspace, users, and branded login portal — self sign-up is not available.",
  },
];

export default function HomePage() {
  const doubledTicker = [...tickerItems, ...tickerItems];

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-clip">
      <SiteHeader />

      {/* Hero — 3D perspective showcase */}
      <section className="hero-light grid-bg-light relative pt-28 sm:pt-32 pb-0 overflow-x-clip">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <p className="inline-flex items-center justify-center gap-2 text-[11px] sm:text-xs font-medium text-indigo-700 mb-6 sm:mb-8 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 max-w-full">
            <Sparkles className="h-3 w-3 shrink-0" />
            <span className="leading-snug">Synentrix Technologies Pvt. Ltd.</span>
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-5 sm:mb-6 text-slate-900">
            Close more deals.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent">
              Lose fewer leads.
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-1">
            Synentrix Flow is a sales CRM built for teams who outgrew spreadsheets — capture, qualify, pipeline, and forecast in one workspace.
          </p>
          <div className="flex flex-col min-[480px]:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 mb-6 sm:mb-8 max-w-md sm:max-w-none mx-auto">
            <a href={SUPPORT_MAILTO} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                Request access <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Log in
              </Button>
            </Link>
            <a href="#platform" className="w-full sm:w-auto hidden sm:block">
              <Button variant="ghost" size="lg" className="w-full sm:w-auto">See the platform</Button>
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-3 sm:px-6 relative z-10">
          <Hero3DShowcase>
            <PipelineVisual />
          </Hero3DShowcase>
        </div>
      </section>

      {/* Marquee */}
      <section className="border-y border-slate-200 bg-indigo-50/40 py-4 overflow-hidden">
        <div className="flex whitespace-nowrap">
          <div className="marquee-track flex gap-10 items-center">
            {doubledTicker.map((item, i) => (
              <span key={`${item}-${i}`} className="flex items-center gap-10 text-sm font-medium text-slate-500">
                {item}
                <span className="h-1 w-1 rounded-full bg-indigo-400" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Bento grid */}
      <section id="platform" className="py-16 sm:py-24 lg:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 sm:gap-6 mb-10 sm:mb-14">
            <div className="min-w-0">
              <p className="text-indigo-600 text-sm font-semibold mb-2 sm:mb-3">Platform</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold max-w-lg leading-tight text-slate-900">
                One workspace for the entire sales cycle
              </h2>
            </div>
            <p className="text-slate-500 max-w-md text-sm leading-relaxed lg:text-right">
              Not another bloated CRM. Synentrix Flow is shaped around how Indian sales teams actually work — fast setup, clear pipeline, honest pricing.
            </p>
          </div>

          <Bento3DGrid />
        </div>
      </section>

      {/* Lead inbox showcase */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 to-indigo-50/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div className="w-full min-w-0 order-1">
            <LeadInboxPreview />
          </div>
          <div className="min-w-0 order-2">
            <p className="text-indigo-600 text-sm font-semibold mb-3">Lead inbox</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-5 leading-tight text-slate-900">
              Every lead scored and sorted before your first call
            </h2>
            <p className="text-slate-600 leading-relaxed mb-8">
              Stop digging through email and WhatsApp threads. Synentrix Flow scores intent, tags the source, and surfaces who needs attention right now.
            </p>
            <ul className="space-y-4">
              {["Auto-assignment by territory or round-robin", "Hot lead alerts for high-intent prospects", "One-click convert to contact & deal"].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <ChevronRight className="h-3 w-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Deal intelligence */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div className="order-2 lg:order-1 min-w-0">
            <p className="text-cyan-600 text-sm font-semibold mb-3">Deal intelligence</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-5 leading-tight text-slate-900">
              Know exactly where revenue is stuck
            </h2>
            <p className="text-slate-600 leading-relaxed mb-8">
              Stage-by-stage funnel analytics show drop-off points. Managers see rep load; founders see forecast confidence — without exporting to Excel.
            </p>
            <a href={SUPPORT_MAILTO} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
              Request company access <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
          <div className="order-1 lg:order-2 w-full min-w-0">
            <FunnelAnalyticsPreview />
          </div>
        </div>
      </section>

      {/* Workflow timeline */}
      <section id="workflow" className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-indigo-50/40 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-indigo-600 text-sm font-semibold mb-2 sm:mb-3 text-center">Workflow</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-16 max-w-xl mx-auto text-slate-900 px-2">
            From first touch to signed contract
          </h2>

          <div className="relative max-w-2xl mx-auto">
            <div className="absolute left-[15px] sm:left-[19px] top-3 bottom-3 w-0.5 sm:w-1 rounded-full bg-gradient-to-b from-indigo-300 via-violet-300 to-emerald-300" />
            <div className="space-y-6 sm:space-y-8">
              {workflowSteps.map((step, i) => (
                <div key={step.phase} className="relative pl-12 sm:pl-14">
                  <div className="absolute left-0 top-2 h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl border-2 border-indigo-200 bg-white flex items-center justify-center text-[10px] sm:text-xs font-bold text-indigo-600 card-3d-depth">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 sm:p-6 card-3d-depth hover:shadow-xl hover:shadow-indigo-100/50 transition-shadow">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-1">{step.phase}</p>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Teams */}
      <section id="teams" className="py-16 sm:py-24 border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-blue-600 text-sm font-semibold mb-2 sm:mb-3">Teams</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">Built for every seat at the table</h2>
          </div>
          <Team3DGrid />
        </div>
      </section>

      {/* Synentrix */}
      <section id="synentrix" className="py-16 sm:py-24 lg:py-32 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden grid lg:grid-cols-2 bg-white card-3d-depth">
            <div className="p-6 sm:p-8 md:p-12 bg-gradient-to-br from-blue-50 to-cyan-50">
              <Building2 className="h-8 w-8 text-blue-600 mb-6" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-slate-900">Synentrix Technologies</h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                An Indian technology company building practical SaaS for startups and SMEs.
                Synentrix Flow joins BillFlow in our product family — sell with Synentrix Flow, invoice with BillFlow.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="px-3 py-1.5 rounded-full border border-blue-200 bg-white text-blue-700 font-medium">Synentrix Flow · CRM</span>
                <span className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 font-medium">BillFlow · Billing</span>
              </div>
            </div>
            <div className="p-6 sm:p-8 md:p-12 flex flex-col justify-center gap-5 sm:gap-6">
              {[
                { icon: Globe, label: "Cloud-native", desc: "Access from anywhere" },
                { icon: UserCheck, label: "Team-ready", desc: "Roles & ownership built in" },
                { icon: TrendingUp, label: "India-first", desc: "Pricing & UX for local teams" },
                { icon: Phone, label: "Support", desc: SUPPORT_EMAIL },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-8 sm:mb-10 text-slate-900">Common questions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-slate-200 bg-white p-6 card-3d-depth hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-0.5 transition-all">
                <p className="font-semibold text-slate-900 mb-2 text-sm">{faq.q}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-white to-blue-50/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center rounded-2xl sm:rounded-3xl border border-blue-200 bg-white px-5 sm:px-8 py-10 sm:py-14 md:py-16 card-3d-depth relative overflow-hidden">
          <div
            className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl pointer-events-none"
            aria-hidden
          />
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 mb-5 shadow-lg shadow-blue-200/60 relative">
            <Zap className="h-7 w-7 text-blue-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-slate-900">Your pipeline, live in 5 minutes</h2>
          <p className="text-slate-600 text-sm mb-8 max-w-md mx-auto">
            Invite-only CRM for companies onboarded by Synentrix Technologies Private Limited.
          </p>
          <a href={SUPPORT_MAILTO} className="inline-block w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              Contact Synentrix <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
