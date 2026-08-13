import { useState } from "react";
import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { apiFetch } from "@/lib/desktop-auth";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookOpen, Plus, FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFileUpload } from "@/hooks/useFileUpload";
import { workspaceApiError, queryErrorMessage } from "@/lib/workspace-error";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "bylaws")!;

type GovDocStatus = "draft" | "under_review" | "current" | "superseded" | "archived";

interface GovernanceDoc {
  id: number;
  title: string;
  category: string;
  versionLabel: string;
  effectiveDate: string;
  approvalDate?: string | null;
  status: GovDocStatus;
  notes?: string | null;
  originalFilename?: string | null;
  storageKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<GovDocStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  current: "bg-green-100 text-green-800",
  superseded: "bg-orange-100 text-orange-800",
  archived: "bg-gray-100 text-gray-800",
};

const CATEGORIES = [
  "ChapterConstitution",
  "ChapterBylaws",
  "InstitutionPolicy",
  "NationalGuidance",
  "StandingRules",
  "Amendment",
  "Other",
];

function useGovernanceDocs() {
  return useQuery<GovernanceDoc[]>({
    queryKey: ["governance", "documents"],
    queryFn: async () => {
      const res = await apiFetch("/api/governance/documents");
      if (!res.ok) {
        console.warn("[C100 Workspace] /api/governance/documents HTTP", res.status);
        throw new Error(String(res.status));
      }
      return res.json();
    },
  });
}

function useDocAction(action: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/governance/documents/${id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(await workspaceApiError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance", "documents"] }),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });
}

export default function BylawsWorkspacePage() {
  const { data: docs, isLoading, error } = useGovernanceDocs();
  const { toast } = useToast();
  const qc = useQueryClient();

  const publish = useDocAction("publish");
  const supersede = useDocAction("supersede");
  const archive = useDocAction("archive");
  const restore = useDocAction("restore");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "ChapterBylaws",
    versionLabel: "1.0",
    effectiveDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { uploadFile, isUploading } = useFileUpload({
    workspace: "governance",
    maxBytes: 20 * 1024 * 1024,
    allowedTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const createDoc = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiFetch("/api/governance/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await workspaceApiError(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["governance", "documents"] });
      setCreateOpen(false);
      toast({ title: "Document created." });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  async function handleCreate() {
    let storageKey: string | undefined;
    let originalFilename: string | undefined;
    let mimeType: string | undefined;
    let fileSizeBytes: number | undefined;

    if (selectedFile) {
      const result = await uploadFile(selectedFile);
      if (!result) return;
      storageKey = result.objectPath;
      originalFilename = selectedFile.name;
      mimeType = selectedFile.type;
      fileSizeBytes = selectedFile.size;
    }

    createDoc.mutate({ ...form, storageKey, originalFilename, mimeType, fileSizeBytes });
  }

  const list = docs ?? [];
  const currentCount = list.filter((d) => d.status === "current").length;
  const draftCount = list.filter((d) => d.status === "draft" || d.status === "under_review").length;

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={queryErrorMessage(error, "governance documents")} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <StatGrid
                stats={[
                  { label: "Current Documents", value: currentCount, icon: BookOpen },
                  { label: "In Progress", value: draftCount, icon: FileText },
                  { label: "Total", value: list.length, icon: FileText },
                ]}
              />
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 h-4 w-4" /> New Document
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Governance Document</DialogTitle>
                  </DialogHeader>
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
                          <SelectContent>
                            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Version</Label>
                        <Input value={form.versionLabel} onChange={(e) => setForm((f) => ({ ...f, versionLabel: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Effective Date</Label>
                      <Input type="date" value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>File (PDF or DOCX, max 20 MB)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                      {selectedFile && <p className="text-xs text-muted-foreground">{selectedFile.name}</p>}
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleCreate}
                      disabled={!form.title || createDoc.isPending || isUploading}
                    >
                      {isUploading ? "Uploading…" : createDoc.isPending ? "Saving…" : "Create Document"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  Governance Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No governance documents yet. Add the chapter's bylaws, constitution, or amendments above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-md border px-3 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{doc.title}</p>
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[doc.status]}`}>
                              {doc.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {doc.category} · v{doc.versionLabel} · Effective {doc.effectiveDate}
                            {doc.originalFilename ? ` · ${doc.originalFilename}` : ""}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center gap-1.5 shrink-0">
                          {doc.status !== "current" && doc.status !== "archived" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => publish.mutate(doc.id)}
                              disabled={publish.isPending}
                            >
                              Publish
                            </Button>
                          )}
                          {doc.status === "current" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => supersede.mutate(doc.id)}
                              disabled={supersede.isPending}
                            >
                              Supersede
                            </Button>
                          )}
                          {doc.status !== "archived" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => archive.mutate(doc.id)}
                              disabled={archive.isPending}
                            >
                              Archive
                            </Button>
                          )}
                          {doc.status === "archived" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => restore.mutate(doc.id)}
                              disabled={restore.isPending}
                            >
                              Restore
                            </Button>
                          )}
                          {doc.storageKey && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              asChild
                            >
                              <a href={`/api/storage${doc.storageKey}`} target="_blank" rel="noreferrer">
                                View
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ExecWorkspaceShell>
  );
}
