import { useMe } from "@/lib/me";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useStartImpersonation,
  useEndImpersonation,
  useGetOrgSettings,
  useListMembers,
  getGetMyProfileQueryKey,
  type Member,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import LoginPage from "@/pages/login";
import { ErrorBlock } from "@/components/page-states";
import { cn } from "@/lib/utils";
import { Shield, Users, Settings, Eye, EyeOff, RotateCcw } from "lucide-react";

const VIEW_OPTIONS: {
  value: string;
  label: string;
  description: string;
  experience: string;
}[] = [
  {
    value: "Member",
    label: "General Member",
    description: "Mobile-first portal with bottom tabs — events, committee, profile",
    experience: "Member Portal",
  },
  {
    value: "CommitteeChair",
    label: "Committee Chair",
    description: "Top-nav portal — committee management, events, nudges",
    experience: "Committee Portal",
  },
  {
    value: "BylawsChair",
    label: "Bylaws Chair",
    description: "Top-nav portal — bylaws-specific committee view",
    experience: "Committee Portal",
  },
  {
    value: "ExecutiveBoard",
    label: "Executive Board",
    description: "Operations console with sidebar — dashboard, members, reports, nudges",
    experience: "Operations Console",
  },
  {
    value: "Admin",
    label: "Administrator",
    description: "Full operations console — all exec access plus member role editing",
    experience: "Operations Console",
  },
];

export default function TechConsolePage() {
  const me = useMe();

  if (me.isLoading) return null;
  if (!me.isAuthenticated) return <LoginPage />;
  if (!me.isTechChair) {
    return (
      <AppShell>
        <ErrorBlock title="Technology Chair only" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="System Administration"
        title="Technology Chair Console"
        description="Manage platform settings, test role experiences, and monitor system health."
      />
      <div className="space-y-6">
        <RoleViewSwitcher />
        <SystemSummary />
      </div>
    </AppShell>
  );
}

function RoleViewSwitcher() {
  const me = useMe();
  const queryClient = useQueryClient();

  const startMutation = useStartImpersonation({
    mutation: {
      onSuccess: (data: Member) => {
        queryClient.setQueryData(getGetMyProfileQueryKey(), data);
      },
    },
  });

  const endMutation = useEndImpersonation({
    mutation: {
      onSuccess: (data: Member) => {
        queryClient.setQueryData(getGetMyProfileQueryKey(), data);
      },
    },
  });

  const isActive = !!me.impersonating;
  const activeView = me.impersonating?.viewAs;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Role View Switching
          </CardTitle>
          {isActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => endMutation.mutate()}
              disabled={endMutation.isPending}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
              {endMutation.isPending ? "Exiting…" : "Exit view — return to Tech Chair"}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Temporarily view any organizational role experience without changing
          your account permissions. All impersonation activity is audit-logged.
        </p>
      </CardHeader>
      <CardContent>
        {isActive && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <EyeOff className="h-4 w-4 shrink-0" />
            <span>
              Currently viewing as <strong>{activeView}</strong>. Navigation and
              layout reflect that role. Your real permissions are unchanged.
            </span>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VIEW_OPTIONS.map((opt) => {
            const isCurrent = activeView === opt.value;
            return (
              <button
                key={opt.value}
                disabled={startMutation.isPending || endMutation.isPending}
                onClick={() => {
                  if (isCurrent) {
                    endMutation.mutate();
                  } else {
                    startMutation.mutate({ data: { viewAs: opt.value as "Member" | "CommitteeChair" | "BylawsChair" | "ExecutiveBoard" | "Admin" } });
                  }
                }}
                className={cn(
                  "group flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                  isCurrent
                    ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary)/0.08)]"
                    : "border-border hover:border-[hsl(var(--primary)/0.4)] hover:bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{opt.label}</span>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-[10px]">
                      Active
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {opt.description}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--secondary))]">
                  {opt.experience}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SystemSummary() {
  const { data: org } = useGetOrgSettings();
  const { data: members } = useListMembers();

  const memberList = Array.isArray(members) ? members : [];
  const activeCount = memberList.filter((m) => m.membershipStatus === "Active").length;

  const stats = [
    {
      label: "Total Members",
      value: memberList.length,
      icon: Users,
    },
    {
      label: "Active Members",
      value: activeCount,
      icon: Shield,
    },
    {
      label: "Org Config",
      value: org ? "Configured" : "Default",
      icon: Settings,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--accent))]">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
