"use client";

import { ClientErrorReporter } from "@/components/error-reporter";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClientErrorReporter />
      {children}
    </>
  );
}
