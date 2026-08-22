export const LEAD_SOURCES = [
  "Website",
  "IndiaMART",
  "Google Ads",
  "Facebook",
  "Facebook Ads",
  "Instagram",
  "LinkedIn",
  "WhatsApp",
  "Email",
  "Email Campaign",
  "Referral",
  "API",
  "Walk-in",
  "Cold Call",
  "Trade Show",
  "Manual Entry",
] as const;

export const LEAD_STATUSES = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "follow_up",
  "won",
  "lost",
  "on_hold",
] as const;

export const ASSIGNMENT_METHODS = [
  { id: "round_robin", label: "Round Robin" },
  { id: "load_based", label: "Load-Based" },
  { id: "location_based", label: "Location-Based" },
  { id: "source_based", label: "Source-Based" },
  { id: "product_based", label: "Product-Based" },
] as const;

export const LEAD_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const FOLLOWUP_TYPES = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "video_call", label: "Video Call" },
  { value: "site_visit", label: "Site visit" },
] as const;

export const FOLLOWUP_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  meeting: "Meeting",
  email: "Email",
  whatsapp: "WhatsApp",
  video_call: "Video call",
  site_visit: "Site visit",
};

export const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
  { value: "note", label: "Note" },
  { value: "site_visit", label: "Site visit" },
] as const;

export const COMM_CHANNELS = [
  { value: "email", label: "Email", icon: "mail" },
  { value: "whatsapp", label: "WhatsApp", icon: "message" },
  { value: "sms", label: "SMS", icon: "smartphone" },
  { value: "call", label: "Click-to-Call", icon: "phone" },
] as const;

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  assigned: "Assigned",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal / Quotation",
  negotiation: "Negotiation",
  follow_up: "Follow-up",
  won: "Won",
  lost: "Lost",
  on_hold: "On Hold",
  converted: "Won",
};

export const STATUS_BADGE: Record<string, string> = {
  new: "bg-slate-100 text-slate-700 border border-slate-200",
  assigned: "bg-sky-50 text-sky-700 border border-sky-200",
  contacted: "bg-blue-50 text-blue-700 border border-blue-200",
  qualified: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  proposal_sent: "bg-violet-50 text-violet-700 border border-violet-200",
  negotiation: "bg-amber-50 text-amber-800 border border-amber-200",
  follow_up: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  won: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  lost: "bg-rose-50 text-rose-700 border border-rose-200",
  on_hold: "bg-orange-50 text-orange-700 border border-orange-200",
};

export const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border border-slate-200",
  medium: "bg-blue-50 text-blue-700 border border-blue-200",
  high: "bg-amber-50 text-amber-800 border border-amber-200",
  urgent: "bg-rose-50 text-rose-700 border border-rose-200",
};

export const LEAD_PIPELINE_STAGES = [
  { id: "new", label: "New" },
  { id: "assigned", label: "Assigned" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal_sent", label: "Proposal / Quotation" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;
