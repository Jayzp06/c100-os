import { Link } from "wouter";
import { useGetMyCommittee } from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import {
  NudgeBadge,
  Pill,
  RoleBadge,
  eventTypeLabel,
} from "@/components/badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Users } from "lucide-react";

export default function MyCommitteePage() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  return <MyCommittee />;
}

function MyCommittee() {
  const { data, isLoading, error } = useGetMyCommittee();

  if (isLoading) {
    return (
      <AppShell>
        <LoadingBlock />
      </AppShell>
    );
  }

  if (error || !data) {
    const status = (error as { response?: { status?: number } } | undefined)
      ?.response?.status;
    if (status === 404) {
      return (
        <AppShell>
          <PageHeader eyebrow="My Committee" title="No committee yet" />
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You are not currently assigned to a committee. Reach out to
                the Executive Board to get placed.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/committees">
                  View all committees <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </AppShell>
      );
    }
    return (
      <AppShell>
        <ErrorBlock />
      </AppShell>
    );
  }

  const { committee, isChair, myStats, roster, followUpMembers, upcomingEvents, recentActivity } = data;

  return (
    <AppShell>
      <PageHeader
        eyebrow={committee.fourForFutureAlignment ?? "My Committee"}
        title={committee.name}
        description={committee.description}
        actions={
          <div className="flex items-center gap-2">
            {committee.committeeRank != null ? (
              <Pill tone="gold">Rank #{committee.committeeRank}</Pill>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/committees/${committee.id}`}>
                Public view <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Members" value={committee.memberCount} />
        <Stat
          label="Participation"
          value={`${committee.aggregateParticipationPct.toFixed(0)}%`}
        />
        <Stat label="Events hosted" value={committee.totalEventsHosted} />
        <Stat label="Impact points" value={committee.totalImpactPoints} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">My stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total points" value={myStats.totalPoints} />
            <Row label="Impact points" value={myStats.impactPoints} />
            <Row
              label="Participation"
              value={`${myStats.participationPct.toFixed(0)}%`}
            />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Nudge status</span>
              <NudgeBadge status={myStats.nudgeStatus} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">Upcoming events</CardTitle>
          </CardHeader>
          <CardContent>
            {!upcomingEvents || upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming events for this committee.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/events/${e.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
                    >
                      <div>
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {eventTypeLabel(e.eventType)} ·{" "}
                          {new Date(e.date).toLocaleDateString()}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {isChair ? (
        <>
          {followUpMembers && followUpMembers.length > 0 ? (
            <Card className="mt-6 border-[hsl(var(--secondary)/0.4)]">
              <CardHeader>
                <CardTitle className="font-serif">
                  Follow up ({followUpMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  These members are below the participation goal this
                  semester.
                </p>
                <div className="flex flex-wrap gap-2">
                  {followUpMembers.map((m) => (
                    <Link key={m.id} href={`/members/${m.id}`}>
                      <Pill tone="warning">{m.fullName}</Pill>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="font-serif">Committee roster</CardTitle>
            </CardHeader>
            <CardContent>
              {!roster || roster.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No members assigned to this committee yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Nudge</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                        <TableHead className="text-right">Impact</TableHead>
                        <TableHead className="text-right">
                          Participation
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roster.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <Link
                              href={`/members/${m.id}`}
                              className="font-medium hover:underline"
                            >
                              {m.fullName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <RoleBadge role={m.role} />
                          </TableCell>
                          <TableCell>
                            <NudgeBadge status={m.nudgeStatus} />
                          </TableCell>
                          <TableCell className="text-right">
                            {m.totalPoints}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.impactPoints}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {m.participationPct.toFixed(0)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {recentActivity && recentActivity.length > 0 ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="font-serif">Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {recentActivity.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{a.memberName}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.eventTitle} ·{" "}
                          {new Date(a.checkInTime).toLocaleString()}
                        </p>
                      </div>
                      <Pill tone="primary">+{a.pointsAwarded} pts</Pill>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="font-serif text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
