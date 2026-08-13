import { useState } from "react";
import { Link } from "wouter";
import {
  useListEvents,
  useListCommittees,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CardSkeleton,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
} from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import {
  EventStatusBadge,
  Pill,
  eventTypeLabel,
} from "@/components/badges";
import { ArrowRight, MapPin, Plus } from "lucide-react";
import { formatTime12h } from "@/lib/utils";

export default function EventsPage() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  return <EventsList />;
}

function EventsList() {
  const me = useMe();
  const [status, setStatus] = useState<string>("all");
  const [committeeId, setCommitteeId] = useState<string>("all");
  const committees = useListCommittees();

  const params: Record<string, string | number | undefined> = {};
  if (status !== "all") params.status = status;
  if (committeeId !== "all") params.committeeId = Number(committeeId);

  const events = useListEvents(
    Object.keys(params).length
      ? (params as { status?: "Upcoming" | "Active" | "Completed" | "Cancelled"; committeeId?: number })
      : undefined,
  );

  const canCreate = me.isLeader;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Events"
        title="Chapter events"
        description="General body meetings, committee work sessions, service events, mentoring, and conferences."
        actions={
          canCreate ? (
            <Button asChild data-testid="button-new-event">
              <Link href="/events/new">
                <Plus className="mr-1 h-4 w-4" /> New event
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="select-event-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Upcoming">Upcoming</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={committeeId} onValueChange={setCommitteeId}>
          <SelectTrigger data-testid="select-event-committee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All committees</SelectItem>
            {(committees.data ?? []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {events.isLoading ? (
        <CardSkeleton rows={5} />
      ) : events.error ? (
        <ErrorBlock />
      ) : !events.data || events.data.length === 0 ? (
        <EmptyBlock
          title="No events match"
          description="Try clearing filters or creating a new event."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {events.data.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="block group"
              data-testid={`event-${e.id}`}
            >
              <Card className="transition-shadow group-hover:shadow-md">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <EventStatusBadge status={e.status} />
                      <Pill tone="primary">{eventTypeLabel(e.eventType)}</Pill>
                      {e.committeeName ? (
                        <span className="text-xs text-muted-foreground">
                          · {e.committeeName}
                        </span>
                      ) : null}
                    </div>
                    <p className="font-serif text-lg font-semibold group-hover:text-[hsl(var(--primary))]">
                      {e.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(e.date)} · {formatTime12h(e.startTime)}–{formatTime12h(e.endTime)}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {e.location}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Points
                      </p>
                      <p className="font-serif text-lg font-semibold">
                        {e.pointValue}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Attendees
                      </p>
                      <p className="font-serif text-lg font-semibold">
                        {e.totalAttendees}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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

function formatDate(d: string) {
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
