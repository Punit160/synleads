"use client";

import { useEffect } from "react";
import { BtnPrimary } from "@/components/ui/dashboard-ui";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.message.includes("Loading chunk") ||
    error.message.includes("ChunkLoadError") ||
    error.name === "ChunkLoadError";

  useEffect(() => {
    if (!isChunkError) return;
    const key = "dash-chunk-reload";
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      window.location.reload();
    }
  }, [isChunkError]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-2xl">
        {isChunkError ? "↻" : "!"}
      </div>
      <h1 className="text-lg font-semibold text-slate-900">
        {isChunkError ? "App updated — refresh needed" : "Something went wrong"}
      </h1>
      <p className="text-sm text-slate-500 mt-2 max-w-md">
        {isChunkError
          ? "The dashboard loaded an outdated script bundle. This usually happens after a code update while the dev server is running."
          : error.message || "An unexpected error occurred loading this page."}
      </p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        <BtnPrimary
          onClick={() => {
            sessionStorage.removeItem("dash-chunk-reload");
            window.location.reload();
          }}
        >
          Reload page
        </BtnPrimary>
        {!isChunkError && (
          <button type="button" onClick={reset} className="pro-btn-secondary text-sm">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
