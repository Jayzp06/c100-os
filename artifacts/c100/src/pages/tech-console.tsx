import { useEffect, useState } from "react";
import { useMe } from "@/lib/me";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  useStartImpersonation,
  useEndImpersonation,
  useGetOrgSettings,
  useListMembers,
  useListEventTypeConfig,
  useUpdateEventTypeConfig,
  getListEventTypeConfigQueryKey,
  getGetMyProfileQueryKey,
  type Member,
  type EventTypeConfig,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import LoginPage from "@/pages/login";
import { ErrorBlock, LoadingBlock } from "@/components/page-states";
import { cn } from "@/lib/utils";
import { eventTypeLabel } from "@/components/badges";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Users,
  Settings,
  Eye,
  EyeOff,
  RotateCcw,
  Sliders,
} from "lucide-react";

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
    description: "Top-nav portal — committee management, events, profile",
    experience: "Committee Portal",
  },
  {
    value: "ExecutiveBoard",
    label: "Executive Board",
    description: "Operations console with sidebar — dashboard, members, committees, reports",
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
        <ScoringRules />
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
        // Impersonation swaps the entire RBAC context, so every cached query
        // (dashboard, events, members, committees, reports) can now
        // resolve to different data or a different permission set. A full
        // invalidation is the only safe option here — this is a rare,
        // Tech-Chair-only QA action, not a hot path.
        queryClient.invalidateQueries();
      },
    },
  });

  const endMutation = useEndImpersonation({
    mutation: {
      onSuccess: (data: Member) => {
        queryClient.setQueryData(getGetMyProfileQueryKey(), data);
        queryClient.invalidateQueries();
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
                    startMutation.mutate({ data: { viewAs: opt.value as "Member" | "CommitteeChair" | "ExecutiveBoard" | "Admin" } });
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

function ScoringRules() {
  const { data, isLoading, error } = useListEventTypeConfig();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<
    Record<string, { pointValue: string; impactMultiplier: string }>
  >({});

  useEffect(() => {
    if (!data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const cfg of data) {
        if (!next[cfg.eventType]) {
          next[cfg.eventType] = {
            pointValue: String(cfg.pointValue),
            impactMultiplier: String(cfg.impactMultiplier),
          };
        }
      }
      return next;
    });
  }, [data]);

  const update = useUpdateEventTypeConfig({
    mutation: {
      onSuccess: () => {
        toast({ title: "Scoring rule updated." });
        qc.invalidateQueries({ queryKey: getListEventTypeConfigQueryKey() });
      },
      onError: () => {
        toast({ title: "Could not update scoring rule.", variant: "destructive" });
      },
    },
  });

  function save(cfg: EventTypeConfig) {
    const draft = drafts[cfg.eventType];
    if (!draft) return;
    const pointValue = Number(draft.pointValue);
    const impactMultiplier = Number(draft.impactMultiplier);
    if (!Number.isFinite(pointValue) || !Number.isFinite(impactMultiplier)) {
      toast({ title: "Enter valid numbers.", variant: "destructive" });
      return;
    }
    update.mutate({
      eventType: cfg.eventType,
      data: { pointValue, impactMultiplier },
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Sliders className="h-4 w-4 text-muted-foreground" />
          Event Scoring Rules
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Point values and impact multipliers auto-score new events by type.
          Changing a rule here only affects events created after the change —
          existing events keep the scoring they were created with.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingBlock />
        ) : error || !data ? (
          <ErrorBlock />
        ) : (
          <div className="space-y-3">
            {data.map((cfg) => {
              const draft = drafts[cfg.eventType] ?? {
                pointValue: String(cfg.pointValue),
                impactMultiplier: String(cfg.impactMultiplier),
              };
              const dirty =
                draft.pointValue !== String(cfg.pointValue) ||
                draft.impactMultiplier !== String(cfg.impactMultiplier);
              return (
                <div
                  key={cfg.eventType}
                  className="grid grid-cols-1 items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto_auto]"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {eventTypeLabel(cfg.eventType)}
                    </p>
                    {cfg.updatedByName ? (
                      <p className="text-xs text-muted-foreground">
                        Last updated by {cfg.updatedByName}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Points
                    </label>
                    <Input
                      type="number"
                      min="0"
                      className="w-24"
                      value={draft.pointValue}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [cfg.eventType]: {
                            ...draft,
                            pointValue: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Impact multiplier
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-28"
                      value={draft.impactMultiplier}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [cfg.eventType]: {
                            ...draft,
                            impactMultiplier: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={!dirty || update.isPending}
                    onClick={() => save(cfg)}
                  >
                    Save
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
