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

// ── Workspace permission matrix ───────────────────────────────────────────────
// Mirror the EXEC_WORKSPACES entries from the frontend lib so the backend can
// assert the contract without importing a frontend module. This list must stay
// in sync with artifacts/c100/src/lib/exec-workspaces.ts.
const WORKSPACE_PERMISSION_MAP: Record<string, string> = {
  president:        "manage_org_settings",
  "vice-president": "view_committee_reports",
  secretary:        "manage_minutes",
  treasurer:        "manage_finances",
  historian:        "manage_archives",
  "sergeant-at-arms": "view_conduct_reports",
  parliamentarian:  "manage_procedure_records",
  technology:       "view_system_diagnostics",
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

describe("platform_admin permissions — technical account-admin only", () => {
  const p = sysPerms("platform_admin");

  // Should have these account/system-admin perms
  const ADMIN_PERMS = [
    "manage_members",
    "manage_system_settings", "manage_roles", "manage_permissions",
    "impersonate_users", "view_audit_logs", "deploy_desktop",
  ];

  for (const perm of ADMIN_PERMS) {
    test(`has ${perm}`, () => assertHas(p, perm, "platform_admin"));
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
    "view_system_diagnostics", "manage_system_configuration", "view_release_information",
    "manage_update_configuration", "troubleshoot_authentication", "view_technical_audit_logs",
    "manage_integrations", "impersonate_for_support",
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

describe("workspace permission matrix — platform_admin holds no exec-suite workspace permissions", () => {
  const p = sysPerms("platform_admin");
  for (const [workspace, perm] of Object.entries(WORKSPACE_PERMISSION_MAP)) {
    test(`platform_admin lacks workspace permission for "${workspace}" (${perm})`, () =>
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
