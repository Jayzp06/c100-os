/**
 * Chief of Staff workspace — executive action items, assignments, and
 * decision/follow-through tracker.
 *
 * Permission gate: manage_executive_operations
 * Confidentiality: cross-workspace tasks show workspace name + opaque ID only.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "chief-of-staff")!;
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Plus,
  RotateCcw,
  Archive,
  User,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskPriority = "low" | "medium" | "high" | "urgent";
type TaskStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled"
  | "archived";

interface ExecTask {
  id: number;
  title: string;
  description?: string | null;
  ownerId: number;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string | null;
  completionDate?: string | null;
  relatedWorkspace?: string | null;
  relatedSourceRecord?: string | null;
  notes?: string | null;
  collaboratorIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  open: number;
  blocked: number;
  overdue: number;
  dueSoon: number;
  recentDone: { id: number; title: string; completionDate: string | null }[];
}

interface Member { id: number; fullName: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked",     label: "Blocked" },
  { value: "completed",   label: "Completed" },
  { value: "cancelled",   label: "Cancelled" },
  { value: "archived",    label: "Archived" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

const WORKSPACE_OPTIONS = [
  { value: "",                label: "All workspaces" },
  { value: "president",       label: "President" },
  { value: "vice-president",  label: "Vice President" },
  { value: "chief-of-staff",  label: "Chief of Staff" },
  { value: "secretary",       label: "Secretary" },
  { value: "treasurer",       label: "Treasurer" },
  { value: "historian",       label: "Historian" },
  { value: "bylaws",          label: "Bylaws Officer" },
  { value: "parliamentarian", label: "Parliamentarian" },
  { value: "sergeant-at-arms",label: "Sergeant-at-Arms" },
];

function priorityBadgeClass(p: TaskPriority) {
  return {
    low:    "bg-gray-100 text-gray-700",
    medium: "bg-blue-100 text-blue-700",
    high:   "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  }[p];
}

function statusBadgeClass(s: TaskStatus) {
  return {
    not_started: "bg-gray-100 text-gray-700",
    in_progress: "bg-sky-100 text-sky-700",
    blocked:     "bg-amber-100 text-amber-700",
    completed:   "bg-green-100 text-green-700",
    cancelled:   "bg-rose-100 text-rose-700",
    archived:    "bg-zinc-100 text-zinc-500",
  }[s];
}

function isOverdue(t: ExecTask) {
  if (!t.dueDate) return false;
  if (t.status === "completed" || t.status === "cancelled" || t.status === "archived") return false;
  return t.dueDate < new Date().toISOString().split("T")[0];
}

// ── Empty form ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "",
  description: "",
  ownerId: "",
  priority: "medium" as TaskPriority,
  dueDate: "",
  relatedWorkspace: "",
  relatedSourceRecord: "",
  notes: "",
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function ChiefOfStaffPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Filters ──────────────────────────────────────────────────────────────────

  const [filterStatus, setFilterStatus]     = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterOwner, setFilterOwner]       = useState<string>("");
  const [filterWorkspace, setFilterWorkspace] = useState<string>("");
  const [showArchived, setShowArchived]     = useState(false);

  // ── Dialog state ─────────────────────────────────────────────────────────────

  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask]     = useState<ExecTask | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);

  // ── Queries ───────────────────────────────────────────────────────────────────

  const { data: summary } = useQuery<Summary>({
    queryKey: ["cos", "summary"],
    queryFn: () => fetch("/api/chief-of-staff/summary").then((r) => r.json()),
  });

  const { data: tasks = [], isLoading } = useQuery<ExecTask[]>({
    queryKey: ["cos", "tasks"],
    queryFn: () => fetch("/api/chief-of-staff/tasks").then((r) => r.json()),
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: () => fetch("/api/members").then((r) => r.json()),
  });

  // ── Derived list ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (!showArchived && t.status === "archived") return false;
      if (filterStatus    && t.status           !== filterStatus)    return false;
      if (filterPriority  && t.priority          !== filterPriority)  return false;
      if (filterOwner     && String(t.ownerId)   !== filterOwner)     return false;
      if (filterWorkspace && (t.relatedWorkspace ?? "") !== filterWorkspace) return false;
      return true;
    });
  }, [tasks, filterStatus, filterPriority, filterOwner, filterWorkspace, showArchived]);

  const memberName = (id: number) =>
    members.find((m) => m.id === id)?.fullName ?? `Member #${id}`;

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cos"] });
  };

  const createTask = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      fetch("/api/chief-of-staff/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ownerId: Number(data.ownerId),
          dueDate: data.dueDate || undefined,
          relatedWorkspace: data.relatedWorkspace || undefined,
          relatedSourceRecord: data.relatedSourceRecord || undefined,
          description: data.description || undefined,
          notes: data.notes || undefined,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed");
        return r.json();
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Task created." });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) =>
      fetch(`/api/chief-of-staff/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed");
        return r.json();
      }),
    onSuccess: () => {
      invalidate();
      setEditTask(null);
      toast({ title: "Task updated." });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const archiveTask = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/chief-of-staff/tasks/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Archive failed");
        return r.json();
      }),
    onSuccess: () => { invalidate(); toast({ title: "Task archived." }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const restoreTask = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/chief-of-staff/tasks/${id}/restore`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Restore failed");
        return r.json();
      }),
    onSuccess: () => { invalidate(); toast({ title: "Task restored." }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── Quick status toggle ────────────────────────────────────────────────────────

  const setStatus = (id: number, status: TaskStatus) =>
    updateTask.mutate({ id, patch: { status } });

  // ── Edit dialog helpers ────────────────────────────────────────────────────────

  const openEdit = (t: ExecTask) => {
    setEditTask(t);
    setForm({
      title:               t.title,
      description:         t.description ?? "",
      ownerId:             String(t.ownerId),
      priority:            t.priority,
      dueDate:             t.dueDate ?? "",
      relatedWorkspace:    t.relatedWorkspace ?? "",
      relatedSourceRecord: t.relatedSourceRecord ?? "",
      notes:               t.notes ?? "",
    });
  };

  const saveEdit = () => {
    if (!editTask) return;
    updateTask.mutate({
      id: editTask.id,
      patch: {
        title:               form.title,
        description:         form.description || null,
        ownerId:             Number(form.ownerId),
        priority:            form.priority,
        dueDate:             form.dueDate || null,
        relatedWorkspace:    form.relatedWorkspace || null,
        relatedSourceRecord: form.relatedSourceRecord || null,
        notes:               form.notes || null,
      },
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Open",         value: summary?.open    ?? 0, icon: <Clock className="h-4 w-4 text-sky-500" /> },
            { label: "Due Soon",     value: summary?.dueSoon ?? 0, icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
            { label: "Overdue",      value: summary?.overdue ?? 0, icon: <XCircle className="h-4 w-4 text-rose-500" /> },
            { label: "Blocked",      value: summary?.blocked ?? 0, icon: <AlertTriangle className="h-4 w-4 text-orange-500" /> },
          ].map((c) => (
            <Card key={c.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
                {c.icon}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recently completed */}
        {(summary?.recentDone ?? []).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recently Completed</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {summary!.recentDone.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span>{t.title}</span>
                  {t.completionDate && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(t.completionDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Filters + create */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All priorities</SelectItem>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Owner</Label>
            <Select value={filterOwner} onValueChange={setFilterOwner}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="All owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All owners</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Workspace</Label>
            <Select value={filterWorkspace} onValueChange={setFilterWorkspace}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {WORKSPACE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
          <div className="ml-auto">
            <Button
              size="sm"
              onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}
              data-testid="button-create-task"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New task
            </Button>
          </div>
        </div>

        {/* Task list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No tasks match the current filters.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <Card
                key={t.id}
                className={`transition-opacity ${t.status === "archived" || t.status === "cancelled" ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        {isOverdue(t) && (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700">OVERDUE</span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(t.status)}`}>
                          {STATUS_OPTIONS.find((s) => s.value === t.status)?.label ?? t.status}
                        </span>
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityBadgeClass(t.priority)}`}>
                          {t.priority}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <User className="h-3 w-3" />
                          {memberName(t.ownerId)}
                        </span>
                        {t.dueDate && (
                          <span className={`text-[10px] ${isOverdue(t) ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
                            Due {t.dueDate}
                          </span>
                        )}
                        {t.relatedWorkspace && (
                          <span className="text-[10px] text-muted-foreground">
                            → {WORKSPACE_OPTIONS.find((w) => w.value === t.relatedWorkspace)?.label ?? t.relatedWorkspace}
                          </span>
                        )}
                        {t.collaboratorIds.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{t.collaboratorIds.length} collaborator{t.collaboratorIds.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {t.status !== "completed" && t.status !== "cancelled" && t.status !== "archived" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-green-700 hover:text-green-800"
                          onClick={() => setStatus(t.id, "completed")}
                          title="Mark complete"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {t.status === "not_started" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => setStatus(t.id, "in_progress")}>Start</Button>
                      )}
                      {t.status === "in_progress" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => setStatus(t.id, "blocked")}>Block</Button>
                      )}
                      {t.status === "blocked" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => setStatus(t.id, "in_progress")}>Unblock</Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => openEdit(t)}
                        data-testid={`button-edit-task-${t.id}`}
                      >
                        Edit
                      </Button>
                      {t.status === "archived" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => restoreTask.mutate(t.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground">
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Archive task?</AlertDialogTitle>
                              <AlertDialogDescription>
                                The task will be archived. You can restore it later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => archiveTask.mutate(t.id)}>
                                Archive
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  {t.notes && (
                    <p className="mt-2 text-xs text-muted-foreground border-t pt-2 line-clamp-2">{t.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Executive Task</DialogTitle></DialogHeader>
            <TaskForm
              form={form}
              setForm={setForm}
              members={members}
              onSubmit={() => createTask.mutate(form)}
              loading={createTask.isPending}
              submitLabel="Create task"
            />
          </DialogContent>
        </Dialog>

        {/* Edit dialog */}
        <Dialog open={!!editTask} onOpenChange={(o) => { if (!o) setEditTask(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
            {editTask && (
              <>
                <div className="space-y-3 pb-2">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={editTask.status}
                      onValueChange={(v) =>
                        updateTask.mutate({ id: editTask.id, patch: { status: v } })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TaskForm
                  form={form}
                  setForm={setForm}
                  members={members}
                  onSubmit={saveEdit}
                  loading={updateTask.isPending}
                  submitLabel="Save changes"
                />
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ExecWorkspaceShell>
  );
}

// ── Shared form ────────────────────────────────────────────────────────────────

function TaskForm({
  form,
  setForm,
  members,
  onSubmit,
  loading,
  submitLabel,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  members: Member[];
  onSubmit: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  const set = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="What needs to happen?"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional context"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Owner <span className="text-destructive">*</span></Label>
          <Select value={form.ownerId} onValueChange={(v) => set("ownerId", v)}>
            <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={(v) => set("priority", v as TaskPriority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[
                { value: "low",    label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high",   label: "High" },
                { value: "urgent", label: "Urgent" },
              ].map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Due date</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Related workspace</Label>
          <Select value={form.relatedWorkspace} onValueChange={(v) => set("relatedWorkspace", v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              {[
                { value: "",                label: "None" },
                { value: "secretary",       label: "Secretary" },
                { value: "treasurer",       label: "Treasurer" },
                { value: "historian",       label: "Historian" },
                { value: "bylaws",          label: "Bylaws Officer" },
                { value: "parliamentarian", label: "Parliamentarian" },
                { value: "sergeant-at-arms",label: "Sergeant-at-Arms" },
              ].map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Source record ID</Label>
        <Input
          value={form.relatedSourceRecord}
          onChange={(e) => set("relatedSourceRecord", e.target.value)}
          placeholder="e.g. finances:42  (opaque — does not grant access)"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        disabled={!form.title || !form.ownerId || loading}
        onClick={onSubmit}
        data-testid="button-submit-task"
      >
        {loading ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}
