import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMember,
  useUpdateMember,
  useListCommittees,
  getGetMemberQueryKey,
  getListMembersQueryKey,
} from "@workspace/api-client-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBlock, LoadingBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import {
  MembershipBadge,
  NudgeBadge,
  Pill,
  RoleBadge,
} from "@/components/badges";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES = [
  "Member",
  "CommitteeChair",
  "BylawsChair",
  "ExecutiveBoard",
  "Admin",
];
const STATUSES = ["Active", "Probationary", "Suspended", "Inactive"];

export default function MemberDetailPage() {
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
  if (!me.isLeader) {
    return (
      <AppShell>
        <ErrorBlock title="Leadership only" />
      </AppShell>
    );
  }
  return <MemberDetail id={id} />;
}

function MemberDetail({ id }: { id: number }) {
  const me = useMe();
  const member = useGetMember(id, {
    query: {
      queryKey: getGetMemberQueryKey(id),
      enabled: Number.isFinite(id),
    },
  });
  const committees = useListCommittees();
  const qc = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateMember({
    mutation: {
      onSuccess: () => {
        toast({ title: "Member updated." });
        qc.invalidateQueries({ queryKey: getGetMemberQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListMembersQueryKey() });
      },
      onError: () => {
        toast({ title: "Update failed.", variant: "destructive" });
      },
    },
  });

  const [form, setForm] = useState({
    role: "Member",
    committeeId: "none",
    membershipStatus: "Active",
    duesPaid: false,
    accountActive: true,
  });

  useEffect(() => {
    if (member.data) {
      setForm({
        role: member.data.role,
        committeeId:
          member.data.committeeId != null
            ? String(member.data.committeeId)
            : "none",
        membershipStatus: member.data.membershipStatus,
        duesPaid: member.data.duesPaid,
        accountActive: member.data.accountActive,
      });
    }
  }, [member.data]);

  if (member.isLoading) {
    return (
      <AppShell>
        <LoadingBlock />
      </AppShell>
    );
  }
  if (!member.data) {
    return (
      <AppShell>
        <ErrorBlock />
      </AppShell>
    );
  }

  const m = member.data;

  function save() {
    update.mutate({
      id,
      data: {
        role: form.role as
          | "Member"
          | "CommitteeChair"
          | "BylawsChair"
          | "ExecutiveBoard"
          | "Admin",
        committeeId: form.committeeId === "none" ? null : Number(form.committeeId),
        membershipStatus: form.membershipStatus as
          | "Active"
          | "Probationary"
          | "Suspended"
          | "Inactive",
        duesPaid: form.duesPaid,
        accountActive: form.accountActive,
      },
    });
  }

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href="/members">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to roster
        </Link>
      </Button>
      <PageHeader
        eyebrow="Member"
        title={m.fullName}
        description={`${m.email} · ${m.studentId ?? "No student ID on file"}`}
        actions={
          <div className="flex items-center gap-2">
            <RoleBadge role={m.role} />
            <MembershipBadge status={m.membershipStatus} />
            <NudgeBadge status={m.nudgeStatus} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">Standing</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Participation" value={`${m.participationPct.toFixed(0)}%`} />
            <Stat label="Total points" value={String(m.totalPoints)} />
            <Stat label="Impact points" value={String(m.impactPoints)} />
            <Stat label="Streak" value={String(m.streakCount)} />
            <Stat label="GPA" value={m.gpa != null ? Number(m.gpa).toFixed(2) : "—"} />
            <Stat label="Graduation" value={String(m.graduationYear ?? "—")} />
            <Stat
              label="Events attended"
              value={`${m.eventsAttended} / ${m.eventsEligible}`}
            />
            <Stat label="Committee" value={m.committeeName ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Quick facts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Phone" value={m.phone ?? "—"} />
            <Row label="Date joined" value={formatDate(m.dateJoined)} />
            <Row label="Last login" value={formatDate(m.lastLogin)} />
            <Row
              label="Dues"
              value={
                <Pill tone={m.duesPaid ? "success" : "warning"}>
                  {m.duesPaid ? "Paid" : "Outstanding"}
                </Pill>
              }
            />
            <Row
              label="Account"
              value={
                <Pill tone={m.accountActive ? "success" : "danger"}>
                  {m.accountActive ? "Active" : "Disabled"}
                </Pill>
              }
            />
          </CardContent>
        </Card>
      </div>

      {me.isAdmin ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-serif">Admin controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Committee</Label>
                <Select
                  value={form.committeeId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, committeeId: v }))
                  }
                >
                  <SelectTrigger data-testid="select-committee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(committees.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Membership status</Label>
                <Select
                  value={form.membershipStatus}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, membershipStatus: v }))
                  }
                >
                  <SelectTrigger data-testid="select-membership-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="font-medium">Dues paid</Label>
                    <p className="text-xs text-muted-foreground">
                      Required for full eligibility.
                    </p>
                  </div>
                  <Switch
                    checked={form.duesPaid}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, duesPaid: v }))
                    }
                    data-testid="switch-duespaid"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="font-medium">Account active</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow this member to access the system.
                    </p>
                  </div>
                  <Switch
                    checked={form.accountActive}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, accountActive: v }))
                    }
                    data-testid="switch-account-active"
                  />
                </div>
              </div>
            </div>
            <div className="pt-2">
              <Button
                onClick={save}
                disabled={update.isPending}
                data-testid="button-save-member"
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-serif text-lg font-semibold">{value}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
function formatDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return s;
  }
}
