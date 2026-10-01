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
    recentNotes,
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
    prisma.leadNote.findMany({
      where: { leadId: { in: leadIds } },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
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

  type PreviewDraft = LeadActivityPreview & { sortAt: number };
  const draftsByLead = new Map<string, PreviewDraft[]>();

  function pushDraft(leadId: string, draft: PreviewDraft) {
    const list = draftsByLead.get(leadId) || [];
    list.push(draft);
    draftsByLead.set(leadId, list);
  }

  for (const event of timelineEvents) {
    if (event.type === "note") continue;
    pushDraft(event.leadId, {
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      createdAt: event.createdAt.toISOString(),
      userName: event.user?.name ?? null,
      sortAt: event.createdAt.getTime(),
    });
  }

  for (const note of recentNotes) {
    pushDraft(note.leadId, {
      id: note.id,
      type: "note",
      title: "Note added",
      description: note.content,
      createdAt: note.createdAt.toISOString(),
      userName: note.author?.name ?? null,
      sortAt: note.createdAt.getTime(),
    });
  }

  const lastActivityByLead = new Map<string, string>();
  for (const [leadId, drafts] of draftsByLead) {
    drafts.sort((a, b) => b.sortAt - a.sortAt);
    recentByLead.set(
      leadId,
      drafts.slice(0, previewLimit).map(({ sortAt: _sortAt, ...preview }) => preview)
    );
    if (drafts.length > 0) {
      lastActivityByLead.set(leadId, drafts[0].createdAt);
    }
  }
  for (const event of timelineEvents) {
    if (!lastActivityByLead.has(event.leadId)) {
      lastActivityByLead.set(event.leadId, event.createdAt.toISOString());
    }
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
