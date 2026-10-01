"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTenantPath } from "@/lib/use-tenant-path";
import { User, Phone } from "lucide-react";
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

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
};

export default function EditContactPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Contact>(`/api/contacts/${id}`).then(setContact).catch(() => router.push(tp("/dashboard/contacts")));
  }, [id, router, tp]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/api/contacts/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: fd.get("firstName"),
          lastName: fd.get("lastName") || undefined,
          email: fd.get("email") || undefined,
          phone: fd.get("phone") || undefined,
          title: fd.get("title") || undefined,
          notes: fd.get("notes") || undefined,
        }),
      });
      router.push(tp(`/dashboard/contacts/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update contact");
      setLoading(false);
    }
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <FormPage
      backHref={`/dashboard/contacts/${id}`}
      backLabel="Back to contact"
      title="Edit contact"
      description={`${contact.firstName} ${contact.lastName || ""}`.trim()}
      badge="Contacts"
      aside={
        <FormAside title="Editing tips">
          <FormTipList
            items={[
              "Updated email and phone sync across linked leads.",
              "Notes are visible to your team on the contact profile.",
            ]}
          />
        </FormAside>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormShell>
          <FormSection title="Contact details" icon={User} compact>
            <FormGrid cols={3}>
              <FormField label="First name" required>
                <Input name="firstName" required defaultValue={contact.firstName} />
              </FormField>
              <FormField label="Last name">
                <Input name="lastName" defaultValue={contact.lastName || ""} />
              </FormField>
              <FormField label="Job title">
                <Input name="title" defaultValue={contact.title || ""} />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormSection title="Reach" icon={Phone} compact>
            <FormGrid cols={2}>
              <FormField label="Email">
                <Input name="email" type="email" defaultValue={contact.email || ""} />
              </FormField>
              <FormField label="Phone">
                <Input name="phone" defaultValue={contact.phone || ""} />
              </FormField>
              <FormField label="Notes" span="full">
                <Textarea name="notes" defaultValue={contact.notes || ""} rows={3} />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormActions error={error} sticky>
            <FormSubmitButton loading={loading}>Save changes</FormSubmitButton>
            <FormCancelButton href={`/dashboard/contacts/${id}`} />
          </FormActions>
        </FormShell>
      </form>
    </FormPage>
  );
}
