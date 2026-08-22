"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  PageHeader,
  Panel,
  ProTable,
  Th,
  Td,
  BtnPrimary,
  EmptyState,
  PageLoader,
  FetchError,
} from "@/components/ui/dashboard-ui";
import { FilterBar } from "@/components/ui/filter-bar";
import { ExcelImportToolbar } from "@/components/ui/excel-import-toolbar";

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  account?: { name: string } | null;
};

export default function ContactsPage() {
  const auth = useAuth();
  const canImport = auth.hasPermission("import");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      setContacts(await apiFetch<Contact[]>("/api/contacts"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts().catch(console.error);
  }, []);

  const accounts = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.account?.name && set.add(c.account.name));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (accountFilter && c.account?.name !== accountFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        `${c.firstName} ${c.lastName || ""}`.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.title || "").toLowerCase().includes(q) ||
        (c.account?.name || "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, accountFilter]);

  if (loading) return <PageLoader />;
  if (error) return <FetchError message={error} onRetry={() => loadContacts().catch(console.error)} />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Operations"
        title="Contacts"
        description="People you sell to across accounts"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExcelImportToolbar
              apiBase="/api/contacts"
              entityLabel="Contacts"
              canImport={canImport}
              onImported={loadContacts}
            />
            <BtnPrimary href="/dashboard/contacts/new">
              <Plus className="h-4 w-4" /> Add contact
            </BtnPrimary>
          </div>
        }
      />

      <FilterBar
        className="mb-4"
        showClear={!!(search || accountFilter)}
        onClear={() => {
          setSearch("");
          setAccountFilter("");
        }}
        fields={[
          {
            type: "search",
            key: "search",
            label: "Search",
            placeholder: "Name, email, phone, title...",
            value: search,
            onChange: setSearch,
            className: "flex-1 min-w-0 w-full sm:min-w-[220px]",
          },
          ...(accounts.length > 0
            ? [{
                type: "select" as const,
                key: "account",
                label: "Account",
                placeholder: "All accounts",
                value: accountFilter,
                onChange: setAccountFilter,
                options: accounts.map((a) => ({ value: a, label: a })),
              }]
            : []),
        ]}
      />

      <Panel title={`${filtered.length} contacts`} noPadding>
        {filtered.length === 0 ? (
          <EmptyState title="No contacts found" description="Add a contact or adjust your filters" />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Account</Th>
                <Th>Title</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td className="font-medium">
                    <TenantLink href={`/dashboard/contacts/${c.id}`} className="text-slate-900 hover:text-blue-600 hover:underline">
                      {c.firstName} {c.lastName}
                    </TenantLink>
                  </Td>
                  <Td className="max-w-[140px] truncate" title={c.account?.name || undefined}>{c.account?.name || "—"}</Td>
                  <Td className="max-w-[120px] truncate">{c.title || "—"}</Td>
                  <Td className="max-w-[160px] truncate" title={c.email || undefined}>{c.email || "—"}</Td>
                  <Td className="max-w-[120px] truncate">{c.phone || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </Panel>
    </div>
  );
}
