export type QuoteLineInput = {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
};

export type QuoteTotals = {
  subtotal: number;
  lineDiscountTotal: number;
  globalDiscountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function lineNet(item: QuoteLineInput): number {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  const disc = Math.min(100, Math.max(0, Number(item.discount) || 0));
  return round2(qty * price * (1 - disc / 100));
}

/** Per-line tax after line + proportional global discount (GST-style). */
export function calcQuoteTotals(
  items: QuoteLineInput[],
  globalDiscountPercent: number,
  _globalTaxRate?: number
): QuoteTotals {
  const globalDiscount = Math.min(100, Math.max(0, Number(globalDiscountPercent) || 0));

  const lines = items.map((item) => {
    const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    const net = lineNet(item);
    return {
      gross,
      net,
      lineDiscount: round2(gross - net),
      taxRate: Math.max(0, Number(item.taxRate) || 0),
    };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.net, 0));
  const lineDiscountTotal = round2(lines.reduce((s, l) => s + l.lineDiscount, 0));
  const globalDiscountAmount = round2(subtotal * (globalDiscount / 100));
  const taxableAmount = round2(subtotal - globalDiscountAmount);

  let taxAmount = 0;
  if (subtotal > 0) {
    taxAmount = round2(
      lines.reduce((sum, line) => {
        const share = line.net / subtotal;
        const lineTaxable = round2(line.net - globalDiscountAmount * share);
        return sum + lineTaxable * (line.taxRate / 100);
      }, 0)
    );
  }

  const total = round2(taxableAmount + taxAmount);

  return {
    subtotal,
    lineDiscountTotal,
    globalDiscountAmount,
    taxableAmount,
    taxAmount,
    total,
  };
}

export function calcLineNet(item: QuoteLineInput): number {
  return lineNet(item);
}

export function calcLineTotalWithTax(item: QuoteLineInput, globalDiscountPercent: number, allItems: QuoteLineInput[]): number {
  const totals = calcQuoteTotals(allItems, globalDiscountPercent);
  const net = lineNet(item);
  if (totals.subtotal <= 0) return net;
  const share = net / totals.subtotal;
  const lineTaxable = round2(net - totals.globalDiscountAmount * share);
  const tax = round2(lineTaxable * ((Number(item.taxRate) || 0) / 100));
  return round2(lineTaxable + tax);
}
