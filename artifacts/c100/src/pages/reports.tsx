import { useState } from "react";
import {
  useGetAdminOverview,
  useGetScholarshipEligibility,
  useGetConferenceEligibility,
  useGetCommitteeReport,
  useListCommittees,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CardSkeleton,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
} from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import { MembershipBadge, Pill } from "@/components/badges";
import { ReportExportMenu } from "@/components/report-export";

export default function ReportsPage() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  if (!me.isExecOrAdmin && !me.isChair) {
    return (
      <AppShell>
        <ErrorBlock
          title="Leadership access only"
          message="Reports are restricted to the Executive Board, Admin, and Committee Chairs."
        />
      </AppShell>
    );
  }
  return <Reports />;
}

function Reports() {
  const me = useMe();

  if (!me.isExecOrAdmin) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Committee report"
          title="Reports"
          description="Roster, events, and participation for your committee."
        />
        {me.committeeChairId != null ? (
          <CommitteeReportView committeeId={me.committeeChairId} />
        ) : (
          <ErrorBlock
            title="No committee assigned"
            message="Ask an Admin to assign you as chair of a committee to view its report."
          />
        )}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Eligibility & overview"
        title="Reports"
        description="The data that drives award nominations, scholarship review, and conference travel selection."
      />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Chapter overview</TabsTrigger>
          <TabsTrigger value="scholarship" data-testid="tab-scholarship">Scholarship eligibility</TabsTrigger>
          <TabsTrigger value="conference" data-testid="tab-conference">Conference eligibility</TabsTrigger>
          <TabsTrigger value="committees" data-testid="tab-committees">Committee reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Overview />
        </TabsContent>
        <TabsContent value="scholarship" className="mt-4">
          <EligibilityTab kind="scholarship" />
        </TabsContent>
        <TabsContent value="conference" className="mt-4">
          <EligibilityTab kind="conference" />
        </TabsContent>
        <TabsContent value="committees" className="mt-4">
          <CommitteesTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Overview() {
  const data = useGetAdminOverview();
  if (data.isLoading) return <CardSkeleton rows={4} />;
  if (!data.data) return <ErrorBlock />;
  const o = data.data;
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ReportExportMenu endpoint="/api/reports/admin-overview" label="Export overview" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total members" value={o.totalMembers} />
        <StatCard label="Active members" value={o.activeMembers} />
        <StatCard
          label="At risk"
          value={o.atRiskMembers}
          tone={o.atRiskMembers > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Critical"
          value={o.criticalMembers}
          tone={o.criticalMembers > 0 ? "danger" : "default"}
        />
        <StatCard label="Total events" value={o.totalEvents} />
        <StatCard label="Upcoming" value={o.upcomingEvents} />
        <StatCard label="Completed" value={o.completedEvents} />
        <StatCard
          label="Chapter participation"
          value={`${o.chapterParticipationPct.toFixed(0)}%`}
          tone="primary"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Committee snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Committee</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Participation</TableHead>
                  <TableHead className="text-right">Impact pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.committees.map((c) => (
                  <TableRow key={c.committeeId}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.rank}</TableCell>
                    <TableCell className="text-right">
                      {c.memberCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.totalEventsHosted}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.participationPct.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {c.totalImpactPoints}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {o.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="divide-y">
              {o.recentActivity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {a.userName ?? "Member"} checked in to{" "}
                      {a.eventTitle ?? "an event"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.method} · {a.pointsAwarded} pts
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {a.checkInTime
                      ? new Date(a.checkInTime).toLocaleString()
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "primary" | "warning" | "danger";
}) {
  const border =
    tone === "primary"
      ? "border-[hsl(var(--primary)/0.25)]"
      : tone === "warning"
        ? "border-amber-300"
        : tone === "danger"
          ? "border-rose-300"
          : "";
  return (
    <Card className={border}>
      <CardContent className="space-y-1 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="font-serif text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function EligibilityTab({ kind }: { kind: "scholarship" | "conference" }) {
  const scholarship = useGetScholarshipEligibility();
  const conference = useGetConferenceEligibility();
  const data = kind === "scholarship" ? scholarship : conference;
  const endpoint =
    kind === "scholarship"
      ? "/api/reports/scholarship-eligibility"
      : "/api/reports/conference-eligibility";

  if (data.isLoading) return <CardSkeleton rows={5} />;
  if (!data.data) return <ErrorBlock />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ReportExportMenu endpoint={endpoint} />
      </div>
      {data.data.length === 0 ? (
        <EmptyBlock
          title="No eligibility records yet"
          description="As participation, GPA, and dues data come in, this list will populate."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {kind === "conference" ? (
                      <TableHead className="w-12 text-right">Rank</TableHead>
                    ) : null}
                    <TableHead>Member</TableHead>
                    <TableHead>Committee</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead className="text-right">Participation</TableHead>
                    <TableHead className="text-right">GPA</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Eligible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((r) => (
                    <TableRow key={r.userId}>
                      {kind === "conference" ? (
                        <TableCell className="text-right font-serif font-bold">
                          {r.rank ?? "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className="font-medium">{r.fullName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.committeeName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <MembershipBadge status={r.membershipStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={r.meetsParticipation ? "" : "text-amber-700 dark:text-amber-300"}>
                          {r.participationPct.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={r.meetsGpa ? "" : "text-amber-700 dark:text-amber-300"}>
                          {r.gpa != null ? Number(r.gpa).toFixed(2) : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {r.systemScore.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <Pill tone={r.eligible ? "success" : "danger"}>
                          {r.eligible ? "Eligible" : "Ineligible"}
                        </Pill>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CommitteesTab() {
  const committees = useListCommittees();
  const [selected, setSelected] = useState<number | null>(null);

  if (committees.isLoading) return <CardSkeleton rows={3} />;
  if (!committees.data) return <ErrorBlock />;

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select
          value={selected != null ? String(selected) : undefined}
          onValueChange={(v) => setSelected(Number(v))}
        >
          <SelectTrigger data-testid="select-committee-report">
            <SelectValue placeholder="Choose a committee" />
          </SelectTrigger>
          <SelectContent>
            {committees.data.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selected != null ? (
        <CommitteeReportView committeeId={selected} />
      ) : (
        <EmptyBlock
          title="Select a committee"
          description="Choose a committee above to view its roster, events, and participation."
        />
      )}
    </div>
  );
}

function CommitteeReportView({ committeeId }: { committeeId: number }) {
  const report = useGetCommitteeReport(committeeId);

  if (report.isLoading) return <CardSkeleton rows={4} />;
  if (!report.data) return <ErrorBlock />;
  const r = report.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-xl font-bold">{r.name}</h3>
          <p className="text-sm text-muted-foreground">
            Chair: {r.chairName ?? "Unassigned"} · {r.semester}
          </p>
        </div>
        <ReportExportMenu endpoint={`/api/reports/committee/${committeeId}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Members" value={r.memberCount} />
        <StatCard label="Events hosted" value={r.totalEventsHosted} />
        <StatCard label="Impact points" value={r.totalImpactPoints} />
        <StatCard
          label="Participation"
          value={`${r.aggregateParticipationPct.toFixed(0)}%`}
          tone="primary"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Roster</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Participation</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.fullName}</TableCell>
                    <TableCell>
                      <MembershipBadge status={m.membershipStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      {m.participationPct.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right">{m.totalPoints}</TableCell>
                    <TableCell className="text-right">{m.impactPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Events this semester</CardTitle>
        </CardHeader>
        <CardContent>
          {r.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet this semester.</p>
          ) : (
            <ul className="divide-y">
              {r.events.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.date}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {e.totalAttendees} attendees
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
