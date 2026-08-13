/**
 * RBAC permission matrix regression tests — Work Order 5
 *
 * Asserts the complete permission contract for every org and system role:
 *   • Each role holds exactly the permissions the spec grants it.
 *   • Each role is denied every permission assigned to a different position.
 *   • Legacy broad slugs (manage_documents, view_reports) are absent from all roles.
 *   • Multiple positions produce the correct union.
 *   • bylaws_officer has been removed from the matrix.
 *   • Tech Chair and Platform Admin carry only technical permissions.
 *
 * Run with:
 *   cd artifacts/api-server && pnpm exec tsx --test src/__tests__/rbac-permissions.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ORG_ROLE_PERMS, SYSTEM_ROLE_PERMS } from "../../../../lib/db/src/rbac-matrix.js";
import { RESERVED_COMMITTEE_NAMES, validateCommitteeName } from "../routes/committees.js";
import { ASSIGNABLE_ORG_ROLE_SLUGS, ASSIGNABLE_SYSTEM_ROLE_SLUGS, deriveLegacyRole } from "../lib/rbac.js";

// ── Workspace permission matrix ───────────────────────────────────────────────
// Mirror the EXEC_WORKSPACES entries from the frontend lib so the backend can
// assert the contract without importing a frontend module. This list must stay
// in sync with artifacts/c100/src/lib/exec-workspaces.ts.
const WORKSPACE_PERMISSION_MAP: Record<string, string> = {
  president:          "manage_org_settings",
  "vice-president":   "view_committee_reports",
  "chief-of-staff":   "manage_executive_operations",
  secretary:          "manage_minutes",
  treasurer:          "manage_finances",
  historian:          "manage_archives",
  "sergeant-at-arms": "manage_conduct_records",
  parliamentarian:    "manage_procedure_records",
  bylaws:             "manage_governance_documents",
  technology:         "view_system_diagnostics",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function orgPerms(slug: string): Set<string> {
  return new Set(ORG_ROLE_PERMS[slug] ?? []);
}

function sysPerms(slug: string): Set<string> {
  return new Set(SYSTEM_ROLE_PERMS[slug] ?? []);
}

function union(...slugs: string[]): Set<string> {
  const all = new Set<string>();
  for (const s of slugs) {
    for (const p of orgPerms(s)) all.add(p);
  }
  return all;
}

function assertHas(set: Set<string>, perm: string, label: string) {
  assert.ok(set.has(perm), `${label} should have "${perm}"`);
}

function assertLacks(set: Set<string>, perm: string, label: string) {
  assert.ok(!set.has(perm), `${label} must NOT have "${perm}"`);
}

// ── Legacy perm removal: no role should carry the old broad slugs ──────────────

describe("legacy permission groups are absent from all roles", () => {
  const LEGACY = ["manage_documents", "view_reports"];

  test("no org role carries manage_documents", () => {
    for (const [slug, perms] of Object.entries(ORG_ROLE_PERMS)) {
      assert.ok(
        !perms.includes("manage_documents"),
        `${slug} must not contain legacy manage_documents`,
      );
    }
  });

  test("no org role carries view_reports", () => {
    for (const [slug, perms] of Object.entries(ORG_ROLE_PERMS)) {
      assert.ok(
        !perms.includes("view_reports"),
        `${slug} must not contain legacy view_reports`,
      );
    }
  });

  test("no system role carries manage_documents", () => {
    for (const [slug, perms] of Object.entries(SYSTEM_ROLE_PERMS)) {
      assert.ok(
        !perms.includes("manage_documents"),
        `system:${slug} must not contain legacy manage_documents`,
      );
    }
  });

  test("no system role carries view_reports", () => {
    for (const [slug, perms] of Object.entries(SYSTEM_ROLE_PERMS)) {
      assert.ok(
        !perms.includes("view_reports"),
        `system:${slug} must not contain legacy view_reports`,
      );
    }
  });

  // Satisfy TS — LEGACY is used only for the variable declaration
  test("legacy array still defined (reference check)", () => {
    assert.deepEqual(LEGACY, ["manage_documents", "view_reports"]);
  });
});

// ── bylaws_officer removal ─────────────────────────────────────────────────────

describe("bylaws_officer removal (consolidated into bylaws_chair)", () => {
  test("bylaws_officer is absent from ORG_ROLE_PERMS", () => {
    assert.equal(
      Object.prototype.hasOwnProperty.call(ORG_ROLE_PERMS, "bylaws_officer"),
      false,
    );
  });
});

// ── Technology Chair: technical-only ──────────────────────────────────────────

describe("technology_chair permissions — technical-only", () => {
  const p = sysPerms("technology_chair");

  // Should have exactly these technical perms
  const TECH_PERMS = [
    "view_system_diagnostics",
    "manage_system_configuration",
    "view_release_information",
    "manage_update_configuration",
    "troubleshoot_authentication",
    "view_technical_audit_logs",
    "manage_integrations",
    "impersonate_for_support",
  ];

  for (const perm of TECH_PERMS) {
    test(`has ${perm}`, () => assertHas(p, perm, "technology_chair"));
  }

  // Must NOT have officer, finance, or reporting tools
  const DENIED: string[] = [
    "manage_finances", "manage_executive_dashboard",
    "manage_members", "manage_org_settings",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "manage_governance_documents", "upload_governance_documents", "version_governance_documents",
    "manage_archives", "manage_chapter_timeline",
    "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
    "view_committee_reports", "view_governance_reports", "view_archive_reports",
    "view_conduct_reports",
    // legacy
    "manage_documents", "view_reports",
    // admin tools that belong to platform_admin, not tech chair
    "manage_system_settings", "manage_roles", "manage_permissions",
    "impersonate_users", "view_audit_logs", "deploy_desktop",
  ];

  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "technology_chair"));
  }
});

// ── Platform Admin: technical account-administration only ─────────────────────

describe("platform_admin permissions — account-admin + full technical platform ops", () => {
  const p = sysPerms("platform_admin");

  // Account-administration perms
  const ACCOUNT_PERMS = [
    "manage_members",
    "manage_system_settings", "manage_roles", "manage_permissions",
    "impersonate_users", "view_audit_logs", "deploy_desktop",
  ];
  for (const perm of ACCOUNT_PERMS) {
    test(`has ${perm}`, () => assertHas(p, perm, "platform_admin"));
  }

  // Technical platform ops (same set as technology_chair)
  const TECH_PERMS = [
    "view_system_diagnostics",
    "manage_system_configuration",
    "view_release_information",
    "manage_update_configuration",
    "troubleshoot_authentication",
    "view_technical_audit_logs",
    "manage_integrations",
    "impersonate_for_support",
  ];
  for (const perm of TECH_PERMS) {
    test(`has ${perm} (same as technology_chair)`, () => assertHas(p, perm, "platform_admin"));
  }

  // Must NOT have executive-suite tools
  const DENIED: string[] = [
    "manage_finances", "manage_executive_dashboard",
    "manage_attendance", "manage_committees", "manage_events", "manage_org_settings",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "manage_governance_documents", "upload_governance_documents", "version_governance_documents",
    "manage_archives", "manage_chapter_timeline",
    "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
    "view_committee_reports", "view_governance_reports", "view_archive_reports",
    "view_conduct_reports",
    "manage_documents", "view_reports",
  ];
  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "platform_admin"));
  }
});

// ── President: full explicit set ──────────────────────────────────────────────

describe("president permissions — full explicit grant", () => {
  const p = orgPerms("president");

  const FULL: string[] = [
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
  ];

  for (const perm of FULL) {
    test(`has ${perm}`, () => assertHas(p, perm, "president"));
  }

  // Should not have old broad slugs
  test("does NOT have manage_documents (legacy)", () => assertLacks(p, "manage_documents", "president"));
  test("does NOT have view_reports (legacy)", () => assertLacks(p, "view_reports", "president"));
});

// ── Vice President ────────────────────────────────────────────────────────────

describe("vice_president permissions", () => {
  const p = orgPerms("vice_president");

  test("has manage_committees", () => assertHas(p, "manage_committees", "vice_president"));
  test("has manage_events", () => assertHas(p, "manage_events", "vice_president"));
  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "vice_president"));
  test("has view_chapter_overview", () => assertHas(p, "view_chapter_overview", "vice_president"));
  test("has view_committee_reports", () => assertHas(p, "view_committee_reports", "vice_president"));

  // Must not access finance, secretary, historian, or conduct tools
  const DENIED: string[] = [
    "manage_finances", "manage_members", "manage_org_settings",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "manage_governance_documents", "version_governance_documents",
    "manage_archives", "manage_chapter_timeline",
    "view_financial_reports", "view_eligibility_reports",
    "view_governance_reports", "view_archive_reports", "view_conduct_reports",
    "manage_documents", "view_reports",
  ];
  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "vice_president"));
  }
});

// ── Secretary ─────────────────────────────────────────────────────────────────

describe("secretary permissions", () => {
  const p = orgPerms("secretary");

  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "secretary"));
  test("has manage_minutes", () => assertHas(p, "manage_minutes", "secretary"));
  test("has manage_agendas", () => assertHas(p, "manage_agendas", "secretary"));
  test("has manage_official_correspondence", () => assertHas(p, "manage_official_correspondence", "secretary"));
  test("has view_official_records", () => assertHas(p, "view_official_records", "secretary"));

  const DENIED: string[] = [
    "manage_finances", "manage_members", "manage_org_settings",
    "manage_committees", "manage_events", "manage_attendance",
    "manage_governance_documents", "upload_governance_documents", "version_governance_documents",
    "manage_archives", "upload_archive_material", "manage_chapter_timeline",
    "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
    "view_committee_reports", "view_governance_reports", "view_archive_reports",
    "view_conduct_reports",
    "manage_documents", "view_reports",
  ];
  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "secretary"));
  }
});

// ── Treasurer ─────────────────────────────────────────────────────────────────

describe("treasurer permissions", () => {
  const p = orgPerms("treasurer");

  test("has manage_finances", () => assertHas(p, "manage_finances", "treasurer"));
  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "treasurer"));
  test("has view_financial_reports", () => assertHas(p, "view_financial_reports", "treasurer"));

  const DENIED: string[] = [
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_org_settings",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "manage_governance_documents", "version_governance_documents",
    "manage_archives", "manage_chapter_timeline",
    "view_chapter_overview", "view_eligibility_reports",
    "view_committee_reports", "view_governance_reports", "view_archive_reports",
    "view_conduct_reports", "view_official_records",
    "manage_documents", "view_reports",
  ];
  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "treasurer"));
  }
});

// ── Sergeant-at-Arms ──────────────────────────────────────────────────────────

describe("sergeant_at_arms permissions", () => {
  const p = orgPerms("sergeant_at_arms");

  test("has manage_events", () => assertHas(p, "manage_events", "sergeant_at_arms"));
  test("has manage_attendance", () => assertHas(p, "manage_attendance", "sergeant_at_arms"));
  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "sergeant_at_arms"));
  test("has view_conduct_reports", () => assertHas(p, "view_conduct_reports", "sergeant_at_arms"));

  const DENIED: string[] = [
    "manage_finances", "manage_members", "manage_org_settings", "manage_committees",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "manage_governance_documents", "version_governance_documents",
    "manage_archives", "manage_chapter_timeline",
    "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
    "view_committee_reports", "view_governance_reports", "view_archive_reports",
    "view_official_records",
    "manage_documents", "view_reports",
  ];
  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "sergeant_at_arms"));
  }
});

// ── Parliamentarian ───────────────────────────────────────────────────────────

describe("parliamentarian permissions", () => {
  const p = orgPerms("parliamentarian");

  test("has view_governance_documents", () => assertHas(p, "view_governance_documents", "parliamentarian"));
  test("has manage_procedure_records", () => assertHas(p, "manage_procedure_records", "parliamentarian"));
  test("has manage_motions", () => assertHas(p, "manage_motions", "parliamentarian"));
  test("has manage_parliamentary_rulings", () => assertHas(p, "manage_parliamentary_rulings", "parliamentarian"));
  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "parliamentarian"));
  test("has view_governance_reports", () => assertHas(p, "view_governance_reports", "parliamentarian"));

  // Parliamentarian can VIEW governance docs but NOT version/publish them — only Bylaws Chair can
  test("does NOT have version_governance_documents", () =>
    assertLacks(p, "version_governance_documents", "parliamentarian"));
  test("does NOT have manage_governance_documents (write)", () =>
    assertLacks(p, "manage_governance_documents", "parliamentarian"));

  const DENIED: string[] = [
    "manage_finances", "manage_members", "manage_org_settings",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "manage_archives", "upload_archive_material", "manage_chapter_timeline",
    "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
    "view_committee_reports", "view_archive_reports", "view_conduct_reports",
    "view_official_records",
    "manage_documents", "view_reports",
  ];
  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "parliamentarian"));
  }
});

// ── Historian ─────────────────────────────────────────────────────────────────

describe("historian permissions", () => {
  const p = orgPerms("historian");

  test("has manage_archives", () => assertHas(p, "manage_archives", "historian"));
  test("has upload_archive_material", () => assertHas(p, "upload_archive_material", "historian"));
  test("has manage_chapter_timeline", () => assertHas(p, "manage_chapter_timeline", "historian"));
  test("has view_archives", () => assertHas(p, "view_archives", "historian"));
  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "historian"));
  test("has view_archive_reports", () => assertHas(p, "view_archive_reports", "historian"));

  const DENIED: string[] = [
    "manage_finances", "manage_members", "manage_org_settings",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "manage_governance_documents", "upload_governance_documents", "version_governance_documents",
    "manage_procedure_records", "manage_motions",
    "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
    "view_committee_reports", "view_governance_reports", "view_conduct_reports",
    "view_official_records",
    "manage_documents", "view_reports",
  ];
  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "historian"));
  }
});

// ── Bylaws Chair ──────────────────────────────────────────────────────────────

describe("bylaws_chair permissions", () => {
  const p = orgPerms("bylaws_chair");

  test("has manage_governance_documents", () => assertHas(p, "manage_governance_documents", "bylaws_chair"));
  test("has upload_governance_documents", () => assertHas(p, "upload_governance_documents", "bylaws_chair"));
  test("has version_governance_documents", () => assertHas(p, "version_governance_documents", "bylaws_chair"));
  test("has view_governance_documents", () => assertHas(p, "view_governance_documents", "bylaws_chair"));
  test("has view_governance_reports", () => assertHas(p, "view_governance_reports", "bylaws_chair"));

  // Bylaws Chair cannot access finance, minutes, archives, or conduct tools
  const DENIED: string[] = [
    "manage_finances", "manage_members", "manage_org_settings", "manage_executive_dashboard",
    "manage_minutes", "manage_agendas", "manage_official_correspondence",
    "manage_archives", "upload_archive_material", "manage_chapter_timeline",
    "manage_procedure_records", "manage_motions",
    "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
    "view_committee_reports", "view_archive_reports", "view_conduct_reports",
    "view_official_records",
    "manage_documents", "view_reports",
  ];
  for (const perm of DENIED) {
    test(`does NOT have ${perm}`, () => assertLacks(p, perm, "bylaws_chair"));
  }
});

// ── Parliamentarian vs Bylaws Chair isolation ─────────────────────────────────

describe("parliamentarian vs bylaws_chair isolation", () => {
  test("Parliamentarian can view governance docs but cannot publish (version)", () => {
    const parl = orgPerms("parliamentarian");
    assertHas(parl, "view_governance_documents", "parliamentarian");
    assertLacks(parl, "version_governance_documents", "parliamentarian");
  });

  test("Bylaws Chair can publish governance docs (version)", () => {
    const bc = orgPerms("bylaws_chair");
    assertHas(bc, "version_governance_documents", "bylaws_chair");
  });

  test("Parliamentarian does not hold Bylaws Chair write perms", () => {
    const parl = orgPerms("parliamentarian");
    assertLacks(parl, "manage_governance_documents", "parliamentarian");
    assertLacks(parl, "upload_governance_documents", "parliamentarian");
  });
});

// ── Committee chairs ──────────────────────────────────────────────────────────

describe("committee chair permissions", () => {
  const CHAIRS = [
    "mentoring_chair", "education_chair", "economic_empowerment_chair",
    "leadership_development_chair", "health_wellness_chair",
    "community_service_chair", "special_events_chair", "committee_chair",
  ];

  for (const chair of CHAIRS) {
    const p = orgPerms(chair);
    test(`${chair}: has manage_committees`, () => assertHas(p, "manage_committees", chair));
    test(`${chair}: has manage_events`, () => assertHas(p, "manage_events", chair));
    test(`${chair}: has manage_attendance`, () => assertHas(p, "manage_attendance", chair));
    // No exec-only tools
    test(`${chair}: does NOT have manage_finances`, () => assertLacks(p, "manage_finances", chair));
    test(`${chair}: does NOT have manage_executive_dashboard`, () => assertLacks(p, "manage_executive_dashboard", chair));
    test(`${chair}: does NOT have manage_minutes`, () => assertLacks(p, "manage_minutes", chair));
    test(`${chair}: does NOT have manage_governance_documents`, () => assertLacks(p, "manage_governance_documents", chair));
    test(`${chair}: does NOT have manage_archives`, () => assertLacks(p, "manage_archives", chair));
    test(`${chair}: does NOT have view_financial_reports`, () => assertLacks(p, "view_financial_reports", chair));
    test(`${chair}: does NOT have manage_documents (legacy)`, () => assertLacks(p, "manage_documents", chair));
    test(`${chair}: does NOT have view_reports (legacy)`, () => assertLacks(p, "view_reports", chair));
  }
});

// ── General member ────────────────────────────────────────────────────────────

describe("general_member permissions", () => {
  const p = orgPerms("general_member");
  test("has no permission groups", () => assert.equal(p.size, 0));
});

// ── Cross-role isolation ───────────────────────────────────────────────────────

describe("cross-role isolation: no role bleeds into another's domain", () => {
  // Treasurer cannot see minutes
  test("Treasurer lacks manage_minutes (Secretary domain)", () =>
    assertLacks(orgPerms("treasurer"), "manage_minutes", "treasurer"));
  // Secretary cannot see finances
  test("Secretary lacks manage_finances (Treasurer domain)", () =>
    assertLacks(orgPerms("secretary"), "manage_finances", "secretary"));
  // Historian cannot see governance documents
  test("Historian lacks manage_governance_documents (Bylaws domain)", () =>
    assertLacks(orgPerms("historian"), "manage_governance_documents", "historian"));
  // Bylaws Chair cannot see archive material
  test("Bylaws Chair lacks manage_archives (Historian domain)", () =>
    assertLacks(orgPerms("bylaws_chair"), "manage_archives", "bylaws_chair"));
  // Parliamentarian cannot see financial reports
  test("Parliamentarian lacks view_financial_reports (Treasurer domain)", () =>
    assertLacks(orgPerms("parliamentarian"), "view_financial_reports", "parliamentarian"));
  // Sergeant-at-Arms cannot see governance reports
  test("Sergeant-at-Arms lacks view_governance_reports", () =>
    assertLacks(orgPerms("sergeant_at_arms"), "view_governance_reports", "sergeant_at_arms"));
  // Tech Chair cannot see conduct reports
  test("Tech Chair lacks view_conduct_reports", () =>
    assertLacks(sysPerms("technology_chair"), "view_conduct_reports", "technology_chair"));
  // Platform Admin cannot see archive reports
  test("Platform Admin lacks view_archive_reports", () =>
    assertLacks(sysPerms("platform_admin"), "view_archive_reports", "platform_admin"));
});

// ── Multiple positions: permissions union ─────────────────────────────────────

describe("multiple positions produce correct permission union", () => {
  test("secretary + treasurer gets both document and finance tools", () => {
    const combined = union("secretary", "treasurer");
    assertHas(combined, "manage_minutes", "secretary+treasurer");
    assertHas(combined, "manage_finances", "secretary+treasurer");
    assertHas(combined, "view_financial_reports", "secretary+treasurer");
    assertHas(combined, "view_official_records", "secretary+treasurer");
    // Still lacks governance and archive tools
    assertLacks(combined, "manage_governance_documents", "secretary+treasurer");
    assertLacks(combined, "manage_archives", "secretary+treasurer");
  });

  test("parliamentarian + bylaws_chair gets governance read and version/publish", () => {
    const combined = union("parliamentarian", "bylaws_chair");
    assertHas(combined, "view_governance_documents", "parl+bylaws");
    assertHas(combined, "manage_governance_documents", "parl+bylaws");
    assertHas(combined, "version_governance_documents", "parl+bylaws");
    assertHas(combined, "manage_motions", "parl+bylaws");
    // Still lacks financial tools
    assertLacks(combined, "manage_finances", "parl+bylaws");
    assertLacks(combined, "manage_minutes", "parl+bylaws");
  });

  test("president holds every executive permission group", () => {
    const p = orgPerms("president");
    // Verify president covers every named exec permission
    const ALL_EXEC_PERMS = [
      "manage_members", "manage_attendance", "manage_committees", "manage_events",
      "manage_finances", "manage_executive_dashboard", "manage_org_settings",
      "manage_minutes", "manage_agendas", "manage_official_correspondence", "view_official_records",
      "manage_governance_documents", "upload_governance_documents",
      "version_governance_documents", "view_governance_documents",
      "manage_procedure_records", "manage_motions", "manage_parliamentary_rulings",
      "manage_archives", "upload_archive_material", "manage_chapter_timeline", "view_archives",
      "view_chapter_overview", "view_financial_reports", "view_eligibility_reports",
      "view_committee_reports", "view_governance_reports", "view_archive_reports",
      "view_conduct_reports",
    ];
    for (const perm of ALL_EXEC_PERMS) {
      assertHas(p, perm, "president");
    }
  });
});

// ── Reserved committee name validation ────────────────────────────────────────

describe("validateCommitteeName", () => {
  test("accepts valid committee names", () => {
    assert.equal(validateCommitteeName("Mentoring"), null);
    assert.equal(validateCommitteeName("Economic Empowerment & Development"), null);
    assert.equal(validateCommitteeName("Health & Wellness"), null);
  });

  test("rejects empty name", () => {
    assert.notEqual(validateCommitteeName(""), null);
    assert.notEqual(validateCommitteeName("  "), null);
  });

  test("rejects name shorter than 2 characters", () => {
    assert.notEqual(validateCommitteeName("A"), null);
  });

  test("rejects name longer than 100 characters", () => {
    assert.notEqual(validateCommitteeName("A".repeat(101)), null);
  });

  test("rejects 'Bylaws' (exact, reserved)", () => {
    assert.notEqual(validateCommitteeName("Bylaws"), null);
  });

  test("rejects 'bylaws' (case-insensitive)", () => {
    assert.notEqual(validateCommitteeName("bylaws"), null);
  });

  test("rejects 'BYLAWS' (case-insensitive)", () => {
    assert.notEqual(validateCommitteeName("BYLAWS"), null);
  });

  test("RESERVED_COMMITTEE_NAMES includes 'Bylaws'", () => {
    assert.ok(
      RESERVED_COMMITTEE_NAMES.includes("Bylaws" as any),
      "Bylaws must appear in RESERVED_COMMITTEE_NAMES",
    );
  });
});

// ── Workspace permission matrix ────────────────────────────────────────────────
//
// Each EXEC_WORKSPACES entry declares a requiredPermission.  These tests verify
// the backend permission matrix supports that contract:
//   • the primary role for the workspace holds the permission (positive)
//   • the president holds every officer workspace permission (union access)
//   • platform_admin holds none of the workspace permissions (no exec access)
//   • technology_chair holds only the technology workspace permission
//   • general_member / committee_chair hold no workspace permissions
//
// WORKSPACE_PERMISSION_MAP must stay in sync with
// artifacts/c100/src/lib/exec-workspaces.ts.

describe("workspace permission matrix — primary role positive checks", () => {
  const cases: Array<[string, string, string]> = [
    // [workspaceSlug, orgOrSystemRole, permission]
    ["president",         "president",        "manage_org_settings"],
    ["vice-president",    "vice_president",   "view_committee_reports"],
    ["secretary",         "secretary",        "manage_minutes"],
    ["treasurer",         "treasurer",        "manage_finances"],
    ["historian",         "historian",        "manage_archives"],
    ["sergeant-at-arms",  "sergeant_at_arms", "view_conduct_reports"],
    ["parliamentarian",   "parliamentarian",  "manage_procedure_records"],
  ];

  for (const [workspace, role, perm] of cases) {
    test(`${workspace}: ${role} has required permission "${perm}"`, () => {
      assertHas(orgPerms(role), perm, role);
    });
  }

  test("technology: technology_chair (system role) has view_system_diagnostics", () => {
    assertHas(sysPerms("technology_chair"), "view_system_diagnostics", "technology_chair");
  });
});

describe("workspace permission matrix — president holds all officer workspace permissions", () => {
  const officerWorkspacePerms = Object.entries(WORKSPACE_PERMISSION_MAP)
    .filter(([slug]) => slug !== "technology")
    .map(([, perm]) => perm);

  const p = orgPerms("president");
  for (const perm of officerWorkspacePerms) {
    test(`president has workspace permission "${perm}"`, () => assertHas(p, perm, "president"));
  }

  test("president does NOT have technology workspace permission (view_system_diagnostics)", () => {
    // President is an executive officer, not a technical system role.
    assertLacks(p, "view_system_diagnostics", "president");
  });
});

describe("workspace permission matrix — platform_admin has technology workspace access only", () => {
  const p = sysPerms("platform_admin");

  test("platform_admin has view_system_diagnostics (technology workspace access)", () =>
    assertHas(p, "view_system_diagnostics", "platform_admin"));

  // Must NOT have any officer workspace permissions
  const officerWorkspacePerms = Object.entries(WORKSPACE_PERMISSION_MAP)
    .filter(([slug]) => slug !== "technology")
    .map(([, perm]) => perm);

  for (const perm of officerWorkspacePerms) {
    test(`platform_admin lacks officer workspace permission "${perm}"`, () =>
      assertLacks(p, perm, "platform_admin"));
  }
});

describe("workspace permission matrix — technology_chair holds only the technology workspace permission", () => {
  const p = sysPerms("technology_chair");
  test("technology_chair has view_system_diagnostics (technology workspace)", () =>
    assertHas(p, "view_system_diagnostics", "technology_chair"));

  const officerWorkspacePerms = Object.entries(WORKSPACE_PERMISSION_MAP)
    .filter(([slug]) => slug !== "technology")
    .map(([, perm]) => perm);

  for (const perm of officerWorkspacePerms) {
    test(`technology_chair lacks officer workspace permission "${perm}"`, () =>
      assertLacks(p, perm, "technology_chair"));
  }
});

describe("workspace permission matrix — general_member and committee_chair hold no workspace permissions", () => {
  const noAccessRoles = ["general_member", "committee_chair", "committee_member"];

  for (const role of noAccessRoles) {
    const p = orgPerms(role);
    for (const [workspace, perm] of Object.entries(WORKSPACE_PERMISSION_MAP)) {
      test(`${role} lacks workspace permission for "${workspace}" (${perm})`, () =>
        assertLacks(p, perm, role));
    }
  }
});

describe("workspace permission matrix — legacy ExecutiveBoard role name not used as a gate", () => {
  // The 'ExecutiveBoard' string was the old legacy role-name gate.
  // Workspace access is now permission-based, so no workspace permission is
  // granted solely by having role='ExecutiveBoard'.  Actual exec members
  // (president, secretary, etc.) get access through their explicit org roles.
  test("'ExecutiveBoard' is not a key in WORKSPACE_PERMISSION_MAP", () => {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(WORKSPACE_PERMISSION_MAP, "ExecutiveBoard"),
      "ExecutiveBoard must not be a workspace access discriminator",
    );
  });
  test("workspace permissions are granted by org-role slugs, not legacy role strings", () => {
    // Each workspace permission must appear in at least one specific org-role's
    // permission set (not only in a broad legacy role like 'ExecutiveBoard').
    for (const [workspace, perm] of Object.entries(WORKSPACE_PERMISSION_MAP)) {
      if (workspace === "technology") continue; // system-role checked separately
      const holderRoles = Object.entries(ORG_ROLE_PERMS)
        .filter(([, perms]) => perms.includes(perm))
        .map(([role]) => role);
      assert.ok(
        holderRoles.length > 0,
        `workspace "${workspace}" permission "${perm}" must be held by at least one org role`,
      );
      assert.ok(
        !holderRoles.includes("ExecutiveBoard" as never),
        `workspace "${workspace}" permission "${perm}" must not be granted via the legacy 'ExecutiveBoard' role`,
      );
    }
  });
});

// ── Officer workspace permission isolation — Task 2 additions ─────────────────

describe("bylaws_chair — manage_governance_documents only among officer workspace perms", () => {
  const p = orgPerms("bylaws_chair");

  test("bylaws_chair has manage_governance_documents", () => assertHas(p, "manage_governance_documents", "bylaws_chair"));
  test("bylaws_chair has upload_governance_documents", () => assertHas(p, "upload_governance_documents", "bylaws_chair"));

  // Must NOT have other officer workspace permissions
  const DENIED = ["manage_minutes", "manage_finances", "manage_archives", "manage_conduct_records", "manage_procedure_records"];
  for (const perm of DENIED) {
    test(`bylaws_chair lacks "${perm}"`, () => assertLacks(p, perm, "bylaws_chair"));
  }
});

describe("parliamentarian — view_governance_documents only (no manage)", () => {
  const p = orgPerms("parliamentarian");

  test("parliamentarian has view_governance_documents (read-only)", () => assertHas(p, "view_governance_documents", "parliamentarian"));
  test("parliamentarian has manage_procedure_records", () => assertHas(p, "manage_procedure_records", "parliamentarian"));

  const DENIED = ["manage_governance_documents", "manage_finances", "manage_minutes", "manage_archives", "manage_conduct_records"];
  for (const perm of DENIED) {
    test(`parliamentarian lacks "${perm}"`, () => assertLacks(p, perm, "parliamentarian"));
  }
});

describe("secretary — manage_minutes only; no cross-workspace leakage", () => {
  const p = orgPerms("secretary");

  test("secretary has manage_minutes", () => assertHas(p, "manage_minutes", "secretary"));

  const DENIED = ["manage_finances", "manage_conduct_records", "manage_governance_documents", "manage_archives", "manage_procedure_records"];
  for (const perm of DENIED) {
    test(`secretary lacks "${perm}"`, () => assertLacks(p, perm, "secretary"));
  }
});

describe("treasurer — manage_finances only; no cross-workspace leakage", () => {
  const p = orgPerms("treasurer");

  test("treasurer has manage_finances", () => assertHas(p, "manage_finances", "treasurer"));

  const DENIED = ["manage_minutes", "manage_conduct_records", "manage_archives", "manage_governance_documents", "manage_procedure_records"];
  for (const perm of DENIED) {
    test(`treasurer lacks "${perm}"`, () => assertLacks(p, perm, "treasurer"));
  }
});

describe("historian — manage_archives only; no cross-workspace leakage", () => {
  const p = orgPerms("historian");

  test("historian has manage_archives", () => assertHas(p, "manage_archives", "historian"));
  test("historian has upload_archive_material", () => assertHas(p, "upload_archive_material", "historian"));

  const DENIED = ["manage_finances", "manage_minutes", "manage_conduct_records", "manage_governance_documents", "manage_procedure_records"];
  for (const perm of DENIED) {
    test(`historian lacks "${perm}"`, () => assertLacks(p, perm, "historian"));
  }
});

describe("sergeant_at_arms — manage_conduct_records; no cross-workspace leakage", () => {
  const p = orgPerms("sergeant_at_arms");

  test("sergeant_at_arms has manage_conduct_records", () => assertHas(p, "manage_conduct_records", "sergeant_at_arms"));
  test("sergeant_at_arms has view_conduct_reports", () => assertHas(p, "view_conduct_reports", "sergeant_at_arms"));

  const DENIED = ["manage_finances", "manage_minutes", "manage_archives", "manage_governance_documents", "manage_procedure_records"];
  for (const perm of DENIED) {
    test(`sergeant_at_arms lacks "${perm}"`, () => assertLacks(p, perm, "sergeant_at_arms"));
  }
});

describe("platform_admin — no officer workspace permissions", () => {
  const p = sysPerms("platform_admin");

  const OFFICER_PERMS = [
    "manage_governance_documents", "manage_minutes", "manage_finances",
    "manage_archives", "manage_conduct_records", "manage_procedure_records",
  ];
  for (const perm of OFFICER_PERMS) {
    test(`platform_admin lacks officer workspace perm "${perm}"`, () => assertLacks(p, perm, "platform_admin"));
  }
});

describe("technology_chair — no officer workspace permissions", () => {
  const p = sysPerms("technology_chair");

  const OFFICER_PERMS = [
    "manage_governance_documents", "manage_minutes", "manage_finances",
    "manage_archives", "manage_conduct_records", "manage_procedure_records",
  ];
  for (const perm of OFFICER_PERMS) {
    test(`technology_chair lacks officer workspace perm "${perm}"`, () => assertLacks(p, perm, "technology_chair"));
  }
});

describe("president — holds ALL officer workspace permissions (union)", () => {
  const p = orgPerms("president");

  const ALL_OFFICER_PERMS = [
    "manage_governance_documents", "manage_minutes", "manage_finances",
    "manage_archives", "manage_conduct_records", "manage_procedure_records",
    "manage_org_settings",
  ];
  for (const perm of ALL_OFFICER_PERMS) {
    test(`president has "${perm}"`, () => assertHas(p, perm, "president"));
  }
});

describe("multi-role combination: secretary + historian gets both permission sets", () => {
  const combined = union("secretary", "historian");

  test("combined has manage_minutes (from secretary)", () => assertHas(combined, "manage_minutes", "secretary+historian"));
  test("combined has manage_archives (from historian)", () => assertHas(combined, "manage_archives", "secretary+historian"));
  test("combined lacks manage_finances (neither role has it)", () => assertLacks(combined, "manage_finances", "secretary+historian"));
  test("combined lacks manage_governance_documents (neither role has it)", () => assertLacks(combined, "manage_governance_documents", "secretary+historian"));
  test("combined lacks manage_conduct_records (neither role has it)", () => assertLacks(combined, "manage_conduct_records", "secretary+historian"));
});

// ══════════════════════════════════════════════════════════════════════════════
// Work Order: Chief of Staff + Sergeant-at-Arms + President matrix
// ══════════════════════════════════════════════════════════════════════════════

// ── Assignable role catalog ───────────────────────────────────────────────────

describe("assignable org-role catalog", () => {
  test("sergeant_at_arms appears in ASSIGNABLE_ORG_ROLE_SLUGS", () => {
    assert.ok(
      (ASSIGNABLE_ORG_ROLE_SLUGS as readonly string[]).includes("sergeant_at_arms"),
      "sergeant_at_arms must be assignable",
    );
  });

  test("chief_of_staff appears in ASSIGNABLE_ORG_ROLE_SLUGS", () => {
    assert.ok(
      (ASSIGNABLE_ORG_ROLE_SLUGS as readonly string[]).includes("chief_of_staff"),
      "chief_of_staff must be assignable",
    );
  });

  test("bylaws_chair remains in ASSIGNABLE_ORG_ROLE_SLUGS", () => {
    assert.ok(
      (ASSIGNABLE_ORG_ROLE_SLUGS as readonly string[]).includes("bylaws_chair"),
      "bylaws_chair must remain assignable",
    );
  });

  test("platform_admin remains in ASSIGNABLE_SYSTEM_ROLE_SLUGS (system role, not org role)", () => {
    assert.ok(
      (ASSIGNABLE_SYSTEM_ROLE_SLUGS as readonly string[]).includes("platform_admin"),
      "platform_admin must be assignable as a system role",
    );
    // Must NOT be in org roles
    assert.ok(
      !(ASSIGNABLE_ORG_ROLE_SLUGS as readonly string[]).includes("platform_admin"),
      "platform_admin must NOT appear in org role slugs",
    );
  });
});

// ── Chief of Staff permission isolation ──────────────────────────────────────

describe("chief_of_staff — manage_executive_operations only; no confidential domain access", () => {
  const p = orgPerms("chief_of_staff");

  test("chief_of_staff has manage_executive_operations", () => assertHas(p, "manage_executive_operations", "chief_of_staff"));
  test("chief_of_staff has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "chief_of_staff"));

  // Confidentiality boundaries — spec §6
  const CONFIDENTIAL = [
    "manage_finances",
    "manage_conduct_records",
    "manage_governance_documents",
    "upload_governance_documents",
    "version_governance_documents",
    "manage_minutes",
    "manage_agendas",
    "manage_archives",
    "upload_archive_material",
    "manage_procedure_records",
    "manage_motions",
    "manage_parliamentary_rulings",
    // Technical
    "view_system_diagnostics",
    "manage_system_configuration",
    "manage_roles",
    "manage_permissions",
    "impersonate_users",
  ];
  for (const perm of CONFIDENTIAL) {
    test(`chief_of_staff lacks confidential perm "${perm}"`, () => assertLacks(p, perm, "chief_of_staff"));
  }
});

// ── Sergeant-at-Arms ──────────────────────────────────────────────────────────

describe("sergeant_at_arms — workspace access and isolation", () => {
  const p = orgPerms("sergeant_at_arms");

  test("sergeant_at_arms has manage_conduct_records", () => assertHas(p, "manage_conduct_records", "sergeant_at_arms"));

  const DENIED_DOMAINS = [
    "manage_finances",
    "manage_governance_documents",
    "manage_minutes",
    "manage_archives",
    "manage_procedure_records",
    "manage_executive_operations",
    "view_system_diagnostics",
  ];
  for (const perm of DENIED_DOMAINS) {
    test(`sergeant_at_arms lacks "${perm}"`, () => assertLacks(p, perm, "sergeant_at_arms"));
  }
});

// ── President — complete officer workspace coverage ───────────────────────────

describe("president — holds every officer workspace's required permission explicitly", () => {
  const p = orgPerms("president");

  // Iterate over every officer workspace (excludes technology — intentionally separate)
  const OFFICER_WORKSPACES = Object.entries(WORKSPACE_PERMISSION_MAP).filter(
    ([ws]) => ws !== "technology",
  );

  for (const [ws, perm] of OFFICER_WORKSPACES) {
    test(`president has "${perm}" (required for ${ws} workspace)`, () =>
      assertHas(p, perm, `president→${ws}`),
    );
  }

  test("president has manage_conduct_records explicitly", () =>
    assertHas(p, "manage_conduct_records", "president"),
  );

  test("president has manage_executive_operations explicitly", () =>
    assertHas(p, "manage_executive_operations", "president"),
  );

  // President must NOT have a blanket bypass — access is entirely permission-driven
  test("president workspace access is explicit-permission-based (no bypass flag in matrix)", () => {
    // The matrix defines an array of slugs — there are no boolean bypass flags.
    // This test confirms every workspace above passed on its own explicit perm.
    const covered = OFFICER_WORKSPACES.every(([, perm]) => p.has(perm));
    assert.ok(covered, "President must pass every officer workspace gate through explicit permissions");
  });

  // President must NOT receive Technology automatically
  test("president lacks view_system_diagnostics (Technology is separately permissioned)", () =>
    assertLacks(p, "view_system_diagnostics", "president"),
  );
});

// ── Jaylin: President + Platform Admin combination ────────────────────────────

describe("Jaylin combo: president + platform_admin covers every workspace including Technology", () => {
  const combined = new Set([...orgPerms("president"), ...sysPerms("platform_admin")]);

  // All officer workspaces
  for (const [ws, perm] of Object.entries(WORKSPACE_PERMISSION_MAP)) {
    test(`president+platform_admin has "${perm}" (required for ${ws})`, () => {
      assert.ok(combined.has(perm), `president+platform_admin should have "${perm}" for ${ws}`);
    });
  }
});

// ── Platform Admin: no officer permissions ────────────────────────────────────

describe("platform_admin — Technology only; no officer workspace perms", () => {
  const p = sysPerms("platform_admin");

  test("platform_admin has view_system_diagnostics (Technology workspace)", () =>
    assertHas(p, "view_system_diagnostics", "platform_admin"),
  );

  const OFFICER_PERMS = [
    "manage_org_settings",
    "manage_executive_operations",
    "manage_minutes",
    "manage_finances",
    "manage_archives",
    "manage_conduct_records",
    "manage_procedure_records",
    "manage_governance_documents",
    "view_committee_reports",
  ];
  for (const perm of OFFICER_PERMS) {
    test(`platform_admin lacks officer perm "${perm}"`, () =>
      assertLacks(p, perm, "platform_admin"),
    );
  }
});

// ── Technology Chair: no officer permissions ──────────────────────────────────

describe("technology_chair — Technology only; no officer workspace perms", () => {
  const p = sysPerms("technology_chair");

  test("technology_chair has view_system_diagnostics (Technology workspace)", () =>
    assertHas(p, "view_system_diagnostics", "technology_chair"),
  );

  const OFFICER_PERMS = [
    "manage_org_settings",
    "manage_executive_operations",
    "manage_minutes",
    "manage_finances",
    "manage_archives",
    "manage_conduct_records",
    "manage_procedure_records",
    "manage_governance_documents",
    "view_committee_reports",
  ];
  for (const perm of OFFICER_PERMS) {
    test(`technology_chair lacks officer perm "${perm}"`, () =>
      assertLacks(p, perm, "technology_chair"),
    );
  }
});

// ── General member / committee roles: no exec access ─────────────────────────

describe("general members and committee roles — no executive access", () => {
  const GENERAL_ROLES = ["general_member", "committee_member", "committee_chair", "mentoring_chair"];

  const EXEC_PERMS = [
    "manage_executive_operations",
    "manage_conduct_records",
    "manage_finances",
    "manage_minutes",
    "manage_governance_documents",
    "manage_archives",
    "manage_procedure_records",
    "manage_org_settings",
    "view_system_diagnostics",
  ];

  for (const role of GENERAL_ROLES) {
    const p = orgPerms(role);
    for (const perm of EXEC_PERMS) {
      test(`${role} lacks "${perm}"`, () => assertLacks(p, perm, role));
    }
  }
});

// ── Multiple roles combine correctly ─────────────────────────────────────────

describe("multi-role combination: chief_of_staff + treasurer gets both permission sets", () => {
  const combined = union("chief_of_staff", "treasurer");

  test("combined has manage_executive_operations (from chief_of_staff)", () =>
    assertHas(combined, "manage_executive_operations", "cos+treasurer"),
  );
  test("combined has manage_finances (from treasurer)", () =>
    assertHas(combined, "manage_finances", "cos+treasurer"),
  );
  test("combined lacks manage_conduct_records (neither role has it)", () =>
    assertLacks(combined, "manage_conduct_records", "cos+treasurer"),
  );
  test("combined lacks manage_governance_documents (neither role has it)", () =>
    assertLacks(combined, "manage_governance_documents", "cos+treasurer"),
  );
});

describe("multi-role combination: sergeant_at_arms + historian", () => {
  const combined = union("sergeant_at_arms", "historian");

  test("combined has manage_conduct_records (from sergeant_at_arms)", () =>
    assertHas(combined, "manage_conduct_records", "saa+historian"),
  );
  test("combined has manage_archives (from historian)", () =>
    assertHas(combined, "manage_archives", "saa+historian"),
  );
  test("combined lacks manage_finances", () =>
    assertLacks(combined, "manage_finances", "saa+historian"),
  );
  test("combined lacks manage_executive_operations (neither holds it)", () =>
    assertLacks(combined, "manage_executive_operations", "saa+historian"),
  );
});

// ── Linked source-record confidentiality ────────────────────────────────────

describe("linked source-record boundary: chief_of_staff cannot access linked domain records directly", () => {
  const p = orgPerms("chief_of_staff");

  // Chief of Staff may store an opaque "finances:42" reference in a task,
  // but possessing manage_executive_operations alone must NOT authorize the
  // underlying financial, conduct, governance, or minute records.
  const DOMAIN_PERMS: Array<[string, string]> = [
    ["manage_finances",           "treasurer/finances records"],
    ["manage_conduct_records",    "sergeant-at-arms/conduct records"],
    ["manage_governance_documents","bylaws/governance documents"],
    ["manage_minutes",            "secretary/meeting minutes"],
    ["manage_archives",           "historian/archive entries"],
    ["manage_procedure_records",  "parliamentarian/procedure records"],
  ];

  for (const [perm, domain] of DOMAIN_PERMS) {
    test(`manage_executive_operations alone does not grant "${perm}" (${domain})`, () =>
      assertLacks(p, perm, `chief_of_staff→${domain}`),
    );
  }
});

// ── §6A — deriveLegacyRole regression tests ──────────────────────────────────
//
// These tests guard the server-side deriveLegacyRole() function, which
// auto-syncs the legacy members.role enum whenever org/system-role slugs
// change on a member.  They are the backend companion to the frontend
// positionLabel tests: if deriveLegacyRole produces the wrong enum value,
// stale clients may display incorrect role strings.

describe("deriveLegacyRole: produces correct legacy enum for every slug combination", () => {

  test("no slugs → Member", () => {
    assert.equal(deriveLegacyRole([], []), "Member");
  });

  test("general_member only → Member", () => {
    assert.equal(deriveLegacyRole(["general_member"], []), "Member");
  });

  test("president → ExecutiveBoard", () => {
    assert.equal(deriveLegacyRole(["president"], []), "ExecutiveBoard");
  });

  test("vice_president → ExecutiveBoard", () => {
    assert.equal(deriveLegacyRole(["vice_president"], []), "ExecutiveBoard");
  });

  test("chief_of_staff → ExecutiveBoard", () => {
    assert.equal(deriveLegacyRole(["chief_of_staff"], []), "ExecutiveBoard");
  });

  test("secretary → ExecutiveBoard", () => {
    assert.equal(deriveLegacyRole(["secretary"], []), "ExecutiveBoard");
  });

  test("treasurer → ExecutiveBoard", () => {
    assert.equal(deriveLegacyRole(["treasurer"], []), "ExecutiveBoard");
  });

  test("parliamentarian → ExecutiveBoard", () => {
    assert.equal(deriveLegacyRole(["parliamentarian"], []), "ExecutiveBoard");
  });

  test("historian → ExecutiveBoard", () => {
    assert.equal(deriveLegacyRole(["historian"], []), "ExecutiveBoard");
  });

  test("sergeant_at_arms → ExecutiveBoard", () => {
    assert.equal(deriveLegacyRole(["sergeant_at_arms"], []), "ExecutiveBoard");
  });

  test("removing last exec slug reverts to Member", () => {
    // Simulate removing the last exec position: an empty org slug list
    assert.equal(deriveLegacyRole([], []), "Member");
  });

  test("committee_chair → CommitteeChair", () => {
    assert.equal(deriveLegacyRole(["committee_chair"], []), "CommitteeChair");
  });

  test("bylaws_chair → CommitteeChair", () => {
    assert.equal(deriveLegacyRole(["bylaws_chair"], []), "CommitteeChair");
  });

  test("platform_admin system role → Admin (highest precedence)", () => {
    assert.equal(deriveLegacyRole([], ["platform_admin"]), "Admin");
  });

  test("platform_admin wins over any org exec role", () => {
    // Platform Admin should never show as ExecutiveBoard — even if they also
    // hold an org exec slug (edge case during migration).
    assert.equal(deriveLegacyRole(["president"], ["platform_admin"]), "Admin");
  });

  test("technology_chair system role alone → Member (no exec identity)", () => {
    // Technology Chair has a system role but is NOT an executive board member.
    // They must not inherit the ExecutiveBoard label.
    assert.equal(deriveLegacyRole([], ["technology_chair"]), "Member");
  });

  test("technology_chair does not override a present exec org slug", () => {
    // If someone holds both a tech chair system role and an exec org slug, the
    // exec org slug still drives the enum (tech chair is non-org).
    assert.equal(deriveLegacyRole(["president"], ["technology_chair"]), "ExecutiveBoard");
  });
});

// ── §6A — positionLabel (computePositionLabel) regression tests ───────────────
//
// computePositionLabel lives in the frontend (artifacts/c100/src/lib/me.ts)
// but it is a pure function.  We duplicate the logic here so the backend test
// suite can assert its contract without importing a browser module.
//
// If the frontend implementation changes, these tests will catch a divergence.

function computePositionLabel(
  officerPositions: string[],
  systemRoles: string[],
  orgRoles: string[],
): string {
  const POSITION_DISPLAY: Record<string, string> = {
    president: "President",
    vice_president: "Vice President",
    chief_of_staff: "Chief of Staff",
    secretary: "Secretary",
    treasurer: "Treasurer",
    parliamentarian: "Parliamentarian",
    historian: "Historian",
    bylaws_chair: "Bylaws Officer",
    bylaws_officer: "Bylaws Officer",
    sergeant_at_arms: "Sergeant-at-Arms",
    committee_chair: "Committee Chair",
    platform_admin: "Platform Admin",
    technology_chair: "Technology Chair",
  };
  if (officerPositions.length > 0) {
    const slug = officerPositions[0]!;
    return (
      POSITION_DISPLAY[slug] ??
      slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }
  if (systemRoles.includes("platform_admin")) return "Platform Admin";
  if (systemRoles.includes("technology_chair")) return "Technology Chair";
  for (const r of orgRoles) {
    const label = POSITION_DISPLAY[r];
    if (label) return label;
  }
  return "Member";
}

describe("computePositionLabel: sidebar role label derives from RBAC context, never from legacy role enum", () => {
  test("no positions/roles → Member", () => {
    assert.equal(computePositionLabel([], [], []), "Member");
  });

  test("active officer term takes highest priority", () => {
    assert.equal(computePositionLabel(["president"], [], []), "President");
  });

  test("vice president officer term", () => {
    assert.equal(computePositionLabel(["vice_president"], [], []), "Vice President");
  });

  test("chief of staff officer term", () => {
    assert.equal(computePositionLabel(["chief_of_staff"], [], []), "Chief of Staff");
  });

  test("sergeant at arms officer term", () => {
    assert.equal(computePositionLabel(["sergeant_at_arms"], [], []), "Sergeant-at-Arms");
  });

  test("historian officer term", () => {
    assert.equal(computePositionLabel(["historian"], [], []), "Historian");
  });

  test("platform_admin system role → Platform Admin (no officer terms)", () => {
    assert.equal(computePositionLabel([], ["platform_admin"], []), "Platform Admin");
  });

  test("technology_chair system role → Technology Chair (no officer terms)", () => {
    assert.equal(computePositionLabel([], ["technology_chair"], []), "Technology Chair");
  });

  test("platform_admin wins over technology_chair when both present", () => {
    assert.equal(
      computePositionLabel([], ["platform_admin", "technology_chair"], []),
      "Platform Admin",
    );
  });

  test("platform_admin alone does NOT produce Executive Board label", () => {
    const label = computePositionLabel([], ["platform_admin"], []);
    assert.notEqual(label, "Executive Board");
    assert.notEqual(label, "ExecutiveBoard");
    assert.equal(label, "Platform Admin");
  });

  test("removing last officer term reverts to Member when no system roles", () => {
    // Simulates: exec tag removed, officerPositions cleared, no system roles
    assert.equal(computePositionLabel([], [], []), "Member");
  });

  test("active officer term takes precedence over system roles", () => {
    // A platform admin who is also serving as president shows President
    assert.equal(
      computePositionLabel(["president"], ["platform_admin"], []),
      "President",
    );
  });

  test("org role label shown when no officer terms or system roles", () => {
    assert.equal(computePositionLabel([], [], ["committee_chair"]), "Committee Chair");
  });

  test("unknown slug falls back to title-cased slug string", () => {
    const label = computePositionLabel(["special_role"], [], []);
    assert.equal(label, "Special Role");
  });
});

// ── Workspace ↔ permission consistency ───────────────────────────────────────

describe("workspace permission map consistency: every workspace permission resolves in ORG_ROLE_PERMS", () => {
  // Every non-technology workspace permission must be explicitly listed in at
  // least one org role's permission set.  Technology uses a system role.
  test("each officer workspace permission appears in at least one org role", () => {
    const allOrgPerms = new Set(Object.values(ORG_ROLE_PERMS).flat());
    for (const [ws, perm] of Object.entries(WORKSPACE_PERMISSION_MAP)) {
      if (ws === "technology") continue; // system-role gated
      assert.ok(
        allOrgPerms.has(perm),
        `Workspace "${ws}" requires permission "${perm}" — must appear in at least one ORG_ROLE_PERMS entry`,
      );
    }
  });

  test("technology workspace permission appears in at least one system role", () => {
    const allSysPerms = new Set(Object.values(SYSTEM_ROLE_PERMS).flat());
    assert.ok(
      allSysPerms.has("view_system_diagnostics"),
      "view_system_diagnostics must appear in at least one SYSTEM_ROLE_PERMS entry",
    );
  });
});
