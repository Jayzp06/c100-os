import { useState } from "react";
import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent } from "@/components/ui/card";
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
import { ShieldAlert, Plus, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "sergeant-at-arms")!;

interface ConductRecord { id: number; recordType: string; reportDate: string; summary: string; status: string; memberId?: number | null; }

const RECORD_TYPES = ["IncidentReport", "AttendanceIrregularity", "MeetingOrderNote"];

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-red-100 text-red-800",
  UnderReview: "bg-yellow-100 text-yellow-800",
  Resolved: "bg-green-100 text-green-800",
  Archived: "bg-gray-100 text-gray-800",
};

export default function SergeantAtArmsWorkspacePage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: records, isLoading, error } = useQuery<ConductRecord[]>({
    queryKey: ["conduct", "records"],
    queryFn: async () => { const r = await fetch("/api/conduct/records"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });

  const [open, setOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState<number | null>(null);
  const [form, setForm] = useState({ recordType: "IncidentReport", reportDate: new Date().toISOString().split("T")[0], memberId: "", summary: "", privateDetails: "" });
  const [resolution, setResolution] = useState("");

  const createRecord = useMutation({
    mutationFn: async (data: typeof form) => {
      const body = { ...data, memberId: data.memberId ? Number(data.memberId) : undefined };
      const r = await fetch("/api/conduct/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["conduct", "records"] }); setOpen(false); toast({ title: "Conduct record created." }); },
    onError: () => toast({ title: "Failed to create record.", variant: "destructive" }),
  });

  const resolveRecord = useMutation({
    mutationFn: async ({ id, resolution }: { id: number; resolution: string }) => {
      const r = await fetch(`/api/conduct/records/${id}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["conduct", "records"] }); setResolveOpen(null); setResolution(""); toast({ title: "Record resolved." }); },
    onError: () => toast({ title: "Failed to resolve.", variant: "destructive" }),
  });

  const archiveRecord = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/conduct/records/${id}/archive`, { method: "POST" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["conduct", "records"] }); toast({ title: "Record archived." }); },
    onError: () => toast({ title: "Failed to archive.", variant: "destructive" }),
  });

  const list = records ?? [];
  const openCount = list.filter((r) => r.status === "Open").length;
  const reviewCount = list.filter((r) => r.status === "UnderReview").length;

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <StatGrid stats={[
            { label: "Open Records", value: openCount, icon: ShieldAlert },
            { label: "Under Review", value: reviewCount, icon: Clock },
            { label: "Total Records", value: list.length, icon: CheckCircle2 },
          ]} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> New Record</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Conduct Record</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={form.recordType} onValueChange={(v) => setForm((f) => ({ ...f, recordType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RECORD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Report Date</Label>
                    <Input type="date" value={form.reportDate} onChange={(e) => setForm((f) => ({ ...f, reportDate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Member ID (optional)</Label>
                  <Input type="number" placeholder="Leave blank if not member-specific" value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Summary</Label>
                  <Textarea rows={3} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Private Details (confidential)</Label>
                  <Textarea rows={3} value={form.privateDetails} onChange={(e) => setForm((f) => ({ ...f, privateDetails: e.target.value }))} />
                </div>
                <Button className="w-full" disabled={!form.summary || createRecord.isPending} onClick={() => createRecord.mutate(form)}>
                  {createRecord.isPending ? "Saving…" : "Create Record"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <LoadingBlock /> : error ? <ErrorBlock message="Could not load conduct records." /> : (
          <Card>
            <CardContent className="pt-4">
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No conduct records on file.</p>
              ) : (
                <div className="space-y-2">
                  {list.map((rec) => (
                    <div key={rec.id} className="flex items-start justify-between rounded-md border px-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{rec.summary}</p>
                          <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[rec.status] ?? "bg-gray-100 text-gray-800"}`}>{rec.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.recordType} · {rec.reportDate}{rec.memberId ? ` · Member #${rec.memberId}` : ""}</p>
                      </div>
                      <div className="ml-4 flex items-center gap-1.5 shrink-0">
                        {rec.status !== "Resolved" && rec.status !== "Archived" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResolveOpen(rec.id)}>Resolve</Button>
                        )}
                        {rec.status !== "Archived" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => archiveRecord.mutate(rec.id)} disabled={archiveRecord.isPending}>Archive</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resolve dialog */}
        <Dialog open={resolveOpen !== null} onOpenChange={(open) => { if (!open) { setResolveOpen(null); setResolution(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Resolve Conduct Record</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Resolution</Label>
                <Textarea rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe the resolution…" />
              </div>
              <Button className="w-full" disabled={!resolution || resolveRecord.isPending} onClick={() => resolveOpen !== null && resolveRecord.mutate({ id: resolveOpen, resolution })}>
                {resolveRecord.isPending ? "Saving…" : "Resolve"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ExecWorkspaceShell>
  );
}
