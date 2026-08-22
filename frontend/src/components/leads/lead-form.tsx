"use client";

import { useEffect, useState } from "react";
import { User, MapPin, Briefcase, ListFilter } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  LEAD_STATUS_LABELS,
} from "@/lib/lead-constants";
import {
  FormShell,
  FormSection,
  FormGrid,
  FormField,
  FormActions,
  FormSubmitButton,
  FormRow,
} from "@/components/ui/form-page";
import { Input, Textarea, Select } from "@/components/ui/input";

export type LeadFormData = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  company?: string;
  title?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  industry?: string;
  website?: string;
  source?: string;
  status?: string;
  priority?: string;
  budget?: number | null;
  requirement?: string;
  expectedClosingDate?: string;
  remarks?: string;
  score?: number;
  notes?: string;
  customFields?: Record<string, string>;
};

type CustomFieldDef = {
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
};

type LeadFormProps = {
  initial?: Partial<LeadFormData> & { leadNumber?: string; customFields?: Record<string, string> };
  leadId?: string;
  onSubmit: (data: LeadFormData) => Promise<void>;
  loading?: boolean;
  error?: string;
  submitLabel?: string;
};

export function LeadForm({ initial, onSubmit, loading, error, submitLabel = "Save Lead" }: LeadFormProps) {
  const [customDefs, setCustomDefs] = useState<CustomFieldDef[]>([]);

  useEffect(() => {
    apiFetch<CustomFieldDef[]>("/api/custom-fields/definitions?entityType=lead")
      .then(setCustomDefs)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const customFields: Record<string, string> = {};
    for (const def of customDefs) {
      const v = fd.get(`cf_${def.key}`);
      customFields[def.key] = v != null ? String(v) : "";
    }
    await onSubmit({
      firstName: fd.get("firstName") as string,
      lastName: (fd.get("lastName") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
      alternatePhone: (fd.get("alternatePhone") as string) || undefined,
      company: (fd.get("company") as string) || undefined,
      title: (fd.get("title") as string) || undefined,
      address: (fd.get("address") as string) || undefined,
      city: (fd.get("city") as string) || undefined,
      state: (fd.get("state") as string) || undefined,
      country: (fd.get("country") as string) || undefined,
      pinCode: (fd.get("pinCode") as string) || undefined,
      industry: (fd.get("industry") as string) || undefined,
      website: (fd.get("website") as string) || undefined,
      source: (fd.get("source") as string) || undefined,
      status: (fd.get("status") as string) || undefined,
      priority: (fd.get("priority") as string) || undefined,
      budget: fd.get("budget") ? Number(fd.get("budget")) : null,
      requirement: (fd.get("requirement") as string) || undefined,
      expectedClosingDate: (fd.get("expectedClosingDate") as string) || undefined,
      remarks: (fd.get("remarks") as string) || undefined,
      score: Number(fd.get("score") || 0),
      notes: (fd.get("notes") as string) || undefined,
      ...(customDefs.length > 0 ? { customFields } : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormShell>
        {initial?.leadNumber && (
          <FormSection title="Lead reference" icon={Briefcase}>
            <FormField label="Lead ID">
              <Input readOnly value={initial.leadNumber} />
            </FormField>
          </FormSection>
        )}

        <FormSection title="Customer information" description="Primary contact and company details" icon={User} compact>
          <FormGrid cols={4}>
            <FormField label="Customer name" required>
              <Input name="firstName" required defaultValue={initial?.firstName} placeholder="First name" />
            </FormField>
            <FormField label="Last name">
              <Input name="lastName" defaultValue={initial?.lastName} />
            </FormField>
            <FormField label="Company">
              <Input name="company" defaultValue={initial?.company} />
            </FormField>
            <FormField label="Job title">
              <Input name="title" defaultValue={initial?.title} />
            </FormField>
            <FormField label="Mobile">
              <Input name="phone" type="tel" defaultValue={initial?.phone} />
            </FormField>
            <FormField label="Alternate number">
              <Input name="alternatePhone" type="tel" defaultValue={initial?.alternatePhone} />
            </FormField>
            <FormField label="Email">
              <Input name="email" type="email" defaultValue={initial?.email} />
            </FormField>
            <FormField label="Website">
              <Input name="website" defaultValue={initial?.website} placeholder="https://" />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormRow>
          <FormSection title="Address" icon={MapPin} compact>
            <FormGrid cols={1}>
              <FormField label="Street address">
                <Textarea name="address" defaultValue={initial?.address} rows={2} />
              </FormField>
            </FormGrid>
            <FormGrid cols={2} className="mt-4">
              <FormField label="City">
                <Input name="city" defaultValue={initial?.city} />
              </FormField>
              <FormField label="State">
                <Input name="state" defaultValue={initial?.state} />
              </FormField>
              <FormField label="Country">
                <Input name="country" defaultValue={initial?.country || "India"} />
              </FormField>
              <FormField label="PIN code">
                <Input name="pinCode" defaultValue={initial?.pinCode} />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Lead details" description="Source, status, budget" icon={Briefcase} compact>
            <FormGrid cols={2}>
              <FormField label="Industry">
                <Input name="industry" defaultValue={initial?.industry} />
              </FormField>
              <FormField label="Lead source">
                <Select name="source" defaultValue={initial?.source || "Manual Entry"}>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>
              <FormField label="Status">
                <Select name="status" defaultValue={initial?.status || "new"}>
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
                </Select>
              </FormField>
              <FormField label="Priority">
                <Select name="priority" defaultValue={initial?.priority || "medium"}>
                  {LEAD_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </Select>
              </FormField>
              <FormField label="Budget (₹)">
                <Input name="budget" type="number" min={0} defaultValue={initial?.budget ?? ""} />
              </FormField>
              <FormField label="Lead score" hint="Auto-calculated when scoring rules are enabled">
                <Input name="score" type="number" min={0} max={100} defaultValue={initial?.score ?? 0} />
              </FormField>
              <FormField label="Expected closing date" span="full">
                <Input name="expectedClosingDate" type="date" defaultValue={initial?.expectedClosingDate?.slice(0, 10)} />
              </FormField>
            </FormGrid>
          </FormSection>
        </FormRow>

        <FormSection title="Requirements & notes" compact>
          <FormGrid cols={3}>
            <FormField label="Requirement">
              <Textarea name="requirement" defaultValue={initial?.requirement} rows={3} />
            </FormField>
            <FormField label="Remarks">
              <Textarea name="remarks" defaultValue={initial?.remarks} rows={3} />
            </FormField>
            <FormField label="Internal notes">
              <Textarea name="notes" defaultValue={initial?.notes} rows={3} />
            </FormField>
          </FormGrid>
        </FormSection>

        {customDefs.length > 0 && (
          <FormSection title="Custom fields" icon={ListFilter}>
            <FormGrid>
              {customDefs.map((def) => (
                <FormField key={def.key} label={def.label} required={def.required}>
                  {def.fieldType === "select" ? (
                    <Select name={`cf_${def.key}`} required={def.required} defaultValue={initial?.customFields?.[def.key] ?? ""}>
                      <option value="">—</option>
                      {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  ) : def.fieldType === "boolean" ? (
                    <Select name={`cf_${def.key}`} defaultValue={initial?.customFields?.[def.key] ?? ""}>
                      <option value="">—</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </Select>
                  ) : (
                    <Input
                      name={`cf_${def.key}`}
                      type={def.fieldType === "number" ? "number" : def.fieldType === "date" ? "date" : "text"}
                      required={def.required}
                      defaultValue={initial?.customFields?.[def.key] ?? ""}
                    />
                  )}
                </FormField>
              ))}
            </FormGrid>
          </FormSection>
        )}

        <FormActions error={error} sticky>
          <FormSubmitButton loading={loading}>{submitLabel}</FormSubmitButton>
        </FormActions>
      </FormShell>
    </form>
  );
}
