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
import { DollarSign, TrendingUp, TrendingDown, Plus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReportExportMenu } from "@/components/report-export";
import { workspaceApiError, queryErrorMessage } from "@/lib/workspace-error";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "treasurer")!;

interface DuesEntry { id: number; memberId: number; semesterLabel: string; amountCents: number; status: string; paymentMethod?: string; paidAt?: string; }
interface TxnSummary { totalIncomeCents: number; totalExpenseCents: number; transactionCount: number; }
interface DuesSummary { totalOutstandingCents: number; totalPaidCents: number; duesCount: number; }

function centsToUSD(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function TreasurerWorkspacePage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: dues, isLoading: duesLoading, error: duesError } = useQuery<DuesEntry[]>({
    queryKey: ["treasurer", "dues"],
    queryFn: async () => {
      const r = await fetch("/api/treasurer/dues");
      if (!r.ok) {
        console.warn("[C100 Workspace] /api/treasurer/dues HTTP", r.status);
        throw new Error(String(r.status));
      }
      return r.json();
    },
  });

  const { data: summary } = useQuery<{ transactions: TxnSummary; dues: DuesSummary }>({
    queryKey: ["treasurer", "summary"],
    queryFn: async () => {
      const r = await fetch("/api/treasurer/summary");
      if (!r.ok) {
        console.warn("[C100 Workspace] /api/treasurer/summary HTTP", r.status);
        throw new Error(String(r.status));
      }
      return r.json();
    },
  });

  const [duesOpen, setDuesOpen] = useState(false);
  const [duesForm, setDuesForm] = useState({
    memberId: "",
    semesterLabel: "",
    amountCents: "",
    paymentMethod: "",
    status: "Outstanding",
    notes: "",
  });

  const createDues = useMutation({
    mutationFn: async (data: typeof duesForm) => {
      const r = await fetch("/api/treasurer/dues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, memberId: Number(data.memberId), amountCents: Number(data.amountCents) }),
      });
      if (!r.ok) throw new Error(await workspaceApiError(r));
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["treasurer"] }); setDuesOpen(false); toast({ title: "Dues entry recorded." }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateDuesStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/treasurer/dues/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error(await workspaceApiError(r));
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["treasurer"] }); toast({ title: "Dues status updated." }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const duesList = dues ?? [];
  const outstandingCount = duesList.filter((d) => d.status === "Outstanding").length;
  const paidCount = duesList.filter((d) => d.status === "Paid").length;

  const txnSummary = summary?.transactions;
  const duesSummary = summary?.dues;

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        <StatGrid stats={[
          { label: "Dues Collected", value: duesSummary ? centsToUSD(duesSummary.totalPaidCents) : "—", icon: DollarSign },
          { label: "Outstanding", value: outstandingCount, icon: Users },
          { label: "Net Balance", value: txnSummary ? centsToUSD(txnSummary.totalIncomeCents - txnSummary.totalExpenseCents) : "—", icon: TrendingUp },
        ]} />

        {/* Summary row */}
        {(txnSummary || duesSummary) && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Total Income", value: txnSummary ? centsToUSD(txnSummary.totalIncomeCents) : "—", icon: TrendingUp, color: "text-green-600" },
              { label: "Total Expenses", value: txnSummary ? centsToUSD(txnSummary.totalExpenseCents) : "—", icon: TrendingDown, color: "text-red-600" },
              { label: "Dues Outstanding", value: duesSummary ? centsToUSD(duesSummary.totalOutstandingCents) : "—", icon: DollarSign, color: "text-orange-600" },
              { label: "Dues Paid", value: duesSummary ? centsToUSD(duesSummary.totalPaidCents) : "—", icon: DollarSign, color: "text-green-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="dues">
          <TabsList>
            <TabsTrigger value="dues">Dues Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="dues" className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <ReportExportMenu endpoint="/api/treasurer/dues/export" label="Export Dues" />
              <ReportExportMenu endpoint="/api/treasurer/transactions/export" label="Export Transactions" />
              <Dialog open={duesOpen} onOpenChange={setDuesOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Record Dues</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Record Dues Payment</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Member ID</Label>
                        <Input type="number" value={duesForm.memberId} onChange={(e) => setDuesForm((f) => ({ ...f, memberId: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Semester</Label>
                        <Input placeholder="Fall 2025" value={duesForm.semesterLabel} onChange={(e) => setDuesForm((f) => ({ ...f, semesterLabel: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Amount (cents)</Label>
                        <Input type="number" placeholder="5000 = $50.00" value={duesForm.amountCents} onChange={(e) => setDuesForm((f) => ({ ...f, amountCents: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select value={duesForm.status} onValueChange={(v) => setDuesForm((f) => ({ ...f, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Outstanding">Outstanding</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                            <SelectItem value="Waived">Waived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Payment Method</Label>
                      <Input placeholder="Cash, Check, Venmo…" value={duesForm.paymentMethod} onChange={(e) => setDuesForm((f) => ({ ...f, paymentMethod: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <Textarea rows={2} value={duesForm.notes} onChange={(e) => setDuesForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <Button className="w-full" disabled={!duesForm.memberId || !duesForm.semesterLabel || !duesForm.amountCents || createDues.isPending} onClick={() => createDues.mutate(duesForm)}>
                      {createDues.isPending ? "Saving…" : "Record Dues"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {duesLoading ? <LoadingBlock /> : duesError ? <ErrorBlock message={queryErrorMessage(duesError, "dues ledger")} /> : (
              <Card>
                <CardContent className="pt-4">
                  {duesList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No dues entries yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {duesList.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium">Member #{d.memberId} — {d.semesterLabel}</p>
                            <p className="text-xs text-muted-foreground">{centsToUSD(d.amountCents)}{d.paymentMethod ? ` · ${d.paymentMethod}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${d.status === "Paid" ? "bg-green-100 text-green-800" : d.status === "Waived" ? "bg-gray-100 text-gray-800" : "bg-orange-100 text-orange-800"}`}>{d.status}</span>
                            {d.status === "Outstanding" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateDuesStatus.mutate({ id: d.id, status: "Paid" })} disabled={updateDuesStatus.isPending}>Mark Paid</Button>
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
        </Tabs>
      </div>
    </ExecWorkspaceShell>
  );
}
