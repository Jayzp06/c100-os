import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useListMembers,
  useListCommittees,
  useBulkImportMembers,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CardSkeleton,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
} from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import {
  MembershipBadge,
  NudgeBadge,
  RoleBadge,
} from "@/components/badges";
import { Search, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListMembersQueryKey } from "@workspace/api-client-react";
import { invalidateAggregates } from "@/lib/query-invalidation";

type ParsedRow = { fullName: string; email: string; error?: string };

function parseImportText(raw: string): ParsedRow[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/,(?=\s*[^\s,])/).map((p) => p.trim());
      if (parts.length < 2) {
        return { fullName: line, email: "", error: "Expected: Full Name, email" };
      }
      const fullName = parts[0];
      const email = parts[1];
      if (!fullName || fullName.length < 2) {
        return { fullName, email, error: "Name too short" };
      }
      if (!email.includes("@")) {
        return { fullName, email, error: "Invalid email" };
      }
      return { fullName, email };
    });
}

function ImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const mutation = useBulkImportMembers();

  const rows = useMemo(() => parseImportText(raw), [raw]);
  const validRows = rows.filter((r) => !r.error);
  const parseErrors = rows.filter((r) => r.error);

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setRaw("");
      setResult(null);
    }, 300);
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    const data = await mutation.mutateAsync({
      data: { members: validRows.map((r) => ({ fullName: r.fullName, email: r.email })) },
    });
    setResult(data);
    onImported();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 border-[hsl(var(--gold))] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.1)]">
          <Upload className="h-4 w-4" />
          Import Roster
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Chapter Roster</DialogTitle>
          <DialogDescription>
            Paste one member per line in this format:
            <span className="block font-mono bg-muted rounded px-2 py-1 mt-1 text-xs">
              Full Name, email@fvsu.edu
            </span>
            Imported members will be created as inactive until they sign in for the first time.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <Textarea
              className="font-mono text-sm h-48 resize-none"
              placeholder={"Marcus Johnson, mjohnson@fvsu.edu\nAisha Williams, awilliams@fvsu.edu\nDavid Carter, dcarter@fvsu.edu"}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />

            {rows.length > 0 && (
              <div className="space-y-3">
                {parseErrors.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {parseErrors.length} row{parseErrors.length > 1 ? "s" : ""} with issues (will be skipped)
                    </p>
                    <ul className="text-xs text-destructive/80 space-y-0.5">
                      {parseErrors.map((r, i) => (
                        <li key={i}>• {r.fullName || "(blank)"}: {r.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validRows.length > 0 && (
                  <div className="rounded-md border border-border overflow-hidden">
                    <div className="px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
                      Preview — {validRows.length} valid member{validRows.length !== 1 ? "s" : ""} to import
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Email</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validRows.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm py-1.5">{r.fullName}</TableCell>
                              <TableCell className="text-sm py-1.5 text-muted-foreground">{r.email}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0 || mutation.isPending}
                className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold)/0.85)]"
              >
                {mutation.isPending ? "Importing…" : `Import ${validRows.length} Member${validRows.length !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="font-semibold">Import complete</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded bg-muted p-3 text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--gold))]">{result.created}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Members created</p>
                </div>
                <div className="rounded bg-muted p-3 text-center">
                  <p className="text-2xl font-bold">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Skipped (already exist)</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Insert errors:</p>
                  <ul className="text-xs text-destructive/80 space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold)/0.85)]">
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MembersPage() {
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
          message="Only Committee Chairs, Bylaws Chair, Executive Board, and Admin can view the member roster."
        />
      </AppShell>
    );
  }
  return <MembersList isAdmin={me.member?.role === "Admin"} />;
}

function MembersList({ isAdmin }: { isAdmin: boolean }) {
  const [committeeId, setCommitteeId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const committees = useListCommittees();
  const params = committeeId === "all" ? undefined : { committeeId: Number(committeeId) };
  const members = useListMembers(params);
  const queryClient = useQueryClient();

  const filtered = useMemo(() => {
    const list = members.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.studentId ?? "").toLowerCase().includes(q),
    );
  }, [members.data, search]);

  function handleImported() {
    queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
    invalidateAggregates(queryClient);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Roster"
        title="Chapter members"
        description="Private roster. Use this view to monitor standing and follow up with members directly."
        actions={isAdmin ? <ImportDialog onImported={handleImported} /> : undefined}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or student ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-member-search"
          />
        </div>
        <Select value={committeeId} onValueChange={setCommitteeId}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-committee-filter">
            <SelectValue placeholder="Filter by committee" />
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

      {members.isLoading ? (
        <CardSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          title="No members match"
          description="Try clearing filters or adjusting your search."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Committee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead>Nudge</TableHead>
                    <TableHead className="text-right">Participation</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-[hsl(var(--muted)/0.5)]"
                      data-testid={`row-member-${m.id}`}
                    >
                      <TableCell>
                        <Link
                          href={`/members/${m.id}`}
                          className="block"
                        >
                          <p className="font-medium">{m.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.email}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.committeeName ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={m.role} />
                      </TableCell>
                      <TableCell>
                        <MembershipBadge status={m.membershipStatus} />
                      </TableCell>
                      <TableCell>
                        <NudgeBadge status={m.nudgeStatus} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {m.participationPct.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {m.totalPoints}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
