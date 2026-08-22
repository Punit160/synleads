"use client";

import { useEffect, useState } from "react";
import { TenantLink } from "@/components/ui/tenant-link";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ExcelImportToolbar } from "@/components/ui/excel-import-toolbar";
import {
  PageHeader,
  Panel,
  BtnPrimary,
  PageLoader,
  FetchError,
  EmptyState,
} from "@/components/ui/dashboard-ui";

type Account = {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  _count?: { contacts: number; deals: number };
};

export default function AccountsPage() {
  const auth = useAuth();
  const canImport = auth.hasPermission("import");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAccounts() {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await apiFetch<Account[]>("/api/accounts"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts().catch(console.error);
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <FetchError message={error} onRetry={() => loadAccounts().catch(console.error)} />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Operations"
        title="Accounts"
        description="Companies and organizations you sell to"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExcelImportToolbar
              apiBase="/api/accounts"
              entityLabel="Accounts"
              canImport={canImport}
              onImported={loadAccounts}
            />
            <BtnPrimary href="/dashboard/accounts/new">
              <Plus className="h-4 w-4" /> Add account
            </BtnPrimary>
          </div>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Add your first company or organization to link contacts and deals."
          action={<BtnPrimary href="/dashboard/accounts/new">Add account</BtnPrimary>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <TenantLink key={a.id} href={`/dashboard/accounts/${a.id}`}>
              <Panel title={a.name} subtitle={[a.industry, [a.city, a.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "India"}>
                <div className="flex gap-4 text-xs text-slate-600">
                  <span>{a._count?.contacts ?? 0} contacts</span>
                  <span>{a._count?.deals ?? 0} deals</span>
                </div>
              </Panel>
            </TenantLink>
          ))}
        </div>
      )}
    </div>
  );
}
