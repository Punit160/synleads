"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  FormAsideLinks,
} from "@/components/ui/form-page";
import { Input, Textarea } from "@/components/ui/input";

export default function NewContactPage() {
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
      const contact = await apiFetch<{ id: string }>("/api/contacts", {
        method: "POST",
        body: JSON.stringify({
          firstName: fd.get("firstName"),
          lastName: fd.get("lastName") || undefined,
          email: fd.get("email") || undefined,
          phone: fd.get("phone") || undefined,
          title: fd.get("title") || undefined,
          notes: fd.get("notes") || undefined,
        }),
      });
      router.push(tp(`/dashboard/contacts/${contact.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create contact");
      setLoading(false);
    }
  }

  return (
    <FormPage
      backHref="/dashboard/contacts"
      backLabel="Back to contacts"
      title="Add contact"
      description="Store people linked to accounts and deals."
      badge="Contacts"
      aside={
        <FormAside title="Quick tips">
          <FormTipList
            items={[
              "Link contacts to accounts for a complete company view.",
              "Add email and phone for quick outreach from lead records.",
              "Job title helps personalize follow-up messages.",
            ]}
          />
          <FormAsideLinks
            links={[
              { href: "/dashboard/accounts/new", label: "Add account", sub: "Create a company first" },
              { href: "/dashboard/leads/new", label: "Add lead", sub: "New prospect pipeline" },
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
                <Input name="firstName" required placeholder="Priya" />
              </FormField>
              <FormField label="Last name">
                <Input name="lastName" placeholder="Sharma" />
              </FormField>
              <FormField label="Job title">
                <Input name="title" placeholder="Sales Director" />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormSection title="Reach" icon={Phone} compact>
            <FormGrid cols={2}>
              <FormField label="Email">
                <Input name="email" type="email" placeholder="name@company.com" />
              </FormField>
              <FormField label="Phone">
                <Input name="phone" type="tel" placeholder="+91 98765 43210" />
              </FormField>
              <FormField label="Notes" span="full">
                <Textarea name="notes" rows={3} placeholder="Context, preferences, last conversation…" />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormActions error={error} sticky>
            <FormSubmitButton loading={loading}>Create contact</FormSubmitButton>
            <FormCancelButton href="/dashboard/contacts" />
          </FormActions>
        </FormShell>
      </form>
    </FormPage>
  );
}
