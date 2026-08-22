"use client";

import { TiltCard } from "@/components/marketing/tilt-card";

const rows = [
  { stage: "Proposal sent", count: 11, bar: 75, color: "bg-blue-500" },
  { stage: "Discovery done", count: 22, bar: 55, color: "bg-cyan-500" },
  { stage: "First contact", count: 47, bar: 100, color: "bg-slate-300" },
  { stage: "Closed won", count: 8, bar: 30, color: "bg-emerald-500" },
];

export function FunnelAnalyticsPreview() {
  return (
    <TiltCard intensity={10}>
      <div className="card-3d-depth rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <div className="space-y-5">
          {rows.map((row, i) => (
            <div key={row.stage} style={{ transform: `translateZ(${i * 3}px)` }}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-600">{row.stage}</span>
                <span className="font-semibold text-slate-900">{row.count}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full ${row.color} shadow-sm`}
                  style={{
                    width: `${row.bar}%`,
                    boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.1), 0 2px 8px rgba(124,58,237,0.2)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
          <div
            className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-4 py-3 border border-emerald-100 shadow-md"
            style={{ transform: "translateZ(12px)" }}
          >
            <p className="text-xs text-emerald-700/70">Q2 forecast</p>
            <p className="text-2xl font-bold text-emerald-700">₹28.4L</p>
          </div>
          <div
            className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 px-4 py-3 border border-amber-100 shadow-md"
            style={{ transform: "translateZ(12px)" }}
          >
            <p className="text-xs text-amber-700/70">At risk</p>
            <p className="text-2xl font-bold text-amber-700">₹4.1L</p>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}
