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

export const LEAD_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const ASSIGNMENT_METHODS = [
  "round_robin",
  "load_based",
  "location_based",
  "source_based",
  "product_based",
] as const;

export const ASSIGNMENT_METHOD_LABELS: Record<string, string> = {
  round_robin: "Round Robin",
  load_based: "Load-Based",
  location_based: "Location-Based",
  source_based: "Source-Based",
  product_based: "Product-Based",
};

export const FOLLOWUP_TYPES = [
  "call",
  "meeting",
  "email",
  "whatsapp",
  "video_call",
  "site_visit",
  "demo",
  "proposal",
  "other",
] as const;

export const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "task",
  "note",
  "site_visit",
] as const;

export const COMMUNICATION_CHANNELS = ["email", "whatsapp", "sms", "call"] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number];
export type FollowUpType = (typeof FOLLOWUP_TYPES)[number];
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

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

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  task: "Task",
  note: "Note",
  site_visit: "Site visit",
};

/** Lead pipeline stages for UI funnel display */
export const LEAD_PIPELINE_STAGES = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;
