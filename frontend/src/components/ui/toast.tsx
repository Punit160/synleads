"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}>({
  toast: () => {},
  success: () => {},
  error: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-4), { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toast,
        success: (m) => toast(m, "success"),
        error: (m) => toast(m, "error"),
      }}
    >
      {children}
      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-lg border bg-white px-3 py-2.5 shadow-lg text-sm",
              t.tone === "success" && "border-emerald-200",
              t.tone === "error" && "border-red-200",
              t.tone === "info" && "border-slate-200"
            )}
          >
            {t.tone === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />}
            {t.tone === "error" && <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
            {t.tone === "info" && <Info className="h-4 w-4 text-brand mt-0.5 shrink-0" />}
            <p className="flex-1 text-slate-800">{t.message}</p>
            <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
