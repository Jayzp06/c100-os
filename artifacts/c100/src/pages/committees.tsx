import { Link } from "wouter";
import { useListCommittees } from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  CardSkeleton,
  ErrorBlock,
  LoadingBlock,
} from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import { Pill } from "@/components/badges";
import { ArrowRight } from "lucide-react";

export default function CommitteesPage() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  return <CommitteesList />;
}

function CommitteesList() {
  const list = useListCommittees();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Committees"
        title="Five committees, one chapter"
        description="Each Trailblazer belongs to one of the five committees. The committees compete on participation and impact, never individual scores."
      />

      {list.isLoading ? (
        <CardSkeleton rows={5} />
      ) : list.error || !list.data ? (
        <ErrorBlock />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((c) => (
            <Link
              key={c.id}
              href={`/committees/${c.id}`}
              className="group"
              data-testid={`committee-${c.id}`}
            >
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--primary))]">
                        {c.fourForFutureAlignment ?? "Trailblazer"}
                      </p>
                      <h2 className="font-serif text-xl font-bold">{c.name}</h2>
                    </div>
                    {c.committeeRank != null ? (
                      <Pill tone="gold">Rank #{c.committeeRank}</Pill>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {c.description}
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Members
                      </p>
                      <p className="font-serif text-lg font-semibold">
                        {c.memberCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Events
                      </p>
                      <p className="font-serif text-lg font-semibold">
                        {c.totalEventsHosted}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Participation
                      </p>
                      <p className="font-serif text-lg font-semibold">
                        {c.aggregateParticipationPct.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <span>
                      Chair:{" "}
                      <span className="font-medium text-foreground">
                        {c.chairName ?? "Unassigned"}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
