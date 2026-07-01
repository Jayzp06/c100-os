import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { membersTable } from "./c100";
import { organizationsTable } from "./orgs";

// ─── System Roles ──────────────────────────────────────────────────────────────
// Cross-chapter platform roles (PlatformAdministrator, TechnologyChair, etc.)
// Global — not tied to a specific organization.

export const systemRolesTable = pgTable("system_roles", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  isBuiltin: boolean("is_builtin").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SystemRole = typeof systemRolesTable.$inferSelect;

// ─── Org Roles ─────────────────────────────────────────────────────────────────
// Organizational roles within a specific chapter (President, Treasurer, etc.)
// Each organization defines its own set; built-in roles are seeded for every new org.

export const orgRolesTable = pgTable(
  "org_roles",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    // executive_board | appointed_officer | committee_leadership
    // | committee_member | general_member | advisor | parent_chapter
    tier: varchar("tier", { length: 48 }).notNull(),
    description: text("description"),
    isBuiltin: boolean("is_builtin").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("org_roles_org_id_slug_idx").on(t.organizationId, t.slug)],
);

export type OrgRole = typeof orgRolesTable.$inferSelect;

// ─── Permission Groups ─────────────────────────────────────────────────────────
// Named capability sets (e.g. "manage_members", "view_audit_logs").
// Roles are granted permission groups; groups contain individual permissions.

export const permissionGroupsTable = pgTable("permission_groups", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  // "org" = organizational capability | "system" = platform administration
  scope: varchar("scope", { length: 16 }).notNull().default("org"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PermissionGroup = typeof permissionGroupsTable.$inferSelect;

// ─── Permissions ───────────────────────────────────────────────────────────────
// Atomic capability units belonging to a permission group.
// Slug convention: "<resource>:<action>" e.g. "members:write", "events:create".

export const permissionsTable = pgTable("permissions", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  groupId: integer("group_id")
    .notNull()
    .references(() => permissionGroupsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Permission = typeof permissionsTable.$inferSelect;

// ─── System Role → Permission Group assignments ────────────────────────────────

export const systemRolePermissionsTable = pgTable(
  "system_role_permissions",
  {
    systemRoleId: integer("system_role_id")
      .notNull()
      .references(() => systemRolesTable.id, { onDelete: "cascade" }),
    permGroupId: integer("perm_group_id")
      .notNull()
      .references(() => permissionGroupsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.systemRoleId, t.permGroupId] })],
);

// ─── Org Role → Permission Group assignments ───────────────────────────────────

export const orgRolePermissionsTable = pgTable(
  "org_role_permissions",
  {
    orgRoleId: integer("org_role_id")
      .notNull()
      .references(() => orgRolesTable.id, { onDelete: "cascade" }),
    permGroupId: integer("perm_group_id")
      .notNull()
      .references(() => permissionGroupsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.orgRoleId, t.permGroupId] })],
);

// ─── Member → System Role assignments ─────────────────────────────────────────

export const memberSystemRolesTable = pgTable(
  "member_system_roles",
  {
    memberId: integer("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    systemRoleId: integer("system_role_id")
      .notNull()
      .references(() => systemRolesTable.id, { onDelete: "cascade" }),
    grantedBy: integer("granted_by").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.systemRoleId] })],
);

export type MemberSystemRole = typeof memberSystemRolesTable.$inferSelect;

// ─── Member → Org Role assignments ────────────────────────────────────────────

export const memberOrgRolesTable = pgTable(
  "member_org_roles",
  {
    memberId: integer("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    orgRoleId: integer("org_role_id")
      .notNull()
      .references(() => orgRolesTable.id, { onDelete: "cascade" }),
    grantedBy: integer("granted_by").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.orgRoleId] })],
);

export type MemberOrgRole = typeof memberOrgRolesTable.$inferSelect;

// ─── Org Role Incompatibilities ────────────────────────────────────────────────
// Pairs of org roles that cannot be held simultaneously (e.g. President + VP).
// Enforced by the role-assignment endpoint; Platform Administrator can override.

export const roleIncompatibilitiesTable = pgTable(
  "role_incompatibilities",
  {
    orgRoleAId: integer("org_role_a_id")
      .notNull()
      .references(() => orgRolesTable.id, { onDelete: "cascade" }),
    orgRoleBId: integer("org_role_b_id")
      .notNull()
      .references(() => orgRolesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.orgRoleAId, t.orgRoleBId] })],
);

// ─── Desktop Releases ─────────────────────────────────────────────────────────
// Published desktop application versions per update channel.
// Populated by the GitHub Actions CI pipeline after signing builds.
// platforms is a JSON string: { "darwin-aarch64": { url, signature }, ... }

export const desktopReleasesTable = pgTable("desktop_releases", {
  id: serial("id").primaryKey(),
  channel: varchar("channel", { length: 32 }).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  releaseNotes: text("release_notes"),
  pubDate: timestamp("pub_date", { withTimezone: true }).notNull(),
  platforms: text("platforms").notNull(),
  publishedBy: integer("published_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DesktopRelease = typeof desktopReleasesTable.$inferSelect;

// ─── Sync Events ───────────────────────────────────────────────────────────────
// Change feed for multi-device synchronization. Written by mutating routes.
// Clients poll GET /api/sync/events?since={timestamp} and invalidate query cache.
// Retention: 7 days (cleaned up at API server startup).

export const syncEventsTable = pgTable("sync_events", {
  id: serial("id").primaryKey(),
  resourceType: varchar("resource_type", { length: 64 }).notNull(),
  resourceId: integer("resource_id").notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  payload: text("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SyncEvent = typeof syncEventsTable.$inferSelect;
