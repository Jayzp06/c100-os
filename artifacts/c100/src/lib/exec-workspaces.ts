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
  BookOpen,
} from "lucide-react";

export type ExecWorkspaceSlug =
  | "president"
  | "vice-president"
  | "secretary"
  | "treasurer"
  | "historian"
  | "sergeant-at-arms"
  | "parliamentarian"
  | "bylaws"
  | "technology";

export type ExecWorkspaceConfig = {
  slug: ExecWorkspaceSlug;
  label: string;
  /**
   * The permission-group slug that grants access to this workspace.
   * Access is granted if and only if the member's resolved permission set
   * contains this slug. No role-name bypasses are honoured — all access
   * flows through the RBAC matrix in rbac-matrix.ts.
   *
   * President holds all officer permissions explicitly, so President
   * automatically has access to every officer workspace through the union
   * of his permission set, without any special-case logic.
   */
  requiredPermission: string;
  icon: LucideIcon;
  eyebrow: string;
  description: string;
};

export const EXEC_WORKSPACES: ExecWorkspaceConfig[] = [
  {
    slug: "president",
    label: "President",
    // manage_org_settings is granted only to president in the org-role matrix.
    requiredPermission: "manage_org_settings",
    icon: Crown,
    eyebrow: "Executive Board",
    description: "Chapter-wide health, standing, and executive oversight.",
  },
  {
    slug: "vice-president",
    label: "Vice President",
    // view_committee_reports: VP + President (President has access to all workspaces).
    requiredPermission: "view_committee_reports",
    icon: Users2,
    eyebrow: "Executive Board",
    description: "Committee oversight and cross-committee coordination.",
  },
  {
    slug: "secretary",
    label: "Secretary",
    // manage_minutes: Secretary + President.
    requiredPermission: "manage_minutes",
    icon: NotebookPen,
    eyebrow: "Executive Board",
    description: "Meeting attendance records and chapter documentation.",
  },
  {
    slug: "treasurer",
    label: "Treasurer",
    // manage_finances: Treasurer + President.
    requiredPermission: "manage_finances",
    icon: Landmark,
    eyebrow: "Executive Board",
    description: "Dues tracking and chapter financial oversight.",
  },
  {
    slug: "historian",
    label: "Historian",
    // manage_archives: Historian + President.
    requiredPermission: "manage_archives",
    icon: Camera,
    eyebrow: "Appointed Officer",
    description: "Chapter history, media archive, and event documentation.",
  },
  {
    slug: "sergeant-at-arms",
    label: "Sergeant-at-Arms",
    // manage_conduct_records: Sergeant-at-Arms + President only.
    requiredPermission: "manage_conduct_records",
    icon: ShieldCheck,
    eyebrow: "Executive Board",
    description: "Order, conduct standing, and meeting procedure support.",
  },
  {
    slug: "parliamentarian",
    label: "Parliamentarian",
    // manage_procedure_records: Parliamentarian + President.
    requiredPermission: "manage_procedure_records",
    icon: Gavel,
    eyebrow: "Appointed Officer",
    description: "Bylaws compliance and parliamentary procedure.",
  },
  {
    slug: "bylaws",
    label: "Bylaws Officer",
    // manage_governance_documents: Bylaws Chair + President.
    requiredPermission: "manage_governance_documents",
    icon: BookOpen,
    eyebrow: "Appointed Officer",
    description: "Governance documents, bylaws, amendments, and version history.",
  },
  {
    slug: "technology",
    label: "Technology",
    // view_system_diagnostics: Technology Chair system role only.
    // Platform Admin does not hold this permission and must not receive
    // Executive Suite access through system-role status.
    requiredPermission: "view_system_diagnostics",
    icon: Cpu,
    eyebrow: "System Role",
    description: "Platform administration, roles, and system health.",
  },
];

export function getExecWorkspace(slug: string | undefined) {
  return EXEC_WORKSPACES.find((w) => w.slug === slug) ?? null;
}
