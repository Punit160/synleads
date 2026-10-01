export type ParsedEmailLead = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
  state?: string;
  requirement?: string;
  remarks?: string;
  messageId?: string;
  skip: boolean;
  skipReason?: string;
};

const LABEL_ALIASES: Record<string, string> = {
  name: "name",
  "full name": "name",
  "contact name": "name",
  "customer name": "name",
  "first name": "firstName",
  "last name": "lastName",
  email: "email",
  "e-mail": "email",
  "email id": "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  "phone no": "phone",
  mobile: "phone",
  "mobile number": "phone",
  "mobile no": "phone",
  "contact number": "phone",
  "contact no": "phone",
  "contact": "phone",
  whatsapp: "phone",
  company: "company",
  organisation: "company",
  organization: "company",
  "company name": "company",
  city: "city",
  state: "state",
  requirement: "requirement",
  message: "requirement",
  enquiry: "requirement",
  inquiry: "requirement",
  product: "requirement",
  comments: "requirement",
  "looking for": "requirement",
};

const IGNORE_FROM = [
  "noreply",
  "no-reply",
  "mailer-daemon",
  "postmaster",
  "notifications@",
  "bounce@",
  "bounces@",
  "donotreply",
  "do-not-reply",
];

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extractEmailAddress(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const m = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : undefined;
}

export function extractDisplayName(from: string | undefined | null): string {
  if (!from) return "";
  const quoted = from.match(/^"?([^"<]+)"?\s*</);
  if (quoted) return quoted[1].trim();
  const before = from.split("<")[0]?.trim();
  if (before && !before.includes("@")) return before.replace(/"/g, "");
  const email = extractEmailAddress(from);
  if (email) return email.split("@")[0].replace(/[._-]+/g, " ");
  return "";
}

function splitName(full: string): { firstName: string; lastName?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown" };
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, "");
  const just = digits.replace(/^\+/, "");
  if (just.length < 7 || just.length > 15) return undefined;
  return digits.startsWith("+") ? digits : just;
}

function extractPhoneFromText(text: string): string | undefined {
  const labeled = text.match(
    /(?:phone|mobile|whatsapp|tel|contact(?:\s*(?:no|number|num))?)\s*[:\-]\s*([+\d][\d\s\-()]{6,18})/i
  );
  if (labeled) return normalizePhone(labeled[1]);
  const inPhone = text.match(/(\+?91[-\s]?)?[6-9]\d{9}/);
  if (inPhone) return normalizePhone(inPhone[0]);
  const intl = text.match(/\+\d{8,15}/);
  if (intl) return normalizePhone(intl[0]);
  return undefined;
}

function parseLabeledFields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9 ./-]{1,40})\s*[:\-]\s*(.+?)\s*$/);
    if (!m) continue;
    const key = LABEL_ALIASES[m[1].trim().toLowerCase()];
    if (!key) continue;
    const value = m[2].trim();
    if (value) out[key] = value;
  }
  return out;
}

export function shouldSkipEmail(input: { from?: string; subject?: string; autoSubmitted?: string }): string | null {
  const from = (input.from || "").toLowerCase();
  if (IGNORE_FROM.some((frag) => from.includes(frag))) return "automated sender";
  const subject = (input.subject || "").trim();
  if (/^(auto:|automatic reply|out of office|undeliverable|delivery status)/i.test(subject)) {
    return "auto-reply";
  }
  if (input.autoSubmitted && input.autoSubmitted.toLowerCase() !== "no") return "auto-submitted";
  return null;
}

export function parseLeadFromEmail(input: {
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  captureEmail?: string;
}): ParsedEmailLead {
  const skipReason = shouldSkipEmail(input);
  if (skipReason) {
    return { firstName: "Unknown", skip: true, skipReason, messageId: input.messageId };
  }

  const fromAddr = extractEmailAddress(input.from);
  if (input.captureEmail && fromAddr && fromAddr === input.captureEmail.toLowerCase()) {
    return { firstName: "Unknown", skip: true, skipReason: "sent from capture mailbox", messageId: input.messageId };
  }

  const body = (input.text || (input.html ? htmlToText(input.html) : "")).trim();
  const fields = parseLabeledFields(body);

  const labeledEmail = extractEmailAddress(fields.email);
  const email = labeledEmail || fromAddr;

  let firstName: string | undefined = fields.firstName?.trim();
  let lastName: string | undefined = fields.lastName?.trim();
  if (!firstName && fields.name) {
    const split = splitName(fields.name);
    firstName = split.firstName;
    lastName = lastName || split.lastName;
  }
  if (!firstName) {
    const fromName = extractDisplayName(input.from);
    const split = splitName(fromName || (email ? email.split("@")[0] : "Unknown"));
    firstName = split.firstName;
    lastName = lastName || split.lastName;
  }

  const phone = normalizePhone(fields.phone) || extractPhoneFromText(body);
  const company = fields.company?.trim();
  const city = fields.city?.trim();
  const state = fields.state?.trim();
  const requirement = (fields.requirement || body).slice(0, 8000) || undefined;

  if (!email && !phone && (!firstName || firstName === "Unknown") && !company) {
    return { firstName: "Unknown", skip: true, skipReason: "no lead details found", messageId: input.messageId };
  }

  const remarks = [`Subject: ${input.subject || "(no subject)"}`, input.from ? `From: ${input.from}` : ""]
    .filter(Boolean)
    .join("\n");

  return {
    firstName: firstName || "Unknown",
    lastName,
    email,
    phone,
    company,
    city,
    state,
    requirement,
    remarks,
    messageId: input.messageId,
    skip: false,
  };
}
