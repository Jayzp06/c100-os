import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateEvent,
  useListCommittees,
  getListEventsQueryKey,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBlock, LoadingBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EVENT_TYPES = [
  "GeneralBodyMeeting",
  "CommitteeMeeting",
  "CommunityService",
  "MentoringSession",
  "Workshop",
  "Fundraiser",
  "Conference",
  "Social",
] as const;

export default function NewEventPage() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  if (!me.isLeader) {
    return (
      <AppShell>
        <ErrorBlock
          title="Leadership only"
          message="Only Committee Chairs and above can create events."
        />
      </AppShell>
    );
  }
  return <NewEventForm />;
}

function NewEventForm() {
  const committees = useListCommittees();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateEvent({
    mutation: {
      onSuccess: (event) => {
        toast({ title: "Event created." });
        qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
        setLocation(`/events/${event.id}`);
      },
      onError: () => {
        toast({ title: "Could not create event.", variant: "destructive" });
      },
    },
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    eventType: "CommitteeMeeting" as (typeof EVENT_TYPES)[number],
    committeeId: "none",
    date: new Date().toISOString().slice(0, 10),
    startTime: "18:00",
    endTime: "19:30",
    location: "",
    checkInWindowMinutes: "",
  });

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description || !form.location) {
      toast({ title: "Title, description, and location are required.", variant: "destructive" });
      return;
    }
    const payload = {
      title: form.title,
      description: form.description,
      eventType: form.eventType,
      committeeId: form.committeeId === "none" ? null : Number(form.committeeId),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location,
      checkInWindowMinutes: form.checkInWindowMinutes
        ? Number(form.checkInWindowMinutes)
        : undefined,
    };
    create.mutate({ data: payload });
  }

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href="/events">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to events
        </Link>
      </Button>
      <PageHeader
        eyebrow="New event"
        title="Schedule a chapter event"
        description="Members will see this on their dashboard. Activate the QR check-in from the event detail page when the event begins."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Event details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  data-testid="input-description"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Event type</Label>
                <Select
                  value={form.eventType}
                  onValueChange={(v) =>
                    update("eventType", v as (typeof EVENT_TYPES)[number])
                  }
                >
                  <SelectTrigger data-testid="select-eventtype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Committee</Label>
                <Select
                  value={form.committeeId}
                  onValueChange={(v) => update("committeeId", v)}
                >
                  <SelectTrigger data-testid="select-event-committee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Chapter-wide</SelectItem>
                    {(committees.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                  data-testid="input-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  data-testid="input-location"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start">Start time</Label>
                <Input
                  id="start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => update("startTime", e.target.value)}
                  data-testid="input-start"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">End time</Label>
                <Input
                  id="end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => update("endTime", e.target.value)}
                  data-testid="input-end"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <p className="rounded-md border bg-[hsl(var(--muted)/0.4)] p-3 text-xs text-muted-foreground">
                  Points and impact multiplier are set automatically from the
                  event type's scoring rules.
                  {" "}
                  Technology Chairs and Admins can adjust the rules for each
                  event type from the Tech Console.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="window">Check-in window (minutes)</Label>
                <Input
                  id="window"
                  type="number"
                  min="5"
                  max="240"
                  value={form.checkInWindowMinutes}
                  onChange={(e) =>
                    update("checkInWindowMinutes", e.target.value)
                  }
                  placeholder="Default: 30"
                  data-testid="input-window"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={create.isPending}
                data-testid="button-create-event"
              >
                {create.isPending ? "Creating…" : "Create event"}
              </Button>
              <Button asChild variant="ghost">
                <Link href="/events">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
