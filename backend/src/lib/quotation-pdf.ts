import fs from "fs";
import path from "path";
import type { Quotation, QuotationItem, Lead, Contact, Workspace } from "@prisma/client";
import { calcQuoteTotals } from "./quotation-math";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function fileToDataUrl(filePath: string | null | undefined): string | null {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
  const data = fs.readFileSync(filePath).toString("base64");
  return `data:${mime};base64,${data}`;
}

type QuoteWithRelations = Quotation & {
  items: QuotationItem[];
  lead: Lead | null;
  contact: Contact | null;
  createdBy: { name: string } | null;
};

export function renderQuotationPdfHtml(workspace: Workspace, quote: QuoteWithRelations): string {
  const companyName = workspace.companyLegalName || workspace.name;
  const logo = fileToDataUrl(workspace.logoPath);
  const signature = fileToDataUrl(workspace.signaturePath);
  const stamp = fileToDataUrl(workspace.stampPath);

  const addressParts = [
    workspace.address,
    [workspace.city, workspace.state].filter(Boolean).join(", "),
    workspace.pincode,
    workspace.country,
  ].filter(Boolean);

  const customerName = quote.lead
    ? `${quote.lead.firstName} ${quote.lead.lastName || ""}`.trim()
    : quote.contact
      ? `${quote.contact.firstName} ${quote.contact.lastName || ""}`.trim()
      : "—";

  const customerCompany = quote.lead?.company || "";
  const customerEmail = quote.lead?.email || quote.contact?.email || "";
  const customerPhone = quote.lead?.phone || quote.contact?.phone || "";

  const totals = calcQuoteTotals(
    quote.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      discount: i.discount,
    })),
    quote.discount
  );

  const globalDiscountAmount = totals.globalDiscountAmount;
  const taxableAmount = totals.taxableAmount;

  const itemRows = quote.items
    .map((item, idx) => {
      const share = quote.subtotal > 0 ? item.lineTotal / quote.subtotal : 0;
      const lineTaxable = Math.round((item.lineTotal - totals.globalDiscountAmount * share) * 100) / 100;
      const lineTax = Math.round(lineTaxable * (item.taxRate / 100) * 100) / 100;
      const lineGrand = Math.round((lineTaxable + lineTax) * 100) / 100;
      return `<tr>
        <td class="center">${idx + 1}</td>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
          ${item.description ? `<br><span class="muted">${escapeHtml(item.description)}</span>` : ""}
        </td>
        <td class="center">${item.quantity}</td>
        <td class="right">${formatInr(item.unitPrice)}</td>
        <td class="center">${item.discount > 0 ? `${item.discount}%` : "—"}</td>
        <td class="center">${item.taxRate}%</td>
        <td class="right">${formatInr(item.lineTotal)}</td>
        <td class="right">${formatInr(lineTax)}</td>
        <td class="right strong">${formatInr(lineGrand)}</td>
      </tr>`;
    })
    .join("");

  const defaultTerms =
    workspace.quoteTerms ||
    "Prices are valid until the date mentioned above. Payment terms as mutually agreed. GST as applicable.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Quotation ${escapeHtml(quote.quoteNumber)} — ${escapeHtml(companyName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #0f172a; background: #f8fafc; }
    .page { max-width: 900px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(15,23,42,.08); }
    .inner { padding: 40px 48px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #2563eb; padding-bottom: 24px; margin-bottom: 28px; }
    .brand h1 { font-size: 22px; font-weight: 700; color: #1e3a8a; letter-spacing: -.02em; }
    .brand p { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 6px; }
    .logo { max-height: 72px; max-width: 200px; object-fit: contain; margin-bottom: 8px; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: .08em; text-transform: uppercase; }
    .doc-title .meta { margin-top: 10px; font-size: 12px; color: #475569; line-height: 1.7; }
    .doc-title .meta strong { color: #0f172a; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 18px; background: #f8fafc; }
    .box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; margin-bottom: 10px; font-weight: 700; }
    .box p { font-size: 13px; line-height: 1.6; color: #334155; }
    .box .name { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    table.items { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
    table.items thead th { background: #1e40af; color: #fff; font-weight: 600; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    table.items tbody td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; vertical-align: top; }
    table.items tbody tr:nth-child(even) { background: #f8fafc; }
    .center { text-align: center; }
    .right { text-align: right; }
    .strong { font-weight: 700; }
    .muted { color: #64748b; font-size: 11px; }
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .totals { width: 320px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .totals-row { display: flex; justify-content: space-between; padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .totals-row.grand { background: #eff6ff; border-bottom: none; font-size: 16px; font-weight: 800; color: #1d4ed8; padding: 14px 16px; }
    .notes { margin-bottom: 32px; }
    .notes h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #64748b; margin-bottom: 8px; }
    .notes p { font-size: 12px; line-height: 1.7; color: #475569; white-space: pre-wrap; }
    .signatures { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
    .sig-block { flex: 1; text-align: center; min-height: 120px; }
    .sig-block img.sig { max-height: 64px; max-width: 180px; object-fit: contain; margin-bottom: 8px; }
    .sig-block img.stamp { max-height: 80px; max-width: 100px; object-fit: contain; opacity: .9; }
    .sig-line { border-top: 1px solid #94a3b8; margin-top: 12px; padding-top: 8px; font-size: 12px; color: #334155; }
    .sig-line strong { display: block; font-size: 13px; color: #0f172a; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 10px; color: #94a3b8; }
    .print-bar { position: sticky; top: 0; background: #1e293b; color: #fff; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
    .print-bar button { background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
    .print-bar span { font-size: 13px; opacity: .85; }
    @media print {
      body { background: #fff; }
      .print-bar { display: none !important; }
      .page { margin: 0; border: none; box-shadow: none; max-width: none; }
      .inner { padding: 24px 32px; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span>${escapeHtml(quote.quoteNumber)} — ${escapeHtml(companyName)}</span>
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="page">
    <div class="inner">
      <div class="header">
        <div class="brand">
          ${logo ? `<img src="${logo}" alt="Logo" class="logo" />` : ""}
          <h1>${escapeHtml(companyName)}</h1>
          <p>
            ${addressParts.filter((p): p is string => !!p).map(escapeHtml).join("<br>")}
            ${workspace.phone ? `<br>Phone: ${escapeHtml(workspace.phone)}` : ""}
            ${workspace.email ? `<br>Email: ${escapeHtml(workspace.email)}` : ""}
            ${workspace.website ? `<br>${escapeHtml(workspace.website)}` : ""}
            ${workspace.gstin ? `<br><strong>GSTIN:</strong> ${escapeHtml(workspace.gstin)}` : ""}
            ${workspace.pan ? `<br><strong>PAN:</strong> ${escapeHtml(workspace.pan)}` : ""}
          </p>
        </div>
        <div class="doc-title">
          <h2>Quotation</h2>
          <div class="meta">
            <div><strong>Quote No:</strong> ${escapeHtml(quote.quoteNumber)}</div>
            <div><strong>Date:</strong> ${formatDate(quote.createdAt)}</div>
            <div><strong>Valid Until:</strong> ${formatDate(quote.validUntil)}</div>
            <div><strong>Status:</strong> ${escapeHtml(quote.status.toUpperCase())}</div>
          </div>
        </div>
      </div>

      <div class="parties">
        <div class="box">
          <h3>Bill To</h3>
          <p class="name">${escapeHtml(customerName)}</p>
          ${customerCompany ? `<p>${escapeHtml(customerCompany)}</p>` : ""}
          ${customerEmail ? `<p>${escapeHtml(customerEmail)}</p>` : ""}
          ${customerPhone ? `<p>${escapeHtml(customerPhone)}</p>` : ""}
        </div>
        <div class="box">
          <h3>Prepared By</h3>
          <p class="name">${escapeHtml(quote.createdBy?.name || companyName)}</p>
          <p>${escapeHtml(companyName)}</p>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="center">#</th>
            <th>Description</th>
            <th class="center">Qty</th>
            <th class="right">Rate</th>
            <th class="center">Disc.</th>
            <th class="center">GST</th>
            <th class="right">Amount</th>
            <th class="right">Tax</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="totals-wrap">
        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>${formatInr(quote.subtotal)}</span></div>
          ${quote.discount > 0 ? `<div class="totals-row"><span>Discount (${quote.discount}%)</span><span>−${formatInr(globalDiscountAmount)}</span></div>` : ""}
          <div class="totals-row"><span>Taxable Amount</span><span>${formatInr(taxableAmount)}</span></div>
          <div class="totals-row"><span>GST</span><span>${formatInr(quote.taxAmount)}</span></div>
          <div class="totals-row grand"><span>Grand Total</span><span>${formatInr(quote.total)}</span></div>
        </div>
      </div>

      ${quote.notes ? `<div class="notes"><h3>Notes</h3><p>${escapeHtml(quote.notes)}</p></div>` : ""}
      <div class="notes"><h3>Terms &amp; Conditions</h3><p>${escapeHtml(defaultTerms)}</p></div>

      <div class="signatures">
        <div class="sig-block">
          ${stamp ? `<img src="${stamp}" alt="Company Stamp" class="stamp" />` : ""}
        </div>
        <div class="sig-block">
          ${signature ? `<img src="${signature}" alt="Signature" class="sig" />` : ""}
          <div class="sig-line">
            <strong>${escapeHtml(workspace.authorizedSignatoryName || "Authorized Signatory")}</strong>
            ${workspace.authorizedSignatoryTitle ? escapeHtml(workspace.authorizedSignatoryTitle) : "For " + escapeHtml(companyName)}
          </div>
        </div>
      </div>

      <div class="footer">
        This is a computer-generated quotation from ${escapeHtml(companyName)}.
        ${workspace.gstin ? ` GSTIN: ${escapeHtml(workspace.gstin)}.` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
}
