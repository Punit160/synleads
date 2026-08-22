"use client";

import { useTenantPath } from "@/lib/use-tenant-path";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { ArrowLeft, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  account?: { id: string; name: string } | null;
  deals: Array<{ id: string; name: string; amount: number; stage: { name: string } }>;
};

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const auth = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);

  useEffect(() => {
    apiFetch<Contact>(`/api/contacts/${id}`).then(setContact).catch(() => router.push(tp("/dashboard/contacts")));
  }, [id, router]);

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <TenantLink href="/dashboard/contacts" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to contacts
      </TenantLink>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{contact.firstName} {contact.lastName}</h1>
          <p className="text-sm text-slate-500">{contact.title || "Contact"} {contact.account && `· ${contact.account.name}`}</p>
        </div>
        {auth.hasPermission("edit") && (
          <TenantLink href={`/dashboard/contacts/${id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Pencil className="h-4 w-4" /> Edit
          </TenantLink>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Details" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Email" value={contact.email} />
            <Row label="Phone" value={contact.phone} />
            {contact.account && (
              <div className="flex justify-between gap-4 pt-2">
                <span className="text-slate-500">Account</span>
                <TenantLink href={`/dashboard/accounts/${contact.account.id}`} className="text-violet-600 font-medium">
                  {contact.account.name}
                </TenantLink>
              </div>
            )}
            {contact.notes && <p className="text-slate-600 pt-2 border-t">{contact.notes}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Open deals" />
          <CardBody className="p-0">
            {contact.deals.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No deals linked</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {contact.deals.map((d) => (
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
