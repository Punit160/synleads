type ApiErrorBody = { error?: string; reference?: string };

export class ApiError extends Error {
  status: number;
  reference?: string;
  constructor(message: string, status: number, reference?: string) {
    super(message);
    this.status = status;
    this.reference = reference;
  }
}

function formatErrorMessage(body: ApiErrorBody | null, fallback: string): { message: string; reference?: string } {
  const reference = body?.reference;
  let message = body?.error || fallback;
  if (reference && !message.includes(reference)) {
    message = `${message}${message.endsWith(".") ? "" : "."} Reference: ${reference}`;
  }
  return { message, reference };
}

export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", credentials: "include", body: formData });
  } catch {
    throw new ApiError("Cannot reach the server. Please check your connection and try again.", 0);
  }
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  if (!res.ok) {
    const { message, reference } = formatErrorMessage(body, "Upload failed");
    throw new ApiError(message, res.status, reference);
  }
  return body as T;
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Please check your connection or try again shortly.",
      0
    );
  }

  let body: unknown = null;
  let text = "";
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    text = await res.text().catch(() => "");
  }

  if (!res.ok) {
    let fallback = "Request failed";
    if (res.status >= 500) {
      fallback = "Something went wrong. Our team has been notified.";
    } else if (res.status === 401) {
      fallback = "Your session has expired. Please sign in again.";
    } else if (res.status === 403) {
      fallback = "You don't have permission to do that.";
    } else if (res.status === 404) {
      fallback = "The requested item was not found.";
    }
    const { message, reference } = formatErrorMessage(body as ApiErrorBody | null, fallback);
    if (!body && text && res.status >= 500) {
      throw new ApiError(fallback, res.status);
    }
    throw new ApiError(message, res.status, reference);
  }

  return (body ?? null) as T;
}

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";
  const value = Math.round(amount * 100) / 100;
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Short form for dashboards — use formatCurrency for quotations/invoices. */
export function formatCurrencyCompact(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return formatCurrency(amount);
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - Date.now();
  const absSec = Math.abs(Math.round(diffMs / 1000));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), "second");
  if (absSec < 3600) return rtf.format(Math.round(diffMs / 60000), "minute");
  if (absSec < 86400) return rtf.format(Math.round(diffMs / 3600000), "hour");
  return rtf.format(Math.round(diffMs / 86400000), "day");
}