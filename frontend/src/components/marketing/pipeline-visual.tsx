const stages = [
  { label: "Capture", short: "Cap.", deals: 47, pct: 100, hue: "from-blue-500 to-blue-700" },
  { label: "Qualify", short: "Qual.", deals: 22, pct: 72, hue: "from-blue-400 to-blue-600" },
  { label: "Propose", short: "Prop.", deals: 11, pct: 48, hue: "from-sky-400 to-blue-600" },
  { label: "Negotiate", short: "Neg.", deals: 6, pct: 32, hue: "from-cyan-400 to-blue-500" },
  { label: "Close", short: "Close", deals: 3, pct: 18, hue: "from-emerald-400 to-cyan-600" },
];

function Bar3D({ height, gradient }: { height: number; gradient: string }) {
  const h = Math.max(height * 0.85, 22);
  return (
    <div className="bar-3d flex flex-col items-center w-full max-w-[48px] sm:max-w-[64px] md:max-w-[72px]" style={{ height: h + 10 }}>
      <div
        className={`bar-3d-face w-full bg-gradient-to-t ${gradient}`}
        style={{ height: h }}
      />
    </div>
  );
}

export function PipelineVisual() {
  return (
    <div className="relative w-full min-w-0 overflow-hidden rounded-xl bg-white/80 border border-blue-100/80 p-4 sm:p-6 md:p-8 shadow-inner">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, transparent 40%, rgba(37,99,235,0.06) 100%)",
        }}
        aria-hidden
      />

      <div className="relative mb-6 sm:mb-8 -mx-1 px-1 overflow-x-auto scrollbar-thin">
        <div className="flex items-end justify-between gap-1.5 sm:gap-3 min-w-[280px] sm:min-w-0">
          {stages.map((s, i) => (
            <div key={s.label} className="flex-1 min-w-[52px] flex flex-col items-center gap-1.5 sm:gap-2">
              <div className="w-full flex justify-center" style={{ transform: `translateZ(${i * 4}px)` }}>
                <Bar3D height={s.pct} gradient={s.hue} />
              </div>
              <p className="text-[9px] sm:text-xs font-medium text-slate-500 text-center leading-tight">
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-900">{s.deals}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 sm:gap-3 pt-4 border-t border-blue-100">
        {[
          { label: "Pipeline value", value: "₹46.7L", color: "text-emerald-600", bg: "from-emerald-50 to-white" },
          { label: "Win rate", value: "34%", color: "text-blue-600", bg: "from-blue-50 to-white" },
          { label: "Avg. cycle", value: "18 days", color: "text-cyan-600", bg: "from-cyan-50 to-white" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl bg-gradient-to-br ${stat.bg} border border-white px-3 sm:px-4 py-2.5 sm:py-3 shadow-md text-center sm:text-left`}
          >
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</p>
            <p className={`text-lg sm:text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
