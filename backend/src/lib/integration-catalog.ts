import { z } from "zod";

export type IntegrationFieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "url" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
};

export type IntegrationCatalogItem = {
  id: string;
  name: string;
  category: string;
  summary: string;
  steps: string[];
  fields: IntegrationFieldDef[];
  docsUrl?: string;
};

export const INTEGRATION_IDS = [
  "email",
  "email_inbox",
  "whatsapp",
  "sms",
  "google_ads",
  "facebook",
  "linkedin",
  "indiamart",
  "website",
  "zapier",
] as const;

export type IntegrationId = (typeof INTEGRATION_IDS)[number];

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    id: "email",
    name: "Email (SMTP)",
    category: "Communication",
    summary: "Send quotation emails and outbound messages from Synentrix Flow using your company SMTP server.",
    steps: [
      "Get SMTP details from your email provider (Gmail App Password, SendGrid, Amazon SES, or hosting cPanel mail).",
      "Enter host, port, username, password, and the From email address your customers should see.",
      "Click Save & connect. Use Test connection to verify settings.",
      "When sending from a lead, Synentrix Flow will use these credentials if connected.",
    ],
    fields: [
      { key: "host", label: "SMTP host", type: "text", placeholder: "smtp.gmail.com", required: true },
      { key: "port", label: "Port", type: "number", placeholder: "587", required: true },
      {
        key: "secure",
        label: "Encryption",
        type: "select",
        required: true,
        options: [
          { value: "tls", label: "TLS (port 587)" },
          { value: "ssl", label: "SSL (port 465)" },
          { value: "none", label: "None" },
        ],
      },
      { key: "user", label: "SMTP username", type: "text", placeholder: "you@company.com", required: true },
      { key: "password", label: "SMTP password / app password", type: "password", required: true },
      { key: "fromEmail", label: "From email", type: "text", placeholder: "sales@company.com", required: true },
      { key: "fromName", label: "From name", type: "text", placeholder: "Acme Sales Team" },
    ],
    docsUrl: "https://support.google.com/mail/answer/185833",
  },
  {
    id: "email_inbox",
    name: "Email Inbox (Lead capture)",
    category: "Lead Source",
    summary:
      "Turn inquiry emails into leads. Add the company inbox that receives marketing replies and website enquiries — new messages are captured automatically.",
    steps: [
      "Enter the company email that receives lead enquiries (for example sales@, info@, or your campaign reply-to).",
      "Save & connect. Copy this company's unique inbound address and forward that mailbox to it, or connect IMAP so only this workspace reads the inbox.",
      "Gmail: create an App Password and choose Gmail as the provider. Outlook: use the mailbox password or app password.",
      "Inbound mail is parsed for name, email, phone, company, city, and requirement. Matching contacts stay on this company's existing lead — they are never mixed with another company.",
      "Use Fetch now after connecting IMAP, or wait for automatic checks every few minutes.",
    ],
    fields: [
      {
        key: "captureEmail",
        label: "Company inbox that receives leads",
        type: "text",
        placeholder: "sales@company.com",
        required: true,
        help: "The address prospects email, or your campaign reply-to and form notification inbox.",
      },
      {
        key: "provider",
        label: "Mailbox provider (optional IMAP)",
        type: "select",
        options: [
          { value: "gmail", label: "Gmail / Google Workspace" },
          { value: "outlook", label: "Outlook / Microsoft 365" },
          { value: "yahoo", label: "Yahoo Mail" },
          { value: "custom", label: "Other IMAP / cPanel" },
        ],
        help: "Skip IMAP if you will only forward mail to the inbound address.",
      },
      { key: "imapHost", label: "IMAP host", type: "text", placeholder: "imap.gmail.com" },
      { key: "imapPort", label: "IMAP port", type: "number", placeholder: "993" },
      { key: "imapUser", label: "IMAP username", type: "text", placeholder: "sales@company.com" },
      { key: "imapPassword", label: "IMAP password / app password", type: "password" },
      { key: "mailbox", label: "Folder", type: "text", placeholder: "INBOX", help: "Usually INBOX. Use a dedicated folder if you filter enquiries there." },
    ],
    docsUrl: "https://support.google.com/mail/answer/185833",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "Communication",
    summary: "Send WhatsApp messages to leads via Meta Cloud API, Twilio, or MSG91.",
    steps: [
      "Create a WhatsApp Business account with Meta, Twilio, or MSG91.",
      "Copy API credentials (Phone number ID, access token, or Twilio SID/token).",
      "Paste credentials below and Save & connect.",
      "Log WhatsApp communications on leads; live send uses your provider API when enabled.",
    ],
    fields: [
      {
        key: "provider",
        label: "Provider",
        type: "select",
        required: true,
        options: [
          { value: "meta", label: "Meta (WhatsApp Cloud API)" },
          { value: "twilio", label: "Twilio" },
          { value: "msg91", label: "MSG91" },
        ],
      },
      { key: "phoneNumberId", label: "Phone number ID / Sender", type: "text", required: true },
      { key: "accessToken", label: "API access token", type: "password", required: true },
      { key: "businessAccountId", label: "Business account ID (Meta only)", type: "text" },
    ],
  },
  {
    id: "sms",
    name: "SMS Gateway",
    category: "Communication",
    summary: "Send SMS follow-ups and alerts through Twilio, MSG91, or Textlocal.",
    steps: [
      "Sign up with Twilio, MSG91, or Textlocal and verify your sender ID.",
      "Copy API key and sender ID into the form below.",
      "Save & connect. Outbound SMS from lead communications will use this gateway.",
    ],
    fields: [
      {
        key: "provider",
        label: "Provider",
        type: "select",
        required: true,
        options: [
          { value: "twilio", label: "Twilio" },
          { value: "msg91", label: "MSG91" },
          { value: "textlocal", label: "Textlocal" },
        ],
      },
      { key: "apiKey", label: "API key / Auth token", type: "password", required: true },
      { key: "senderId", label: "Sender ID / From number", type: "text", required: true },
      { key: "accountSid", label: "Account SID (Twilio only)", type: "text" },
    ],
  },
  {
    id: "google_ads",
    name: "Google Ads",
    category: "Lead Source",
    summary: "Import leads from Google Ads lead form extensions via webhook or Zapier.",
    steps: [
      "In Google Ads, open Goals → Conversions → Lead form submissions.",
      "Export leads via Zapier/Make, or use Google Ads webhook (if available on your plan).",
      "Point the webhook to your Synentrix Flow URL (shown after you generate an API key under Lead automation).",
      "Set header X-Synentrix-Flow-Key and map fields: firstName, email, phone, source=Google Ads.",
      "Optional: store your Google Ads customer ID below for reference.",
    ],
    fields: [
      { key: "customerId", label: "Google Ads customer ID", type: "text", placeholder: "123-456-7890" },
      { key: "conversionAction", label: "Conversion / form name", type: "text", placeholder: "Website lead form" },
      { key: "webhookSecret", label: "Webhook secret (optional)", type: "password", help: "For verifying inbound webhooks" },
    ],
  },
  {
    id: "facebook",
    name: "Facebook Lead Ads",
    category: "Lead Source",
    summary: "Receive Facebook & Instagram lead ad submissions in Synentrix Flow.",
    steps: [
      "In Meta Business Suite → Instant Forms, note your Page ID.",
      "Create a Meta App with leads_retrieval permission and generate a Page access token.",
      "Subscribe your app to leadgen webhooks, or use Zapier to POST to Synentrix Flow.",
      "Webhook URL: your Synentrix Flow public endpoint. Header: X-Synentrix-Flow-Key.",
      "Enter Page ID and access token below to mark the integration connected.",
    ],
    fields: [
      { key: "pageId", label: "Facebook Page ID", type: "text", required: true },
      { key: "accessToken", label: "Page access token", type: "password", required: true },
      { key: "verifyToken", label: "Webhook verify token", type: "text", help: "Used when Meta verifies your webhook URL" },
      { key: "appSecret", label: "App secret (optional)", type: "password" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn Lead Gen",
    category: "Lead Source",
    summary: "Capture LinkedIn Lead Gen Form submissions into Synentrix Flow.",
    steps: [
      "In LinkedIn Campaign Manager, open Lead Gen Forms and note your ad account ID.",
      "Use Zapier/Make or a custom webhook to forward new leads to Synentrix Flow.",
      "Webhook: POST to /api/public/leads with X-Synentrix-Flow-Key header.",
      "Set source field to LinkedIn in your automation mapping.",
      "Store LinkedIn account details below for your team reference.",
    ],
    fields: [
      { key: "accountId", label: "LinkedIn ad account ID", type: "text", required: true },
      { key: "organizationId", label: "Organization ID", type: "text" },
      { key: "accessToken", label: "Access token (if using direct API)", type: "password" },
    ],
  },
  {
    id: "indiamart",
    name: "IndiaMART",
    category: "Lead Source",
    summary: "Receive IndiaMART buyer enquiries directly into your company's Synentrix Flow portal.",
    steps: [
      "Open IndiaMART Seller Hub → Settings → Lead Manager / CRM integration.",
      "Set webhook URL to the Synentrix Flow endpoint shown below (same URL for all companies).",
      "Add header X-Synentrix-Flow-Key with your API key from the Integrations page.",
      "Map enquiry fields to firstName, phone, email, company, city, state, requirement.",
      "Set source=IndiaMART in the payload or let Synentrix Flow default it for IndiaMART leads.",
      "Save your IndiaMART CRM key below for reference and mark connected after a test enquiry arrives.",
    ],
    fields: [
      { key: "sellerId", label: "IndiaMART seller / GLID", type: "text", required: true, placeholder: "Your seller ID" },
      { key: "crmKey", label: "IndiaMART CRM / webhook key", type: "password", help: "Stored only in your company workspace" },
      { key: "notes", label: "Notes", type: "text", placeholder: "Account manager, plan, etc." },
    ],
  },
  {
    id: "website",
    name: "Website Forms",
    category: "Lead Source",
    summary: "Capture leads from your website contact form, landing pages, or WordPress.",
    steps: [
      "Go to Settings → Lead automation & webhooks and Generate API key.",
      "Copy the webhook URL shown there.",
      "In your website form handler (HTML, WordPress, React), POST JSON on submit.",
      "Required field: firstName. Recommended: email, phone, company, source=Website.",
      "Mark connected once your form is live and a test lead appears in Leads.",
    ],
    fields: [
      { key: "formUrl", label: "Form page URL", type: "url", placeholder: "https://yoursite.com/contact" },
      { key: "platform", label: "Platform", type: "select", options: [
        { value: "custom", label: "Custom HTML / JavaScript" },
        { value: "wordpress", label: "WordPress" },
        { value: "wix", label: "Wix / Squarespace" },
        { value: "other", label: "Other" },
      ]},
      { key: "notes", label: "Notes for your developer", type: "text", placeholder: "Contact form plugin name, etc." },
    ],
  },
  {
    id: "zapier",
    name: "Zapier",
    category: "Automation",
    summary: "Connect 5000+ apps to Synentrix Flow — Google Sheets, Gmail, Facebook Leads, and more.",
    steps: [
      "Generate your Synentrix Flow API key under Lead automation & webhooks.",
      "In Zapier, create a Zap: Trigger = your app (e.g. Facebook Lead Ads), Action = Webhooks by Zapier → POST.",
      "URL: your Synentrix Flow webhook URL. Header: X-Synentrix-Flow-Key: your-key.",
      "Body type: JSON. Map name → firstName, email, phone, company, source.",
      "Test the Zap; new leads should appear in Synentrix Flow within seconds.",
    ],
    fields: [
      { key: "zapName", label: "Zap name (for reference)", type: "text", placeholder: "Facebook → Synentrix Flow" },
      { key: "triggerApp", label: "Trigger app", type: "text", placeholder: "Facebook Lead Ads" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
];

const emailSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().min(1).max(65535),
  secure: z.enum(["tls", "ssl", "none"]),
  user: z.string().min(1),
  password: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
});

const emailInboxSchema = z.object({
  captureEmail: z.string().email(),
  provider: z.enum(["gmail", "outlook", "yahoo", "custom"]).optional(),
  imapHost: z.string().optional(),
  imapPort: z.coerce.number().min(1).max(65535).optional(),
  imapUser: z.string().optional(),
  imapPassword: z.string().optional(),
  mailbox: z.string().optional(),
});

const whatsappSchema = z.object({
  provider: z.enum(["meta", "twilio", "msg91"]),
  phoneNumberId: z.string().min(1),
  accessToken: z.string().min(1),
  businessAccountId: z.string().optional(),
});

const smsSchema = z.object({
  provider: z.enum(["twilio", "msg91", "textlocal"]),
  apiKey: z.string().min(1),
  senderId: z.string().min(1),
  accountSid: z.string().optional(),
});

const googleAdsSchema = z.object({
  customerId: z.string().optional(),
  conversionAction: z.string().optional(),
  webhookSecret: z.string().optional(),
});

const facebookSchema = z.object({
  pageId: z.string().min(1),
  accessToken: z.string().min(1),
  verifyToken: z.string().optional(),
  appSecret: z.string().optional(),
});

const linkedinSchema = z.object({
  accountId: z.string().min(1),
  organizationId: z.string().optional(),
  accessToken: z.string().optional(),
});

const indiamartSchema = z.object({
  sellerId: z.string().min(1),
  crmKey: z.string().optional(),
  notes: z.string().optional(),
});

const websiteSchema = z.object({
  formUrl: z.string().optional(),
  platform: z.string().optional(),
  notes: z.string().optional(),
});

const zapierSchema = z.object({
  zapName: z.string().optional(),
  triggerApp: z.string().optional(),
  notes: z.string().optional(),
});

export const INTEGRATION_CONFIG_SCHEMAS: Record<IntegrationId, z.ZodTypeAny> = {
  email: emailSchema,
  email_inbox: emailInboxSchema,
  whatsapp: whatsappSchema,
  sms: smsSchema,
  google_ads: googleAdsSchema,
  facebook: facebookSchema,
  linkedin: linkedinSchema,
  indiamart: indiamartSchema,
  website: websiteSchema,
  zapier: zapierSchema,
};

export function getCatalogItem(id: string): IntegrationCatalogItem | undefined {
  return INTEGRATION_CATALOG.find((i) => i.id === id);
}

export function isIntegrationConnected(
  id: IntegrationId,
  config: Record<string, unknown>,
  opts?: { hasLeadApiKey?: boolean }
): boolean {
  switch (id) {
    case "email":
      return emailSchema.safeParse(config).success;
    case "email_inbox":
      return emailInboxSchema.safeParse(config).success;
    case "whatsapp":
      return whatsappSchema.safeParse(config).success;
    case "sms":
      return smsSchema.safeParse(config).success;
    case "google_ads":
      return !!(config.customerId || config.conversionAction);
    case "facebook":
      return facebookSchema.safeParse(config).success;
    case "linkedin":
      return linkedinSchema.safeParse(config).success;
    case "indiamart":
      return indiamartSchema.safeParse(config).success;
    case "website":
      return !!opts?.hasLeadApiKey;
    case "zapier":
      return !!opts?.hasLeadApiKey || !!(config.zapName || config.triggerApp);
    default:
      return false;
  }
}

const SECRET_KEYS = new Set([
  "password",
  "imapPassword",
  "accessToken",
  "apiKey",
  "appSecret",
  "webhookSecret",
  "crmKey",
]);

export function maskIntegrationConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === "string" && SECRET_KEYS.has(k) && v.length > 0) {
      out[k] = v.length <= 4 ? "****" : `****${v.slice(-4)}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}
