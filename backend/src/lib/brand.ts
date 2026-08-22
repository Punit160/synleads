/** Product branding — single source of truth for API responses & docs */
export const PRODUCT_NAME = "Synentrix Flow";
export const WEBHOOK_API_KEY_HEADER = "X-Synentrix-Flow-Key";
export const LEGACY_WEBHOOK_API_KEY_HEADER = "X-LeadFlow-Key";

export function readWebhookApiKey(headers: Record<string, unknown>, queryKey?: unknown): string | undefined {
  return (
    (headers["x-synentrix-flow-key"] as string | undefined) ||
    (headers["x-leadflow-key"] as string | undefined) ||
    (typeof queryKey === "string" ? queryKey : undefined)
  );
}
