import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { ComingSoonCard, StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useGetAdminOverview } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/badges";
import { Users, TrendingUp, CalendarCheck, AlertTriangle, Trophy } from "lucide-react";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "president")!;

export default function PresidentWorkspacePage() {
  const { data, isLoading, error } = useGetAdminOverview();

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error || !data ? (
          <ErrorBlock message="Could not load chapter overview." />
        ) : (
          <>
            <StatGrid
              stats={[
                { label: "Total Members", value: data.totalMembers, icon: Users },
                {
                  label: "Chapter Participation",
                  value: `${data.chapterParticipationPct}%`,
                  icon: TrendingUp,
                },
                {
                  label: "Completed Events",
                  value: data.completedEvents,
                  icon: CalendarCheck,
                },
                {
                  label: "At-Risk / Critical",
                  value: data.atRiskMembers + data.criticalMembers,
                  icon: AlertTriangle,
                },
              ]}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  Committee Standing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.committees.map((c, i) => (
                    <div
                      key={c.committeeId}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Pill tone={i === 0 ? "gold" : "neutral"}>#{i + 1}</Pill>
                        <span className="font-medium">{c.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {c.participationPct}% participation
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <ComingSoonCard
          title="Executive Meeting Agendas"
          description="Draft, distribute, and archive executive board meeting agendas and action items directly from this workspace."
        />
      </div>
    </ExecWorkspaceShell>
  );
}
