import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { normalizeCheckInCode } from "@workspace/checkin-codes";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetEvent,
  useGetCurrentEventQr,
  useCheckInToEvent,
  useListEventAttendance,
  useActivateEventQr,
  useDeactivateEventQr,
  useDeleteEvent,
  useUpdateEvent,
  useManualAttendance,
  useDeleteEventAttendance,
  useListMembers,
  useListCommittees,
  getGetEventQueryKey,
  getListEventAttendanceQueryKey,
  getGetCurrentEventQrQueryKey,
  getListEventsQueryKey,
  getGetMyDashboardQueryKey,
} from "@workspace/api-client-react";
import { invalidateAggregates } from "@/lib/query-invalidation";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ReportExportMenu } from "@/components/report-export";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  QrCode,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EventDetailPage() {
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
  return <EventDetail id={id} />;
}

function EventDetail({ id }: { id: number }) {
  const me = useMe();
  const event = useGetEvent(id, {
    query: {
      queryKey: getGetEventQueryKey(id),
      enabled: Number.isFinite(id),
    },
  });

  if (event.isLoading) {
    return (
      <AppShell>
        <LoadingBlock />
      </AppShell>
    );
  }
  if (!event.data) {
    return (
      <AppShell>
        <ErrorBlock />
      </AppShell>
    );
  }
  const e = event.data;
  const isLeader = me.isLeader;

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href="/events">
          <ArrowLeft className="mr-1 h-4 w-4" /> All events
        </Link>
      </Button>
      <PageHeader
        eyebrow={eventTypeLabel(e.eventType)}
        title={e.title}
        description={e.description}
        actions={
          <div className="flex items-center gap-2">
            <EventStatusBadge status={e.status} />
            <Pill tone="gold">{e.pointValue} pts</Pill>
            {e.qrActive ? <Pill tone="success">QR Live</Pill> : null}
            {me.isExecOrAdmin || me.committeeChairId === e.committeeId ? (
              <ReportExportMenu endpoint={`/api/reports/event/${id}`} />
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Date" value={formatDate(e.date)} />
        <Stat label="Time" value={`${e.startTime} – ${e.endTime}`} />
        <Stat
          label="Location"
          value={
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {e.location}
            </span>
          }
        />
        <Stat label="Attendees" value={String(e.totalAttendees)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CheckInPanel id={id} event={e} isLeader={isLeader} />
        {isLeader ? <ChairControls id={id} event={e} /> : null}
      </div>

      {isLeader ? <AttendanceSection id={id} /> : null}
    </AppShell>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-serif text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function CheckInPanel({
  id,
  event,
  isLeader,
}: {
  id: number;
  event: { qrActive: boolean; status: string };
  isLeader: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();
  const [token, setToken] = useState("");
  useEffect(() => {
    const scanned = new URLSearchParams(search).get("code");
    if (scanned) setToken(normalizeCheckInCode(scanned));
  }, [search]);
  const checkIn = useCheckInToEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Checked in. Points awarded." });
        setToken("");
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListEventAttendanceQueryKey(id) });
        invalidateAggregates(qc);
      },
      onError: (err) => {
        const msg =
          (err as { data?: { error?: { message?: string } } })?.data?.error
            ?.message ?? "Code didn't match. Try the latest code.";
        toast({ title: "Check-in failed", description: msg, variant: "destructive" });
      },
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-serif">Check in</CardTitle>
        {isLeader ? (
          <Button asChild size="sm" variant="outline" data-testid="button-open-qr">
            <Link href={`/events/${id}/qr`}>
              <QrCode className="mr-1 h-3.5 w-3.5" /> Open QR display
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {!event.qrActive ? (
          <p className="text-sm text-muted-foreground">
            Check-in isn&apos;t active for this event yet. The chair will activate
            the rotating QR code when the event begins.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Enter the rotating code shown by your chair. Codes refresh every
              60 seconds — only the current and previous codes are accepted.
            </p>
            <div className="flex gap-2">
              <Input
                value={token}
                onChange={(e) => setToken(normalizeCheckInCode(e.target.value))}
                placeholder="Enter code"
                maxLength={6}
                className="font-mono uppercase tracking-widest"
                data-testid="input-checkin-token"
              />
              <Button
                onClick={() => token && checkIn.mutate({ id, data: { token } })}
                disabled={!token || checkIn.isPending}
                data-testid="button-checkin"
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {checkIn.isPending ? "Checking…" : "Check in"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

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

function EditEventForm({
  id,
  event,
  onDone,
}: {
  id: number;
  event: {
    title: string;
    description: string;
    eventType: string;
    committeeId?: number | null;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    pointValue: number;
    impactMultiplier: number;
    checkInWindowMinutes: number;
  };
  onDone: () => void;
}) {
  const committees = useListCommittees();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: event.title,
    description: event.description,
    eventType: event.eventType as (typeof EVENT_TYPES)[number],
    committeeId: event.committeeId ? String(event.committeeId) : "none",
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    pointValue: String(event.pointValue ?? ""),
    impactMultiplier: String(event.impactMultiplier ?? ""),
    checkInWindowMinutes: String(event.checkInWindowMinutes ?? ""),
  });

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const save = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event updated." });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
        qc.invalidateQueries({ queryKey: getListEventAttendanceQueryKey(id) });
        invalidateAggregates(qc);
        onDone();
      },
      onError: () => {
        toast({ title: "Could not update event.", variant: "destructive" });
      },
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({
      id,
      data: {
        title: form.title,
        description: form.description,
        eventType: form.eventType,
        committeeId:
          form.committeeId === "none" ? null : Number(form.committeeId),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location,
        pointValue: form.pointValue ? Number(form.pointValue) : undefined,
        impactMultiplier: form.impactMultiplier
          ? Number(form.impactMultiplier)
          : undefined,
        checkInWindowMinutes: form.checkInWindowMinutes
          ? Number(form.checkInWindowMinutes)
          : undefined,
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border bg-[hsl(var(--muted)/0.4)] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="edit-title">Title</Label>
          <Input
            id="edit-title"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            data-testid="input-edit-title"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            data-testid="input-edit-description"
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
            <SelectTrigger data-testid="select-edit-eventtype">
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
            <SelectTrigger data-testid="select-edit-committee">
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
          <Label htmlFor="edit-date">Date</Label>
          <Input
            id="edit-date"
            type="date"
            value={form.date}
            onChange={(e) => update("date", e.target.value)}
            data-testid="input-edit-date"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-location">Location</Label>
          <Input
            id="edit-location"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            data-testid="input-edit-location"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-start">Start time</Label>
          <Input
            id="edit-start"
            type="time"
            value={form.startTime}
            onChange={(e) => update("startTime", e.target.value)}
            data-testid="input-edit-start"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-end">End time</Label>
          <Input
            id="edit-end"
            type="time"
            value={form.endTime}
            onChange={(e) => update("endTime", e.target.value)}
            data-testid="input-edit-end"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-pts">Point value</Label>
          <Input
            id="edit-pts"
            type="number"
            min="0"
            value={form.pointValue}
            onChange={(e) => update("pointValue", e.target.value)}
            data-testid="input-edit-points"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-mult">Impact multiplier</Label>
          <Input
            id="edit-mult"
            type="number"
            step="0.01"
            min="0.5"
            max="3"
            value={form.impactMultiplier}
            onChange={(e) => update("impactMultiplier", e.target.value)}
            data-testid="input-edit-multiplier"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-window">Check-in window (minutes)</Label>
          <Input
            id="edit-window"
            type="number"
            min="5"
            max="240"
            value={form.checkInWindowMinutes}
            onChange={(e) => update("checkInWindowMinutes", e.target.value)}
            data-testid="input-edit-window"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={save.isPending} data-testid="button-save-event">
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ChairControls({
  id,
  event,
}: {
  id: number;
  event: {
    qrActive: boolean;
    status: string;
    title: string;
    description: string;
    eventType: string;
    committeeId?: number | null;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    pointValue: number;
    impactMultiplier: number;
    checkInWindowMinutes: number;
  };
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);

  const invalidateEvent = () => {
    qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetCurrentEventQrQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
  };

  const activate = useActivateEventQr({
    mutation: {
      onSuccess: () => {
        toast({ title: "Check-in activated." });
        invalidateEvent();
      },
    },
  });
  const deactivate = useDeactivateEventQr({
    mutation: {
      onSuccess: () => {
        toast({ title: "Check-in closed." });
        invalidateEvent();
      },
    },
  });
  const remove = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event cancelled." });
        qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
        invalidateAggregates(qc);
        setLocation("/events");
      },
    },
  });
  const reactivate = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event reactivated." });
        invalidateEvent();
        qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
        invalidateAggregates(qc);
      },
    },
  });

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Edit event</CardTitle>
        </CardHeader>
        <CardContent>
          <EditEventForm
            id={id}
            event={event}
            onDone={() => setEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-serif">Chair controls</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(true)}
          data-testid="button-edit-event"
        >
          Edit details
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {event.qrActive ? (
            <Button
              variant="outline"
              onClick={() => deactivate.mutate({ id })}
              disabled={deactivate.isPending}
              data-testid="button-deactivate-qr"
            >
              Stop check-in
            </Button>
          ) : (
            <Button
              onClick={() => activate.mutate({ id })}
              disabled={activate.isPending || event.status === "Cancelled"}
              data-testid="button-activate-qr"
            >
              <QrCode className="mr-1 h-4 w-4" /> Start check-in
            </Button>
          )}
          {event.status === "Cancelled" ? (
            <Button
              variant="outline"
              onClick={() =>
                reactivate.mutate({ id, data: { status: "Upcoming" } })
              }
              disabled={reactivate.isPending}
              data-testid="button-reactivate-event"
            >
              {reactivate.isPending ? "Reactivating…" : "Reactivate event"}
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-cancel-event">
                  <Trash2 className="mr-1 h-4 w-4" /> Cancel event
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Members will see this event marked as cancelled. Existing
                    attendance records remain, and it can be reactivated later
                    from this page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate({ id })}>
                    Cancel event
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Need to add someone who couldn&apos;t scan? Use manual attendance below.
        </p>
      </CardContent>
    </Card>
  );
}

function AttendanceSection({ id }: { id: number }) {
  const me = useMe();
  const attendance = useListEventAttendance(id);
  const members = useListMembers();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState<string>("");
  const [reason, setReason] = useState("");

  const manual = useManualAttendance({
    mutation: {
      onSuccess: () => {
        toast({ title: "Attendance recorded." });
        setOpen(false);
        setMemberId("");
        setReason("");
        qc.invalidateQueries({ queryKey: getListEventAttendanceQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        invalidateAggregates(qc);
      },
      onError: () => {
        toast({ title: "Could not record attendance.", variant: "destructive" });
      },
    },
  });

  const removeAttendance = useDeleteEventAttendance({
    mutation: {
      onSuccess: () => {
        toast({ title: "Attendance record removed." });
        qc.invalidateQueries({ queryKey: getListEventAttendanceQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetMyDashboardQueryKey() });
        invalidateAggregates(qc);
      },
      onError: () => {
        toast({
          title: "Could not remove attendance record.",
          variant: "destructive",
        });
      },
    },
  });

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-serif">Attendance</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          data-testid="button-toggle-manual"
        >
          <UserPlus className="mr-1 h-4 w-4" />
          {open ? "Close" : "Manual entry"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {open ? (
          <div className="space-y-3 rounded-md border bg-[hsl(var(--muted)/0.4)] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Member</Label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger data-testid="select-manual-member">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {(members.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Reason</Label>
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why this needs to be recorded manually"
                  data-testid="input-manual-reason"
                />
              </div>
            </div>
            <Button
              onClick={() =>
                memberId &&
                reason &&
                manual.mutate({
                  id,
                  data: { userId: Number(memberId), reason },
                })
              }
              disabled={!memberId || !reason || manual.isPending}
              data-testid="button-submit-manual"
            >
              {manual.isPending ? "Recording…" : "Record attendance"}
            </Button>
          </div>
        ) : null}

        {attendance.isLoading ? (
          <LoadingBlock />
        ) : !attendance.data || attendance.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendance recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  {me.isAdmin ? <TableHead className="w-10" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.userName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.checkInTime
                        ? new Date(a.checkInTime).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Pill
                        tone={
                          a.method === "QrScan"
                            ? "success"
                            : a.method === "Manual"
                              ? "primary"
                              : "warning"
                        }
                      >
                        {a.method}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {a.pointsAwarded}
                    </TableCell>
                    {me.isAdmin ? (
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              data-testid={`button-remove-attendance-${a.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove this attendance record?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {a.userName}&apos;s check-in and{" "}
                                {a.pointsAwarded} awarded points for this event
                                will be removed. Use this to correct a
                                mis-scan or duplicate entry.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep it</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() =>
                                  removeAttendance.mutate({
                                    id,
                                    attendanceId: a.id,
                                  })
                                }
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
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
