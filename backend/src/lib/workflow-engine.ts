import { prisma } from "./prisma";
import { createNotification } from "./notifications";
import { addTimelineEvent } from "./lead-utils";
import type { Lead } from "@prisma/client";

export type WorkflowCondition = { field: string; operator: string; value?: string };
export type WorkflowAction =
  | { type: "set_status"; status: string }
  | { type: "set_priority"; priority: string }
  | { type: "create_followup"; followUpType: string; hoursFromNow: number; notes?: string }
  | { type: "create_task"; title: string; priority?: string; dueHours?: number }
  | { type: "notify_owner"; title: string; message: string }
  | { type: "notify_manager"; title: string; message: string };

function getLeadField(lead: Lead, field: string): string | number | null {
  if (field === "score") return lead.score;
  if (field === "budget") return lead.budget ?? 0;
  const v = (lead as Record<string, unknown>)[field];
  if (typeof v === "number") return v;
  return v != null ? String(v) : null;
}

function conditionMatches(lead: Lead, cond: WorkflowCondition): boolean {
  const raw = getLeadField(lead, cond.field);
  const op = cond.operator;
  const expected = cond.value?.trim() ?? "";

  if (op === "exists") return raw != null && String(raw).length > 0;
  if (typeof raw === "number") {
    const num = parseFloat(expected);
    if (Number.isNaN(num)) return false;
    if (op === "gte") return raw >= num;
    if (op === "gt") return raw > num;
    if (op === "lte") return raw <= num;
    if (op === "equals") return raw === num;
    return false;
  }

  const hay = String(raw ?? "").toLowerCase();
  const needle = expected.toLowerCase();
  if (op === "equals") return hay === needle;
  if (op === "not_equals") return hay !== needle;
  if (op === "contains") return hay.includes(needle);
  if (op === "in") {
    const parts = expected.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return parts.includes(hay);
  }
  return false;
}

function parseConditions(raw: unknown): WorkflowCondition[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is WorkflowCondition => typeof c === "object" && c != null && "field" in c);
}

function parseActions(raw: unknown): WorkflowAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is WorkflowAction => typeof a === "object" && a != null && "type" in a);
}

async function getManagerUserId(workspaceId: string, ownerId: string | null): Promise<string | null> {
  if (!ownerId) return null;
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: ownerId } },
    select: { managerUserId: true },
  });
  return member?.managerUserId ?? null;
}

async function executeAction(
  workspaceId: string,
  lead: Lead,
  action: WorkflowAction,
  actorUserId?: string | null
): Promise<void> {
  switch (action.type) {
    case "set_status":
      if (action.status && action.status !== lead.status) {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: action.status } });
        await addTimelineEvent(lead.id, "status_change", `Status set to ${action.status}`, "Workflow automation", actorUserId ?? undefined);
      }
      break;
    case "set_priority":
      if (action.priority) {
        await prisma.lead.update({ where: { id: lead.id }, data: { priority: action.priority } });
      }
      break;
    case "create_followup": {
      const scheduledAt = new Date(Date.now() + (action.hoursFromNow || 24) * 60 * 60 * 1000);
      await prisma.followUp.create({
        data: {
          workspaceId,
          leadId: lead.id,
          ownerId: lead.ownerId,
          type: action.followUpType || "call",
          scheduledAt,
          notes: action.notes || "Auto-scheduled by workflow",
        },
      });
      break;
    }
    case "create_task": {
      const dueAt = new Date(Date.now() + (action.dueHours || 48) * 60 * 60 * 1000);
      await prisma.task.create({
        data: {
          workspaceId,
          title: action.title,
          priority: action.priority || "medium",
          status: "pending",
          dueDate: dueAt,
          assigneeId: lead.ownerId,
          createdById: actorUserId || lead.ownerId,
          leadId: lead.id,
        },
      });
      break;
    }
    case "notify_owner":
      if (lead.ownerId) {
        await createNotification({
          workspaceId,
          userId: lead.ownerId,
          type: "workflow_alert",
          title: action.title,
          message: action.message,
          channel: "browser",
          relatedType: "lead",
          relatedId: lead.id,
        });
      }
      break;
    case "notify_manager": {
      const managerId = await getManagerUserId(workspaceId, lead.ownerId);
      if (managerId) {
        await createNotification({
          workspaceId,
          userId: managerId,
          type: "workflow_alert",
          title: action.title,
          message: action.message,
          channel: "browser",
          relatedType: "lead",
          relatedId: lead.id,
        });
      }
      break;
    }
  }
}

export async function runWorkflows(input: {
  workspaceId: string;
  trigger: string;
  lead: Lead;
  previousStatus?: string | null;
  actorUserId?: string | null;
}): Promise<number> {
  const rules = await prisma.workflowRule.findMany({
    where: { workspaceId: input.workspaceId, isActive: true, trigger: input.trigger },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  let executed = 0;
  for (const rule of rules) {
    const conditions = parseConditions(rule.conditions);
    const allMatch =
      conditions.length === 0 ||
      conditions.every((c) => {
        if (c.field === "previous_status" && input.previousStatus != null) {
          return conditionMatches({ ...input.lead, status: input.previousStatus } as Lead, {
            ...c,
            field: "status",
          });
        }
        return conditionMatches(input.lead, c);
      });
    if (!allMatch) continue;

    const actions = parseActions(rule.actions);
    for (const action of actions) {
      await executeAction(input.workspaceId, input.lead, action, input.actorUserId);
    }
    executed += 1;
  }
  return executed;
}
