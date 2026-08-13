import { useState } from "react";
import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { apiFetch } from "@/lib/desktop-auth";
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
import { Archive, Image, Plus, CalendarCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFileUpload } from "@/hooks/useFileUpload";
import { workspaceApiError, queryErrorMessage } from "@/lib/workspace-error";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "historian")!;

interface ArchiveEntry { id: number; title: string; description: string; eventDate: string; category: string; visibility: string; tags: string[]; storageKey?: string | null; originalFilename?: string | null; archivedAt?: string | null; }

const CATEGORIES = ["Photo", "Program", "Flyer", "Award", "Announcement", "Milestone", "Other"];

export default function HistorianWorkspacePage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: entries, isLoading, error } = useQuery<ArchiveEntry[]>({
    queryKey: ["historian", "archive"],
    queryFn: async () => {
      const r = await apiFetch("/api/historian/archive");
      if (!r.ok) {
        console.warn("[C100 Workspace] /api/historian/archive HTTP", r.status);
        throw new Error(String(r.status));
      }
      return r.json();
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", eventDate: new Date().toISOString().split("T")[0], category: "Other", visibility: "Officers", tags: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { uploadFile, isUploading } = useFileUpload({
    workspace: "historian",
    maxBytes: 100 * 1024 * 1024,
    allowedTypes: ["image/*", "video/mp4", "video/quicktime"],
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const createEntry = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiFetch("/api/historian/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await workspaceApiError(r));
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["historian", "archive"] }); setOpen(false); toast({ title: "Archive entry created." }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const archiveEntry = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`/api/historian/archive/${id}/archive`, { method: "POST" });
      if (!r.ok) throw new Error(await workspaceApiError(r));
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["historian", "archive"] }); toast({ title: "Entry archived." }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  async function handleCreate() {
    let storageKey: string | undefined;
    let originalFilename: string | undefined;

    if (selectedFile) {
      const result = await uploadFile(selectedFile);
      if (!result) return;
      storageKey = result.objectPath;
      originalFilename = selectedFile.name;
    }

    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    createEntry.mutate({ ...form, tags, storageKey, originalFilename });
  }

  const list = entries ?? [];
  const photoCount = list.filter((e) => e.category === "Photo").length;

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <StatGrid stats={[
            { label: "Total Entries", value: list.length, icon: Archive },
            { label: "Photos", value: photoCount, icon: Image },
          ]} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Add Entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Archive Entry</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Event Date</Label>
                    <Input type="date" value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Visibility</Label>
                    <Select value={form.visibility} onValueChange={(v) => setForm((f) => ({ ...f, visibility: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Officers">Officers</SelectItem>
                        <SelectItem value="Public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tags (comma separated)</Label>
                    <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="awards, 2025…" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Media File (image/video, max 100 MB)</Label>
                  <Input type="file" accept="image/*,video/mp4,video/quicktime" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                  {selectedFile && <p className="text-xs text-muted-foreground">{selectedFile.name}</p>}
                </div>
                <Button className="w-full" disabled={!form.title || createEntry.isPending || isUploading} onClick={handleCreate}>
                  {isUploading ? "Uploading…" : createEntry.isPending ? "Saving…" : "Add Entry"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <LoadingBlock /> : error ? <ErrorBlock message={queryErrorMessage(error, "archive")} /> : (
          <Card>
            <CardContent className="pt-4">
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No archive entries yet. Add photos, awards, milestones, and historical records above.</p>
              ) : (
                <div className="space-y-2">
                  {list.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.category} · {e.eventDate} · {e.visibility}
                          {e.tags?.length > 0 ? ` · ${e.tags.join(", ")}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.storageKey && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                            <a href={`/api/storage${e.storageKey}`} target="_blank" rel="noreferrer">View</a>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => archiveEntry.mutate(e.id)} disabled={archiveEntry.isPending}>Archive</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ExecWorkspaceShell>
  );
}
