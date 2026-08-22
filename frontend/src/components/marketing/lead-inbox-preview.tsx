"use client";

import { TiltCard } from "@/components/marketing/tilt-card";

const leads = [
  { name: "Ananya Reddy", co: "FinEdge", score: 94, tag: "Enterprise", time: "2m ago" },
  { name: "Vikram Singh", co: "ScaleUp Labs", score: 78, tag: "Inbound", time: "14m ago" },
  { name: "Meera Joshi", co: "Nova Retail", score: 61, tag: "Referral", time: "1h ago" },
  { name: "Karan Mehta", co: "DevStack", score: 88, tag: "Hot", time: "3h ago" },
];

function scoreColor(n: number) {
  if (n >= 85) return "text-emerald-600 bg-emerald-100 shadow-sm";
  if (n >= 70) return "text-amber-600 bg-amber-100 shadow-sm";
  return "text-slate-600 bg-slate-100";
}

export function LeadInboxPreview() {
  return (
    <TiltCard intensity={10}>
      <div className="card-3d-depth rounded-2xl border border-slate-200/80 bg-white text-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white to-blue-50/60">
          <div>
            <p className="text-xs text-slate-500">Today&apos;s inbox</p>
            <p className="font-semibold text-sm">12 new leads · 4 need action</p>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 shadow-sm">Live</span>
        </div>
        <ul className="divide-y divide-slate-50">
          {leads.map((l, i) => (
            <li
              key={l.name}
              className="px-5 py-3.5 flex items-center gap-4 hover:bg-blue-50/40 transition-colors"
              style={{ transform: `translateZ(${i * 2}px)` }}
            >
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg shadow-blue-500/30">
                {l.name.split(" ").map((w) => w[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{l.name}</p>
                  {l.tag === "Hot" && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 shadow-sm">Hot</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{l.co} · {l.time}</p>
              </div>
              <div className={`text-xs font-bold px-2 py-1 rounded-lg ${scoreColor(l.score)}`}>
                {l.score}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </TiltCard>
  );
}
