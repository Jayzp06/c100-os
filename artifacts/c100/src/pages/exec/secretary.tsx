import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { ComingSoonCard, StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useListEvents, ListEventsStatus } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventStatusBadge, eventTypeLabel } from "@/components/badges";
import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "secretary")!;

export default function SecretaryWorkspacePage() {
  const { data: completed, isLoading, error } = useListEvents({
    status: ListEventsStatus.Completed,
  });
  const { data: upcoming } = useListEvents({ status: ListEventsStatus.Upcoming });

  const completedList = Array.isArray(completed) ? completed : [];
  const upcomingList = Array.isArray(upcoming) ? upcoming : [];
  const recent = [...completedList]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message="Could not load event records." />
        ) : (
          <>
            <StatGrid
              stats={[
                { label: "Completed Events", value: completedList.length, icon: CheckCircle2 },
                { label: "Upcoming Events", value: upcomingList.length, icon: Clock3 },
              ]}
            />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  Recent Meeting Records
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Records pull directly from the event log — the same source
                  used for attendance and eligibility reporting.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recent.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {eventTypeLabel(e.eventType)} · {new Date(e.date).toLocaleDateString()}
                        </p>
                      </div>
                      <EventStatusBadge status={e.status} />
                    </div>
                  ))}
                  {recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No completed meetings recorded yet.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <ComingSoonCard
          title="Minutes & Agenda Management"
          description="Draft, publish, and archive official meeting minutes and agendas, linked directly to each chapter event."
        />
      </div>
    </ExecWorkspaceShell>
  );
}
