"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-500 mb-6">
          We hit an unexpected error. Try again or return to the home page.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button type="button" onClick={reset} className="auth-btn-primary text-sm px-5 py-2.5">
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
