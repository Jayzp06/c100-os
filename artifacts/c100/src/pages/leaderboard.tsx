import { Link } from "wouter";
import { useGetCommitteeLeaderboard } from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  CardSkeleton,
  ErrorBlock,
  LoadingBlock,
} from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import { Progress } from "@/components/ui/progress";
import { Pill } from "@/components/badges";
import { Trophy } from "lucide-react";

export default function LeaderboardPage() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  return <Leaderboard />;
}

function Leaderboard() {
  const data = useGetCommitteeLeaderboard();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Leaderboard"
        title="Committee leaderboard"
        description="The Trailblazing Chapter publishes committee standings only. Individual rankings stay private — by design."
      />

      {data.isLoading ? (
        <CardSkeleton rows={5} />
      ) : data.error || !data.data ? (
        <ErrorBlock />
      ) : (
        <div className="space-y-3">
          {data.data.map((c, idx) => {
            const tone =
              idx === 0 ? "gold" : idx === 1 ? "primary" : "neutral";
            return (
              <Link
                key={c.committeeId}
                href={`/committees/${c.committeeId}`}
                className="block"
                data-testid={`leaderboard-row-${c.committeeId}`}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4 sm:w-72">
                      <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-md bg-[hsl(var(--primary)/0.08)]">
                        <Trophy
                          className={
                            idx === 0
                              ? "h-6 w-6 text-[hsl(var(--secondary))]"
                              : "h-6 w-6 text-[hsl(var(--primary))]"
                          }
                        />
                        <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-[hsl(var(--primary))] font-serif text-xs font-bold text-[hsl(var(--primary-foreground))]">
                          {c.rank}
                        </span>
                      </div>
                      <div>
                        <p className="font-serif text-lg font-bold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Rank {c.rank} of the chapter
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Aggregate participation
                        </span>
                        <span className="font-semibold">
                          {c.participationPct.toFixed(0)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, c.participationPct)}
                        className="h-2"
                      />
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <Pill tone={tone}>{c.memberCount} members</Pill>
                        <span>·</span>
                        <span>{c.totalEventsHosted} events hosted</span>
                        <span>·</span>
                        <span>{c.totalImpactPoints} impact points</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
