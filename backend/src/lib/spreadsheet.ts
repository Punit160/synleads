import * as XLSX from "xlsx";

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").replace(/\*$/, "").trim());
  return lines.slice(1).map((line) => {
    if (!line.trim()) return null;
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else current += ch;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i]?.replace(/^"|"$/g, "") || "";
    });
    return row;
  }).filter(Boolean) as Record<string, string>[];
}

export function parseExcelBuffer(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === "data") || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return json.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const key = String(k).replace(/\*$/, "").trim();
      out[key] = v == null ? "" : String(v).trim();
    }
    return out;
  });
}

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\*$/, "").replace(/\s+/g, "");
}

export function mapRowHeaders(
  row: Record<string, string>,
  aliases: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const norm = normalizeHeader(key);
    const mapped = aliases[norm] || aliases[key] || key.replace(/\*$/, "").trim();
    if (value?.trim()) out[mapped] = value.trim();
  }
  return out;
}

export function buildTemplateWorkbook(
  entityLabel: string,
  columns: Array<{ key: string; label: string; required: boolean; example: string; notes: string }>,
  sampleRows: Record<string, string>[]
): Buffer {
  const headers = columns.map((c) => (c.required ? `${c.key} *` : c.key));
  const dataRows = sampleRows.map((row) =>
    columns.map((c) => row[c.key] ?? "")
  );

  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  dataSheet["!cols"] = columns.map((c) => ({ wch: Math.max(c.key.length, c.example.length, 14) }));

  const guideRows = [
    ["Column", "Required", "Description", "Example"],
    ...columns.map((c) => [c.label, c.required ? "Yes" : "No", c.notes, c.example]),
    [],
    ["Notes"],
    [`Upload this sheet on the ${entityLabel} page using Import Excel/CSV.`],
    ["Required columns are marked with * in the Data sheet header row."],
    ["Do not rename required column keys — only fill in the rows below the header."],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 48 }, { wch: 24 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "Data");
  XLSX.utils.book_append_sheet(wb, guideSheet, "Column guide");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
