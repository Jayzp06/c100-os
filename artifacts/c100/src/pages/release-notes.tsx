import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/lib/me";
import { useListSystemReleases } from "@workspace/api-client-react";
import {
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/page-states";
import LoginPage from "@/pages/login";
import { Pill } from "@/components/badges";
import { Tag } from "lucide-react";

export default function ReleaseNotesPage() {
  const me = useMe();
  const { data: releases, isLoading, error } = useListSystemReleases();

  if (me.isLoading) return null;
  if (!me.isAuthenticated) return <LoginPage />;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Desktop"
        title="Release Notes"
        description="What changed in each published version of the desktop app."
      />

      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message="Could not load release notes." />
      ) : !releases || releases.length === 0 ? (
        <EmptyBlock
          title="No releases published yet"
          description="Release notes appear here once the first desktop build ships through GitHub Actions."
        />
      ) : (
        <div className="space-y-4">
          {releases.map((r) => (
            <Card key={r.version}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  v{r.version}
                  <Pill tone={r.channel === "stable" ? "success" : "warning"}>
                    {r.channel}
                  </Pill>
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {new Date(r.pubDate).toLocaleDateString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {r.releaseNotes ? (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {r.releaseNotes}
                  </p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No notes provided for this release.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
