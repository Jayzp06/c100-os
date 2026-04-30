import { Link, useParams } from "wouter";
import {
  useGetCommittee,
  useGetCommitteeRoster,
  getGetCommitteeQueryKey,
  getGetCommitteeRosterQueryKey,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import {
  MembershipBadge,
  NudgeBadge,
  Pill,
  RoleBadge,
} from "@/components/badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function CommitteeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  return <CommitteeDetail id={id} />;
}

function CommitteeDetail({ id }: { id: number }) {
  const me = useMe();
  const committee = useGetCommittee(id, {
    query: {
      queryKey: getGetCommitteeQueryKey(id),
      enabled: Number.isFinite(id),
    },
  });
  const roster = useGetCommitteeRoster(id, {
    query: {
      queryKey: getGetCommitteeRosterQueryKey(id),
      enabled: me.isLeader && Number.isFinite(id),
    },
  });

  if (committee.isLoading) {
    return (
      <AppShell>
        <LoadingBlock />
      </AppShell>
    );
  }
  if (!committee.data) {
    return (
      <AppShell>
        <ErrorBlock />
      </AppShell>
    );
  }
  const c = committee.data;

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href="/committees">
          <ArrowLeft className="mr-1 h-4 w-4" /> All committees
        </Link>
      </Button>
      <PageHeader
        eyebrow={c.fourForFutureAlignment ?? "Committee"}
        title={c.name}
        description={c.description}
        actions={
          c.committeeRank != null ? (
            <Pill tone="gold">Rank #{c.committeeRank}</Pill>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Members" value={c.memberCount} />
        <Stat
          label="Participation"
          value={`${c.aggregateParticipationPct.toFixed(0)}%`}
        />
        <Stat label="Events hosted" value={c.totalEventsHosted} />
        <Stat label="Impact points" value={c.totalImpactPoints} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Chair</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {c.chairName ?? "Unassigned"}
            </p>
            <p className="text-sm text-muted-foreground">
              {c.chairUserId
                ? "Reach out to your chair for committee meetings and project assignments."
                : "Executive Board can assign a chair from the Members page."}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">Committee roster</CardTitle>
          </CardHeader>
          <CardContent>
            {!me.isLeader ? (
              <div className="flex items-start gap-3 rounded-md border bg-[hsl(var(--muted)/0.4)] p-4 text-sm">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Roster is private.</p>
                  <p className="text-muted-foreground">
                    Individual standings are visible to leadership only. The
                    chapter publishes aggregate committee results, never
                    individual rankings.
                  </p>
                </div>
              </div>
            ) : roster.isLoading ? (
              <LoadingBlock />
            ) : !roster.data || roster.data.length === 0 ? (
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
                      <TableHead>Membership</TableHead>
                      <TableHead>Nudge</TableHead>
                      <TableHead className="text-right">Participation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.data.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Link
                            href={`/members/${m.id}`}
                            className="block hover:underline"
                          >
                            <p className="font-medium">{m.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.email}
                            </p>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={m.role} />
                        </TableCell>
                        <TableCell>
                          <MembershipBadge status={m.membershipStatus} />
                        </TableCell>
                        <TableCell>
                          <NudgeBadge status={m.nudgeStatus} />
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
      </div>
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
