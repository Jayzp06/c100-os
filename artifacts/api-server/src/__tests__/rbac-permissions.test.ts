/**
 * RBAC permission matrix regression tests.
 *
 * Asserts that each org/system role holds exactly the permission groups it
 * should own, and that specific positions are denied tools belonging to
 * other positions.  Tests import directly from rbac-matrix.ts so that every
 * reseed automatically re-validates the spec.
 *
 * Run with:
 *   cd artifacts/api-server && pnpm exec tsx --test src/__tests__/rbac-permissions.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ORG_ROLE_PERMS, SYSTEM_ROLE_PERMS } from "../../../../lib/db/src/rbac-matrix.js";
import { RESERVED_COMMITTEE_NAMES, validateCommitteeName } from "../routes/committees.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function orgPerms(slug: string): Set<string> {
  return new Set(ORG_ROLE_PERMS[slug] ?? []);
}

function sysPerms(slug: string): Set<string> {
  return new Set(SYSTEM_ROLE_PERMS[slug] ?? []);
}

function assertHas(set: Set<string>, perm: string, label: string) {
  assert.ok(set.has(perm), `${label} should have "${perm}"`);
}

function assertLacks(set: Set<string>, perm: string, label: string) {
  assert.ok(!set.has(perm), `${label} must NOT have "${perm}"`);
}

// ── Org role matrix ───────────────────────────────────────────────────────────

describe("treasurer permissions", () => {
  const p = orgPerms("treasurer");

  test("has manage_finances", () => assertHas(p, "manage_finances", "treasurer"));
  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "treasurer"));
  test("has view_reports", () => assertHas(p, "view_reports", "treasurer"));

  // Negative — treasurer must not hold other positions' exclusive tools
  test("does NOT have manage_documents (Secretary)", () => assertLacks(p, "manage_documents", "treasurer"));
  test("does NOT have manage_members", () => assertLacks(p, "manage_members", "treasurer"));
  test("does NOT have manage_committees", () => assertLacks(p, "manage_committees", "treasurer"));
  test("does NOT have manage_events", () => assertLacks(p, "manage_events", "treasurer"));
  test("does NOT have manage_attendance", () => assertLacks(p, "manage_attendance", "treasurer"));
});

describe("secretary permissions", () => {
  const p = orgPerms("secretary");

  test("has manage_documents", () => assertHas(p, "manage_documents", "secretary"));
  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "secretary"));
  test("has view_reports", () => assertHas(p, "view_reports", "secretary"));

  // Negative
  test("does NOT have manage_finances (Treasurer)", () => assertLacks(p, "manage_finances", "secretary"));
  test("does NOT have manage_members", () => assertLacks(p, "manage_members", "secretary"));
  test("does NOT have manage_events", () => assertLacks(p, "manage_events", "secretary"));
});

describe("sergeant-at-arms permissions", () => {
  const p = orgPerms("sergeant_at_arms");

  test("has manage_events", () => assertHas(p, "manage_events", "sergeant_at_arms"));
  test("has manage_attendance", () => assertHas(p, "manage_attendance", "sergeant_at_arms"));
  test("has manage_executive_dashboard", () => assertHas(p, "manage_executive_dashboard", "sergeant_at_arms"));

  // Negative — does not manage reports, finances, or documents
  test("does NOT have view_reports", () => assertLacks(p, "view_reports", "sergeant_at_arms"));
  test("does NOT have manage_finances", () => assertLacks(p, "manage_finances", "sergeant_at_arms"));
  test("does NOT have manage_documents", () => assertLacks(p, "manage_documents", "sergeant_at_arms"));
});

describe("historian permissions", () => {
  const p = orgPerms("historian");

  test("has manage_documents", () => assertHas(p, "manage_documents", "historian"));
  test("has view_reports", () => assertHas(p, "view_reports", "historian"));

  // Negative — historian is appointed, not executive board
  test("does NOT have manage_finances", () => assertLacks(p, "manage_finances", "historian"));
  test("does NOT have manage_executive_dashboard", () => assertLacks(p, "manage_executive_dashboard", "historian"));
  test("does NOT have manage_members", () => assertLacks(p, "manage_members", "historian"));
});

describe("parliamentarian permissions", () => {
  const p = orgPerms("parliamentarian");

  test("has manage_documents", () => assertHas(p, "manage_documents", "parliamentarian"));
  test("has view_reports", () => assertHas(p, "view_reports", "parliamentarian"));

  test("does NOT have manage_finances", () => assertLacks(p, "manage_finances", "parliamentarian"));
  test("does NOT have manage_executive_dashboard", () => assertLacks(p, "manage_executive_dashboard", "parliamentarian"));
});

describe("bylaws_chair permissions", () => {
  const p = orgPerms("bylaws_chair");

  test("has manage_documents", () => assertHas(p, "manage_documents", "bylaws_chair"));
  test("has view_reports", () => assertHas(p, "view_reports", "bylaws_chair"));

  // Negative
  test("does NOT have manage_finances", () => assertLacks(p, "manage_finances", "bylaws_chair"));
  test("does NOT have manage_executive_dashboard", () => assertLacks(p, "manage_executive_dashboard", "bylaws_chair"));
});

describe("committee chair permissions", () => {
  const p = orgPerms("committee_chair");

  test("has manage_committees", () => assertHas(p, "manage_committees", "committee_chair"));
  test("has manage_events", () => assertHas(p, "manage_events", "committee_chair"));
  test("has manage_attendance", () => assertHas(p, "manage_attendance", "committee_chair"));

  // Committee chairs do not get executive dashboard or financial tools
  test("does NOT have manage_finances", () => assertLacks(p, "manage_finances", "committee_chair"));
  test("does NOT have manage_documents", () => assertLacks(p, "manage_documents", "committee_chair"));
  test("does NOT have manage_executive_dashboard", () => assertLacks(p, "manage_executive_dashboard", "committee_chair"));
  test("does NOT have view_reports", () => assertLacks(p, "view_reports", "committee_chair"));
});

describe("president permissions (broad access is by design)", () => {
  const p = orgPerms("president");
  const ALL_EXEC = [
    "manage_members", "manage_attendance", "manage_committees", "manage_events",
    "manage_finances", "manage_documents", "manage_executive_dashboard",
    "manage_org_settings", "view_reports",
  ];
  for (const perm of ALL_EXEC) {
    test(`has ${perm}`, () => assertHas(p, perm, "president"));
  }
});

describe("general_member permissions", () => {
  const p = orgPerms("general_member");
  test("has no permission groups", () => assert.equal(p.size, 0));
});

// ── bylaws_officer removed (consolidated) ─────────────────────────────────────

describe("bylaws_officer removal", () => {
  test("bylaws_officer is not present in ORG_ROLE_PERMS", () => {
    assert.equal(
      Object.prototype.hasOwnProperty.call(ORG_ROLE_PERMS, "bylaws_officer"),
      false,
      "bylaws_officer must be removed from the permission matrix (consolidated into bylaws_chair)",
    );
  });
});

// ── System role matrix ────────────────────────────────────────────────────────

describe("platform_admin permissions (technical-only)", () => {
  const p = sysPerms("platform_admin");

  // Technical tools it should have
  test("has manage_members", () => assertHas(p, "manage_members", "platform_admin"));
  test("has manage_attendance", () => assertHas(p, "manage_attendance", "platform_admin"));
  test("has manage_committees", () => assertHas(p, "manage_committees", "platform_admin"));
  test("has manage_events", () => assertHas(p, "manage_events", "platform_admin"));
  test("has manage_org_settings", () => assertHas(p, "manage_org_settings", "platform_admin"));
  test("has view_reports", () => assertHas(p, "view_reports", "platform_admin"));
  test("has manage_system_settings", () => assertHas(p, "manage_system_settings", "platform_admin"));
  test("has manage_roles", () => assertHas(p, "manage_roles", "platform_admin"));
  test("has manage_permissions", () => assertHas(p, "manage_permissions", "platform_admin"));
  test("has impersonate_users", () => assertHas(p, "impersonate_users", "platform_admin"));
  test("has view_audit_logs", () => assertHas(p, "view_audit_logs", "platform_admin"));
  test("has deploy_desktop", () => assertHas(p, "deploy_desktop", "platform_admin"));

  // Executive-only tools it must NOT have
  test("does NOT have manage_finances", () => assertLacks(p, "manage_finances", "platform_admin"));
  test("does NOT have manage_documents", () => assertLacks(p, "manage_documents", "platform_admin"));
  test("does NOT have manage_executive_dashboard", () => assertLacks(p, "manage_executive_dashboard", "platform_admin"));
});

describe("technology_chair permissions (technical superuser)", () => {
  const p = sysPerms("technology_chair");

  test("has manage_system_settings", () => assertHas(p, "manage_system_settings", "technology_chair"));
  test("has manage_roles", () => assertHas(p, "manage_roles", "technology_chair"));
  test("has impersonate_users", () => assertHas(p, "impersonate_users", "technology_chair"));
  test("has deploy_desktop", () => assertHas(p, "deploy_desktop", "technology_chair"));

  // Tech Chair is technical-only by permission groups; blanket access comes
  // from the isTechSuperuser() bypass in the route middleware, not from perms.
  test("does NOT have manage_finances", () => assertLacks(p, "manage_finances", "technology_chair"));
  test("does NOT have manage_executive_dashboard", () => assertLacks(p, "manage_executive_dashboard", "technology_chair"));
});

// ── Cross-role isolation ──────────────────────────────────────────────────────

describe("cross-role isolation: Treasurer denied Secretary tools", () => {
  const treasurer = orgPerms("treasurer");
  const secretary = orgPerms("secretary");

  // Treasurer cannot access what Secretary has exclusively
  test("Treasurer lacks manage_documents", () => assertLacks(treasurer, "manage_documents", "treasurer"));
  // Secretary cannot access what Treasurer has exclusively
  test("Secretary lacks manage_finances", () => assertLacks(secretary, "manage_finances", "secretary"));
});

describe("cross-role isolation: committee chairs denied executive tools", () => {
  const chairs = [
    "mentoring_chair", "education_chair", "economic_empowerment_chair",
    "leadership_development_chair", "health_wellness_chair",
    "community_service_chair", "special_events_chair", "committee_chair",
  ];
  const execOnly = ["manage_finances", "manage_documents", "manage_executive_dashboard"];

  for (const chair of chairs) {
    for (const perm of execOnly) {
      test(`${chair} lacks ${perm}`, () => assertLacks(orgPerms(chair), perm, chair));
    }
  }
});

// ── Reserved committee name validation ───────────────────────────────────────

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
