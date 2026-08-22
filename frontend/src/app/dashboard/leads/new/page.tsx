"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantPath } from "@/lib/use-tenant-path";
import { apiFetch, ApiError } from "@/lib/api";
import { LeadForm, type LeadFormData } from "@/components/leads/lead-form";
import { FormPage, FormAside, FormTipList, FormAsideLinks } from "@/components/ui/form-page";

export default function NewLeadPage() {
  const router = useRouter();
  const tp = useTenantPath();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{ leadNumber: string; firstName: string }>>([]);

  async function handleSubmit(data: LeadFormData) {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ lead: { id: string }; possibleDuplicates: Array<{ leadNumber: string; firstName: string }> }>(
        "/api/leads",
        { method: "POST", body: JSON.stringify(data) }
      );
      if (result.possibleDuplicates?.length > 0) {
        setDuplicates(result.possibleDuplicates);
        setLoading(false);
        return;
      }
      router.push(tp(`/dashboard/leads/${result.lead.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create lead");
      setLoading(false);
    }
  }

  return (
    <FormPage
      backHref="/dashboard/leads"
      backLabel="Back to leads"
      title="Add new lead"
      description="Capture prospect details — scoring and workflows run automatically after save."
      badge="Leads"
      maxWidth="full"
      aside={
        <FormAside title="Quick tips">
          <FormTipList
            items={[
              "Mobile and email enable duplicate detection on save.",
              "Source and status drive funnel charts on the dashboard.",
              "Budget and expected close date improve forecast accuracy.",
            ]}
          />
          <FormAsideLinks
            links={[
              { href: "/dashboard/pipeline", label: "Pipeline", sub: "View open deals" },
              { href: "/dashboard/activities/new", label: "Log activity", sub: "Schedule follow-up" },
            ]}
          />
        </FormAside>
      }
    >
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
          <strong>Possible duplicates:</strong> {duplicates.map((d) => d.leadNumber).join(", ")}
        </div>
      )}
      <LeadForm onSubmit={handleSubmit} loading={loading} error={error} submitLabel="Create lead" />
    </FormPage>
  );
}
