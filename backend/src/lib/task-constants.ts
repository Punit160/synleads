export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
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
