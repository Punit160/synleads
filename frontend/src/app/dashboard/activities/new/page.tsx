"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantPath } from "@/lib/use-tenant-path";
import { CalendarClock } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { ACTIVITY_TYPES } from "@/lib/lead-constants";
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

export default function NewActivityPage() {
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
      await apiFetch("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          type: fd.get("type"),
          subject: fd.get("subject"),
          description: fd.get("description") || undefined,
          dueDate: fd.get("dueDate") || null,
        }),
      });
      router.push(tp("/dashboard/activities"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create activity");
      setLoading(false);
    }
  }

  return (
    <FormPage
      backHref="/dashboard/activities"
      backLabel="Back to activities"
      title="Log activity"
      description="Record calls, meetings, and tasks — they appear on the dashboard agenda and lead timeline."
      badge="Activities"
      aside={
        <FormAside title="Quick tips">
          <FormTipList
            items={[
              "Use a clear subject so your team knows what happened at a glance.",
              "Set a due date for follow-ups — they show on Today's Agenda.",
              "Activities sync to the lead timeline when linked to a prospect.",
            ]}
          />
          <FormAsideLinks
            links={[
              { href: "/dashboard/leads", label: "View leads", sub: "Pick a lead to log against" },
              { href: "/dashboard/follow-ups", label: "Follow-ups", sub: "Due reminders" },
            ]}
          />
        </FormAside>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormShell>
          <FormSection title="Activity details" icon={CalendarClock} compact>
            <FormGrid cols={3}>
              <FormField label="Type" required>
                <Select name="type" required defaultValue="call">
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Due date">
                <Input name="dueDate" type="date" />
              </FormField>
              <FormField label="Subject" required span="full">
                <Input name="subject" required placeholder="Follow up with prospect on pricing" />
              </FormField>
              <FormField label="Description" span="full">
                <Textarea name="description" rows={4} placeholder="Notes from the call, next steps, objections…" />
              </FormField>
            </FormGrid>
          </FormSection>
          <FormActions error={error} sticky>
            <FormSubmitButton loading={loading}>Create activity</FormSubmitButton>
            <FormCancelButton href="/dashboard/activities" />
          </FormActions>
        </FormShell>
      </form>
    </FormPage>
  );
}
