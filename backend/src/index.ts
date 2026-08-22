import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import leadsRoutes from "./routes/leads";
import contactsRoutes from "./routes/contacts";
import accountsRoutes from "./routes/accounts";
import dealsRoutes from "./routes/deals";
import activitiesRoutes from "./routes/activities";
import dashboardRoutes from "./routes/dashboard";
import workspaceRoutes from "./routes/workspace";
import followupsRoutes from "./routes/followups";
import communicationsRoutes from "./routes/communications";
import searchRoutes from "./routes/search";
import tasksRoutes from "./routes/tasks";
import quotationsRoutes from "./routes/quotations";
import customersRoutes from "./routes/customers";
import usersRoutes from "./routes/users";
import documentsRoutes from "./routes/documents";
import notificationsRoutes from "./routes/notifications";
import calendarRoutes from "./routes/calendar";
import platformRoutes from "./routes/platform";
import publicLeadsRoutes from "./routes/public-leads";
import publicTenantsRoutes from "./routes/public-tenants";
import auditRoutes from "./routes/audit";
import integrationsRoutes from "./routes/integrations";
import teamsRoutes from "./routes/teams";
import assignmentRulesRoutes from "./routes/assignment-rules";
import automationRoutes from "./routes/automation";
import customFieldsRoutes from "./routes/custom-fields";
import savedViewsRoutes from "./routes/saved-views";
import errorsRoutes from "./routes/errors";
import platformErrorsRoutes from "./routes/platform-errors";
import { notFoundHandler, globalErrorHandler } from "./middleware/global-error";
import { runSlaChecksAllWorkspaces } from "./lib/sla-engine";
import { PRODUCT_NAME } from "./lib/brand";
import { connectDatabase, checkDatabaseHealth, disconnectDatabase } from "./lib/prisma";
import { backfillWorkspaceSlugs } from "./lib/backfill-slugs";

const app = express();
const PORT = process.env.PORT || 4001;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = process.env.FRONTEND_URL || "http://localhost:3000";
      if (origin === allowed) {
        callback(null, true);
        return;
      }
      const appDomain = process.env.APP_DOMAIN?.trim();
      if (appDomain) {
        try {
          const url = new URL(origin);
          const domainHost = appDomain.split(":")[0].toLowerCase();
          if (url.host === appDomain || url.hostname === domainHost || url.hostname.endsWith(`.${domainHost}`)) {
            callback(null, true);
            return;
          }
        } catch {
          /* ignore invalid origin */
        }
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.get("/health", async (_req, res) => {
  const dbOk = await checkDatabaseHealth();
  if (!dbOk) {
    res.status(503).json({
      status: "degraded",
      product: PRODUCT_NAME,
      database: "disconnected",
      hint: "Start MySQL: npm run db:up — then npm run db:migrate && npm run db:seed",
    });
    return;
  }
  res.json({ status: "ok", product: PRODUCT_NAME, database: "mysql" });
});

app.use("/api/auth", authRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/contacts", contactsRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/followups", followupsRoutes);
app.use("/api/communications", communicationsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/quotations", quotationsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/public", publicTenantsRoutes);
app.use("/api/public", publicLeadsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/assignment-rules", assignmentRulesRoutes);
app.use("/api/automation", automationRoutes);
app.use("/api/custom-fields", customFieldsRoutes);
app.use("/api/saved-views", savedViewsRoutes);
app.use("/api/errors", errorsRoutes);
app.use("/api/platform/errors", platformErrorsRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

async function start() {
  try {
    await connectDatabase();
    console.log("MySQL database connected");
    const filled = await backfillWorkspaceSlugs();
    if (filled > 0) console.log(`Backfilled ${filled} workspace slug(s)`);
  } catch (err) {
    console.error("MySQL connection failed:", err instanceof Error ? err.message : err);
    console.error("Run: npm run db:up && npm run db:migrate && npm run db:seed");
  }

  app.listen(PORT, () => {
    console.log(`${PRODUCT_NAME} API running on http://localhost:${PORT}`);
  }).on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a different value.`);
      process.exit(1);
    }
    throw err;
  });

  setInterval(() => {
    runSlaChecksAllWorkspaces().catch(() => {});
  }, 15 * 60 * 1000);
}

start();

process.on("SIGINT", async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDatabase();
  process.exit(0);
});
