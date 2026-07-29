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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gavel, BookOpen, Plus, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "parliamentarian")!;

interface Motion { id: number; motionText: string; result: string; voteYes: number; voteNo: number; voteAbstain: number; notes?: string | null; createdAt: string; }
interface Ruling { id: number; rulingText: string; authoritySource: string; governanceRef?: string | null; createdAt: string; }
interface QuorumRecord { id: number; totalMembership: number; quorumThreshold: number; membersPresent: number; quorumMet: number; recordedAt: string; }
interface GovDoc { id: number; title: string; category: string; status: string; versionLabel: string; effectiveDate: string; storageKey?: string | null; }

const MOTION_RESULTS = ["Passed", "Failed", "Tabled", "Withdrawn", "Other"];

const RESULT_COLORS: Record<string, string> = {
  Passed: "bg-green-100 text-green-800",
  Failed: "bg-red-100 text-red-800",
  Tabled: "bg-yellow-100 text-yellow-800",
  Withdrawn: "bg-gray-100 text-gray-800",
  Other: "bg-blue-100 text-blue-800",
};

export default function ParliamentarianWorkspacePage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: motions, isLoading: motionsLoading } = useQuery<Motion[]>({
    queryKey: ["procedure", "motions"],
    queryFn: async () => { const r = await fetch("/api/procedure/motions"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });

  const { data: rulings, isLoading: rulingsLoading } = useQuery<Ruling[]>({
    queryKey: ["procedure", "rulings"],
    queryFn: async () => { const r = await fetch("/api/procedure/rulings"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });

  const { data: quorumRecords } = useQuery<QuorumRecord[]>({
    queryKey: ["procedure", "quorum"],
    queryFn: async () => { const r = await fetch("/api/procedure/quorum"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });

  const { data: govDocs } = useQuery<GovDoc[]>({
    queryKey: ["procedure", "governance-docs"],
    queryFn: async () => { const r = await fetch("/api/procedure/governance-docs"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });

  const [motionOpen, setMotionOpen] = useState(false);
  const [motionForm, setMotionForm] = useState({ motionText: "", result: "Other", voteYes: "0", voteNo: "0", voteAbstain: "0", notes: "" });

  const [rulingOpen, setRulingOpen] = useState(false);
  const [rulingForm, setRulingForm] = useState({ rulingText: "", authoritySource: "", governanceRef: "" });

  const [quorumOpen, setQuorumOpen] = useState(false);
  const [quorumForm, setQuorumForm] = useState({ totalMembership: "", quorumThreshold: "", membersPresent: "", notes: "" });

  const createMotion = useMutation({
    mutationFn: async (data: typeof motionForm) => {
      const r = await fetch("/api/procedure/motions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, voteYes: Number(data.voteYes), voteNo: Number(data.voteNo), voteAbstain: Number(data.voteAbstain) }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procedure"] }); setMotionOpen(false); toast({ title: "Motion recorded." }); },
    onError: () => toast({ title: "Failed to record motion.", variant: "destructive" }),
  });

  const createRuling = useMutation({
    mutationFn: async (data: typeof rulingForm) => {
      const r = await fetch("/api/procedure/rulings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procedure"] }); setRulingOpen(false); toast({ title: "Ruling recorded." }); },
    onError: () => toast({ title: "Failed to record ruling.", variant: "destructive" }),
  });

  const createQuorum = useMutation({
    mutationFn: async (data: typeof quorumForm) => {
      const r = await fetch("/api/procedure/quorum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ totalMembership: Number(data.totalMembership), quorumThreshold: Number(data.quorumThreshold), membersPresent: Number(data.membersPresent), notes: data.notes }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procedure"] }); setQuorumOpen(false); toast({ title: "Quorum record saved." }); },
    onError: () => toast({ title: "Failed to record quorum.", variant: "destructive" }),
  });

  const motionList = motions ?? [];
  const rulingList = rulings ?? [];
  const quorumList = quorumRecords ?? [];
  const govDocList = govDocs ?? [];
  const passedCount = motionList.filter((m) => m.result === "Passed").length;

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        <StatGrid stats={[
          { label: "Motions Recorded", value: motionList.length, icon: Gavel },
          { label: "Motions Passed", value: passedCount, icon: Scale },
          { label: "Rulings", value: rulingList.length, icon: BookOpen },
        ]} />

        <Tabs defaultValue="motions">
          <TabsList>
            <TabsTrigger value="motions">Motions</TabsTrigger>
            <TabsTrigger value="rulings">Rulings</TabsTrigger>
            <TabsTrigger value="quorum">Quorum</TabsTrigger>
            <TabsTrigger value="govdocs">Governance Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="motions" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={motionOpen} onOpenChange={setMotionOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Record Motion</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Record Motion</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label>Motion Text</Label>
                      <Textarea rows={3} value={motionForm.motionText} onChange={(e) => setMotionForm((f) => ({ ...f, motionText: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Result</Label>
                      <Select value={motionForm.result} onValueChange={(v) => setMotionForm((f) => ({ ...f, result: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{MOTION_RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {["voteYes", "voteNo", "voteAbstain"].map((field) => (
                        <div key={field} className="space-y-1.5">
                          <Label>{field === "voteYes" ? "Yes" : field === "voteNo" ? "No" : "Abstain"}</Label>
                          <Input type="number" min="0" value={(motionForm as Record<string, string>)[field]} onChange={(e) => setMotionForm((f) => ({ ...f, [field]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <Textarea rows={2} value={motionForm.notes} onChange={(e) => setMotionForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <Button className="w-full" disabled={!motionForm.motionText || createMotion.isPending} onClick={() => createMotion.mutate(motionForm)}>
                      {createMotion.isPending ? "Saving…" : "Record Motion"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {motionsLoading ? <LoadingBlock /> : (
              <Card><CardContent className="pt-4">
                {motionList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No motions recorded yet.</p> : (
                  <div className="space-y-2">
                    {motionList.map((m) => (
                      <div key={m.id} className="flex items-start justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{m.motionText}</p>
                          <p className="text-xs text-muted-foreground">Yes: {m.voteYes} · No: {m.voteNo} · Abstain: {m.voteAbstain}</p>
                        </div>
                        <span className={`ml-4 shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${RESULT_COLORS[m.result] ?? "bg-gray-100 text-gray-800"}`}>{m.result}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="rulings" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={rulingOpen} onOpenChange={setRulingOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Record Ruling</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Record Parliamentary Ruling</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5"><Label>Ruling</Label><Textarea rows={3} value={rulingForm.rulingText} onChange={(e) => setRulingForm((f) => ({ ...f, rulingText: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Authority Source</Label><Input placeholder="Robert's Rules, Article III…" value={rulingForm.authoritySource} onChange={(e) => setRulingForm((f) => ({ ...f, authoritySource: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Governance Ref (optional)</Label><Input value={rulingForm.governanceRef} onChange={(e) => setRulingForm((f) => ({ ...f, governanceRef: e.target.value }))} /></div>
                    <Button className="w-full" disabled={!rulingForm.rulingText || !rulingForm.authoritySource || createRuling.isPending} onClick={() => createRuling.mutate(rulingForm)}>
                      {createRuling.isPending ? "Saving…" : "Record Ruling"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {rulingsLoading ? <LoadingBlock /> : (
              <Card><CardContent className="pt-4">
                {rulingList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No rulings recorded yet.</p> : (
                  <div className="space-y-2">
                    {rulingList.map((r) => (
                      <div key={r.id} className="rounded-md border px-3 py-2 text-sm">
                        <p className="font-medium">{r.rulingText}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Authority: {r.authoritySource}{r.governanceRef ? ` · Ref: ${r.governanceRef}` : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="quorum" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={quorumOpen} onOpenChange={setQuorumOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Record Quorum</Button></DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Record Quorum Check</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { field: "totalMembership", label: "Total Members" },
                        { field: "quorumThreshold", label: "Quorum Required" },
                        { field: "membersPresent", label: "Present" },
                      ].map(({ field, label }) => (
                        <div key={field} className="space-y-1.5">
                          <Label>{label}</Label>
                          <Input type="number" min="0" value={(quorumForm as Record<string, string>)[field]} onChange={(e) => setQuorumForm((f) => ({ ...f, [field]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={quorumForm.notes} onChange={(e) => setQuorumForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                    <Button className="w-full" disabled={!quorumForm.totalMembership || !quorumForm.quorumThreshold || !quorumForm.membersPresent || createQuorum.isPending} onClick={() => createQuorum.mutate(quorumForm)}>
                      {createQuorum.isPending ? "Saving…" : "Save Quorum Record"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card><CardContent className="pt-4">
              {quorumList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No quorum records yet.</p> : (
                <div className="space-y-2">
                  {quorumList.map((q) => (
                    <div key={q.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{q.membersPresent}/{q.totalMembership} present (threshold: {q.quorumThreshold})</p>
                        <p className="text-xs text-muted-foreground">{new Date(q.recordedAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${q.quorumMet ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{q.quorumMet ? "Met" : "Not Met"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="govdocs">
            <Card><CardContent className="pt-4">
              {govDocList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No governance documents published yet.</p> : (
                <div className="space-y-2">
                  {govDocList.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{d.category} · v{d.versionLabel} · {d.effectiveDate}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${d.status === "current" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>{d.status}</span>
                        {d.storageKey && (
                          <a
                            href={`/api/storage${d.storageKey}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border hover:bg-muted transition-colors"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </ExecWorkspaceShell>
  );
}
