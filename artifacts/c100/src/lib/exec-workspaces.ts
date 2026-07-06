import type { LucideIcon } from "lucide-react";
import {
  Crown,
  Users2,
  NotebookPen,
  Landmark,
  Camera,
  ShieldCheck,
  Gavel,
  Cpu,
} from "lucide-react";

export type ExecWorkspaceSlug =
  | "president"
  | "vice-president"
  | "secretary"
  | "treasurer"
  | "historian"
  | "sergeant-at-arms"
  | "parliamentarian"
  | "technology";

export type ExecWorkspaceConfig = {
  slug: ExecWorkspaceSlug;
  label: string;
  /** Org role slug that grants direct access, or null when gated by system role instead. */
  orgRole: string | null;
  icon: LucideIcon;
  eyebrow: string;
  description: string;
};

export const EXEC_WORKSPACES: ExecWorkspaceConfig[] = [
  {
    slug: "president",
    label: "President",
    orgRole: "president",
    icon: Crown,
    eyebrow: "Executive Board",
    description: "Chapter-wide health, standing, and executive oversight.",
  },
  {
    slug: "vice-president",
    label: "Vice President",
    orgRole: "vice_president",
    icon: Users2,
    eyebrow: "Executive Board",
    description: "Committee oversight and cross-committee coordination.",
  },
  {
    slug: "secretary",
    label: "Secretary",
    orgRole: "secretary",
    icon: NotebookPen,
    eyebrow: "Executive Board",
    description: "Meeting attendance records and chapter documentation.",
  },
  {
    slug: "treasurer",
    label: "Treasurer",
    orgRole: "treasurer",
    icon: Landmark,
    eyebrow: "Executive Board",
    description: "Dues tracking and chapter financial oversight.",
  },
  {
    slug: "historian",
    label: "Historian",
    orgRole: "historian",
    icon: Camera,
    eyebrow: "Appointed Officer",
    description: "Chapter history, media archive, and event documentation.",
  },
  {
    slug: "sergeant-at-arms",
    label: "Sergeant-at-Arms",
    orgRole: "sergeant_at_arms",
    icon: ShieldCheck,
    eyebrow: "Executive Board",
    description: "Order, conduct standing, and meeting procedure support.",
  },
  {
    slug: "parliamentarian",
    label: "Parliamentarian",
    orgRole: "parliamentarian",
    icon: Gavel,
    eyebrow: "Appointed Officer",
    description: "Bylaws compliance and parliamentary procedure.",
  },
  {
    slug: "technology",
    label: "Technology",
    orgRole: null,
    icon: Cpu,
    eyebrow: "System Role",
    description: "Platform administration, roles, and system health.",
  },
];

export function getExecWorkspace(slug: string | undefined) {
  return EXEC_WORKSPACES.find((w) => w.slug === slug) ?? null;
}
