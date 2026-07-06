import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { ComingSoonCard, StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useListCommittees, useGetCommitteeLeaderboard } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers3, Users, TrendingUp } from "lucide-react";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "vice-president")!;

export default function VicePresidentWorkspacePage() {
  const { data: committees, isLoading, error } = useListCommittees();
  const { data: leaderboard } = useGetCommitteeLeaderboard();

  const list = Array.isArray(committees) ? committees : [];
  const totalMembers = list.reduce((sum, c) => sum + (c.memberCount ?? 0), 0);
  const avgParticipation = leaderboard?.length
    ? Math.round(
        leaderboard.reduce((sum, c) => sum + c.participationPct, 0) /
          leaderboard.length,
      )
    : 0;

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message="Could not load committee overview." />
        ) : (
          <>
            <StatGrid
              stats={[
                { label: "Committees", value: list.length, icon: Layers3 },
                { label: "Committee Members", value: totalMembers, icon: Users },
                {
                  label: "Avg. Participation",
                  value: `${avgParticipation}%`,
                  icon: TrendingUp,
                },
              ]}
            />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Committee Roster
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {list.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        {c.chairName ?? "No chair assigned"} · {c.memberCount} members
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <ComingSoonCard
          title="Cross-Committee Initiative Tracking"
          description="Track special initiatives spanning multiple committees, with milestone status and ownership assignments."
        />
      </div>
    </ExecWorkspaceShell>
  );
}
