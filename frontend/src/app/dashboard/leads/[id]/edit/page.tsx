"use client";

import { useTenantPath } from "@/lib/use-tenant-path";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { LeadForm, type LeadFormData } from "@/components/leads/lead-form";
import { FormPage, FormAside, FormTipList } from "@/components/ui/form-page";

export default function EditLeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const [initial, setInitial] = useState<Partial<LeadFormData> & { leadNumber?: string; customFields?: Record<string, string> }>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<LeadFormData & { leadNumber: string; expectedClosingDate?: string }>(`/api/leads/${id}`),
      apiFetch<Record<string, string>>(`/api/custom-fields/values/lead/${id}`).catch(() => ({})),
    ]).then(([lead, customFields]) =>
      setInitial({
        ...lead,
        expectedClosingDate: lead.expectedClosingDate || undefined,
        customFields,
      })
    ).catch(() => router.push(tp("/dashboard/leads")));
  }, [id, router, tp]);

  async function handleSubmit(data: LeadFormData) {
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(data) });
      router.push(tp(`/dashboard/leads/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update lead");
      setLoading(false);
    }
  }

  if (!initial) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <FormPage
      backHref={`/dashboard/leads/${id}`}
      backLabel="Back to lead"
      title="Edit lead"
      description={`Updating ${initial.leadNumber || "lead"} — changes sync to scoring and automation rules.`}
      badge={initial.leadNumber}
      maxWidth="full"
      aside={
        <FormAside title="Editing tips">
          <FormTipList
            items={[
              "Status changes appear in the lead funnel and timeline.",
              "Custom fields sync to reports when configured by admin.",
              "Save to refresh dashboard KPIs for this owner.",
            ]}
          />
        </FormAside>
      }
    >
      <LeadForm initial={initial} leadId={id} onSubmit={handleSubmit} loading={loading} error={error} submitLabel="Save changes" />
    </FormPage>
  );
}
