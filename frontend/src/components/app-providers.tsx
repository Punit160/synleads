"use client";

import { ClientErrorReporter } from "@/components/error-reporter";
import { ToastProvider } from "@/components/ui/toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ClientErrorReporter />
      {children}
    </ToastProvider>
  );
}
