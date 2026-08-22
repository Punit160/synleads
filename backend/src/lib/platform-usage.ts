import { prisma } from "./prisma";
import { PACKAGE_LABELS, packageMaxUsers, type SubscriptionPackage } from "./roles";
import { ensureSubscriptionHistory } from "./subscription-history";

function normalizeMemberRole(role: string): string {
  if (role === "owner" || role === "admin") return "admin";
  if (role === "manager" || role === "sales_manager") return "manager";
  if (role === "viewer" || role === "accountant") return "viewer";
  return "employee";
}

export async function getPlatformUsageReport() {
  const companies = await prisma.workspace.findMany({
    orderBy: { name: "asc" },
    include: {
      subscription: true,
      members: { where: { status: "active" }, select: { role: true } },
      subscriptionHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: {
        select: {
          leads: true,
          contacts: true,
          accounts: true,
          deals: true,
          activities: true,
          tasks: true,
          quotations: true,
          documents: true,
          customers: true,
          followUps: true,
          communications: true,
          calendarEvents: true,
          notifications: true,
          members: true,
        },
      },
    },
  });

  await Promise.all(companies.map((c) => ensureSubscriptionHistory(c.id)));

  const refreshed = await prisma.workspace.findMany({
    orderBy: { name: "asc" },
    include: {
      subscription: true,
      members: { where: { status: "active" }, select: { role: true } },
      subscriptionHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: {
        select: {
          leads: true,
          contacts: true,
          accounts: true,
          deals: true,
          activities: true,
          tasks: true,
          quotations: true,
          documents: true,
          customers: true,
          followUps: true,
          communications: true,
          calendarEvents: true,
          notifications: true,
          members: true,
        },
      },
    },
  });

  const entityTotals = {
    leads: 0,
    contacts: 0,
    accounts: 0,
    deals: 0,
    activities: 0,
    tasks: 0,
    quotations: 0,
    documents: 0,
    customers: 0,
    followUps: 0,
    communications: 0,
    calendarEvents: 0,
    notifications: 0,
    members: 0,
  };

  const companyRows = refreshed.map((c) => {
    const counts = c._count;
    const roleCounts = { admin: 0, manager: 0, employee: 0, viewer: 0 };
    for (const m of c.members) {
      const r = normalizeMemberRole(m.role);
      roleCounts[r as keyof typeof roleCounts]++;
    }

    const usage = {
      users: counts.members,
      admins: roleCounts.admin,
      managers: roleCounts.manager,
      employees: roleCounts.employee,
      viewers: roleCounts.viewer,
      leads: counts.leads,
      contacts: counts.contacts,
      accounts: counts.accounts,
      deals: counts.deals,
      activities: counts.activities,
      tasks: counts.tasks,
      quotations: counts.quotations,
      documents: counts.documents,
      customers: counts.customers,
      followUps: counts.followUps,
      communications: counts.communications,
      calendarEvents: counts.calendarEvents,
      notifications: counts.notifications,
    };

    const totalRecords =
      usage.leads +
      usage.contacts +
      usage.accounts +
      usage.deals +
      usage.activities +
      usage.tasks +
      usage.quotations +
      usage.documents +
      usage.customers +
      usage.followUps +
      usage.communications +
      usage.calendarEvents;

    entityTotals.leads += usage.leads;
    entityTotals.contacts += usage.contacts;
    entityTotals.accounts += usage.accounts;
    entityTotals.deals += usage.deals;
    entityTotals.activities += usage.activities;
    entityTotals.tasks += usage.tasks;
    entityTotals.quotations += usage.quotations;
    entityTotals.documents += usage.documents;
    entityTotals.customers += usage.customers;
    entityTotals.followUps += usage.followUps;
    entityTotals.communications += usage.communications;
    entityTotals.calendarEvents += usage.calendarEvents;
    entityTotals.notifications += usage.notifications;
    entityTotals.members += usage.users;

    const pkg = c.subscription?.package ?? "trial_7d";
    const maxUsers = packageMaxUsers(pkg);

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt,
      currentPackage: pkg,
      currentPackageLabel: PACKAGE_LABELS[pkg as SubscriptionPackage] || pkg,
      maxUsers,
      expiresAt: c.subscription?.expiresAt ?? null,
      packageHistory: c.subscriptionHistory.map((h) => ({
        id: h.id,
        package: h.package,
        packageLabel: PACKAGE_LABELS[h.package as SubscriptionPackage] || h.package,
        previousPackage: h.previousPackage,
        changeType: h.changeType,
        startsAt: h.startsAt,
        expiresAt: h.expiresAt,
        endedAt: h.endedAt,
        isCurrent: !h.endedAt && h.package === pkg,
      })),
      usage,
      totalRecords,
    };
  });

  const recordsByEntity = [
    { key: "leads", label: "Leads", count: entityTotals.leads },
    { key: "contacts", label: "Contacts", count: entityTotals.contacts },
    { key: "accounts", label: "Accounts", count: entityTotals.accounts },
    { key: "deals", label: "Deals", count: entityTotals.deals },
    { key: "customers", label: "Customers", count: entityTotals.customers },
    { key: "activities", label: "Activities", count: entityTotals.activities },
    { key: "tasks", label: "Tasks", count: entityTotals.tasks },
    { key: "quotations", label: "Quotations", count: entityTotals.quotations },
    { key: "documents", label: "Documents", count: entityTotals.documents },
    { key: "followUps", label: "Follow-ups", count: entityTotals.followUps },
    { key: "communications", label: "Communications", count: entityTotals.communications },
    { key: "calendarEvents", label: "Calendar", count: entityTotals.calendarEvents },
  ].sort((a, b) => b.count - a.count);

  const maxEntity = Math.max(...recordsByEntity.map((e) => e.count), 1);
  const recordsByEntityChart = recordsByEntity.map((e) => ({
    ...e,
    pct: (e.count / maxEntity) * 100,
  }));

  const totalRecordsAll = companyRows.reduce((s, c) => s + c.totalRecords, 0);
  const maxCompanyRecords = Math.max(...companyRows.map((c) => c.totalRecords), 1);
  const topByUsage = [...companyRows]
    .sort((a, b) => b.totalRecords - a.totalRecords)
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      name: c.name,
      totalRecords: c.totalRecords,
      pct: (c.totalRecords / maxCompanyRecords) * 100,
      users: c.usage.users,
      leads: c.usage.leads,
    }));

  return {
    summary: {
      companyCount: companyRows.length,
      activeCompanies: companyRows.filter((c) => c.status === "active").length,
      totalMembers: entityTotals.members,
      totalRecords: totalRecordsAll,
      recordsByEntity: recordsByEntityChart,
    },
    companies: companyRows,
    topByUsage,
  };
}
