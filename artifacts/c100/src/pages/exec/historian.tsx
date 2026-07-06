import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { ComingSoonCard, StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useListEvents, ListEventsStatus } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventTypeLabel } from "@/components/badges";
import { CalendarCheck, Archive } from "lucide-react";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "historian")!;

export default function HistorianWorkspacePage() {
  const { data: completed, isLoading, error } = useListEvents({
    status: ListEventsStatus.Completed,
  });

  const list = Array.isArray(completed) ? completed : [];
  const timeline = [...list]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message="Could not load chapter event history." />
        ) : (
          <>
            <StatGrid
              stats={[
                { label: "Documented Events", value: list.length, icon: CalendarCheck },
              ]}
            />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  Chapter Timeline
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Every completed event, ready to attach photos and highlights
                  to once the media archive ships.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {timeline.map((e) => (
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
                      <span className="text-xs text-muted-foreground">
                        {e.totalAttendees} attended
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <ComingSoonCard
          title="Media Archive"
          description="Upload and organize event photos, videos, and highlight reels, linked to each chapter event."
        />
      </div>
    </ExecWorkspaceShell>
  );
}
