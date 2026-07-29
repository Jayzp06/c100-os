/**
 * RBAC seed + back-fill script.
 *
 * Idempotent — safe to run multiple times.
 *
 * What it does:
 *  1. Seeds the default FVSU Trailblazing organization
 *  2. Seeds all built-in system roles
 *  3. Seeds all built-in org roles for the default org
 *  4. Seeds permission groups and permissions
 *  5. Seeds system_role_permissions and org_role_permissions
 *  6. Seeds role_incompatibilities
 *  7. Back-fills member_system_roles + member_org_roles from legacy members.role
 *  8. Links existing members and org_settings to the default organization
 *
 * Usage:
 *   node --import tsx/esm ./src/seed-rbac.ts
 *   (also called as part of: pnpm --filter @workspace/scripts run seed-c100)
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "./schema/index.js";
import {
  organizationsTable,
  systemRolesTable,
  orgRolesTable,
  permissionGroupsTable,
  permissionsTable,
  systemRolePermissionsTable,
  orgRolePermissionsTable,
  memberSystemRolesTable,
  memberOrgRolesTable,
  roleIncompatibilitiesTable,
  membersTable,
  orgSettingsTable,
} from "./schema/index.js";
import { SYSTEM_ROLE_PERMS, ORG_ROLE_PERMS } from "./rbac-matrix.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ─── Built-in data ─────────────────────────────────────────────────────────────

const DEFAULT_ORG = {
  slug: "fvsu-trailblazing",
  name: "Collegiate 100 — Trailblazing Chapter",
  shortName: "Trailblazing",
};

const SYSTEM_ROLES = [
  { slug: "platform_admin",    name: "Platform Administrator", description: "Full platform access. Manages all members, settings, and system configuration.", sortOrder: 0 },
  { slug: "technology_chair",  name: "Technology Chair",       description: "Technical platform administration: user management, role assignment, org config, audit logs, desktop deployment.", sortOrder: 1 },
  { slug: "developer",         name: "Developer",              description: "Read-all access, impersonation for testing, and debug utilities.", sortOrder: 2 },
  { slug: "system_auditor",    name: "System Auditor",         description: "Read-only access to audit logs, member data, and all platform records.", sortOrder: 3 },
  { slug: "readonly_auditor",  name: "Read-Only Auditor",      description: "Read-only access to non-PII organizational data.", sortOrder: 4 },
] as const;

const ORG_ROLE_TIERS = {
  executive_board:      "executive_board",
  appointed_officer:    "appointed_officer",
  committee_leadership: "committee_leadership",
  committee_member:     "committee_member",
  general_member:       "general_member",
  advisor:              "advisor",
  parent_chapter:       "parent_chapter",
} as const;

const ORG_ROLES = [
  // Executive Board
  { slug: "president",              name: "President",                           tier: "executive_board",      sortOrder: 10 },
  { slug: "vice_president",         name: "Vice President",                      tier: "executive_board",      sortOrder: 11 },
  { slug: "secretary",              name: "Secretary",                           tier: "executive_board",      sortOrder: 12 },
  { slug: "treasurer",              name: "Treasurer",                           tier: "executive_board",      sortOrder: 13 },
  { slug: "chief_of_staff",         name: "Chief of Staff",                      tier: "executive_board",      sortOrder: 14 },
  { slug: "sergeant_at_arms",       name: "Sergeant-at-Arms",                    tier: "executive_board",      sortOrder: 15 },
  // Appointed Officers
  { slug: "membership_director",    name: "Membership Director",                 tier: "appointed_officer",    sortOrder: 20 },
  { slug: "communications_director",name: "Communications & Marketing Director", tier: "appointed_officer",    sortOrder: 21 },
  { slug: "parliamentarian",        name: "Parliamentarian",                     tier: "appointed_officer",    sortOrder: 22 },
  { slug: "historian",              name: "Historian",                           tier: "appointed_officer",    sortOrder: 23 },
  // bylaws_officer removed — consolidated into bylaws_chair
  // Committee Leadership
  { slug: "mentoring_chair",              name: "Mentoring Chair",               tier: "committee_leadership", sortOrder: 30 },
  { slug: "education_chair",              name: "Education Chair",               tier: "committee_leadership", sortOrder: 31 },
  { slug: "economic_empowerment_chair",   name: "Economic Empowerment & Development Chair", tier: "committee_leadership", sortOrder: 32 },
  { slug: "leadership_development_chair", name: "Leadership Development Chair",  tier: "committee_leadership", sortOrder: 33 },
  { slug: "health_wellness_chair",        name: "Health & Wellness Chair",       tier: "committee_leadership", sortOrder: 34 },
  { slug: "community_service_chair",      name: "Community Service Chair",       tier: "committee_leadership", sortOrder: 35 },
  { slug: "special_events_chair",         name: "Special Events Chair",          tier: "committee_leadership", sortOrder: 36 },
  { slug: "committee_chair",              name: "Committee Chair",               tier: "committee_leadership", sortOrder: 37 },
  { slug: "bylaws_chair",                 name: "Bylaws Chair",                  tier: "committee_leadership", sortOrder: 38 },
  // General
  { slug: "committee_member",       name: "Committee Member",                    tier: "committee_member",     sortOrder: 40 },
  { slug: "general_member",         name: "General Member",                      tier: "general_member",       sortOrder: 50 },
  { slug: "advisor",                name: "Advisor",                             tier: "advisor",              sortOrder: 60 },
  { slug: "parent_chapter_rep",     name: "Parent Chapter Representative",       tier: "parent_chapter",       sortOrder: 70 },
] as const;

// Permission groups — scope: "org" or "system"
const PERM_GROUPS = [
  { slug: "manage_members",             name: "Manage Members",              scope: "org",    description: "View, create, update, and deactivate chapter members" },
  { slug: "manage_attendance",          name: "Manage Attendance",           scope: "org",    description: "Record, correct, and override event attendance" },
  { slug: "manage_committees",          name: "Manage Committees",           scope: "org",    description: "Create and manage committees and assignments" },
  { slug: "manage_events",              name: "Manage Events",               scope: "org",    description: "Create, edit, and cancel chapter events" },
  { slug: "manage_finances",            name: "Manage Finances",             scope: "org",    description: "Financial dashboard, budget, dues, and reporting" },
  { slug: "manage_documents",           name: "Manage Documents",            scope: "org",    description: "Upload, version, and publish chapter documents" },
  { slug: "manage_executive_dashboard", name: "Manage Executive Dashboard",  scope: "org",    description: "Access executive overview and cross-committee analytics" },
  { slug: "manage_org_settings",        name: "Manage Org Settings",         scope: "org",    description: "Update chapter name, branding, and eligibility thresholds" },
  { slug: "manage_nudges",              name: "Manage Nudges",               scope: "org",    description: "Review, send, and configure member accountability nudges" },
  { slug: "view_reports",               name: "View Reports",                scope: "org",    description: "Access scholarship, conference, and chapter eligibility reports" },
  { slug: "manage_system_settings",     name: "Manage System Settings",      scope: "system", description: "Platform-level configuration, integrations, and feature flags" },
  { slug: "manage_roles",               name: "Manage Roles",                scope: "system", description: "Assign and remove system and org roles for any member" },
  { slug: "manage_permissions",         name: "Manage Permissions",          scope: "system", description: "Configure permission group assignments to roles" },
  { slug: "impersonate_users",          name: "Impersonate Users",           scope: "system", description: "Assume any org role for testing and administration" },
  { slug: "view_audit_logs",            name: "View Audit Logs",             scope: "system", description: "Read the full system audit log" },
  { slug: "deploy_desktop",             name: "Deploy Desktop",              scope: "system", description: "Publish desktop application releases and manage update channels" },
] as const;

// Permissions within each group — slug: "<resource>:<action>"
const PERMISSIONS_BY_GROUP: Record<string, Array<{ slug: string; name: string }>> = {
  manage_members: [
    { slug: "members:read",    name: "View members" },
    { slug: "members:write",   name: "Create and update members" },
    { slug: "members:deactivate", name: "Deactivate member accounts" },
    { slug: "members:import",  name: "Bulk import members" },
  ],
  manage_attendance: [
    { slug: "attendance:read",    name: "View attendance records" },
    { slug: "attendance:write",   name: "Record attendance" },
    { slug: "attendance:correct", name: "Override and correct attendance" },
  ],
  manage_committees: [
    { slug: "committees:read",   name: "View committees" },
    { slug: "committees:write",  name: "Create and edit committees" },
    { slug: "committees:assign", name: "Assign members to committees" },
    { slug: "committees:roster", name: "View committee rosters" },
  ],
  manage_events: [
    { slug: "events:read",   name: "View events" },
    { slug: "events:write",  name: "Create and edit events" },
    { slug: "events:delete", name: "Cancel events" },
    { slug: "events:qr",     name: "Activate and manage QR check-in" },
  ],
  manage_finances: [
    { slug: "finances:read",   name: "View financial records" },
    { slug: "finances:write",  name: "Manage budget and transactions" },
    { slug: "finances:report", name: "Generate financial reports" },
  ],
  manage_documents: [
    { slug: "documents:read",   name: "View documents" },
    { slug: "documents:write",  name: "Upload and publish documents" },
    { slug: "documents:delete", name: "Remove documents" },
  ],
  manage_executive_dashboard: [
    { slug: "exec_dashboard:read", name: "View executive dashboard" },
  ],
  manage_org_settings: [
    { slug: "org_settings:read",  name: "View org settings" },
    { slug: "org_settings:write", name: "Update org settings" },
  ],
  manage_nudges: [
    { slug: "nudges:read",  name: "View nudges" },
    { slug: "nudges:send",  name: "Send nudges" },
    { slug: "nudges:run",   name: "Run automated nudge cycle" },
  ],
  view_reports: [
    { slug: "reports:read", name: "Access eligibility and chapter reports" },
  ],
  manage_system_settings: [
    { slug: "system:read",  name: "View system settings" },
    { slug: "system:write", name: "Update system configuration" },
  ],
  manage_roles: [
    { slug: "roles:read",   name: "View role assignments" },
    { slug: "roles:assign", name: "Assign roles to members" },
    { slug: "roles:remove", name: "Remove roles from members" },
  ],
  manage_permissions: [
    { slug: "permissions:read",  name: "View permission assignments" },
    { slug: "permissions:write", name: "Configure role permissions" },
  ],
  impersonate_users: [
    { slug: "impersonate:start", name: "Start role impersonation session" },
    { slug: "impersonate:end",   name: "End role impersonation session" },
  ],
  view_audit_logs: [
    { slug: "audit:read", name: "View audit log entries" },
  ],
  deploy_desktop: [
    { slug: "desktop:publish", name: "Publish desktop application release" },
    { slug: "desktop:channel", name: "Manage update channels" },
  ],
};

// System role → permission groups (imported from rbac-matrix.ts)
// Org role → permission groups (imported from rbac-matrix.ts)

// Incompatible org role pairs (both directions are enforced)
const INCOMPATIBLE_PAIRS = [
  ["president", "vice_president"],
  ["president", "secretary"],
  ["president", "treasurer"],
  ["vice_president", "treasurer"],
  ["secretary", "treasurer"],
];

// Legacy role → RBAC mappings for back-fill
const LEGACY_TO_SYSTEM_ROLE: Record<string, string | undefined> = {
  Admin:          "platform_admin",
  TechnologyChair:"technology_chair",
};

const LEGACY_TO_ORG_ROLE: Record<string, string> = {
  Member:         "general_member",
  CommitteeChair: "general_member", // + committee_leadership role added via officer_terms/committee_assignments
  BylawsChair:    "general_member",
  ExecutiveBoard: "general_member", // + exec role added via officer_terms
  Admin:          "general_member",
  TechnologyChair:"general_member",
};

// ─── Main ──────────────────────────────────────────────────────────────────────

export async function seedRbac() {
  console.log("[seed-rbac] Starting RBAC seed + back-fill...");

  // 1. Default organization
  const [org] = await db
    .insert(organizationsTable)
    .values(DEFAULT_ORG)
    .onConflictDoUpdate({
      target: organizationsTable.slug,
      set: { name: DEFAULT_ORG.name, shortName: DEFAULT_ORG.shortName },
    })
    .returning();
  console.log(`[seed-rbac] Organization: ${org.name} (id=${org.id})`);

  // 2. System roles
  const sysRoleMap = new Map<string, number>();
  for (const sr of SYSTEM_ROLES) {
    const [row] = await db
      .insert(systemRolesTable)
      .values({ ...sr, isBuiltin: true })
      .onConflictDoUpdate({ target: systemRolesTable.slug, set: { name: sr.name, description: sr.description } })
      .returning();
    sysRoleMap.set(row.slug, row.id);
  }
  console.log(`[seed-rbac] ${sysRoleMap.size} system roles seeded`);

  // 3. Org roles
  const orgRoleMap = new Map<string, number>();
  for (const or of ORG_ROLES) {
    const [row] = await db
      .insert(orgRolesTable)
      .values({ ...or, organizationId: org.id, isBuiltin: true })
      .onConflictDoUpdate({
        target: [orgRolesTable.organizationId, orgRolesTable.slug],
        set: { name: or.name, tier: or.tier },
      })
      .returning();
    orgRoleMap.set(row.slug, row.id);
  }
  console.log(`[seed-rbac] ${orgRoleMap.size} org roles seeded`);

  // 4. Permission groups
  const pgroupMap = new Map<string, number>();
  for (const pg of PERM_GROUPS) {
    const [row] = await db
      .insert(permissionGroupsTable)
      .values({ ...pg })
      .onConflictDoUpdate({ target: permissionGroupsTable.slug, set: { name: pg.name, scope: pg.scope } })
      .returning();
    pgroupMap.set(row.slug, row.id);
  }
  console.log(`[seed-rbac] ${pgroupMap.size} permission groups seeded`);

  // 5. Permissions
  let permCount = 0;
  for (const [groupSlug, perms] of Object.entries(PERMISSIONS_BY_GROUP)) {
    const groupId = pgroupMap.get(groupSlug);
    if (!groupId) continue;
    for (const p of perms) {
      await db
        .insert(permissionsTable)
        .values({ ...p, groupId })
        .onConflictDoUpdate({ target: permissionsTable.slug, set: { name: p.name } });
      permCount++;
    }
  }
  console.log(`[seed-rbac] ${permCount} permissions seeded`);

  // 6. System role → permission group assignments
  let srPermCount = 0;
  for (const [roleSlug, groupSlugs] of Object.entries(SYSTEM_ROLE_PERMS)) {
    const roleId = sysRoleMap.get(roleSlug);
    if (!roleId) continue;
    for (const gs of groupSlugs) {
      const pgId = pgroupMap.get(gs);
      if (!pgId) continue;
      await db
        .insert(systemRolePermissionsTable)
        .values({ systemRoleId: roleId, permGroupId: pgId })
        .onConflictDoNothing();
      srPermCount++;
    }
  }
  console.log(`[seed-rbac] ${srPermCount} system role permission assignments seeded`);

  // 7. Org role → permission group assignments
  let orPermCount = 0;
  for (const [roleSlug, groupSlugs] of Object.entries(ORG_ROLE_PERMS)) {
    const roleId = orgRoleMap.get(roleSlug);
    if (!roleId) continue;
    for (const gs of groupSlugs) {
      if (typeof gs !== "string") continue;
      const pgId = pgroupMap.get(gs);
      if (!pgId) continue;
      await db
        .insert(orgRolePermissionsTable)
        .values({ orgRoleId: roleId, permGroupId: pgId })
        .onConflictDoNothing();
      orPermCount++;
    }
  }
  console.log(`[seed-rbac] ${orPermCount} org role permission assignments seeded`);

  // 8. Role incompatibilities
  let incompat = 0;
  for (const [aSlug, bSlug] of INCOMPATIBLE_PAIRS) {
    const aId = orgRoleMap.get(aSlug);
    const bId = orgRoleMap.get(bSlug);
    if (!aId || !bId) continue;
    await db
      .insert(roleIncompatibilitiesTable)
      .values({ orgRoleAId: aId, orgRoleBId: bId })
      .onConflictDoNothing();
    await db
      .insert(roleIncompatibilitiesTable)
      .values({ orgRoleAId: bId, orgRoleBId: aId })
      .onConflictDoNothing();
    incompat++;
  }
  console.log(`[seed-rbac] ${incompat} incompatibility pairs seeded`);

  // 9. Link existing members to default organization
  await db
    .update(membersTable)
    .set({ organizationId: org.id })
    .where(isNull(membersTable.organizationId));
  console.log("[seed-rbac] Members linked to organization");

  // 10. Link org_settings to default organization
  await db
    .update(orgSettingsTable)
    .set({ organizationId: org.id })
    .where(isNull(orgSettingsTable.organizationId));
  console.log("[seed-rbac] Org settings linked to organization");

  // 11. Back-fill member_system_roles and member_org_roles from legacy role column
  const generalMemberRoleId = orgRoleMap.get("general_member");
  if (!generalMemberRoleId) throw new Error("general_member org role not found");

  const allMembers = await db.select().from(membersTable);
  let backfilled = 0;

  for (const member of allMembers) {
    const legacyRole = member.role;

    // Every member gets general_member org role
    await db
      .insert(memberOrgRolesTable)
      .values({ memberId: member.id, orgRoleId: generalMemberRoleId })
      .onConflictDoNothing();

    // Map legacy CommitteeChair → committee_* org role via committee_assignments (done separately by seed)
    // Map legacy Executive roles → exec org role via officer_terms (done separately by seed)

    // Map legacy system roles
    const sysRoleSlug = LEGACY_TO_SYSTEM_ROLE[legacyRole];
    if (sysRoleSlug) {
      const sysRoleId = sysRoleMap.get(sysRoleSlug);
      if (sysRoleId) {
        await db
          .insert(memberSystemRolesTable)
          .values({ memberId: member.id, systemRoleId: sysRoleId })
          .onConflictDoNothing();
      }
    }

    backfilled++;
  }
  console.log(`[seed-rbac] ${backfilled} members back-filled`);

  // 12. Cleanup migrations — idempotent, safe to re-run
  //
  // a) Remove manage_finances / manage_documents / manage_executive_dashboard /
  //    manage_nudges from platform_admin — those are executive-only permissions.
  const PLATFORM_ADMIN_REMOVED_PERMS = [
    "manage_finances", "manage_documents", "manage_executive_dashboard", "manage_nudges",
  ];
  const platformAdminSysId = sysRoleMap.get("platform_admin");
  if (platformAdminSysId) {
    for (const slug of PLATFORM_ADMIN_REMOVED_PERMS) {
      const pgId = pgroupMap.get(slug);
      if (pgId) {
        await db
          .delete(systemRolePermissionsTable)
          .where(
            and(
              eq(systemRolePermissionsTable.systemRoleId, platformAdminSysId),
              eq(systemRolePermissionsTable.permGroupId, pgId),
            ),
          );
      }
    }
    console.log("[seed-rbac] platform_admin stale perms removed");
  }

  // b) Consolidate bylaws_officer → bylaws_chair (migrate members, delete role)
  const bylawsChairId = orgRoleMap.get("bylaws_chair");
  const [bylawsOfficerRow] = await db
    .select({ id: orgRolesTable.id })
    .from(orgRolesTable)
    .where(eq(orgRolesTable.slug, "bylaws_officer"));
  if (bylawsOfficerRow && bylawsChairId) {
    await db
      .update(memberOrgRolesTable)
      .set({ orgRoleId: bylawsChairId })
      .where(eq(memberOrgRolesTable.orgRoleId, bylawsOfficerRow.id));
    await db
      .delete(orgRolePermissionsTable)
      .where(eq(orgRolePermissionsTable.orgRoleId, bylawsOfficerRow.id));
    await db.delete(orgRolesTable).where(eq(orgRolesTable.id, bylawsOfficerRow.id));
    console.log("[seed-rbac] bylaws_officer merged into bylaws_chair");
  }

  console.log("[seed-rbac] RBAC seed complete");
}

// Run directly when called as a script
if (process.argv[1]?.endsWith("seed-rbac.ts") || process.argv[1]?.endsWith("seed-rbac.js")) {
  seedRbac()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}
