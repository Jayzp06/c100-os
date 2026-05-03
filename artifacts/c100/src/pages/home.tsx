import * as React from "react";
import { Link } from "wouter";
import { useMe } from "@/lib/me";
import {
  useGetMyDashboard,
  useListMyNudges,
  useListEvents,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CardSkeleton,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
} from "@/components/page-states";
import LoginPage from "@/pages/login";
import {
  EventStatusBadge,
  NudgeBadge,
  Pill,
  RoleBadge,
  eventTypeLabel,
} from "@/components/badges";
import {
  ArrowRight,
  CalendarDays,
  Flame,
  Mail,
  TrendingUp,
} from "lucide-react";

function formatDate(d?: string) {
  if (!d) return "";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function PendingApproval() {
  const [bootstrapNeeded, setBootstrapNeeded] = React.useState<boolean | null>(null);
  const [claiming, setClaiming] = React.useState(false);
  const [claimError, setClaimError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/bootstrap/status")
      .then((r) => r.json())
      .then((d: { bootstrapNeeded: boolean }) => setBootstrapNeeded(d.bootstrapNeeded))
      .catch(() => setBootstrapNeeded(false));
  }, []);

  async function claimAdmin() {
    setClaiming(true);
    setClaimError(null);
    try {
      const r = await fetch("/api/bootstrap/claim-admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (r.ok) {
        window.location.reload();
      } else {
        let errMsg = "Failed to claim admin slot.";
        try {
          const body = await r.json() as { error?: string };
          errMsg = body.error ?? errMsg;
        } catch {
          // ignore parse failure
        }
        setClaimError(errMsg);
      }
    } catch (err) {
      setClaimError(`Request failed (${err instanceof Error ? err.message : String(err)}). Make sure you are signed in.`);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Pending Approval"
        title="Awaiting chapter activation"
        description="You're signed in to Replit, but your account hasn't been activated in the chapter roster yet. Your Executive Board controls chapter access."
      />
      {bootstrapNeeded && (
        <Card className="mb-4 border-[hsl(var(--secondary)/0.4)] bg-[hsl(var(--secondary)/0.06)]">
          <CardContent className="flex flex-col gap-3 p-6">
            <p className="text-sm font-medium">
              First-time setup: no chapter admin has been claimed yet.
            </p>
            <p className="text-sm text-muted-foreground">
              If you are the chapter Admin, click below to activate your account
              and take over the admin role. This option disappears once claimed.
            </p>
            {claimError && (
              <p className="text-sm text-destructive">{claimError}</p>
            )}
            <Button
              onClick={claimAdmin}
              disabled={claiming}
              data-testid="button-claim-admin"
            >
              {claiming ? "Activating..." : "Activate as Chapter Admin"}
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <p className="text-sm text-muted-foreground">
            Reach out to a member of the Executive Board with your full name,
            student ID, and committee preference. Once you&apos;re added and
            your account is activated, sign back in to see your dashboard.
          </p>
          <Button asChild variant="outline" data-testid="button-pending-logout">
            <a href="/api/logout">Sign out</a>
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "gold";
}) {
  return (
    <Card
      className={
        tone === "primary"
          ? "border-[hsl(var(--primary)/0.25)]"
          : tone === "gold"
            ? "border-[hsl(var(--secondary)/0.4)]"
            : ""
      }
    >
      <CardContent className="space-y-1 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="font-serif text-3xl font-bold">{value}</p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const me = useMe();

  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock label="Loading chapter system" />
      </div>
    );
  }

  if (!me.isAuthenticated) return <LoginPage />;
  if (me.isPendingApproval) return <PendingApproval />;
  if (!me.member) {
    return (
      <AppShell>
        <ErrorBlock message="We couldn't load your chapter profile. Try signing out and back in." />
      </AppShell>
    );
  }

  return <Dashboard />;
}

function Dashboard() {
  const me = useMe();
  const dashboard = useGetMyDashboard();
  const nudges = useListMyNudges();
  const upcomingEvents = useListEvents({ status: "Upcoming" });
  const activeEvents = useListEvents({ status: "Active" });

  if (dashboard.isLoading) {
    return (
      <AppShell>
        <LoadingBlock label="Loading your dashboard" />
      </AppShell>
    );
  }
  if (dashboard.error || !dashboard.data) {
    return (
      <AppShell>
        <ErrorBlock message="We couldn't load your dashboard." />
      </AppShell>
    );
  }

  const data = dashboard.data;
  const member = data.member;
  const goal = data.participationGoalPct;
  const part = member.participationPct;
  const onTrack = part >= goal;
  const unreadNudges = (nudges.data ?? []).filter((n) => !n.read);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Trailblazer dashboard"
        title={`Welcome, ${member.fullName.split(" ")[0]}.`}
        description={
          <>
            Your chapter snapshot, your nudges, and what&apos;s next. Stay above{" "}
            <span className="font-medium text-foreground">
              {goal.toFixed(0)}% participation
            </span>{" "}
            to remain eligible for awards, scholarship, and conference travel.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <RoleBadge role={member.role} />
            <NudgeBadge status={member.nudgeStatus} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Participation"
          value={`${part.toFixed(0)}%`}
          hint={`${member.eventsAttended} of ${member.eventsEligible} events`}
          tone={onTrack ? "primary" : "default"}
        />
        <StatCard
          label="Total points"
          value={member.totalPoints}
          hint={`${member.impactPoints} impact-weighted`}
        />
        <StatCard
          label="Streak"
          value={
            <span className="inline-flex items-center gap-2">
              {member.streakCount}
              {member.streakCount > 0 ? (
                <Flame className="h-5 w-5 text-[hsl(var(--secondary))]" />
              ) : null}
            </span>
          }
          hint="consecutive eligible events attended"
          tone="gold"
        />
        <StatCard
          label="Committee"
          value={
            data.committee ? (
              <span className="text-xl">{data.committee.name}</span>
            ) : (
              <span className="text-base text-muted-foreground">Unassigned</span>
            )
          }
          hint={
            data.committee && data.committee.committeeRank != null
              ? `Rank #${data.committee.committeeRank} this semester`
              : undefined
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">Participation toward goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress
              value={Math.min(100, (part / Math.max(goal, 1)) * 100)}
              className="h-3"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                You&apos;re at{" "}
                <span className="font-semibold text-foreground">
                  {part.toFixed(0)}%
                </span>{" "}
                of the {goal.toFixed(0)}% chapter standard.
              </span>
              <Pill tone={onTrack ? "success" : "warning"}>
                {onTrack ? "On track" : "Below standard"}
              </Pill>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Events attended
                </p>
                <p className="text-lg font-semibold">
                  {member.eventsAttended}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Eligible events
                </p>
                <p className="text-lg font-semibold">
                  {member.eventsEligible}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Dues
                </p>
                <p className="text-lg font-semibold">
                  {member.duesPaid ? "Paid" : "Outstanding"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif">Active nudges</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/nudges">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {nudges.isLoading ? (
              <CardSkeleton rows={3} />
            ) : unreadNudges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active nudges. Keep it up.
              </p>
            ) : (
              <ul className="space-y-3">
                {unreadNudges.slice(0, 4).map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border bg-[hsl(var(--muted)/0.4)] p-3"
                    data-testid={`nudge-${n.id}`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                        {n.nudgeType}
                      </span>
                    </div>
                    <p className="text-sm leading-snug">{n.messageContent}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif">Active right now</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/events">
                All events <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activeEvents.isLoading ? (
              <CardSkeleton rows={2} />
            ) : !activeEvents.data || activeEvents.data.length === 0 ? (
              <EmptyBlock
                title="No active events"
                description="When the chapter starts an event, you'll see check-in CTAs here."
              />
            ) : (
              <ul className="space-y-3">
                {activeEvents.data.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                    data-testid={`active-event-${e.id}`}
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <EventStatusBadge status={e.status} />
                        <span className="text-xs text-muted-foreground">
                          {eventTypeLabel(e.eventType)}
                        </span>
                      </div>
                      <p className="truncate font-medium">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.location} · {e.startTime}
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/events/${e.id}`}>
                        Check in <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif">Upcoming</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingEvents.isLoading ? (
              <CardSkeleton rows={3} />
            ) : !upcomingEvents.data || upcomingEvents.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming events on the calendar yet.
              </p>
            ) : (
              <ul className="divide-y">
                {upcomingEvents.data.slice(0, 5).map((e) => (
                  <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/events/${e.id}`}
                      className="block group"
                      data-testid={`upcoming-event-${e.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium group-hover:text-[hsl(var(--primary))]">
                            {e.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDate(e.date)} · {e.startTime} · {e.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Pill tone="gold">{e.pointValue} pts</Pill>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif">
              Committee leaderboard
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/leaderboard">
                Full leaderboard <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.committeeLeaderboard.map((c) => (
                <li
                  key={c.committeeId}
                  className="flex items-center justify-between rounded-md border p-3"
                  data-testid={`leaderboard-${c.committeeId}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary)/0.08)] font-serif text-sm font-bold text-[hsl(var(--primary))]">
                      {c.rank}
                    </span>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.memberCount} members ·{" "}
                        {c.totalEventsHosted} events hosted
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Participation
                      </p>
                      <p className="text-sm font-semibold">
                        {c.participationPct.toFixed(0)}%
                      </p>
                    </div>
                    <TrendingUp className="h-4 w-4 text-[hsl(var(--secondary))]" />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
