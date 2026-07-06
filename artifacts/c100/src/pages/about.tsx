import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/me";
import { IS_TAURI } from "@/lib/desktop-auth";
import { getDesktopMetadata, type AppMetadata } from "@/lib/desktop-info";
import { useGetSystemInfo } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import LoginPage from "@/pages/login";
import { Link } from "wouter";
import { Info, Monitor, FileText, RefreshCw, Stethoscope } from "lucide-react";

export default function AboutPage() {
  const me = useMe();
  const { data: info, isLoading, error } = useGetSystemInfo();
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
        title="About C100 Ops"
        description="Version, build, and environment details for this installation."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Info className="h-4 w-4 text-muted-foreground" />
              Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingBlock />
            ) : error || !info ? (
              <ErrorBlock message="Could not reach the server to load version info." />
            ) : (
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <InfoRow label="Application" value={info.appName} />
                <InfoRow label="Chapter" value={info.chapterName} />
                <InfoRow label="Server version" value={info.version} />
                <InfoRow label="Release channel" value={info.releaseChannel} />
                <InfoRow label="Build" value={info.buildNumber} />
                <InfoRow label="Environment" value={info.environment} />
                <InfoRow
                  label="Server time"
                  value={new Date(info.serverTime).toLocaleString()}
                />
              </dl>
            )}
          </CardContent>
        </Card>

        {IS_TAURI ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                Desktop Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meta ? (
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <InfoRow label="App version" value={meta.appVersion} />
                  <InfoRow label="Tauri runtime" value={meta.tauriVersion} />
                  <InfoRow label="Operating system" value={meta.osType} />
                  <InfoRow label="OS version" value={meta.osVersion} />
                  <InfoRow label="Architecture" value={meta.arch} />
                </dl>
              ) : (
                <LoadingBlock label="Reading system info" />
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              You are using the web version of C100 Ops. Install the desktop
              app for offline access, native notifications, and automatic
              updates.
            </CardContent>
          </Card>
        )}

        {info ? (
          <p className="text-xs text-muted-foreground">{info.copyright}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/release-notes">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Release notes
            </Link>
          </Button>
          {IS_TAURI ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/updates">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Check for updates
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link href="/diagnostics">
              <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
              Diagnostics
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value ?? "Unknown"}</dd>
    </div>
  );
}
