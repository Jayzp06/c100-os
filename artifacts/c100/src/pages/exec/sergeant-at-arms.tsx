import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { ComingSoonCard, StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useListNudges } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/badges";
import { Bell, ShieldAlert, Clock } from "lucide-react";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "sergeant-at-arms")!;

export default function SergeantAtArmsWorkspacePage() {
  const { data: nudges, isLoading, error } = useListNudges();

  const list = Array.isArray(nudges) ? nudges : [];
  const recent = [...list]
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 8);
  const critical = list.filter((n) => n.memberStatusAtSend === "Critical").length;

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message="Could not load nudge activity." />
        ) : (
          <>
            <StatGrid
              stats={[
                { label: "Nudges Sent", value: list.length, icon: Bell },
                { label: "Critical-Tier Nudges", value: critical, icon: ShieldAlert },
              ]}
            />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Standing Activity
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Nudge history reflects member standing and conduct
                  escalations tracked by the chapter's accountability system.
                </p>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <EmptyBlock title="No nudges sent yet" />
                ) : (
                  <div className="space-y-2">
                    {recent.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{n.userName ?? "Member"}</p>
                          <p className="text-xs text-muted-foreground">
                            {n.triggerReason}
                          </p>
                        </div>
                        <Pill
                          tone={
                            n.memberStatusAtSend === "Critical"
                              ? "danger"
                              : n.memberStatusAtSend === "AtRisk"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {n.memberStatusAtSend}
                        </Pill>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <ComingSoonCard
          title="Formal Conduct Records"
          description="Log and track formal conduct proceedings and meeting-order enforcement separate from the participation nudge system."
        />
      </div>
    </ExecWorkspaceShell>
  );
}
