/**
 * Canonical RBAC permission matrix.
 *
 * Defines which permission-group slugs each org/system role holds.
 * This file has no side effects and no runtime dependencies — safe to
 * import from tests, seeds, and application code alike.
 *
 * Rules:
 *  - Permissions are additive: a member's effective set is the union of
 *    every role they hold.
 *  - Technology Chair is the only role that bypasses permission checks
 *    entirely (all-access superuser for technical administration).
 *  - Platform Admin is technical-only: it does NOT auto-receive
 *    manage_finances, manage_documents, manage_executive_dashboard,
 *    or manage_nudges.  Those belong exclusively to their respective
 *    executive positions.
 *  - bylaws_officer is consolidated into bylaws_chair (removed).
 */

export const SYSTEM_ROLE_PERMS: Record<string, string[]> = {
  /**
   * Technical + member administration only.
   * Does NOT include executive-board tools (finances, documents,
   * executive dashboard, nudges).
   */
  platform_admin: [
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_org_settings", "view_reports",
    "manage_system_settings", "manage_roles", "manage_permissions",
    "impersonate_users", "view_audit_logs", "deploy_desktop",
  ],
  /** Blanket technical superuser — bypasses all permission-group checks. */
  technology_chair: [
    "manage_members", "manage_org_settings",
    "manage_system_settings", "manage_roles", "manage_permissions",
    "impersonate_users", "view_audit_logs", "deploy_desktop",
  ],
  developer: [
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_org_settings", "view_reports",
    "manage_system_settings", "manage_roles",
    "impersonate_users", "view_audit_logs",
  ],
  system_auditor: [
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_org_settings", "view_reports", "view_audit_logs",
  ],
  readonly_auditor: [
    "manage_committees", "manage_events", "view_reports",
  ],
};

export const ORG_ROLE_PERMS: Record<string, string[]> = {
  // ── Executive Board ────────────────────────────────────────────────────────
  president: [
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_finances", "manage_documents", "manage_executive_dashboard",
    "manage_org_settings", "manage_nudges", "view_reports",
  ],
  vice_president: [
    "manage_committees", "manage_events",
    "manage_executive_dashboard", "manage_nudges", "view_reports",
  ],
  secretary: [
    "manage_documents", "manage_executive_dashboard", "view_reports",
  ],
  treasurer: [
    "manage_finances", "manage_executive_dashboard", "view_reports",
  ],
  chief_of_staff: [
    "manage_members", "manage_executive_dashboard", "manage_nudges", "view_reports",
  ],
  sergeant_at_arms: [
    "manage_events", "manage_attendance", "manage_executive_dashboard",
  ],
  // ── Appointed Officers ────────────────────────────────────────────────────
  membership_director:    ["manage_members", "manage_committees"],
  communications_director: ["manage_documents"],
  parliamentarian:        ["manage_documents", "view_reports"],
  historian:              ["manage_documents", "view_reports"],
  // bylaws_officer → consolidated into bylaws_chair
  // ── Committee Leadership ──────────────────────────────────────────────────
  mentoring_chair:              ["manage_committees", "manage_events", "manage_attendance"],
  education_chair:              ["manage_committees", "manage_events", "manage_attendance"],
  economic_empowerment_chair:   ["manage_committees", "manage_events", "manage_attendance"],
  leadership_development_chair: ["manage_committees", "manage_events", "manage_attendance"],
  health_wellness_chair:        ["manage_committees", "manage_events", "manage_attendance"],
  community_service_chair:      ["manage_committees", "manage_events", "manage_attendance"],
  special_events_chair:         ["manage_committees", "manage_events", "manage_attendance"],
  committee_chair:              ["manage_committees", "manage_events", "manage_attendance"],
  bylaws_chair:                 ["manage_documents", "view_reports"],
  // ── General ───────────────────────────────────────────────────────────────
  committee_member:   [],
  general_member:     [],
  advisor:            ["view_reports", "manage_executive_dashboard"],
  parent_chapter_rep: ["view_reports"],
};
