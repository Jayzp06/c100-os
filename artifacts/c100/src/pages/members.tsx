import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useListMembers,
  useListCommittees,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Search } from "lucide-react";

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
  return <MembersList />;
}

function MembersList() {
  const [committeeId, setCommitteeId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const committees = useListCommittees();
  const params = committeeId === "all" ? undefined : { committeeId: Number(committeeId) };
  const members = useListMembers(params);

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

  return (
    <AppShell>
      <PageHeader
        eyebrow="Roster"
        title="Chapter members"
        description="Private roster. Use this view to monitor standing and follow up with members directly."
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
