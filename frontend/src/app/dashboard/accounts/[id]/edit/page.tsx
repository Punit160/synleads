"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "@/components/ui/form-page";
import { Input, Textarea } from "@/components/ui/input";

type Account = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

export default function EditAccountPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Account>(`/api/accounts/${id}`).then(setAccount).catch(() => router.push(tp("/dashboard/accounts")));
  }, [id, router, tp]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/api/accounts/${id}`, {
        method: "PUT",
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
      router.push(tp(`/dashboard/accounts/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update account");
      setLoading(false);
    }
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <FormPage
      backHref={`/dashboard/accounts/${id}`}
      backLabel="Back to account"
      title="Edit account"
      description={account.name}
      badge="Accounts"
      aside={
        <FormAside title="Editing tips">
          <FormTipList
            items={[
              "Company name updates reflect on linked deals and contacts.",
              "Industry helps filter accounts in reports.",
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
                <Input name="name" required defaultValue={account.name} />
              </FormField>
              <FormField label="Industry">
                <Input name="industry" defaultValue={account.industry || ""} />
              </FormField>
              <FormField label="Website">
                <Input name="website" defaultValue={account.website || ""} />
              </FormField>
              <FormField label="Phone">
                <Input name="phone" defaultValue={account.phone || ""} />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormSection title="Location & notes" icon={MapPin} compact>
            <FormGrid cols={3}>
              <FormField label="City">
                <Input name="city" defaultValue={account.city || ""} />
              </FormField>
              <FormField label="State">
                <Input name="state" defaultValue={account.state || ""} />
              </FormField>
              <FormField label="Notes" span="full">
                <Textarea name="notes" defaultValue={account.notes || ""} rows={3} />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormActions error={error} sticky>
            <FormSubmitButton loading={loading}>Save changes</FormSubmitButton>
            <FormCancelButton href={`/dashboard/accounts/${id}`} />
          </FormActions>
        </FormShell>
      </form>
    </FormPage>
  );
}
