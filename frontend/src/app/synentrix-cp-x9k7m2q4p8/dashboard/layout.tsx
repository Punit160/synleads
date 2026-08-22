import { PlatformAuthProvider } from "@/lib/platform-auth-context";
import { PlatformShell } from "@/components/platform/platform-shell";

export default function PlatformDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAuthProvider>
      <PlatformShell>{children}</PlatformShell>
    </PlatformAuthProvider>
  );
}
