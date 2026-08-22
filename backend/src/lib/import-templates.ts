import { buildTemplateWorkbook } from "./spreadsheet";
import { LEAD_STATUSES, LEAD_PRIORITIES } from "./lead-constants";
import { TASK_PRIORITIES, TASK_STATUSES } from "./task-constants";

export type ImportEntity = "leads" | "contacts" | "accounts" | "deals" | "customers" | "tasks";

type ColumnDef = {
  key: string;
  label: string;
  required: boolean;
  example: string;
  notes: string;
};

const TEMPLATES: Record<
  ImportEntity,
  { label: string; filename: string; columns: ColumnDef[]; samples: Record<string, string>[] }
> = {
  leads: {
    label: "Leads",
    filename: "leads-import-template.xlsx",
    columns: [
      { key: "firstName", label: "First name", required: true, example: "Rahul", notes: "Required — contact first name" },
      { key: "lastName", label: "Last name", required: false, example: "Sharma", notes: "Optional" },
      { key: "email", label: "Email", required: false, example: "rahul@example.com", notes: "Used for duplicate check" },
      { key: "phone", label: "Phone", required: false, example: "9876543210", notes: "Used for duplicate check" },
      { key: "company", label: "Company", required: false, example: "Acme Pvt Ltd", notes: "Company or organisation name" },
      { key: "city", label: "City", required: false, example: "Mumbai", notes: "Optional" },
      { key: "state", label: "State", required: false, example: "Maharashtra", notes: "Optional" },
      { key: "source", label: "Source", required: false, example: "Website", notes: "Lead source channel" },
      { key: "status", label: "Status", required: false, example: "new", notes: `Allowed: ${LEAD_STATUSES.join(", ")}` },
      { key: "priority", label: "Priority", required: false, example: "medium", notes: `Allowed: ${LEAD_PRIORITIES.join(", ")}` },
      { key: "budget", label: "Budget", required: false, example: "500000", notes: "Numeric budget in INR" },
      { key: "requirement", label: "Requirement", required: false, example: "CRM for 20 users", notes: "Optional notes" },
      { key: "remarks", label: "Remarks", required: false, example: "Follow up next week", notes: "Optional" },
    ],
    samples: [
      {
        firstName: "Rahul",
        lastName: "Sharma",
        email: "rahul@example.com",
        phone: "9876543210",
        company: "Acme Pvt Ltd",
        city: "Mumbai",
        state: "Maharashtra",
        source: "Website",
        status: "new",
        priority: "medium",
        budget: "500000",
        requirement: "CRM for 20 users",
        remarks: "Demo scheduled",
      },
      {
        firstName: "Priya",
        lastName: "Patel",
        email: "priya@example.com",
        phone: "9123456780",
        company: "Bright Solutions",
        city: "Ahmedabad",
        state: "Gujarat",
        source: "Referral",
        status: "contacted",
        priority: "high",
        budget: "250000",
        requirement: "Lead management",
        remarks: "",
      },
    ],
  },
  contacts: {
    label: "Contacts",
    filename: "contacts-import-template.xlsx",
    columns: [
      { key: "firstName", label: "First name", required: true, example: "Amit", notes: "Required" },
      { key: "lastName", label: "Last name", required: false, example: "Verma", notes: "Optional" },
      { key: "email", label: "Email", required: false, example: "amit@acme.com", notes: "Duplicate check" },
      { key: "phone", label: "Phone", required: false, example: "9988776655", notes: "Duplicate check" },
      { key: "title", label: "Job title", required: false, example: "Sales Manager", notes: "Optional" },
      { key: "accountName", label: "Account name", required: false, example: "Acme Pvt Ltd", notes: "Links to existing account by name" },
      { key: "notes", label: "Notes", required: false, example: "Key decision maker", notes: "Optional" },
    ],
    samples: [
      { firstName: "Amit", lastName: "Verma", email: "amit@acme.com", phone: "9988776655", title: "Sales Manager", accountName: "Acme Pvt Ltd", notes: "Primary contact" },
      { firstName: "Neha", lastName: "Gupta", email: "neha@bright.com", phone: "9112233445", title: "Director", accountName: "Bright Solutions", notes: "" },
    ],
  },
  accounts: {
    label: "Accounts",
    filename: "accounts-import-template.xlsx",
    columns: [
      { key: "name", label: "Account name", required: true, example: "Acme Pvt Ltd", notes: "Required — company name" },
      { key: "industry", label: "Industry", required: false, example: "Manufacturing", notes: "Optional" },
      { key: "website", label: "Website", required: false, example: "https://acme.com", notes: "Optional URL" },
      { key: "phone", label: "Phone", required: false, example: "02212345678", notes: "Optional" },
      { key: "city", label: "City", required: false, example: "Mumbai", notes: "Optional" },
      { key: "state", label: "State", required: false, example: "Maharashtra", notes: "Optional" },
      { key: "country", label: "Country", required: false, example: "India", notes: "Defaults to India" },
      { key: "notes", label: "Notes", required: false, example: "Enterprise prospect", notes: "Optional" },
    ],
    samples: [
      { name: "Acme Pvt Ltd", industry: "Manufacturing", website: "https://acme.com", phone: "02212345678", city: "Mumbai", state: "Maharashtra", country: "India", notes: "Key account" },
      { name: "Bright Solutions", industry: "IT Services", website: "https://bright.in", phone: "07998765432", city: "Ahmedabad", state: "Gujarat", country: "India", notes: "" },
    ],
  },
  deals: {
    label: "Deals",
    filename: "deals-import-template.xlsx",
    columns: [
      { key: "name", label: "Deal name", required: true, example: "Acme CRM rollout", notes: "Required" },
      { key: "stageName", label: "Pipeline stage", required: true, example: "Proposal", notes: "Must match an existing stage name in your pipeline" },
      { key: "amount", label: "Amount", required: false, example: "350000", notes: "Deal value in INR" },
      { key: "probability", label: "Probability %", required: false, example: "60", notes: "0–100" },
      { key: "accountName", label: "Account name", required: false, example: "Acme Pvt Ltd", notes: "Links to existing account" },
      { key: "contactEmail", label: "Contact email", required: false, example: "amit@acme.com", notes: "Links to existing contact" },
      { key: "expectedCloseDate", label: "Expected close", required: false, example: "2026-08-15", notes: "YYYY-MM-DD format" },
      { key: "notes", label: "Notes", required: false, example: "Needs approval", notes: "Optional" },
    ],
    samples: [
      { name: "Acme CRM rollout", stageName: "Proposal", amount: "350000", probability: "60", accountName: "Acme Pvt Ltd", contactEmail: "amit@acme.com", expectedCloseDate: "2026-08-15", notes: "Q3 target" },
      { name: "Bright annual license", stageName: "Qualification", amount: "120000", probability: "40", accountName: "Bright Solutions", contactEmail: "neha@bright.com", expectedCloseDate: "2026-09-01", notes: "" },
    ],
  },
  customers: {
    label: "Customers",
    filename: "customers-import-template.xlsx",
    columns: [
      { key: "name", label: "Customer name", required: true, example: "Acme Pvt Ltd", notes: "Required" },
      { key: "email", label: "Email", required: false, example: "billing@acme.com", notes: "Duplicate check" },
      { key: "phone", label: "Phone", required: false, example: "9876501234", notes: "Duplicate check" },
      { key: "company", label: "Company", required: false, example: "Acme Pvt Ltd", notes: "Optional display name" },
      { key: "notes", label: "Notes", required: false, example: "Converted from lead", notes: "Optional" },
    ],
    samples: [
      { name: "Acme Pvt Ltd", email: "billing@acme.com", phone: "9876501234", company: "Acme Pvt Ltd", notes: "Annual contract" },
      { name: "Bright Solutions", email: "accounts@bright.in", phone: "9123409876", company: "Bright Solutions", notes: "" },
    ],
  },
  tasks: {
    label: "Tasks",
    filename: "tasks-import-template.xlsx",
    columns: [
      { key: "title", label: "Title", required: true, example: "Call Rahul for demo", notes: "Required" },
      { key: "description", label: "Description", required: false, example: "Discuss pricing and timeline", notes: "Optional" },
      { key: "dueDate", label: "Due date", required: false, example: "2026-07-25", notes: "YYYY-MM-DD" },
      { key: "priority", label: "Priority", required: false, example: "medium", notes: `Allowed: ${TASK_PRIORITIES.join(", ")}` },
      { key: "status", label: "Status", required: false, example: "pending", notes: `Allowed: ${TASK_STATUSES.join(", ")}` },
      { key: "assigneeEmail", label: "Assignee email", required: false, example: "manager@company.com", notes: "Must match a workspace user email" },
    ],
    samples: [
      { title: "Call Rahul for demo", description: "Discuss pricing", dueDate: "2026-07-25", priority: "high", status: "pending", assigneeEmail: "" },
      { title: "Send proposal to Bright", description: "", dueDate: "2026-07-28", priority: "medium", status: "pending", assigneeEmail: "" },
    ],
  },
};

export function getImportTemplateBuffer(entity: ImportEntity): Buffer {
  const t = TEMPLATES[entity];
  return buildTemplateWorkbook(t.label, t.columns, t.samples);
}

export function getImportTemplateFilename(entity: ImportEntity): string {
  return TEMPLATES[entity].filename;
}
