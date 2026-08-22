import { prisma } from "./prisma";
import { mapRowHeaders } from "./spreadsheet";
import { TASK_PRIORITIES, TASK_STATUSES } from "./task-constants";

const ALIASES: Record<string, string> = {
  title: "title",
  description: "description",
  duedate: "dueDate",
  due: "dueDate",
  priority: "priority",
  status: "status",
  assigneeemail: "assigneeEmail",
  assignee: "assigneeEmail",
};

export async function importTaskRows(
  workspaceId: string,
  rows: Record<string, string>[],
  defaultOwnerId: string
) {
  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const raw of rows) {
    const row = mapRowHeaders(raw, ALIASES);
    if (!row.title) {
      errors.push("Skipped row: missing title");
      continue;
    }

    let assigneeId: string | null = defaultOwnerId;
    if (row.assigneeEmail) {
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          status: "active",
          user: { email: row.assigneeEmail },
        },
        select: { userId: true },
      });
      if (member) assigneeId = member.userId;
      else errors.push(`Task "${row.title}": assignee "${row.assigneeEmail}" not found — assigned to you`);
    }

    await prisma.task.create({
      data: {
        workspaceId,
        createdById: defaultOwnerId,
        assigneeId,
        title: row.title,
        description: row.description || null,
        dueDate: row.dueDate ? new Date(row.dueDate) : null,
        priority: TASK_PRIORITIES.includes(row.priority as typeof TASK_PRIORITIES[number]) ? row.priority : "medium",
        status: TASK_STATUSES.includes(row.status as typeof TASK_STATUSES[number]) ? row.status : "pending",
      },
    });
    imported++;
  }

  return { imported, duplicates, errors };
}
