import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMyNudges,
  useListNudges,
  useRunNudgeEvaluation,
  useMarkNudgeRead,
  useMarkAllNudgesRead,
  getListMyNudgesQueryKey,
  getListNudgesQueryKey,
  getGetMyDashboardQueryKey,
} from "@workspace/api-client-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CardSkeleton,
  EmptyBlock,
  LoadingBlock,
} from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import { Pill } from "@/components/badges";
import { Bell, Check, CheckCheck, Mail, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const NUDGE_TONES: Record<string, "success" | "primary" | "gold" | "warning" | "danger"> = {
  ActiveEncouragement: "success",
  Milestone: "gold",
  GentleReminder: "primary",
  AtRiskWarning: "warning",
  CriticalAlert: "danger",
  ChairInactivityAlert: "warning",
  ChairParticipationAlert: "warning",
};

export default function NudgesPage() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  return <Nudges />;
}

function Nudges() {
  const me = useMe();
  return (
    <AppShell>
      <PageHeader
        eyebrow="Nudges"
        title="Stay close to the standard"
        description="The chapter sends nudges to keep you on track. Encouragement when you're showing up, gentle reminders when you slip, and direct outreach when participation drops."
      />
      {me.isExecOrAdmin ? (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine" data-testid="tab-my-nudges">My nudges</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all-nudges">All nudges</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="mt-4">
            <MyNudges />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <AllNudges />
          </TabsContent>
        </Tabs>
      ) : (
        <MyNudges />
      )}
    </AppShell>
  );
}

function MyNudges() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const data = useListMyNudges();

  const markRead = useMarkNudgeRead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMyNudgesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetMyDashboardQueryKey() });
      },
    },
  });

  const markAllRead = useMarkAllNudgesRead({
    mutation: {
      onSuccess: () => {
        toast({ title: "All nudges marked as read." });
        qc.invalidateQueries({ queryKey: getListMyNudgesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetMyDashboardQueryKey() });
      },
    },
  });

  if (data.isLoading) return <CardSkeleton rows={4} />;
  if (!data.data || data.data.length === 0) {
    return (
      <EmptyBlock
        title="No nudges right now"
        description="You're meeting the chapter standard. Keep showing up."
      />
    );
  }

  const unreadCount = data.data.filter((n) => !n.read).length;

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{unreadCount}</span>{" "}
            unread {unreadCount === 1 ? "nudge" : "nudges"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            {markAllRead.isPending ? "Marking…" : "Mark all read"}
          </Button>
        </div>
      )}
      {data.data.map((n) => (
        <Card
          key={n.id}
          data-testid={`nudge-${n.id}`}
          className={cn(!n.read && "border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.04)]")}
        >
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill tone={NUDGE_TONES[n.nudgeType] ?? "neutral"}>
                  {n.nudgeType}
                </Pill>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {n.deliveryChannel}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {!n.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => markRead.mutate({ id: n.id })}
                    disabled={markRead.isPending}
                    data-testid={`button-mark-read-${n.id}`}
                    aria-label="Mark as read"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
                {!n.read ? (
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" aria-label="Unread" />
                ) : null}
              </div>
            </div>
            <p className="text-sm">{n.messageContent}</p>
            <p className="text-xs text-muted-foreground">
              {n.triggerReason} · sent{" "}
              {n.sentAt ? new Date(n.sentAt).toLocaleString() : "—"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AllNudges() {
  const [tier, setTier] = useState<string>("all");
  const params: { tier?: string } = {};
  if (tier !== "all") params.tier = tier;
  const data = useListNudges(Object.keys(params).length ? params : undefined);
  const qc = useQueryClient();
  const { toast } = useToast();
  const run = useRunNudgeEvaluation({
    mutation: {
      onSuccess: () => {
        toast({ title: "Nudges sent based on the latest data." });
        qc.invalidateQueries({ queryKey: getListNudgesQueryKey() });
        qc.invalidateQueries({ queryKey: getListMyNudgesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetMyDashboardQueryKey() });
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-60" data-testid="select-tier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="ActiveEncouragement">Active</SelectItem>
            <SelectItem value="Milestone">Milestone</SelectItem>
            <SelectItem value="GentleReminder">Gentle reminder</SelectItem>
            <SelectItem value="AtRiskWarning">At risk</SelectItem>
            <SelectItem value="CriticalAlert">Critical</SelectItem>
            <SelectItem value="ChairInactivityAlert">Chair inactivity</SelectItem>
            <SelectItem value="ChairParticipationAlert">Chair participation</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          data-testid="button-run-eval"
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          {run.isPending ? "Running…" : "Run nudge evaluation"}
        </Button>
      </div>

      {data.isLoading ? (
        <CardSkeleton rows={5} />
      ) : !data.data || data.data.length === 0 ? (
        <EmptyBlock title="No nudges in the log" />
      ) : (
        <div className="space-y-3">
          {data.data.map((n) => (
            <Card key={n.id} data-testid={`nudge-row-${n.id}`}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Pill tone={NUDGE_TONES[n.nudgeType] ?? "neutral"}>
                        {n.nudgeType}
                      </Pill>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        {n.userName}
                      </span>
                    </div>
                    <p className="text-sm">{n.messageContent}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {n.sentAt ? new Date(n.sentAt).toLocaleString() : "—"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Status at send: {n.memberStatusAtSend} · Trigger:{" "}
                  {n.triggerReason}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
