import { useState } from "react";
import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Mail, Plus, CheckCircle2, FileText, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "secretary")!;

interface MeetingRecord { id: number; meetingType: string; title: string; meetingDate: string; status: string; }
interface Correspondence { id: number; direction: string; correspondent: string; subject: string; dateSent: string; }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-800",
};

export default function SecretaryWorkspacePage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: meetings, isLoading: meetingsLoading, error: meetingsError } = useQuery<MeetingRecord[]>({
    queryKey: ["secretary", "meetings"],
    queryFn: async () => { const r = await fetch("/api/secretary/meetings"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });

  const { data: correspondence, isLoading: corrLoading } = useQuery<Correspondence[]>({
    queryKey: ["secretary", "correspondence"],
    queryFn: async () => { const r = await fetch("/api/secretary/correspondence"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });

  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ meetingType: "GeneralBody", title: "", meetingDate: new Date().toISOString().split("T")[0], agendaText: "", notes: "" });

  const [corrOpen, setCorrOpen] = useState(false);
  const [corrForm, setCorrForm] = useState({ direction: "Inbound" as "Inbound" | "Outbound", correspondent: "", subject: "", dateSent: new Date().toISOString().split("T")[0], description: "" });

  const [reviseOpen, setReviseOpen] = useState(false);
  const [revisingId, setRevisingId] = useState<number | null>(null);
  const [reviseForm, setReviseForm] = useState({ reason: "", agendaText: "", notes: "" });

  const createRevision = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof reviseForm }) => {
      const r = await fetch(`/api/secretary/meetings/${id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["secretary", "meetings"] });
      setReviseOpen(false);
      setRevisingId(null);
      toast({ title: "Revision recorded. Record moved back to submitted." });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createMeeting = useMutation({
    mutationFn: async (data: typeof meetingForm) => {
      const r = await fetch("/api/secretary/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secretary", "meetings"] }); setMeetingOpen(false); toast({ title: "Meeting record created." }); },
    onError: () => toast({ title: "Failed to create meeting record.", variant: "destructive" }),
  });

  const approveMeeting = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/secretary/meetings/${id}/approve`, { method: "POST" });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secretary", "meetings"] }); toast({ title: "Meeting record approved." }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createCorr = useMutation({
    mutationFn: async (data: typeof corrForm) => {
      const r = await fetch("/api/secretary/correspondence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secretary", "correspondence"] }); setCorrOpen(false); toast({ title: "Correspondence logged." }); },
    onError: () => toast({ title: "Failed to log correspondence.", variant: "destructive" }),
  });

  const meetingList = meetings ?? [];
  const corrList = correspondence ?? [];
  const approvedCount = meetingList.filter((m) => m.status === "approved").length;
  const draftCount = meetingList.filter((m) => m.status === "draft" || m.status === "submitted").length;

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        <StatGrid stats={[
          { label: "Approved Records", value: approvedCount, icon: CheckCircle2 },
          { label: "In Progress", value: draftCount, icon: FileText },
          { label: "Correspondence", value: corrList.length, icon: Mail },
        ]} />

        <Tabs defaultValue="meetings">
          <TabsList>
            <TabsTrigger value="meetings">Meeting Records</TabsTrigger>
            <TabsTrigger value="correspondence">Correspondence</TabsTrigger>
          </TabsList>

          <TabsContent value="meetings" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> New Meeting Record</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>New Meeting Record</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select value={meetingForm.meetingType} onValueChange={(v) => setMeetingForm((f) => ({ ...f, meetingType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["GeneralBody", "ExecutiveBoard", "Committee", "Special", "Emergency", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Input type="date" value={meetingForm.meetingDate} onChange={(e) => setMeetingForm((f) => ({ ...f, meetingDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Title</Label>
                      <Input value={meetingForm.title} onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Agenda</Label>
                      <Textarea rows={3} value={meetingForm.agendaText} onChange={(e) => setMeetingForm((f) => ({ ...f, agendaText: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <Textarea rows={3} value={meetingForm.notes} onChange={(e) => setMeetingForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <Button className="w-full" disabled={!meetingForm.title || createMeeting.isPending} onClick={() => createMeeting.mutate(meetingForm)}>
                      {createMeeting.isPending ? "Saving…" : "Create Record"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {meetingsLoading ? <LoadingBlock /> : meetingsError ? <ErrorBlock message="Could not load meeting records." /> : (
              <Card>
                <CardContent className="pt-4">
                  {meetingList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No meeting records yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {meetingList.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium">{m.title}</p>
                            <p className="text-xs text-muted-foreground">{m.meetingType} · {m.meetingDate}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-800"}`}>{m.status}</span>
                            {m.status !== "approved" && m.status !== "archived" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approveMeeting.mutate(m.id)} disabled={approveMeeting.isPending}>Approve</Button>
                            )}
                            {m.status === "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => { setRevisingId(m.id); setReviseForm({ reason: "", agendaText: "", notes: "" }); setReviseOpen(true); }}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Revise
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="correspondence" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={corrOpen} onOpenChange={setCorrOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Log Correspondence</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Log Correspondence</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Direction</Label>
                        <Select value={corrForm.direction} onValueChange={(v) => setCorrForm((f) => ({ ...f, direction: v as "Inbound" | "Outbound" }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Inbound">Inbound</SelectItem>
                            <SelectItem value="Outbound">Outbound</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Input type="date" value={corrForm.dateSent} onChange={(e) => setCorrForm((f) => ({ ...f, dateSent: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Correspondent</Label>
                      <Input value={corrForm.correspondent} onChange={(e) => setCorrForm((f) => ({ ...f, correspondent: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Subject</Label>
                      <Input value={corrForm.subject} onChange={(e) => setCorrForm((f) => ({ ...f, subject: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Textarea rows={3} value={corrForm.description} onChange={(e) => setCorrForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                    <Button className="w-full" disabled={!corrForm.correspondent || !corrForm.subject || createCorr.isPending} onClick={() => createCorr.mutate(corrForm)}>
                      {createCorr.isPending ? "Saving…" : "Log Correspondence"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {corrLoading ? <LoadingBlock /> : (
              <Card>
                <CardContent className="pt-4">
                  {corrList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No correspondence logged yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {corrList.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium">{c.subject}</p>
                            <p className="text-xs text-muted-foreground">{c.direction} · {c.correspondent} · {c.dateSent}</p>
                          </div>
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${c.direction === "Inbound" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>{c.direction}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Revision dialog — shown when "Revise" is clicked on an approved record */}
        <Dialog open={reviseOpen} onOpenChange={(open) => { setReviseOpen(open); if (!open) setRevisingId(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Revision</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2">
              The approved record will be preserved in full revision history. This revision moves the record back to &ldquo;submitted&rdquo; status.
            </p>
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label>Reason for revision <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Corrected quorum count"
                  value={reviseForm.reason}
                  onChange={(e) => setReviseForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Updated agenda (optional)</Label>
                <Textarea rows={3} value={reviseForm.agendaText} onChange={(e) => setReviseForm((f) => ({ ...f, agendaText: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Updated notes (optional)</Label>
                <Textarea rows={3} value={reviseForm.notes} onChange={(e) => setReviseForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <Button
                className="w-full"
                disabled={!reviseForm.reason || createRevision.isPending}
                onClick={() => { if (revisingId !== null) createRevision.mutate({ id: revisingId, data: reviseForm }); }}
              >
                {createRevision.isPending ? "Saving…" : "Submit Revision"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ExecWorkspaceShell>
  );
}
