"use client";

import { useTenantPath } from "@/lib/use-tenant-path";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, FileText, ListOrdered } from "lucide-react";
import { apiFetch, formatCurrency } from "@/lib/api";
import { calcQuoteTotals, calcLineNet, calcLineTotalWithTax } from "@/lib/quotation-math";
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
import { Input, Textarea, Select } from "@/components/ui/input";

type LineItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
};

type Lead = { id: string; leadNumber: string; firstName: string; lastName: string | null; company: string | null };

let nextLineItemId = 0;
const emptyItem = (): LineItem => ({
  id: String(++nextLineItemId),
  name: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 18,
  discount: 0,
});

function parseNum(value: string, fallback = 0): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const tp = useTenantPath();
  const searchParams = useSearchParams();
  const presetLeadId = searchParams.get("leadId") || "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState(presetLeadId);
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Lead[]>("/api/leads").then((list) => {
      setLeads(list);
      if (presetLeadId && list.some((l) => l.id === presetLeadId)) {
        setLeadId(presetLeadId);
      }
    }).catch(console.error);
  }, [presetLeadId]);

  const totals = calcQuoteTotals(items, discount);

  function updateItem(id: string, field: keyof Omit<LineItem, "id">, value: string | number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      setError("Add at least one line item with a name");
      return;
    }
    setSaving(true);
    try {
      await apiFetch<{ id: string }>("/api/quotations", {
        method: "POST",
        body: JSON.stringify({
          leadId: leadId || null,
          taxRate: 0,
          discount,
          validUntil: validUntil || null,
          notes: notes || undefined,
          items: validItems.map(({ id: _id, ...item }) => item),
        }),
      });
      router.push(tp("/dashboard/quotations"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quotation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormPage
      backHref="/dashboard/quotations"
      backLabel="Back to quotations"
      title="New quotation"
      description="Line totals use each row's tax rate. Global discount applies before GST."
      badge="Quotations"
      maxWidth="full"
      aside={
        <>
          <div className="form-aside-card mb-4">
            <div className="form-aside-head">
              <span className="font-bold text-slate-800">Quote total</span>
            </div>
            <div className="form-aside-body space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.globalDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({discount}%)</span>
                  <span className="font-semibold tabular-nums">−{formatCurrency(totals.globalDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>GST</span>
                <span className="font-semibold tabular-nums">{formatCurrency(totals.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-indigo-700 pt-2 border-t border-slate-200">
                <span>Grand total</span>
                <span className="tabular-nums">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
          <FormAside title="Quick tips">
            <FormTipList
              items={[
                "Select a lead to pre-fill customer on the PDF.",
                "Per-line GST rates support mixed tax items.",
                "Valid-until date prints on the quotation document.",
              ]}
            />
          </FormAside>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormShell>
          <FormSection title="Customer & details" icon={FileText} compact>
            <FormGrid cols={3}>
              <FormField label="Customer (lead)" span={2}>
                <Select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                  <option value="">Select customer</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.leadNumber} — {l.firstName} {l.lastName} {l.company ? `(${l.company})` : ""}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Valid until">
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </FormField>
              <FormField label="Global discount (%)" >
                <Input type="number" min={0} max={100} step={0.01} value={discount} onChange={(e) => setDiscount(parseNum(e.target.value))} />
              </FormField>
              <FormField label="Notes" span="full">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Terms, conditions, or internal notes" />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Line items"
            icon={ListOrdered}
            compact
            description="Add products or services — totals update live in the sidebar"
          >
            <div className="space-y-3">
              <div className="hidden lg:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1">
                <div className="col-span-4">Item</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Unit price</div>
                <div className="col-span-1">GST %</div>
                <div className="col-span-1">Disc %</div>
                <div className="col-span-2">Line total</div>
                <div className="col-span-1" />
              </div>
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end rounded-lg border border-slate-100 bg-slate-50/50 p-2 lg:p-0 lg:border-0 lg:bg-transparent">
                  <div className="col-span-12 lg:col-span-4">
                    {idx === 0 && <label className="form-field-label lg:hidden">Item</label>}
                    <Input className="text-sm" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} placeholder="Product / service" />
                  </div>
                  <div className="col-span-4 lg:col-span-1">
                    {idx === 0 && <label className="form-field-label lg:hidden">Qty</label>}
                    <Input type="number" min="0.01" step="0.01" className="text-sm" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", parseNum(e.target.value, 1))} />
                  </div>
                  <div className="col-span-4 lg:col-span-2">
                    {idx === 0 && <label className="form-field-label lg:hidden">Unit price</label>}
                    <Input type="number" min="0" step="0.01" className="text-sm" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", parseNum(e.target.value))} />
                  </div>
                  <div className="col-span-4 lg:col-span-1">
                    {idx === 0 && <label className="form-field-label lg:hidden">GST</label>}
                    <Input type="number" min="0" step="0.01" className="text-sm" value={item.taxRate} onChange={(e) => updateItem(item.id, "taxRate", parseNum(e.target.value, 18))} />
                  </div>
                  <div className="col-span-4 lg:col-span-1">
                    {idx === 0 && <label className="form-field-label lg:hidden">Disc</label>}
                    <Input type="number" min="0" max="100" step="0.01" className="text-sm" value={item.discount} onChange={(e) => updateItem(item.id, "discount", parseNum(e.target.value))} />
                  </div>
                  <div className="col-span-8 lg:col-span-2">
                    {idx === 0 && <label className="form-field-label lg:hidden">Total</label>}
                    <p className="text-sm font-bold text-slate-900 tabular-nums py-2">{formatCurrency(calcLineTotalWithTax(item, discount, items))}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums -mt-1">Net {formatCurrency(calcLineNet(item))}</p>
                  </div>
                  <div className="col-span-4 lg:col-span-1 flex items-end justify-end">
                    <button type="button" onClick={() => removeItem(item.id)} disabled={items.length <= 1} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addItem} className="form-btn-secondary !inline-flex text-xs mt-2">
                <Plus className="h-3.5 w-3.5" /> Add row
              </button>
            </div>
          </FormSection>

          <FormActions error={error} sticky>
            <FormSubmitButton loading={saving}>Create quotation</FormSubmitButton>
            <FormCancelButton href="/dashboard/quotations" />
          </FormActions>
        </FormShell>
      </form>
    </FormPage>
  );
}
