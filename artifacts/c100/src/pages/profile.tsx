import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyProfile,
  useUpdateMyProfile,
  getGetMyProfileQueryKey,
  getGetMyDashboardQueryKey,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import {
  MembershipBadge,
  Pill,
  RoleBadge,
} from "@/components/badges";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  return <ProfileInner />;
}

function ProfileInner() {
  const profile = useGetMyProfile();
  const qc = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateMyProfile({
    mutation: {
      onSuccess: () => {
        toast({ title: "Profile saved." });
        qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        qc.invalidateQueries({ queryKey: getGetMyDashboardQueryKey() });
      },
      onError: () => {
        toast({
          title: "Could not save profile",
          description: "Please check your inputs and try again.",
          variant: "destructive",
        });
      },
    },
  });

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    studentId: "",
    gpa: "",
    graduationYear: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile.data) {
      setForm({
        fullName: profile.data.fullName ?? "",
        phone: profile.data.phone ?? "",
        studentId: profile.data.studentId ?? "",
        gpa: profile.data.gpa != null ? String(profile.data.gpa) : "",
        graduationYear:
          profile.data.graduationYear != null
            ? String(profile.data.graduationYear)
            : "",
      });
    }
  }, [profile.data]);

  if (profile.isLoading) {
    return (
      <AppShell>
        <LoadingBlock />
      </AppShell>
    );
  }
  if (!profile.data) {
    return (
      <AppShell>
        <ErrorBlock />
      </AppShell>
    );
  }

  const m = profile.data;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    const trimName = form.fullName.trim();
    if (trimName && trimName.length < 2)
      errors.fullName = "Full name must be at least 2 characters.";
    if (trimName && trimName.length > 100)
      errors.fullName = "Full name must be 100 characters or fewer.";
    if (form.phone.trim().length > 20)
      errors.phone = "Phone number must be 20 characters or fewer.";
    if (form.studentId.trim().length > 30)
      errors.studentId = "Student ID must be 30 characters or fewer.";
    if (form.gpa.trim()) {
      const gpaNum = Number(form.gpa);
      if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4.5)
        errors.gpa = "GPA must be between 0 and 4.5.";
    }
    if (form.graduationYear.trim()) {
      const yr = Number(form.graduationYear);
      if (!Number.isInteger(yr) || yr < 2000 || yr > 2100)
        errors.graduationYear = "Graduation year must be between 2000 and 2100.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: Record<string, string | number | undefined> = {};
    if (form.fullName.trim()) payload.fullName = form.fullName.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.studentId.trim()) payload.studentId = form.studentId.trim();
    if (form.gpa.trim()) payload.gpa = Number(form.gpa);
    if (form.graduationYear.trim())
      payload.graduationYear = Number(form.graduationYear);
    update.mutate({ data: payload });
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Profile"
        title="Your chapter profile"
        description="Keep your contact information and academic record current. The chapter uses these for eligibility, conference travel, and award decisions."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">Edit details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, fullName: e.target.value }));
                      if (fieldErrors.fullName) setFieldErrors((fe) => ({ ...fe, fullName: "" }));
                    }}
                    aria-invalid={!!fieldErrors.fullName}
                    data-testid="input-fullname"
                  />
                  {fieldErrors.fullName && (
                    <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, phone: e.target.value }));
                      if (fieldErrors.phone) setFieldErrors((fe) => ({ ...fe, phone: "" }));
                    }}
                    aria-invalid={!!fieldErrors.phone}
                    data-testid="input-phone"
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input
                    id="studentId"
                    value={form.studentId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, studentId: e.target.value }));
                      if (fieldErrors.studentId) setFieldErrors((fe) => ({ ...fe, studentId: "" }));
                    }}
                    aria-invalid={!!fieldErrors.studentId}
                    data-testid="input-studentid"
                  />
                  {fieldErrors.studentId && (
                    <p className="text-xs text-destructive">{fieldErrors.studentId}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gpa">GPA</Label>
                  <Input
                    id="gpa"
                    type="number"
                    step="0.01"
                    min="0"
                    max="4.5"
                    value={form.gpa}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, gpa: e.target.value }));
                      if (fieldErrors.gpa) setFieldErrors((fe) => ({ ...fe, gpa: "" }));
                    }}
                    aria-invalid={!!fieldErrors.gpa}
                    data-testid="input-gpa"
                  />
                  {fieldErrors.gpa && (
                    <p className="text-xs text-destructive">{fieldErrors.gpa}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grad">Graduation year</Label>
                  <Input
                    id="grad"
                    type="number"
                    min="2024"
                    max="2032"
                    value={form.graduationYear}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        graduationYear: e.target.value,
                      }))
                    }
                    data-testid="input-grad"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={m.email} disabled />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={update.isPending}
                  data-testid="button-save-profile"
                >
                  {update.isPending ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Standing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <RoleBadge role={m.role} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Membership</span>
              <MembershipBadge status={m.membershipStatus} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Committee</span>
              <span className="font-medium">
                {m.committeeName ?? "Unassigned"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dues</span>
              <Pill tone={m.duesPaid ? "success" : "warning"}>
                {m.duesPaid ? "Paid" : "Outstanding"}
              </Pill>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Participation</span>
              <span className="font-semibold">
                {m.participationPct.toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total points</span>
              <span className="font-semibold">{m.totalPoints}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Streak</span>
              <span className="font-semibold">{m.streakCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
