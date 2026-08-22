"use client";

import { useEffect, useState } from "react";
import { TenantLink } from "@/components/ui/tenant-link";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  PageHeader,
  Panel,
  ProTable,
  Th,
  Td,
  PageLoader,
  EmptyState,
} from "@/components/ui/dashboard-ui";
import { SearchInput } from "@/components/ui/search-input";
import { ExcelImportToolbar } from "@/components/ui/excel-import-toolbar";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  convertedAt: string;
  _count: { orders: number; invoices: number; payments: number; serviceHistory: number };
};

export default function CustomersPage() {
  const auth = useAuth();
  const canImport = auth.hasPermission("import");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const url = debounced ? `/api/customers?q=${encodeURIComponent(debounced)}` : "/api/customers";
    apiFetch<Customer[]>(url)
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debounced]);

  async function reloadCustomers() {
    const url = debounced ? `/api/customers?q=${encodeURIComponent(debounced)}` : "/api/customers";
    setCustomers(await apiFetch<Customer[]>(url));
  }

  if (loading && customers.length === 0) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="CRM"
        title="Customers"
        description="Converted leads and active customer accounts"
        action={
          <ExcelImportToolbar
            apiBase="/api/customers"
            entityLabel="Customers"
            canImport={canImport}
            onImported={reloadCustomers}
          />
        }
      />

      <Panel
        title={`${customers.length} customers`}
        action={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search customers…"
            className="w-full sm:w-[260px]"
            size="compact"
          />
        }
        noPadding
      >
        {customers.length === 0 ? (
          <EmptyState title="No customers found" description="Convert a lead to create a customer record" />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Company</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Invoices</Th>
                <Th>Converted</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <TenantLink href={`/dashboard/customers/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.name}
                    </TenantLink>
                  </Td>
                  <Td>{c.company || "—"}</Td>
                  <Td>{c.email || "—"}</Td>
                  <Td>{c.phone || "—"}</Td>
                  <Td className="text-right font-semibold">{c._count.orders}</Td>
                  <Td className="text-right font-semibold">{c._count.invoices}</Td>
                  <Td className="tabular-nums">{formatDate(c.convertedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </Panel>
    </div>
  );
}
