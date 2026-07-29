import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "gold" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral:
    "bg-muted text-muted-foreground border border-[hsl(var(--border))]",
  primary:
    "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.2)]",
  gold: "bg-[hsl(var(--secondary)/0.18)] text-[hsl(35_80%_25%)] border border-[hsl(var(--secondary)/0.4)]",
  success:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  warning:
    "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  danger:
    "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ROLE_LABEL: Record<string, string> = {
  Member: "Member",
  CommitteeChair: "Committee Chair",
  BylawsChair: "Committee Chair",
  ExecutiveBoard: "Executive Board",
  Admin: "Admin",
};

export function RoleBadge({ role }: { role: string | null | undefined }) {
  if (!role) return null;
  const tone: Tone =
    role === "Admin" || role === "ExecutiveBoard"
      ? "primary"
      : role === "Member"
        ? "neutral"
        : "gold";
  return <Pill tone={tone}>{ROLE_LABEL[role] ?? role}</Pill>;
}


export function MembershipBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  if (!status) return null;
  const tone: Tone =
    status === "Active"
      ? "success"
      : status === "Probationary"
        ? "warning"
        : status === "Suspended"
          ? "danger"
          : "neutral";
  return <Pill tone={tone}>{status}</Pill>;
}

export function EventStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  if (!status) return null;
  const tone: Tone =
    status === "Active"
      ? "success"
      : status === "Upcoming"
        ? "primary"
        : status === "Completed"
          ? "neutral"
          : status === "Cancelled"
            ? "danger"
            : "neutral";
  return <Pill tone={tone}>{status}</Pill>;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  GeneralBodyMeeting: "General Body Meeting",
  CommitteeMeeting: "Committee Meeting",
  CommunityService: "Community Service",
  MentoringSession: "Mentoring",
  Workshop: "Workshop",
  Fundraiser: "Fundraiser",
  Conference: "Conference",
  Social: "Social",
};

export function EventTypeLabel({ type }: { type: string }) {
  return <span>{EVENT_TYPE_LABEL[type] ?? type}</span>;
}

export function eventTypeLabel(type: string) {
  return EVENT_TYPE_LABEL[type] ?? type;
}
