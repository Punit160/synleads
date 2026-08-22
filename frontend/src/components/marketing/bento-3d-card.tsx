"use client";

import { type LucideIcon } from "lucide-react";
import { TiltCard } from "@/components/marketing/tilt-card";
import { cn } from "@/lib/utils";

interface Bento3DCardProps {
  span: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string;
  iconBg: string;
}

export function Bento3DCard({ span, icon: Icon, title, desc, accent, iconBg }: Bento3DCardProps) {
  return (
    <div className={cn("h-full w-full min-w-0", span)}>
      <TiltCard intensity={8} className="h-full w-full">
        <div className="group relative h-full min-h-[140px] rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 overflow-hidden card-3d-depth transition-shadow hover:shadow-2xl hover:shadow-blue-200/50">
          <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
          <div
            className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-400/10 blur-2xl group-hover:bg-blue-400/20 transition-colors"
            aria-hidden
          />
          <div className="relative">
            <div className={`inline-flex p-2.5 rounded-xl ${iconBg} mb-4 shadow-md`} style={{ transform: "translateZ(16px)" }}>
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-lg text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}
