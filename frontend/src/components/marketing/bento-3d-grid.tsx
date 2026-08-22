"use client";

import { BarChart3, Calendar, Kanban, Mail, Target } from "lucide-react";
import { Bento3DCard } from "@/components/marketing/bento-3d-card";

const bentoItems = [
  {
    span: "md:col-span-2 lg:col-span-2 lg:row-span-2",
    icon: Kanban,
    title: "Pipeline that mirrors how you sell",
    desc: "Kanban boards, stage probabilities, and deal values update in real time. Drag a deal forward and your forecast adjusts instantly.",
    accent: "from-blue-100/80 to-white",
    iconBg: "bg-blue-100 text-blue-600",
  },
  {
    span: "",
    icon: Target,
    title: "Lead scoring",
    desc: "Rank every lead by fit and intent automatically.",
    accent: "from-emerald-50 to-white",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  {
    span: "",
    icon: Calendar,
    title: "Follow-ups",
    desc: "Tasks and reminders tied to every contact.",
    accent: "from-cyan-50 to-white",
    iconBg: "bg-cyan-100 text-cyan-600",
  },
  {
    span: "md:col-span-2 lg:col-span-2",
    icon: BarChart3,
    title: "Forecasting & reports",
    desc: "Pipeline velocity, conversion by source, rep performance, and quarterly revenue projections — the numbers your leadership actually asks for.",
    accent: "from-amber-50 to-white",
    iconBg: "bg-amber-100 text-amber-600",
  },
  {
    span: "md:col-span-2 lg:col-span-1",
    icon: Mail,
    title: "Comms log",
    desc: "Emails and calls on one timeline.",
    accent: "from-rose-50 to-white",
    iconBg: "bg-rose-100 text-rose-600",
  },
];

export function Bento3DGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 auto-rows-fr items-stretch">
      {bentoItems.map((item) => (
        <Bento3DCard key={item.title} {...item} />
      ))}
    </div>
  );
}
