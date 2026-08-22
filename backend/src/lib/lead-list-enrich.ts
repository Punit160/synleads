import { prisma } from "./prisma";
import { fetchActivityMetaForLeads, type LeadActivityCounts, type LeadActivityPreview } from "./lead-activity";

export type { LeadActivityCounts, LeadActivityPreview };

const PIPELINE_STAGES = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "follow_up",
  "won",
] as const;

export function leadProgressPercent(status: string): number {
  if (status === "lost" || status === "on_hold") return 0;
  const idx = PIPELINE_STAGES.indexOf(status as (typeof PIPELINE_STAGES)[number]);
  if (idx === -1) return 15;
  return Math.round(((idx + 1) / PIPELINE_STAGES.length) * 100);
}

type LeadRow = {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  company: string | null;
  title: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: string | null;
  status: string;
  priority: string;
  budget: number | null;
  requirement: string | null;
  remarks: string | null;
  expectedClosingDate: Date | null;
  score: number;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; name: string } | null;
};

export async function enrichLeadsForList(leads: LeadRow[]) {
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length === 0) return [];

  const [pendingFollowUps, callFollowUps, meetingFollowUps, callComms] = await Promise.all([
    prisma.followUp.findMany({
      where: { leadId: { in: leadIds }, completed: false },
      orderBy: { scheduledAt: "asc" },
      select: { leadId: true, scheduledAt: true, type: true },
    }),
    prisma.followUp.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, type: "call" },
      _count: { _all: true },
    }),
    prisma.followUp.groupBy({
      by: ["leadId"],
      where: {
        leadId: { in: leadIds },
        type: { in: ["meeting", "video_call", "site_visit"] },
      },
      _count: { _all: true },
    }),
    prisma.communication.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, channel: "call" },
      _count: { _all: true },
    }),
  ]);

  const nextByLead = new Map<string, { scheduledAt: Date; type: string }>();
  for (const fu of pendingFollowUps) {
    if (!nextByLead.has(fu.leadId)) {
      nextByLead.set(fu.leadId, { scheduledAt: fu.scheduledAt, type: fu.type });
    }
  }

  const callCount = new Map<string, number>();
  for (const row of callFollowUps) callCount.set(row.leadId, row._count._all);
  for (const row of callComms) {
    callCount.set(row.leadId, (callCount.get(row.leadId) || 0) + row._count._all);
  }

  const meetingCount = new Map<string, number>();
  for (const row of meetingFollowUps) meetingCount.set(row.leadId, row._count._all);

  const { recentByLead, countsByLead, lastActivityByLead } = await fetchActivityMetaForLeads(leadIds, 4);

  return leads.map((lead) => {
    const next = nextByLead.get(lead.id);
    return {
      ...lead,
      nextFollowUp: next
        ? { scheduledAt: next.scheduledAt.toISOString(), type: next.type }
        : null,
      callAttempts: callCount.get(lead.id) || 0,
      meetingAttempts: meetingCount.get(lead.id) || 0,
      progressPercent: leadProgressPercent(lead.status),
      recentActivity: recentByLead.get(lead.id) || [],
      activityCounts: countsByLead.get(lead.id) || {
        timeline: 0,
        notes: 0,
        communications: 0,
        followUps: 0,
        pendingFollowUps: 0,
        attachments: 0,
      },
      lastActivityAt: lastActivityByLead.get(lead.id) || lead.updatedAt.toISOString(),
    };
  });
}
