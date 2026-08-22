/** Normalize phone to digits only (last 10 for Indian numbers). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  if (digits.startsWith("91") && digits.length >= 12) return digits.slice(-10);
  return digits.slice(-10);
}

export function isEmailIdentifier(value: string): boolean {
  return value.includes("@");
}
