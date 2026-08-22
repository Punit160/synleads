"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantPath } from "@/lib/use-tenant-path";
import { Handshake, Users } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import {
  FormPage,
  FormShell,
  FormSection,
  FormGrid,
  FormField,
  FormActions,
  FormSubmitButton,
  FormCancelButton,
  FormAside,
  FormTipList,
  FormAsideLinks,
} from "@/components/ui/form-page";
import { Input, Textarea, Select } from "@/components/ui/input";

type Stage = { id: string; name: string; isWon?: boolean; isLost?: boolean };
type Account = { id: string; name: string };
type Contact = { id: string; firstName: string; lastName: string | null };

export default function NewDealPage() {
  const router = useRouter();
  const tp = useTenantPath();
  const [stages, setStages] = useState<Stage[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Stage[]>("/api/workspace/stages"),
      apiFetch<Account[]>("/api/accounts"),
      apiFetch<Contact[]>("/api/contacts"),
    ]).then(([s, a, c]) => {
      setStages(s.filter((x) => !x.isWon && !x.isLost));
      setAccounts(a);
      setContacts(c);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          stageId: fd.get("stageId"),
          amount: Number(fd.get("amount") || 0),
          accountId: fd.get("accountId") || null,
          contactId: fd.get("contactId") || null,
          expectedCloseDate: fd.get("expectedCloseDate") || null,
          notes: fd.get("notes") || undefined,
        }),
      });
      router.push(tp("/dashboard/pipeline"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create deal");
      setLoading(false);
    }
  }

  return (
    <FormPage
      backHref="/dashboard/pipeline"
      backLabel="Back to pipeline"
      title="Create deal"
      description="Add an opportunity to your pipeline — amount and stage drive forecast and dashboard KPIs."
      badge="Pipeline"
      aside={
        <FormAside title="Quick tips">
          <FormTipList
            items={[
              "Use a descriptive deal name your team will recognize in reports.",
              "Amount and stage update weighted pipeline on the dashboard.",
              "Link an account and contact for a complete customer view.",
            ]}
          />
          <FormAsideLinks
            links={[
              { href: "/dashboard/accounts/new", label: "Add account", sub: "New company" },
              { href: "/dashboard/leads/new", label: "Add lead", sub: "New prospect" },
            ]}
          />
        </FormAside>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormShell>
          <FormSection title="Deal overview" icon={Handshake} compact>
            <FormGrid cols={2}>
              <FormField label="Deal name" required span="full">
                <Input name="name" required placeholder="Enterprise CRM rollout — Acme" />
              </FormField>
              <FormField label="Stage" required>
                <Select name="stageId" required defaultValue={stages[0]?.id}>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Amount (₹)">
                <Input name="amount" type="number" min={0} defaultValue={0} />
              </FormField>
              <FormField label="Expected close date">
                <Input name="expectedCloseDate" type="date" />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormSection title="Related records" icon={Users} compact>
            <FormGrid cols={2}>
              <FormField label="Account">
                <Select name="accountId" defaultValue="">
                  <option value="">None</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Contact">
                <Select name="contactId" defaultValue="">
                  <option value="">None</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Notes" span="full">
                <Textarea name="notes" rows={3} placeholder="Scope, competitors, decision timeline…" />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormActions error={error} sticky>
            <FormSubmitButton loading={loading}>Create deal</FormSubmitButton>
            <FormCancelButton href="/dashboard/pipeline" />
          </FormActions>
        </FormShell>
      </form>
    </FormPage>
  );
}
