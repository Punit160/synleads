"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

export function ClientErrorReporter() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      const message = event.message || "Unknown client error";
      apiFetch("/api/errors/report", {
        method: "POST",
        body: JSON.stringify({
          message,
          stack: event.error?.stack,
          url: window.location.href,
          component: "window.onerror",
        }),
      }).catch(() => {});
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      apiFetch("/api/errors/report", {
        method: "POST",
        body: JSON.stringify({
          message: message.slice(0, 2000),
          stack: reason instanceof Error ? reason.stack : undefined,
          url: window.location.href,
          component: "unhandledrejection",
        }),
      }).catch(() => {});
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
