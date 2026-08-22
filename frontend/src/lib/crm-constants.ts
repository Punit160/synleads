export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
};

export const TASK_PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border border-slate-200",
  medium: "bg-blue-50 text-blue-700 border border-blue-200",
  high: "bg-amber-50 text-amber-800 border border-amber-200",
  urgent: "bg-rose-50 text-rose-700 border border-rose-200",
};

export const TASK_STATUS_BADGE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 border border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200",
};

export const ROLES = ["owner", "admin", "manager", "employee", "viewer"] as const;

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Sales Manager",
  employee: "Sales Executive",
  viewer: "Viewer",
};

export const PACKAGE_LABELS: Record<string, string> = {
  trial_7d: "7-Day Trial · 5 Users",
  yearly_5: "Yearly · 5 Users · ₹2,999",
  yearly_10: "Yearly · 10 Users · ₹5,499",
  yearly_20: "Yearly · 20 Users · ₹9,499",
  yearly_50: "Yearly · 50 Users · ₹19,999",
  yearly_100: "Yearly · 100 Users · ₹37,999",
  yearly_200: "Yearly · 200 Users · ₹69,999",
  yearly_500: "Yearly · 500 Users · ₹1,49,999",
};

export const YEARLY_TEAM_SIZES = [5, 10, 20, 50, 100, 200, 500] as const;

export const DOC_CATEGORIES = [
  { id: "general", label: "General" },
  { id: "agreement", label: "Agreements" },
  { id: "quotation", label: "Quotations" },
  { id: "image", label: "Images" },
  { id: "pdf", label: "PDFs" },
  { id: "contract", label: "Contracts" },
];

export const QUOTE_STATUSES: Record<string, string> = {
  draft: "Draft", sent: "Sent", approved: "Approved", rejected: "Rejected", expired: "Expired",
};

export const REPORT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "source", label: "Lead Source" },
  { id: "conversion", label: "Conversion" },
  { id: "employees", label: "Employee-wise" },
  { id: "teams", label: "Team-wise" },
  { id: "assignment", label: "Assignment" },
  { id: "sales", label: "Sales" },
  { id: "executive", label: "Executive Performance" },
  { id: "followup", label: "Follow-up" },
  { id: "wonlost", label: "Won / Lost" },
  { id: "lost", label: "Lost Leads" },
  { id: "revenue", label: "Revenue" },
  { id: "monthly", label: "Monthly" },
  { id: "daily", label: "Daily Activity" },
] as const;
