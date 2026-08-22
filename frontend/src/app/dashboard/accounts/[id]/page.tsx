"use client";

import { useTenantPath } from "@/lib/use-tenant-path";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { ArrowLeft, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, formatCurrency } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Account = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
  contacts: Array<{ id: string; firstName: string; lastName: string | null; title: string | null }>;
  deals: Array<{ id: string; name: string; amount: number; stage: { name: string } }>;
};

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const auth = useAuth();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    apiFetch<Account>(`/api/accounts/${id}`).then(setAccount).catch(() => router.push(tp("/dashboard/accounts")));
  }, [id, router]);

  if (!account) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <TenantLink href="/dashboard/accounts" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to accounts
      </TenantLink>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
          <p className="text-sm text-slate-500">
            {[account.industry, account.city, account.state, account.country].filter(Boolean).join(" · ")}
          </p>
        </div>
        {auth.hasPermission("edit") && (
          <TenantLink href={`/dashboard/accounts/${id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Pencil className="h-4 w-4" /> Edit
          </TenantLink>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Company info" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Website" value={account.website} />
            <Row label="Phone" value={account.phone} />
            {account.notes && <p className="text-slate-600 pt-2 border-t">{account.notes}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={`Contacts (${account.contacts.length})`} />
          <CardBody className="p-0">
            {account.contacts.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No contacts</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {account.contacts.map((c) => (
                  <li key={c.id}>
                    <TenantLink href={`/dashboard/contacts/${c.id}`} className="block px-5 py-3 hover:bg-slate-50">
                      <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-slate-500">{c.title || "—"}</p>
                    </TenantLink>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader title={`Deals (${account.deals.length})`} />
          <CardBody className="p-0">
            {account.deals.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No deals</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {account.deals.map((d) => (
                  <li key={d.id}>
                    <TenantLink href={`/dashboard/deals/${d.id}`} className="px-5 py-3 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <Badge variant="open">{d.stage.name}</Badge>
                      </div>
                      <span className="text-sm font-bold text-violet-600">{formatCurrency(d.amount)}</span>
                    </TenantLink>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value || "—"}</span>
    </div>
  );
}
