"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantPath } from "@/lib/use-tenant-path";
import { Building2, MapPin } from "lucide-react";
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
import { Input, Textarea } from "@/components/ui/input";

export default function NewAccountPage() {
  const router = useRouter();
  const tp = useTenantPath();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const account = await apiFetch<{ id: string }>("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          industry: fd.get("industry") || undefined,
          website: fd.get("website") || undefined,
          phone: fd.get("phone") || undefined,
          city: fd.get("city") || undefined,
          state: fd.get("state") || undefined,
          notes: fd.get("notes") || undefined,
        }),
      });
      router.push(tp(`/dashboard/accounts/${account.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create account");
      setLoading(false);
    }
  }

  return (
    <FormPage
      backHref="/dashboard/accounts"
      backLabel="Back to accounts"
      title="Add account"
      description="Organize companies you sell to — link contacts and deals under each account."
      badge="Accounts"
      aside={
        <FormAside title="Quick tips">
          <FormTipList
            items={[
              "Use the legal or trading name your team recognizes.",
              "Industry and location help segment reports and assignments.",
              "Accounts group multiple contacts and open deals in one place.",
            ]}
          />
          <FormAsideLinks
            links={[
              { href: "/dashboard/contacts/new", label: "Add contact", sub: "People at this company" },
              { href: "/dashboard/deals/new", label: "Create deal", sub: "Start an opportunity" },
            ]}
          />
        </FormAside>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormShell>
          <FormSection title="Company" icon={Building2} compact>
            <FormGrid cols={2}>
              <FormField label="Company name" required span="full">
                <Input name="name" required placeholder="Acme Industries Pvt Ltd" />
              </FormField>
              <FormField label="Industry">
                <Input name="industry" placeholder="Manufacturing, IT, Retail…" />
              </FormField>
              <FormField label="Website">
                <Input name="website" placeholder="https://example.com" />
              </FormField>
              <FormField label="Phone">
                <Input name="phone" type="tel" placeholder="Board line or main office" />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormSection title="Location & notes" icon={MapPin} compact>
            <FormGrid cols={3}>
              <FormField label="City">
                <Input name="city" />
              </FormField>
              <FormField label="State">
                <Input name="state" />
              </FormField>
              <FormField label="Notes" span="full">
                <Textarea name="notes" rows={3} placeholder="Key accounts, payment terms, decision makers…" />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormActions error={error} sticky>
            <FormSubmitButton loading={loading}>Create account</FormSubmitButton>
            <FormCancelButton href="/dashboard/accounts" />
          </FormActions>
        </FormShell>
      </form>
    </FormPage>
  );
}
