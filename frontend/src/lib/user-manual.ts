export type ManualSection = {
  id: string;
  title: string;
  content: Array<{ heading?: string; body?: string; bullets?: string[] }>;
};

export const USER_MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    content: [
      {
        body: "Synentrix Flow is your company’s sales CRM — provided by Synentrix Technologies. After you purchase a plan, Synentrix creates your company workspace and sends login details for your Company Admin account.",
      },
      {
        heading: "Your Company Admin account",
        body: "Synentrix sets up one primary admin login for your organisation (company name + admin email + password). This admin is the workspace owner and should be the first person to sign in.",
        bullets: [
          "Complete company profile and quotation branding in Settings",
          "Add Sales Managers and Sales Executives under Team",
          "Share individual login credentials with each team member — they sign in with their own email",
        ],
      },
      {
        heading: "Sign in",
        body: "Go to the login page and enter the email and password provided by Synentrix (for admin) or by your company admin (for managers and executives). If login fails, contact the Synentrix team or your company admin.",
      },
      {
        heading: "Navigation",
        body: "Use the left sidebar for all modules. The top search bar finds leads, deals, contacts, accounts, and customers. The bell icon shows notifications and refreshes automatically while you work. Open User Manual from the sidebar anytime for this guide.",
      },
    ],
  },
  {
    id: "subscription-plans",
    title: "Subscription & team limits",
    content: [
      {
        body: "Synentrix Flow is offered on yearly plans only. Your company’s plan is set up by the Synentrix team when you are onboarded. It defines how many active users can access your workspace.",
      },
      {
        heading: "Team sizes available",
        body: "Plans are available for teams of 5, 10, 20, 50, 100, 200, or 500 active users. Your Company Admin, Sales Managers, and Sales Executives all count toward this limit.",
      },
      {
        heading: "Plans & pricing",
        body: "For plan details, upgrades, and pricing, contact the Synentrix team at synentrixtechnologies@gmail.com. Mention your company name and the team size you need.",
      },
      {
        heading: "Adding team members",
        bullets: [
          "Company Admin — add managers and executives from Team or Settings → Sales Team",
          "Sales Manager — add sales executives who report to them (within your plan limit)",
          "When the limit is reached, contact Synentrix to upgrade before adding more users",
        ],
      },
      {
        heading: "Renewals & upgrades",
        body: "Renewals and upgrades (e.g. from 10 to 50 users) are handled by Synentrix. Email the support team with your company name and requested team size.",
      },
    ],
  },
  {
    id: "roles-permissions",
    title: "Roles & permissions",
    content: [
      {
        body: "Access follows a strict hierarchy. Each higher role includes the capabilities below it, scoped to the right data. Owners and admins see the whole workspace; sales managers see their team plus unassigned leads; sales executives see only records assigned to them.",
      },
      {
        heading: "Role hierarchy (highest to lowest)",
        bullets: [
          "Owner / Admin — full CRM, all records, team management, settings, automation, delete, import/export",
          "Sales Manager — team leads, deals, tasks, follow-ups, reports; can assign within team; cannot delete records or manage admin settings",
          "Sales Executive — own assigned leads, deals, tasks, and related records; can add and edit but not assign, import, delete, or open reports",
          "Viewer — read-only access to all records and reports; no create, edit, delete, or assign",
        ],
      },
      {
        heading: "Data visibility rules",
        bullets: [
          "Leads — executives: own assigned only; managers: own + direct reports + unassigned pool; admin/viewer: all",
          "Deals, contacts, accounts, activities — same owner-based scope as leads",
          "Tasks — scoped by assignee or creator within your hierarchy level",
          "Customers & quotations — linked to leads in your scope; managers/admins see broader sets",
          "Global search — returns only records your role is allowed to see",
          "Team page — managers see their executives plus admin/manager roles; admins see everyone",
        ],
      },
      {
        heading: "Key permissions",
        bullets: [
          "view — read records and dashboard",
          "add / edit — create and change records within your scope",
          "delete — remove records (owner/admin only)",
          "assign — reassign leads to team members (manager/admin; within team for managers)",
          "import / export — bulk upload and CSV export (manager/admin)",
          "reports — access Reports module (manager/admin/viewer)",
          "manage_team — add sales executives (managers: own team only)",
          "manage_users — full team, roles, and automation settings (admins only)",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    content: [
      {
        body: "The dashboard shows KPIs: total leads, new leads, follow-ups due, conversions, pipeline value, won revenue, conversion rate, and sales performance by executive.",
      },
      {
        heading: "Panels",
        bullets: [
          "Recent leads — click a row to open lead detail",
          "Open deals — click to open deal detail",
          "Upcoming follow-ups — scheduled actions needing attention",
          "Recent activity — timeline events across leads",
          "Lead source / status / priority charts — distribution at a glance",
          "Pipeline by stage — value per sales stage",
          "Integrations — connection status (configure in Settings)",
        ],
      },
    ],
  },
  {
    id: "leads",
    title: "Leads",
    content: [
      {
        body: "Leads are potential customers. Each lead gets a unique number (e.g. LF-00001) and moves through stages: New → Contacted → Qualified → Proposal → Negotiation → Converted (Won) / Lost / On Hold.",
      },
      {
        heading: "Lead sources",
        body: "Track where each lead came from. Supported sources include Website, Google Ads, Facebook, Facebook Ads, Instagram, LinkedIn, WhatsApp, Email, Email Campaign, Referral, Walk-in, Cold Call, Trade Show, and Manual Entry. Choose the source when creating a lead or importing a spreadsheet.",
      },
      {
        heading: "List page",
        bullets: [
          "Filter by status, source, priority, city, assignee, and date range",
          "View — Active leads (default), Archived, or All",
          "Sort by — date created, last updated, name, status, priority, score, or city",
          "Order — newest first or oldest first",
          "Search by name, company, phone, or lead number",
          "Export CSV and Import via Excel/CSV (if your role allows)",
          "Click a lead row to open detail",
        ],
      },
      {
        heading: "Archive & restore",
        body: "Instead of deleting, archive leads you no longer want in the active list. Use the archive icon in the row actions on the Leads page. Switch View to Archived to see archived leads, then use the restore icon to bring one back. Archived leads keep their full history, notes, and attachments.",
      },
      {
        heading: "Manual & automatic assignment",
        bullets: [
          "When creating or editing a lead, choose a Sales Executive in the Assigned To field",
          "If no assignee is chosen and auto-assign is enabled (Settings), the system assigns the lead round-robin among active sales executives",
          "Managers and admins can reassign leads at any time; the assignee receives an in-app notification",
        ],
      },
      {
        heading: "Lead detail",
        bullets: [
          "Details — contact info, company, budget, requirement, owner, location",
          "Timeline — automatic history of status changes, assignments, and key events",
          "Notes — internal notes for your team",
          "Attachments — upload files (proposals, IDs, contracts, etc.)",
          "Follow-ups — schedule calls, meetings, site visits, or reminders",
          "Communications — log calls, emails, WhatsApp, and SMS (live send when integrations are connected)",
          "Edit / Duplicate / Convert / Archive / Delete — based on your permissions",
        ],
      },
      {
        heading: "Convert lead",
        body: "Converting a qualified or won lead creates linked Contact and/or Account records and optionally an open Deal in the pipeline with the lead’s budget as amount. All timeline, notes, and attachments stay linked to the original lead record.",
      },
    ],
  },
  {
    id: "import-export",
    title: "Import & export",
    content: [
      {
        body: "Bulk bring data into Synentrix Flow or download it for reporting. Import is available on Leads, Contacts, Accounts, Pipeline (Deals), Customers, and Tasks — for roles with the import permission.",
      },
      {
        heading: "Import from Excel or CSV",
        bullets: [
          "Click Import on the module page (e.g. Leads) to open the import dialog",
          "Step 1 — Download sample template; it lists required and optional column headers for that module",
          "Fill the template in Excel or Google Sheets, then save as .xlsx, .xls, or .csv",
          "Step 2 — Optionally choose a default assignee for imported leads",
          "Step 3 — Upload your file and click Import now",
          "Review the result message — it shows how many rows imported, duplicates skipped, and any row errors",
        ],
      },
      {
        heading: "Import tips",
        bullets: [
          "Use exact column headers from the template; do not rename required columns",
          "Duplicate leads (same email or phone) are skipped automatically",
          "For leads, if auto-assign is on and you leave assignee blank, new rows follow your workspace auto-assign rules",
          "Large files may take a few seconds — wait for the success or error summary before closing the dialog",
        ],
      },
      {
        heading: "Export",
        bullets: [
          "Leads — Export button downloads a CSV of the current filtered list (export permission required)",
          "Reports — each report tab supports export where shown on the Reports page",
          "Quotations — open a quote and use PDF for a printable copy with your company branding",
        ],
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations & connections",
    content: [
      {
        body: "Each company provisioned by Synentrix has its own Integrations portal. Go to Administration → Integrations in the sidebar (or Dashboard → Manage integrations). Company admins connect services; other roles can view status.",
      },
      {
        heading: "How to connect any integration",
        bullets: [
          "Sign in to your company portal as Admin",
          "Open Integrations from the sidebar (Administration section)",
          "Generate your Lead capture API key at the top (for webhooks)",
          "Click Connect & setup on the integration card you need",
          "Follow the step-by-step procedure in the popup and Save & connect",
        ],
      },
      {
        heading: "Email (SMTP)",
        body: "Use your company mail server or provider (Gmail App Password, SendGrid, SES). Enter SMTP host, port, username, password, and From address. Required for sending emails directly from Synentrix Flow when live dispatch is enabled.",
      },
      {
        heading: "Email Inbox (Lead capture)",
        body: "For email marketing and inbound enquiries: add the company inbox that receives lead details (sales@, info@, or your campaign reply-to). Synentrix Flow creates a lead from each new message — name, email, phone, company, and requirement are parsed from the body when present. Matching email or phone is attached to the existing lead instead of creating a duplicate.",
        bullets: [
          "Integrations → Email Inbox (Lead capture) → enter the company inbox → Save & connect",
          "Forward that mailbox to this company's unique inbound address, or connect Gmail/Outlook IMAP so only this workspace reads the inbox",
          "The inbound URL includes your company slug — mail posted there cannot create leads in another company",
          "Use Fetch now to import immediately, or wait for automatic checks every few minutes",
        ],
      },
      {
        heading: "WhatsApp & SMS",
        body: "Choose your provider (Meta Cloud API, Twilio, MSG91, Textlocal). Paste API token and sender/phone number ID. Communications are logged on leads; outbound messages use your provider when connected.",
      },
      {
        heading: "Website Forms",
        body: "Generate API key under Lead automation & webhooks. POST JSON to the webhook URL with header X-Synentrix-Flow-Key. Required body field: firstName. Test by submitting your contact form — the lead should appear within seconds.",
      },
      {
        heading: "Google Ads, Facebook, LinkedIn",
        body: "These platforms do not push leads directly without a middleware app. Use Zapier/Make or your developer to forward lead form submissions to the Synentrix Flow webhook. Store your ad account or page IDs in the integration form for reference.",
      },
      {
        heading: "Zapier",
        body: "Create a Zap: Trigger = any app (Facebook Lead Ads, Google Sheets, etc.), Action = Webhooks POST to your Synentrix Flow URL with X-Synentrix-Flow-Key header. Map fields to firstName, email, phone, source.",
      },
    ],
  },
  {
    id: "lead-automation",
    title: "Lead capture & automation",
    content: [
      {
        body: "Company Admins can connect website forms and other inbound channels so leads flow into Synentrix Flow automatically — without manual entry.",
      },
      {
        heading: "Auto-assign new leads",
        body: "Under Settings → Lead automation & webhooks, turn on Auto-assign new leads. When enabled, any new lead created without an owner (manual entry, import, or webhook) is assigned round-robin to active Sales Executives in your workspace.",
      },
      {
        heading: "Website & form webhook",
        bullets: [
          "Settings → Lead automation & webhooks — Generate or Regenerate API key",
          "Copy the webhook URL shown on that page",
          "Configure your website form or automation tool to POST JSON to that URL",
          "Include header: X-Synentrix-Flow-Key: your-api-key",
          "Required field: firstName. Optional: lastName, email, phone, company, city, state, source, requirement, budget, remarks",
          "Default source is Website if not specified; duplicate email/phone returns an error so you do not create duplicates",
        ],
      },
      {
        heading: "Email marketing & inbox capture",
        body: "Companies that run email campaigns can connect Email Inbox under Integrations. Enquiries and replies that arrive on the company mailbox are parsed into leads (source: Email). Duplicate email or phone is attached to the existing lead with the message logged on the timeline.",
      },
      {
        heading: "Example webhook body",
        body: '{ "firstName": "Raj", "lastName": "Sharma", "email": "raj@example.com", "phone": "9876543210", "company": "Acme Pvt Ltd", "source": "Website", "requirement": "CRM for 10 users" }',
      },
      {
        heading: "After a webhook lead arrives",
        body: "The lead appears on the Leads list with status New, a timeline entry noting the webhook source, and an assignment notification to the executive if auto-assign or manual rules applied. Facebook, Google Ads, and WhatsApp lead forms can use the same webhook via Zapier, Make, or your developer — contact Synentrix if you need help wiring a specific channel.",
      },
    ],
  },
  {
    id: "pipeline-deals",
    title: "Pipeline & deals",
    content: [
      {
        body: "The pipeline is a Kanban board of open opportunities grouped by stage (e.g. Prospecting, Qualification, Proposal, Negotiation, Closed Won/Lost).",
      },
      {
        heading: "Board view",
        bullets: [
          "Drag a deal card to another column to change stage",
          "Click the deal name or ⋯ menu → View deal for full detail",
          "Use the stage dropdown on a card to move without dragging",
          "Quick Add / Full Form on the first column creates a new deal",
        ],
      },
      {
        heading: "List & archived views",
        body: "Switch tabs at the top: Board (active deals), List (table), Archived (won/lost). Filter by stage, owner, industry, or search text. Import deals from Excel/CSV using Import on the Pipeline page.",
      },
      {
        heading: "Deal detail",
        bullets: [
          "View amount, probability, expected close date, owner, notes",
          "Move to stage from the detail page",
          "Linked account and contact open in their pages",
          "Recent activities logged against the deal",
        ],
      },
    ],
  },
  {
    id: "quotations",
    title: "Quotations",
    content: [
      {
        body: "Create professional quotes for leads or customers with line items, per-line GST, global discount, and PDF output.",
      },
      {
        heading: "Creating a quote",
        bullets: [
          "Go to Quotations → New Quotation",
          "Select a lead (optional), add line items with quantity, unit price, tax %, and line discount",
          "Set global discount and default tax rate — totals recalculate automatically",
          "Save as draft",
        ],
      },
      {
        heading: "GST & totals",
        body: "Tax is calculated per line item, then summed. Global discount is applied before tax and allocated proportionally across lines. Amounts display in full rupees (e.g. ₹11,800 not rounded to ₹12K).",
      },
      {
        heading: "Workflow",
        bullets: [
          "Draft → Mark as sent (status update; email integration coming)",
          "Sent → Approve (manager/admin)",
          "Open PDF from list or detail — prints company logo, address, GSTIN, signature, stamp from Settings",
        ],
      },
      {
        heading: "Quotation branding",
        body: "Admins configure company legal name, address, GSTIN, logo, signature, stamp, and default terms under Settings → Company Profile and Quotation Branding. These appear on every PDF.",
      },
    ],
  },
  {
    id: "customers",
    title: "Customers (Customer 360)",
    content: [
      {
        body: "Customers are converted or manually added accounts with a unified view of orders, invoices, payments, tickets, and communications.",
      },
      {
        heading: "Customer list",
        body: "Browse all customers, search, and open a profile for the 360° view with tabs for overview, orders, invoices, payments, support tickets, and communication history.",
      },
    ],
  },
  {
    id: "contacts-accounts",
    title: "Contacts & accounts",
    content: [
      {
        body: "Accounts are companies; contacts are people. A contact can be linked to an account. Deals can reference both.",
      },
      {
        heading: "Contacts",
        bullets: [
          "Add contact with name, email, phone, title, notes",
          "Import contacts in bulk via Import → download template → upload Excel/CSV",
          "Edit from contact detail → Edit button",
          "View linked account and open deals",
        ],
      },
      {
        heading: "Accounts",
        bullets: [
          "Add company with industry, website, address, phone",
          "Import accounts in bulk from the Accounts page Import button",
          "Edit from account detail → Edit button",
          "See linked contacts and deals",
        ],
      },
    ],
  },
  {
    id: "follow-ups-tasks",
    title: "Follow-ups, tasks & activities",
    content: [
      {
        heading: "Follow-ups",
        body: "Schedule calls, meetings, emails, WhatsApp, video calls, or site visits on leads. View all upcoming and overdue items under Follow-ups. The dashboard shows today’s due count.",
        bullets: [
          "Create from lead detail → Follow-ups tab",
          "Mark complete when done",
          "Overdue follow-ups trigger in-app alerts for the owner",
          "Calendar page shows follow-ups alongside tasks and activities",
        ],
      },
      {
        heading: "Tasks",
        body: "General to-do items with title, due date, priority, and assignee. Filter by status, priority, or owner on the Tasks page. Import tasks in bulk from Excel/CSV using the Import button.",
      },
      {
        heading: "Activities",
        body: "Log sales activities — calls, emails, meetings, tasks, notes, and site visits — linked to deals or from Activities → Log activity. View all under Activities in the sidebar or from deal detail.",
      },
    ],
  },
  {
    id: "calendar-reports",
    title: "Calendar & reports",
    content: [
      {
        heading: "Calendar",
        body: "Monthly view of follow-ups, tasks, and activities. Click events to see details. Helps plan your week at a glance.",
      },
      {
        heading: "Reports",
        body: "Available to roles with the reports permission. Tabs include overview, conversion, sales, executive performance, follow-ups, lost leads, revenue, and daily activity.",
        bullets: [
          "Lead conversion by source and status",
          "Pipeline value and won/lost revenue",
          "Per-executive won deals and revenue",
          "Follow-up due today, overdue, completed",
        ],
      },
    ],
  },
  {
    id: "team-settings",
    title: "Team & settings",
    content: [
      {
        heading: "Team management",
        body: "The Company Admin manages the full team. Sales Managers can add executives under themselves. All additions must stay within your subscription user limit.",
        bullets: [
          "Team page — add manager or executive with name, email, and password",
          "Assign each executive to a Sales Manager",
          "Activate or deactivate members without deleting their history",
          "If you see “Team limit reached”, upgrade your plan via Synentrix",
        ],
      },
      {
        heading: "Settings",
        bullets: [
          "Company Profile — legal name, address, GSTIN, contact details",
          "Quotation Branding — logo, signature, stamp, signatory, default terms",
          "Integrations — link to the full Integrations portal (admins)",
          "About — product info and support contact",
        ],
      },
    ],
  },
  {
    id: "notifications-search",
    title: "Notifications & search",
    content: [
      {
        heading: "Notifications",
        body: "The bell in the header shows your unread count and updates automatically while you use the app. Open Notifications to see alerts for new lead assignments, overdue follow-ups, upcoming follow-ups, deal stage changes, and quote approvals. Mark individual items or all as read.",
      },
      {
        heading: "Global search",
        body: "Type at least 2 characters in the top search bar. Results group by Leads, Contacts, Accounts, Deals, and Customers. Click a result to jump directly to that record.",
      },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    content: [
      {
        body: "Central place to browse files uploaded across leads and workspace. Useful for finding proposals, contracts, and attachments without opening each lead individually.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting & support",
    content: [
      {
        heading: "Common issues",
        bullets: [
          "Cannot log in — use credentials from Synentrix or your company admin; check subscription expiry",
          "Cannot add team member — you may have reached your plan’s user limit; contact Synentrix to upgrade",
          "Missing menu items — your role may not include that permission; ask your admin",
          "Empty pipeline — create a deal from Pipeline → Create or convert a qualified lead",
          "PDF missing logo — admin must upload branding in Settings → Quotation Branding",
          "Reports blocked — only roles with reports permission can access Reports",
          "Import failed — download the latest template, check required columns, and use CSV or Excel format",
          "Webhook returns 401 — regenerate the API key in Settings and update your form’s X-Synentrix-Flow-Key header",
          "Webhook returns 409 — a lead with the same email or phone already exists; open that lead instead",
          "Cannot find a lead — check View filter (Active vs Archived) and clear other filters",
          "Auto-assign not working — confirm the toggle is on in Settings and you have active Sales Executives",
        ],
      },
      {
        heading: "Contact support",
        body: "For technical help, billing, onboarding, or feature requests, email Synentrix Technologies. Include your workspace name, user email, and a short description of the issue. Screenshots help us resolve faster.",
      },
    ],
  },
];
