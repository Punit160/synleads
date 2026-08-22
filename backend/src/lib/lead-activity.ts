import { prisma } from "./prisma";

export type LeadActivityPreview = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  userName: string | null;
};

export type LeadActivityCounts = {
  timeline: number;
  notes: number;
  communications: number;
  followUps: number;
  pendingFollowUps: number;
  attachments: number;
};

export async function fetchActivityMetaForLeads(leadIds: string[], previewLimit = 4) {
  if (leadIds.length === 0) {
    return {
      recentByLead: new Map<string, LeadActivityPreview[]>(),
      countsByLead: new Map<string, LeadActivityCounts>(),
      lastActivityByLead: new Map<string, string>(),
    };
  }

  const [
    timelineEvents,
    noteCounts,
    commCounts,
    followUpCounts,
    pendingFollowUpCounts,
    attachmentCounts,
    timelineCounts,
  ] = await Promise.all([
    prisma.leadTimelineEvent.findMany({
      where: { leadId: { in: leadIds } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.leadNote.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _count: { _all: true },
    }),
    prisma.communication.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _count: { _all: true },
    }),
    prisma.followUp.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _count: { _all: true },
    }),
    prisma.followUp.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, completed: false },
      _count: { _all: true },
    }),
    prisma.leadAttachment.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _count: { _all: true },
    }),
    prisma.leadTimelineEvent.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _count: { _all: true },
    }),
  ]);

  const recentByLead = new Map<string, LeadActivityPreview[]>();
  for (const event of timelineEvents) {
    const list = recentByLead.get(event.leadId) || [];
    if (list.length >= previewLimit) continue;
    list.push({
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      createdAt: event.createdAt.toISOString(),
      userName: event.user?.name ?? null,
    });
    recentByLead.set(event.leadId, list);
  }

  const countsByLead = new Map<string, LeadActivityCounts>();
  const countMap = (
    rows: { leadId: string; _count: { _all: number } }[],
    key: keyof LeadActivityCounts
  ) => {
    for (const row of rows) {
      const existing = countsByLead.get(row.leadId) || emptyCounts();
      existing[key] = row._count._all;
      countsByLead.set(row.leadId, existing);
    }
  };

  countMap(timelineCounts, "timeline");
  countMap(noteCounts, "notes");
  countMap(commCounts, "communications");
  countMap(followUpCounts, "followUps");
  countMap(pendingFollowUpCounts, "pendingFollowUps");
  countMap(attachmentCounts, "attachments");

  const lastActivityByLead = new Map<string, string>();
  for (const event of timelineEvents) {
    if (!lastActivityByLead.has(event.leadId)) {
      lastActivityByLead.set(event.leadId, event.createdAt.toISOString());
    }
  }

  return { recentByLead, countsByLead, lastActivityByLead };
}

function emptyCounts(): LeadActivityCounts {
  return {
    timeline: 0,
    notes: 0,
    communications: 0,
    followUps: 0,
    pendingFollowUps: 0,
    attachments: 0,
  };
}
