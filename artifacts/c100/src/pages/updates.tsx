import { useCallback, useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMe } from "@/lib/me";
import { IS_TAURI } from "@/lib/desktop-auth";
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  relaunchApp,
  getDesktopMetadata,
  type UpdateCheckResult,
  type InstallProgress,
} from "@/lib/desktop-info";
import LoginPage from "@/pages/login";
import { ErrorBlock } from "@/components/page-states";
import { RefreshCw, CheckCircle2, DownloadCloud, AlertTriangle } from "lucide-react";

export default function UpdatesPage() {
  const me = useMe();

  if (me.isLoading) return null;
  if (!me.isAuthenticated) return <LoginPage />;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Desktop"
        title="Software Updates"
        description="Check for, download, and install the latest version of C100 Ops."
      />
      {IS_TAURI ? (
        <UpdatesPanel />
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Automatic updates are only available in the desktop app. The web
            version always serves the latest release.
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

type Stage =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; result: UpdateCheckResult }
  | { kind: "installing"; progress: InstallProgress }
  | { kind: "installed" }
  | { kind: "error"; message: string };

function UpdatesPanel() {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    getDesktopMetadata().then((m) => setCurrentVersion(m.appVersion));
  }, []);

  const runCheck = useCallback(async () => {
    setStage({ kind: "checking" });
    const result = await checkForUpdate();
    setStage({ kind: "result", result });
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  async function install() {
    setStage({
      kind: "installing",
      progress: { phase: "downloading", downloaded: 0, total: null },
    });
    try {
      await downloadAndInstallUpdate((progress) => {
        setStage({ kind: "installing", progress });
      });
      setStage({ kind: "installed" });
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : "Update failed to install.",
      });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <RefreshCw
            className={
              "h-4 w-4 text-muted-foreground" +
              (stage.kind === "checking" ? " animate-spin" : "")
            }
          />
          Update Status
        </CardTitle>
        {currentVersion ? (
          <p className="text-sm text-muted-foreground">
            Installed version: {currentVersion}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {stage.kind === "idle" || stage.kind === "checking" ? (
          <p className="text-sm text-muted-foreground">Checking for updates…</p>
        ) : null}

        {stage.kind === "result" && stage.result.status === "up-to-date" ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            You are on the latest version.
          </div>
        ) : null}

        {stage.kind === "result" && stage.result.status === "error" ? (
          <ErrorBlock title="Could not check for updates" message={stage.result.message} />
        ) : null}

        {stage.kind === "result" && stage.result.status === "available" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DownloadCloud className="h-4 w-4 text-[hsl(var(--secondary))]" />
              Version {stage.result.version} is available
              {stage.result.date ? ` (${new Date(stage.result.date).toLocaleDateString()})` : ""}
            </div>
            {stage.result.body ? (
              <p className="whitespace-pre-line rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                {stage.result.body}
              </p>
            ) : null}
            <Button onClick={install} size="sm">
              Download and install
            </Button>
          </div>
        ) : null}

        {stage.kind === "installing" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {stage.progress.phase === "downloading"
                ? "Downloading update…"
                : "Installing update…"}
            </p>
            <Progress
              value={
                stage.progress.total
                  ? Math.min(100, (stage.progress.downloaded / stage.progress.total) * 100)
                  : undefined
              }
            />
          </div>
        ) : null}

        {stage.kind === "installed" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Update installed. Restart to finish applying it.
            </div>
            <Button size="sm" onClick={() => relaunchApp()}>
              Restart now
            </Button>
          </div>
        ) : null}

        {stage.kind === "error" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--destructive))]">
              <AlertTriangle className="h-4 w-4" />
              {stage.message}
            </div>
            <Button size="sm" variant="outline" onClick={runCheck}>
              Try again
            </Button>
          </div>
        ) : null}

        {stage.kind !== "checking" && stage.kind !== "installing" ? (
          <Button size="sm" variant="ghost" onClick={runCheck}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Check again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
