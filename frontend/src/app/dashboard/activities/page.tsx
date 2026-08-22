"use client";

import { useEffect, useState } from "react";
import { TenantLink } from "@/components/ui/tenant-link";
import { Plus } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Panel,
  BtnPrimary,
  PageLoader,
  FetchError,
  EmptyState,
} from "@/components/ui/dashboard-ui";

type Activity = {
  id: string;
  type: string;
  subject: string;
  dueDate: string | null;
  completed: boolean;
  lead?: { firstName: string; lastName: string | null } | null;
  deal?: { name: string } | null;
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setActivities(await apiFetch<Activity[]>("/api/activities"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function complete(id: string) {
    await apiFetch(`/api/activities/${id}/complete`, { method: "PATCH" });
    await load();
  }

  if (loading) return <PageLoader />;
  if (error) return <FetchError message={error} onRetry={() => load().catch(console.error)} />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Sales & CRM"
        title="Activities"
        description="Calls, meetings, tasks, and follow-ups"
        action={
          <BtnPrimary href="/dashboard/activities/new">
            <Plus className="h-4 w-4" /> Log activity
          </BtnPrimary>
        }
      />

      <Panel title="Recent activities" noPadding>
        {activities.length === 0 ? (
          <EmptyState
            title="No activities yet"
            description="Log calls, meetings, and tasks to track your sales motion."
            action={
              <TenantLink href="/dashboard/activities/new">
                <BtnPrimary>Log activity</BtnPrimary>
              </TenantLink>
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {activities.map((a) => (
              <div key={a.id} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={a.type}>{a.type}</Badge>
                    {a.completed && <Badge variant="won">done</Badge>}
                  </div>
                  <p className="font-medium text-sm text-slate-900 truncate" title={a.subject}>{a.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {a.lead ? `${a.lead.firstName} ${a.lead.lastName}` : a.deal?.name || "General"}
                    {a.dueDate ? ` · Due ${formatDate(a.dueDate)}` : ""}
                  </p>
                </div>
                {!a.completed && (
                  <Button size="sm" variant="outline" onClick={() => complete(a.id)} className="shrink-0 self-start sm:self-center">Complete</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
