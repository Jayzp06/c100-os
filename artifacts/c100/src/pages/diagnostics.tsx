import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/me";
import { IS_TAURI } from "@/lib/desktop-auth";
import { getDesktopMetadata, type AppMetadata } from "@/lib/desktop-info";
import { useGetSystemDiagnostics } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Pill } from "@/components/badges";
import LoginPage from "@/pages/login";
import { RefreshCw, Database, Server, Monitor } from "lucide-react";

export default function DiagnosticsPage() {
  const me = useMe();
  const { data: diag, isLoading, error, refetch, isFetching } =
    useGetSystemDiagnostics();
  const [meta, setMeta] = useState<AppMetadata | null>(null);

  useEffect(() => {
    getDesktopMetadata().then(setMeta);
  }, []);

  if (me.isLoading) return null;
  if (!me.isAuthenticated) return <LoginPage />;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Desktop"
        title="Diagnostics"
        description="Live connectivity checks for support and troubleshooting."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={"mr-1.5 h-3.5 w-3.5" + (isFetching ? " animate-spin" : "")}
            />
            Re-run checks
          </Button>
        }
      />

      <div className="space-y-4">
        {isLoading ? (
          <LoadingBlock label="Running diagnostics" />
        ) : error || !diag ? (
          <ErrorBlock
            title="Could not reach the server"
            message="The API is unreachable. Check your internet connection or try again."
          />
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  API Server
                  <Pill tone={diag.api.status === "ok" ? "success" : "danger"}>
                    {diag.api.status}
                  </Pill>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Row label="Response latency" value={`${diag.api.latencyMs} ms`} />
                  <Row label="Environment" value={diag.environment} />
                  <Row
                    label="Server time"
                    value={new Date(diag.serverTime).toLocaleString()}
                  />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  Database
                  <Pill tone={diag.database.connected ? "success" : "danger"}>
                    {diag.database.connected ? "connected" : "unreachable"}
                  </Pill>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Row label="Ping latency" value={`${diag.database.latencyMs} ms`} />
                  <Row
                    label="Migration"
                    value={diag.database.migrationVersion ?? "Unknown"}
                  />
                </dl>
              </CardContent>
            </Card>
          </>
        )}

        {IS_TAURI ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                Local Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meta ? (
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Row label="App version" value={meta.appVersion ?? "Unknown"} />
                  <Row
                    label="Operating system"
                    value={`${meta.osType ?? "Unknown"} ${meta.osVersion ?? ""}`}
                  />
                  <Row label="Architecture" value={meta.arch ?? "Unknown"} />
                </dl>
              ) : (
                <LoadingBlock label="Reading local system info" />
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
