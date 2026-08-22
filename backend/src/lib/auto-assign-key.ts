import crypto from "crypto";

export function generateLeadApiKey(): string {
  return `lf_${crypto.randomBytes(24).toString("hex")}`;
}
