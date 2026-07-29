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
 *  - No role bypasses permission checks automatically. All access is
 *    derived from explicit permission-group assignments here.
 *  - Technology Chair is technical-only; it does NOT receive any
 *    executive-board, document, finance, or reporting permissions.
 *  - Platform Admin is technical account-administration only; it does
 *    NOT receive executive-suite permissions.
 *  - Document permissions are split by domain (Secretary ≠ Historian
 *    ≠ Bylaws Chair ≠ Parliamentarian).
 *  - Report permissions are split by type so each officer sees only
 *    the data relevant to their position.
 *  - bylaws_officer is consolidated into bylaws_chair (removed).
 */

export const SYSTEM_ROLE_PERMS: Record<string, string[]> = {
  /**
   * Technical account-administration only.
   * Does NOT include executive-board, document, finance, or reporting tools.
   */
  platform_admin: [
    "manage_members",
    "manage_system_settings", "manage_roles", "manage_permissions",
    "impersonate_users", "view_audit_logs", "deploy_desktop",
  ],
  /**
   * Technical platform operations only.
   * Does NOT access officer workspaces, finances, documents, or reports.
   */
  technology_chair: [
    "view_system_diagnostics",
    "manage_system_configuration",
    "view_release_information",
    "manage_update_configuration",
    "troubleshoot_authentication",
    "view_technical_audit_logs",
    "manage_integrations",
    "impersonate_for_support",
  ],
  developer: [
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_org_settings",
    "manage_system_settings", "manage_roles",
    "impersonate_users", "view_audit_logs",
    "view_chapter_overview", "view_eligibility_reports",
  ],
  system_auditor: [
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_org_settings", "view_audit_logs",
    "view_chapter_overview",
  ],
  readonly_auditor: [
    "manage_committees", "manage_events", "view_chapter_overview",
  ],
};

export const ORG_ROLE_PERMS: Record<string, string[]> = {
  // ── Executive Board ────────────────────────────────────────────────────────
  president: [
    // Operational
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_finances", "manage_executive_dashboard", "manage_org_settings",
    // Secretary domain
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    // Governance domain
    "manage_governance_documents", "upload_governance_documents",
    "version_governance_documents", "view_governance_documents",
    // Parliamentary domain
    "manage_procedure_records", "manage_motions", "manage_parliamentary_rulings",
    // Archive domain
    "manage_archives", "upload_archive_material", "manage_chapter_timeline", "view_archives",
    // Reports
    "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
    "view_committee_reports", "view_official_records", "view_governance_reports",
    "view_archive_reports", "view_conduct_reports",
  ],
  vice_president: [
    "manage_committees", "manage_events",
    "manage_executive_dashboard",
    "view_chapter_overview", "view_committee_reports",
  ],
  secretary: [
    "manage_executive_dashboard",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "view_official_records",
  ],
  treasurer: [
    "manage_finances", "manage_executive_dashboard",
    "view_financial_reports",
  ],
  chief_of_staff: [
    "manage_members", "manage_executive_dashboard",
    "view_chapter_overview",
  ],
  sergeant_at_arms: [
    "manage_events", "manage_attendance", "manage_executive_dashboard",
    "view_conduct_reports",
  ],
  // ── Appointed Officers ────────────────────────────────────────────────────
  membership_director:    ["manage_members", "manage_committees"],
  communications_director: ["manage_official_correspondence"],
  parliamentarian: [
    "view_governance_documents", "manage_procedure_records",
    "manage_motions", "manage_parliamentary_rulings",
    "manage_executive_dashboard", "view_governance_reports",
  ],
  historian: [
    "manage_archives", "upload_archive_material",
    "manage_chapter_timeline", "view_archives",
    "manage_executive_dashboard", "view_archive_reports",
  ],
  bylaws_chair: [
    "manage_governance_documents", "upload_governance_documents",
    "version_governance_documents", "view_governance_documents",
    "view_governance_reports",
  ],
  // ── Committee Leadership ──────────────────────────────────────────────────
  mentoring_chair:              ["manage_committees", "manage_events", "manage_attendance"],
  education_chair:              ["manage_committees", "manage_events", "manage_attendance"],
  economic_empowerment_chair:   ["manage_committees", "manage_events", "manage_attendance"],
  leadership_development_chair: ["manage_committees", "manage_events", "manage_attendance"],
  health_wellness_chair:        ["manage_committees", "manage_events", "manage_attendance"],
  community_service_chair:      ["manage_committees", "manage_events", "manage_attendance"],
  special_events_chair:         ["manage_committees", "manage_events", "manage_attendance"],
  committee_chair:              ["manage_committees", "manage_events", "manage_attendance"],
  // ── General ───────────────────────────────────────────────────────────────
  committee_member:   [],
  general_member:     [],
  advisor:            ["manage_executive_dashboard", "view_chapter_overview"],
  parent_chapter_rep: ["view_chapter_overview"],
};
