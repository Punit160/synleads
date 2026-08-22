import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createDefaultStages } from "../src/lib/workspace";
import { createSubscription } from "../src/lib/subscription";

const prisma = new PrismaClient();

async function seedAutomation(workspaceId: string) {
  const existing = await prisma.workflowRule.findFirst({ where: { workspaceId } });
  if (existing) return;

  await prisma.slaPolicy.upsert({
    where: { workspaceId },
    create: { workspaceId, firstResponseHours: 24, escalateAfterHours: 48 },
    update: {},
  });

  await prisma.workflowRule.create({
    data: {
      workspaceId,
      name: "Auto follow-up on new lead",
      trigger: "lead.created",
      priority: 10,
      conditions: [],
      actions: [{ type: "create_followup", followUpType: "call", hoursFromNow: 24 }],
    },
  });

  await prisma.leadScoringRule.createMany({
    data: [
      { workspaceId, name: "Has phone", field: "has_phone", operator: "exists", points: 15, priority: 5 },
      { workspaceId, name: "Has email", field: "has_email", operator: "exists", points: 10, priority: 4 },
      { workspaceId, name: "Website source", field: "source", operator: "equals", value: "Website", points: 20, priority: 3 },
      { workspaceId, name: "High priority", field: "priority", operator: "equals", value: "high", points: 25, priority: 2 },
      { workspaceId, name: "Budget over 1L", field: "budget", operator: "gte", value: "100000", points: 20, priority: 1 },
    ],
  });

  await prisma.customFieldDefinition.createMany({
    data: [
      {
        workspaceId,
        key: "product_interest",
        label: "Product interest",
        fieldType: "select",
        options: JSON.stringify(["CRM", "ERP", "Custom"]),
        sortOrder: 0,
      },
      { workspaceId, key: "referral_code", label: "Referral code", fieldType: "text", sortOrder: 1 },
    ],
  });

  await prisma.savedView.createMany({
    data: [
      {
        workspaceId,
        name: "Hot leads",
        entityType: "lead",
        isShared: true,
        filters: { priority: "high", view: "active", sortBy: "score", sortDir: "desc" },
      },
      {
        workspaceId,
        name: "New leads",
        entityType: "lead",
        isShared: true,
        filters: { status: "new", view: "active" },
      },
    ],
  });
}

async function main() {
  const password = await bcrypt.hash("demo1234", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@leadflow.app" },
    update: { phone: "9876543210" },
    create: {
      name: "Demo User",
      email: "demo@leadflow.app",
      phone: "9876543210",
      password,
      workspace: {
        create: { name: "Synentrix Demo Workspace", slug: "synentrix-demo" },
      },
    },
    include: { workspace: true },
  });

  if (!user.workspace) throw new Error("Workspace missing");

  await prisma.workspace.update({
    where: { id: user.workspace.id },
    data: { slug: "synentrix-demo" },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: user.workspace.id, userId: user.id },
    },
    create: {
      workspaceId: user.workspace.id,
      userId: user.id,
      role: "owner",
      status: "active",
    },
    update: {},
  });

  const stageCount = await prisma.pipelineStage.count({
    where: { workspaceId: user.workspace.id },
  });
  if (stageCount === 0) await createDefaultStages(user.workspace.id);

  const stages = await prisma.pipelineStage.findMany({
    where: { workspaceId: user.workspace.id },
    orderBy: { order: "asc" },
  });

  await prisma.leadTimelineEvent.deleteMany({ where: { lead: { workspaceId: user.workspace.id } } });
  await prisma.followUp.deleteMany({ where: { workspaceId: user.workspace.id } });
  await prisma.communication.deleteMany({ where: { workspaceId: user.workspace.id } });
  await prisma.leadNote.deleteMany({ where: { lead: { workspaceId: user.workspace.id } } });
  await prisma.leadAttachment.deleteMany({ where: { lead: { workspaceId: user.workspace.id } } });
  await prisma.lead.deleteMany({ where: { workspaceId: user.workspace.id } });
  await prisma.deal.deleteMany({ where: { workspaceId: user.workspace.id } });
  await prisma.contact.deleteMany({ where: { workspaceId: user.workspace.id } });
  await prisma.account.deleteMany({ where: { workspaceId: user.workspace.id } });

  const account = await prisma.account.create({
    data: {
      workspaceId: user.workspace.id,
      ownerId: user.id,
      name: "TechNova Pvt Ltd",
      industry: "Technology",
      city: "Bangalore",
      state: "Karnataka",
    },
  });

  const contact = await prisma.contact.create({
    data: {
      workspaceId: user.workspace.id,
      ownerId: user.id,
      accountId: account.id,
      firstName: "Rajesh",
      lastName: "Kumar",
      email: "rajesh@technova.in",
      phone: "+91 98765 43210",
      title: "CTO",
    },
  });

  const leadData = [
    {
      leadNumber: "LF-00001",
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya@growthstack.io",
      phone: "+91 98765 11111",
      company: "GrowthStack",
      city: "Mumbai",
      state: "Maharashtra",
      industry: "SaaS",
      source: "Website",
      status: "new",
      priority: "high",
      budget: 250000,
      requirement: "CRM for 50 users",
      score: 78,
    },
    {
      leadNumber: "LF-00002",
      firstName: "Amit",
      lastName: "Patel",
      email: "amit@cloudfirst.com",
      phone: "+91 98765 22222",
      company: "CloudFirst",
      city: "Ahmedabad",
      state: "Gujarat",
      industry: "Cloud Services",
      source: "Referral",
      status: "contacted",
      priority: "medium",
      budget: 500000,
      score: 88,
    },
    {
      leadNumber: "LF-00003",
      firstName: "Ananya",
      lastName: "Reddy",
      email: "ananya@finedge.in",
      phone: "+91 98765 33333",
      company: "FinEdge",
      city: "Hyderabad",
      state: "Telangana",
      industry: "Finance",
      source: "LinkedIn",
      status: "qualified",
      priority: "urgent",
      budget: 850000,
      requirement: "Enterprise lead management",
      score: 94,
    },
  ];

  for (const l of leadData) {
    const lead = await prisma.lead.create({
      data: { workspaceId: user.workspace.id, ownerId: user.id, ...l },
    });
    await prisma.leadTimelineEvent.create({
      data: { leadId: lead.id, userId: user.id, type: "created", title: "Lead created", description: `Lead ${l.leadNumber} seeded` },
    });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const leads = await prisma.lead.findMany({ where: { workspaceId: user.workspace.id } });

  await prisma.followUp.create({
    data: {
      workspaceId: user.workspace.id,
      leadId: leads[0].id,
      ownerId: user.id,
      type: "call",
      scheduledAt: new Date(),
      notes: "Initial discovery call",
    },
  });

  await prisma.communication.create({
    data: {
      workspaceId: user.workspace.id,
      leadId: leads[1].id,
      ownerId: user.id,
      channel: "email",
      subject: "Product demo follow-up",
      body: "Sent pricing proposal",
    },
  });

  const qualified = stages.find((s) => s.name === "Qualified")!;
  const proposal = stages.find((s) => s.name === "Proposal / Quotation")!;
  if (!qualified || !proposal) {
    throw new Error("Default pipeline stages missing — run createDefaultStages first");
  }

  await prisma.deal.createMany({
    data: [
      {
        workspaceId: user.workspace.id,
        ownerId: user.id,
        stageId: qualified.id,
        accountId: account.id,
        contactId: contact.id,
        name: "TechNova Enterprise CRM",
        amount: 850000,
        probability: 40,
        status: "open",
      },
      {
        workspaceId: user.workspace.id,
        ownerId: user.id,
        stageId: proposal.id,
        name: "ScaleUp Labs Annual",
        amount: 320000,
        probability: 60,
        status: "open",
      },
    ],
  });

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: user.workspace.id, userId: user.id } },
    data: { role: "super_admin" },
  });

  await prisma.task.createMany({
    data: [
      { workspaceId: user.workspace!.id, createdById: user.id, assigneeId: user.id, title: "Prepare proposal for TechNova", priority: "high", status: "in_progress", dueDate: new Date(Date.now() + 86400000), leadId: leads[2].id },
      { workspaceId: user.workspace!.id, createdById: user.id, assigneeId: user.id, title: "Follow up with GrowthStack", priority: "medium", status: "pending", dueDate: new Date(), leadId: leads[0].id },
      { workspaceId: user.workspace!.id, createdById: user.id, assigneeId: user.id, title: "Send contract to CloudFirst", priority: "urgent", status: "pending", dueDate: new Date(Date.now() - 86400000), leadId: leads[1].id },
    ],
  });

  const existingQuote = await prisma.quotation.findFirst({
    where: { workspaceId: user.workspace!.id, quoteNumber: "QT-00001" },
  });
  if (existingQuote) {
    await seedTeamAndPlatform(user.id, user.workspace!.id);
    await seedAutomation(user.workspace!.id);
    console.log("Seed complete (demo data already present).");
    console.log("Platform admin URL: /synentrix-cp-x9k7m2q4p8");
    console.log("Platform admin: platform@synentrix.com / Synentrix@2026");
    console.log("Workspace owner: demo@leadflow.app / demo1234");
    return;
  }

  const quote = await prisma.quotation.create({
    data: {
      workspaceId: user.workspace!.id,
      quoteNumber: "QT-00001",
      createdById: user.id,
      leadId: leads[2].id,
      status: "approved",
      subtotal: 850000,
      taxRate: 18,
      taxAmount: 153000,
      discount: 5,
      total: 953850,
      items: {
        create: [
          { name: "Enterprise CRM License", description: "50 users annual", quantity: 1, unitPrice: 650000, taxRate: 18, discount: 0, lineTotal: 650000 },
          { name: "Implementation & Training", quantity: 1, unitPrice: 200000, taxRate: 18, discount: 0, lineTotal: 200000 },
        ],
      },
      history: { create: [{ action: "created", notes: "Initial quote" }, { action: "approved", notes: "Approved by manager" }] },
    },
  });

  const customer = await prisma.customer.create({
    data: {
      workspaceId: user.workspace!.id,
      contactId: contact.id,
      accountId: account.id,
      name: "Rajesh Kumar",
      email: "rajesh@technova.in",
      phone: "+91 98765 43210",
      company: "TechNova Pvt Ltd",
    },
  });

  await prisma.customerOrder.create({ data: { customerId: customer.id, orderNumber: "ORD-001", amount: 850000, status: "confirmed" } });
  await prisma.customerInvoice.create({ data: { customerId: customer.id, invoiceNumber: "INV-001", amount: 850000, status: "unpaid", dueDate: new Date(Date.now() + 30 * 86400000) } });
  await prisma.serviceHistory.create({ data: { customerId: customer.id, title: "Onboarding call completed", description: "Initial setup and training session", status: "completed" } });

  await prisma.notification.createMany({
    data: [
      { workspaceId: user.workspace!.id, userId: user.id, type: "follow_up", title: "Follow-up Reminder", message: "Call Priya Sharma today at 3 PM", channel: "browser" },
      { workspaceId: user.workspace!.id, userId: user.id, type: "quote", title: "Quote Approved", message: `${quote.quoteNumber} approved`, channel: "email", read: true },
      { workspaceId: user.workspace!.id, userId: user.id, type: "task", title: "Overdue Task", message: "Send contract to CloudFirst is overdue", channel: "browser" },
    ],
  });

  await prisma.calendarEvent.create({
    data: {
      workspaceId: user.workspace!.id,
      ownerId: user.id,
      title: "Demo with FinEdge",
      type: "meeting",
      startAt: new Date(Date.now() + 2 * 86400000),
      endAt: new Date(Date.now() + 2 * 86400000 + 3600000),
      location: "Google Meet",
      description: "Product demo for enterprise lead management",
    },
  });

  await seedTeamAndPlatform(user.id, user.workspace!.id);
  await seedAutomation(user.workspace!.id);

  console.log("Seed complete.");
  console.log("Platform admin URL: /synentrix-cp-x9k7m2q4p8");
  console.log("Platform admin: platform@synentrix.com / Synentrix@2026");
  console.log("Workspace owner: demo@leadflow.app / demo1234");
  console.log("Manager: manager@demo.com / manager123");
  console.log("Employee: employee@demo.com / employee123");
}

async function seedTeamAndPlatform(demoUserId: string, workspaceId: string) {
  await createSubscription(workspaceId, "yearly_20");

  const platformPassword = await bcrypt.hash("Synentrix@2026", 12);
  await prisma.platformAdmin.upsert({
    where: { email: "platform@synentrix.com" },
    update: { role: "super_admin", status: "active" },
    create: {
      name: "Synentrix Platform Admin",
      email: "platform@synentrix.com",
      password: platformPassword,
      role: "super_admin",
      status: "active",
    },
  });

  const salesPlatformPassword = await bcrypt.hash("sales123", 12);
  const salesAdmin = await prisma.platformAdmin.upsert({
    where: { email: "sales@synentrix.com" },
    update: { role: "sales", status: "active" },
    create: {
      name: "Synentrix Sales Executive",
      email: "sales@synentrix.com",
      password: salesPlatformPassword,
      role: "sales",
      status: "active",
    },
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      provisionedByPlatformAdminId: salesAdmin.id,
      interestedPackage: "yearly_20",
    },
  });

  const existingSale = await prisma.platformSale.findFirst({ where: { workspaceId } });
  if (!existingSale) {
    await prisma.platformSale.create({
      data: {
        workspaceId,
        package: "yearly_20",
        amountInr: 9499,
        soldByPlatformAdminId: salesAdmin.id,
        notes: "Demo seed sale",
      },
    });
  }

  const managerPassword = await bcrypt.hash("manager123", 12);
  const manager = await prisma.user.upsert({
    where: { email: "manager@demo.com" },
    update: { phone: "9876543211" },
    create: {
      name: "Sales Manager",
      email: "manager@demo.com",
      phone: "9876543211",
      password: managerPassword,
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: manager.id } },
    create: { workspaceId, userId: manager.id, role: "manager", status: "active" },
    update: { role: "manager", status: "active" },
  });

  const employeePassword = await bcrypt.hash("employee123", 12);
  const employee = await prisma.user.upsert({
    where: { email: "employee@demo.com" },
    update: { phone: "9876543212" },
    create: {
      name: "Sales Executive",
      email: "employee@demo.com",
      phone: "9876543212",
      password: employeePassword,
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: employee.id } },
    create: {
      workspaceId,
      userId: employee.id,
      role: "employee",
      managerUserId: manager.id,
      status: "active",
    },
    update: { role: "employee", managerUserId: manager.id, status: "active" },
  });

  await prisma.lead.updateMany({
    where: { workspaceId, leadNumber: { in: ["LF-00001", "LF-00002"] } },
    data: { ownerId: employee.id },
  });

  await prisma.lead.updateMany({
    where: { workspaceId, leadNumber: { in: ["LF-00003", "LF-00004"] } },
    data: { ownerId: manager.id },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
