"use client";

import { Users } from "lucide-react";
import { TiltCard } from "@/components/marketing/tilt-card";

const teamRoles = [
  { role: "Sales Rep", focus: "Own leads & close deals", metric: "12 active deals", color: "border-blue-200 bg-gradient-to-br from-blue-50 to-white" },
  { role: "Sales Manager", focus: "Coach team & forecast", metric: "₹46L pipeline", color: "border-cyan-200 bg-gradient-to-br from-cyan-50 to-white" },
  { role: "Founder", focus: "Full visibility", metric: "34% win rate", color: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" },
  { role: "Ops", focus: "Import & automate", metric: "8 workflows", color: "border-amber-200 bg-gradient-to-br from-amber-50 to-white" },
];

export function Team3DGrid() {
  return (
    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
      {teamRoles.map((t) => (
        <TiltCard key={t.role} intensity={10} className="h-full">
          <div className={`rounded-2xl border p-5 sm:p-6 card-3d-depth h-full ${t.color}`}>
            <Users className="h-5 w-5 text-slate-500 mb-4" />
            <p className="font-semibold text-slate-900 mb-1">{t.role}</p>
            <p className="text-xs text-slate-500 mb-4">{t.focus}</p>
            <p className="text-sm font-mono text-blue-600 font-medium">{t.metric}</p>
          </div>
        </TiltCard>
      ))}
    </div>
  );
}
