"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

export function TiltCard({ children, className, intensity = 12 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("rotateX(0deg) rotateY(0deg)");
  const [tiltEnabled, setTiltEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setTiltEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    if (!tiltEnabled) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(
      `rotateX(${-y * intensity}deg) rotateY(${x * intensity}deg) translateZ(8px)`
    );
  }

  function handleLeave() {
    setTransform("rotateX(0deg) rotateY(0deg) translateZ(0px)");
  }

  return (
    <div className={cn("scene-3d w-full", className)} style={{ perspective: "900px" }}>
      <div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className="preserve-3d w-full transition-transform duration-200 ease-out will-change-transform"
        style={{ transform }}
      >
        {children}
      </div>
    </div>
  );
}
