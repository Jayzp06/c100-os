import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { ComingSoonCard, StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useGetOrgSettings, useListCommittees } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, Layers3, Target } from "lucide-react";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "parliamentarian")!;

export default function ParliamentarianWorkspacePage() {
  const { data: org, isLoading, error } = useGetOrgSettings();
  const { data: committees } = useListCommittees();

  const list = Array.isArray(committees) ? committees : [];

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error || !org ? (
          <ErrorBlock message="Could not load chapter governance settings." />
        ) : (
          <>
            <StatGrid
              stats={[
                {
                  label: "Participation Goal",
                  value: `${org.participationGoalPct}%`,
                  icon: Target,
                },
                { label: "Active Committees", value: list.length, icon: Layers3 },
              ]}
            />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Gavel className="h-4 w-4 text-muted-foreground" />
                  Governance Thresholds
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  These org-wide settings define eligibility rules referenced
                  in the chapter bylaws.
                </p>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Scholarship minimum
                    </dt>
                    <dd className="text-sm font-medium">{org.scholarshipMinPct}%</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Conference minimum
                    </dt>
                    <dd className="text-sm font-medium">{org.conferenceMinPct}%</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Awards minimum
                    </dt>
                    <dd className="text-sm font-medium">{org.awardsMinPct}%</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </>
        )}

        <ComingSoonCard
          title="Bylaws & Amendment Tracking"
          description="Track the chapter's current bylaws, proposed amendments, and voting history in one place."
        />
      </div>
    </ExecWorkspaceShell>
  );
}
