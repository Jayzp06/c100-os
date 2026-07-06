import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useGetSystemDiagnostics, useListMembers } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/badges";
import { Link } from "wouter";
import { Server, Database, Users, Settings2, Stethoscope, Info } from "lucide-react";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "technology")!;

export default function TechnologyWorkspacePage() {
  const { data: diag, isLoading, error } = useGetSystemDiagnostics();
  const { data: members } = useListMembers();

  const list = Array.isArray(members) ? members : [];

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error || !diag ? (
          <ErrorBlock message="Could not reach the API for a system health check." />
        ) : (
          <StatGrid
            stats={[
              { label: "Registered Members", value: list.length, icon: Users },
            ]}
          />
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Server className="h-4 w-4 text-muted-foreground" />
              Platform Status
              {diag ? (
                <Pill tone={diag.api.status === "ok" ? "success" : "danger"}>
                  {diag.api.status}
                </Pill>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {diag ? (
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    API latency
                  </dt>
                  <dd className="text-sm font-medium">{diag.api.latencyMs} ms</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Database className="h-3 w-3" /> Database
                  </dt>
                  <dd className="text-sm font-medium">
                    {diag.database.connected ? "Connected" : "Unreachable"} ({diag.database.latencyMs} ms)
                  </dd>
                </div>
              </dl>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/tech">
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                  Full System Console
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/diagnostics">
                  <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
                  Diagnostics
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/about">
                  <Info className="mr-1.5 h-3.5 w-3.5" />
                  About
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ExecWorkspaceShell>
  );
}
