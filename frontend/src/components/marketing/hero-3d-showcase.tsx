"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

interface Hero3DShowcaseProps {
  children: ReactNode;
}

export function Hero3DShowcase({ children }: Hero3DShowcaseProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [transform, setTransform] = useState("rotateX(8deg) rotateY(-10deg) translateZ(0px)");

  useEffect(() => {
    const compactMq = window.matchMedia("(max-width: 768px)");
    const tiltMq = window.matchMedia("(hover: hover) and (pointer: fine)");

    const sync = () => {
      const compact = compactMq.matches;
      setIsCompact(compact);
      setTiltEnabled(tiltMq.matches && !compact);
      setTransform(
        compact
          ? "rotateX(4deg) rotateY(-6deg) translateZ(0px)"
          : "rotateX(8deg) rotateY(-10deg) translateZ(0px)"
      );
    };

    sync();
    compactMq.addEventListener("change", sync);
    tiltMq.addEventListener("change", sync);
    return () => {
      compactMq.removeEventListener("change", sync);
      tiltMq.removeEventListener("change", sync);
    };
  }, []);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    if (!tiltEnabled) return;
    const el = sceneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(
      `rotateX(${8 - y * 8}deg) rotateY(${-10 + x * 10}deg) translateZ(16px)`
    );
  }

  function handleLeave() {
    setTransform(
      isCompact
        ? "rotateX(4deg) rotateY(-6deg) translateZ(0px)"
        : "rotateX(8deg) rotateY(-10deg) translateZ(0px)"
    );
  }

  return (
    <div className="relative scene-3d pt-2 sm:pt-4 pb-10 sm:pb-20 md:pb-24 overflow-x-clip">
      <div
        className="orb-3d absolute left-0 top-20 h-32 w-32 sm:h-40 sm:w-40 bg-blue-400/30 pointer-events-none"
        aria-hidden
      />
      <div
        className="orb-3d absolute right-0 top-28 h-24 w-24 sm:h-32 sm:w-32 bg-cyan-400/25 pointer-events-none animate-float-delayed"
        aria-hidden
      />

      <div
        className="glass-3d absolute left-2 sm:left-6 top-16 sm:top-24 z-20 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 animate-float hidden sm:block"
      >
        <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Hot lead</p>
        <p className="text-sm font-bold text-slate-900">Score 94</p>
      </div>
      <div
        className="glass-3d absolute right-2 sm:right-8 top-28 sm:top-40 z-20 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 animate-float-delayed hidden sm:block"
      >
        <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Deal won</p>
        <p className="text-sm font-bold text-slate-900">₹12L</p>
      </div>
      <div
        className="glass-3d absolute right-4 sm:right-12 bottom-4 sm:bottom-8 z-20 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 animate-float-slow hidden md:block"
      >
        <p className="text-[10px] uppercase tracking-wider text-cyan-600 font-semibold">Pipeline</p>
        <p className="text-sm font-bold text-slate-900">₹46.7L</p>
      </div>

      <div
        ref={sceneRef}
        className="preserve-3d relative mx-auto w-full max-w-5xl px-0 sm:px-2"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {!isCompact && (
          <>
            <div
              className="absolute inset-x-6 sm:inset-x-8 top-6 h-full rounded-3xl bg-blue-200/40 border border-blue-200/60 card-3d-layer-back hidden sm:block"
              style={{ transform: "translateZ(-60px) rotateX(8deg) rotateY(-10deg) scale(0.96)" }}
              aria-hidden
            />
            <div
              className="absolute inset-x-3 sm:inset-x-4 top-3 h-full rounded-3xl bg-white/60 border border-white/80 card-3d-layer-back hidden sm:block"
              style={{ transform: "translateZ(-30px) rotateX(8deg) rotateY(-10deg) scale(0.98)" }}
              aria-hidden
            />
          </>
        )}

        <div
          className="relative transition-transform duration-300 ease-out will-change-transform"
          style={{ transform }}
        >
          <div className="card-3d-depth rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white overflow-hidden">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-slate-50 to-blue-50/50 min-w-0">
              <div className="flex gap-1 shrink-0">
                <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-red-300 shadow-sm" />
                <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-300 shadow-sm" />
                <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-300 shadow-sm" />
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 ml-1 sm:ml-2 font-mono truncate min-w-0">
                synentrixflow.com / pipeline
              </span>
            </div>
            <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-b from-white to-blue-50/30">
              {children}
            </div>
          </div>

          <div
            className="absolute -bottom-6 sm:-bottom-8 left-[8%] right-[8%] h-6 sm:h-8 rounded-[100%] bg-blue-600/15 blur-2xl pointer-events-none"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
