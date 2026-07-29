/**
 * RBAC permission engine.
 *
 * Resolves permissions for a member by joining:
 *   member_system_roles → system_role_permissions → permission_groups
 *   member_org_roles    → org_role_permissions    → permission_groups
 *
 * All checks are additive — a member's permissions are the union of every
 * role they hold.  System roles (platform_admin, technology_chair) are
 * superset roles that can override org-level restrictions.
 */

import { type Request, type Response, type NextFunction } from "express";
import {
  db,
  memberSystemRolesTable,
  memberOrgRolesTable,
  systemRolesTable,
  orgRolesTable,
  systemRolePermissionsTable,
  orgRolePermissionsTable,
  permissionGroupsTable,
  type Member as MemberRow,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import type { AuthedHandler } from "./c100";

// ─── Core resolution ────────────────────────────────────────────────────────────

export interface RbacContext {
  /** Slugs of system roles held (e.g. "platform_admin", "technology_chair"). */
  systemRoles: string[];
  /** Slugs of org roles held (e.g. "president", "general_member"). */
  orgRoles: string[];
  /** Highest org role tier held. */
  highestTier: OrgRoleTier | null;
  /** Union of all permission group slugs from system + org role assignments. */
  permissionGroups: Set<string>;
}

export type OrgRoleTier =
  | "executive_board"
  | "appointed_officer"
  | "committee_leadership"
  | "committee_member"
  | "general_member"
  | "advisor"
  | "parent_chapter";

const TIER_RANK: Record<OrgRoleTier, number> = {
  executive_board: 6,
  appointed_officer: 5,
  committee_leadership: 4,
  committee_member: 3,
  general_member: 2,
  advisor: 1,
  parent_chapter: 0,
};

export async function resolveRbacContext(memberId: number): Promise<RbacContext> {
  const [sysRoleRows, orgRoleRows] = await Promise.all([
    db
      .select({ slug: systemRolesTable.slug })
      .from(memberSystemRolesTable)
      .innerJoin(
        systemRolesTable,
        eq(systemRolesTable.id, memberSystemRolesTable.systemRoleId),
      )
      .where(eq(memberSystemRolesTable.memberId, memberId)),
    db
      .select({ slug: orgRolesTable.slug, tier: orgRolesTable.tier })
      .from(memberOrgRolesTable)
      .innerJoin(
        orgRolesTable,
        eq(orgRolesTable.id, memberOrgRolesTable.orgRoleId),
      )
      .where(eq(memberOrgRolesTable.memberId, memberId)),
  ]);

  const systemRoles = sysRoleRows.map((r) => r.slug);
  const orgRoles = orgRoleRows.map((r) => r.slug);

  let highestTier: OrgRoleTier | null = null;
  for (const row of orgRoleRows) {
    const t = row.tier as OrgRoleTier;
    if (
      !highestTier ||
      (TIER_RANK[t] ?? -1) > (TIER_RANK[highestTier] ?? -1)
    ) {
      highestTier = t;
    }
  }

  const permissionGroups = new Set<string>();

  if (systemRoles.length > 0) {
    const sysRoleIds = await db
      .select({ id: systemRolesTable.id })
      .from(systemRolesTable)
      .where(inArray(systemRolesTable.slug, systemRoles));
    const ids = sysRoleIds.map((r) => r.id);

    if (ids.length > 0) {
      const sysPerms = await db
        .select({ slug: permissionGroupsTable.slug })
        .from(systemRolePermissionsTable)
        .innerJoin(
          permissionGroupsTable,
          eq(permissionGroupsTable.id, systemRolePermissionsTable.permGroupId),
        )
        .where(inArray(systemRolePermissionsTable.systemRoleId, ids));
      for (const p of sysPerms) permissionGroups.add(p.slug);
    }
  }

  if (orgRoles.length > 0) {
    const orgRoleIds = await db
      .select({ id: orgRolesTable.id })
      .from(orgRolesTable)
      .where(inArray(orgRolesTable.slug, orgRoles));
    const ids = orgRoleIds.map((r) => r.id);

    if (ids.length > 0) {
      const orgPerms = await db
        .select({ slug: permissionGroupsTable.slug })
        .from(orgRolePermissionsTable)
        .innerJoin(
          permissionGroupsTable,
          eq(permissionGroupsTable.id, orgRolePermissionsTable.permGroupId),
        )
        .where(inArray(orgRolePermissionsTable.orgRoleId, ids));
      for (const p of orgPerms) permissionGroups.add(p.slug);
    }
  }

  return { systemRoles, orgRoles, highestTier, permissionGroups };
}

// ─── Convenience helpers ────────────────────────────────────────────────────────

/** True if the member has ANY of the listed system role slugs. */
export function hasSystemRole(ctx: RbacContext, ...slugs: string[]): boolean {
  return slugs.some((s) => ctx.systemRoles.includes(s));
}

/** True if the member has the given permission group. */
export function hasPermissionGroup(ctx: RbacContext, slug: string): boolean {
  return ctx.permissionGroups.has(slug);
}

/**
 * True if the member is the Technology Chair — the only role that bypasses
 * all permission-group checks (blanket technical superuser).
 * Platform Admin does NOT bypass checks; it uses explicit permission groups.
 */
export function isTechSuperuser(ctx: RbacContext): boolean {
  return hasSystemRole(ctx, "technology_chair");
}

/**
 * True if the member holds any system-level administrative role
 * (platform_admin OR technology_chair).  Used to grant the
 * operations_console experience — does NOT bypass permission checks.
 */
export function isPlatformAdmin(ctx: RbacContext): boolean {
  return hasSystemRole(ctx, "platform_admin", "technology_chair");
}

/**
 * Derive the UI experience shell from RBAC context + legacy officer data.
 *
 * Priority (highest first):
 *   1. System role: platform_admin or technology_chair → operations_console
 *   2. Org role tier: executive_board or appointed_officer → operations_console
 *   3. Active officer_terms row for an executive position → operations_console
 *   4. Org role tier: committee_leadership → committee_portal
 *   5. Active committee_assignments "chair" row (or committees.chairUserId) → committee_portal
 *   6. Default → member_portal
 */
export function deriveExperience(
  ctx: RbacContext,
  extra: {
    hasOfficerTerm: boolean;
    isTechChair: boolean;
    hasCommitteeChair: boolean;
  },
): "operations_console" | "committee_portal" | "member_portal" {
  if (isPlatformAdmin(ctx) || extra.isTechChair) return "operations_console";

  const tier = ctx.highestTier;
  if (tier === "executive_board" || tier === "appointed_officer")
    return "operations_console";
  if (extra.hasOfficerTerm) return "operations_console";

  if (tier === "committee_leadership") return "committee_portal";
  if (extra.hasCommitteeChair) return "committee_portal";

  return "member_portal";
}

/**
 * Compute the full set of experience shells a member legitimately qualifies for,
 * based on the same signals as `deriveExperience`, but without short-circuiting
 * to only the highest-priority one. Used to power a "switch view" affordance for
 * members who hold more than one qualifying role (e.g. an exec board member who
 * is also a committee chair) — distinct from Tech Chair impersonation, which
 * simulates a role NOT held.
 */
export function computeAvailableExperiences(
  ctx: RbacContext,
  extra: {
    hasOfficerTerm: boolean;
    isTechChair: boolean;
    hasCommitteeChair: boolean;
  },
): Array<"operations_console" | "committee_portal" | "member_portal"> {
  const experiences = new Set<
    "operations_console" | "committee_portal" | "member_portal"
  >();

  if (
    isPlatformAdmin(ctx) ||
    extra.isTechChair ||
    ctx.highestTier === "executive_board" ||
    ctx.highestTier === "appointed_officer" ||
    extra.hasOfficerTerm
  ) {
    experiences.add("operations_console");
  }

  if (ctx.highestTier === "committee_leadership" || extra.hasCommitteeChair) {
    experiences.add("committee_portal");
  }

  // Every member always qualifies for the member portal — it is the base
  // experience everyone holds regardless of additional leadership roles.
  experiences.add("member_portal");

  return Array.from(experiences);
}

// ─── Permission-tag assignment (member-detail admin UI) ───────────────────────
//
// These two whitelists are the only org/system roles an admin can grant or
// revoke through the multi-tag permission UI (PATCH /members/:id). They are
// intentionally additive to the legacy `members.role` column — assigning or
// removing them never touches `role` and never rewrites any existing
// `requireRole`/LEADERSHIP_ROLES/EXEC_OR_ADMIN/TECH_OR_ADMIN gate. Executive
// Board access is derived automatically from these org-role tiers by
// `deriveExperience` — there is deliberately no generic "Executive Board" tag
// here; granting president/vice_president/secretary/treasurer already
// promotes the member to the Operations Console shell.
export const ASSIGNABLE_ORG_ROLE_SLUGS = [
  "president",
  "vice_president",
  "secretary",
  "treasurer",
  "parliamentarian",
  "historian",
  "committee_chair",
] as const;

export const ASSIGNABLE_SYSTEM_ROLE_SLUGS = ["platform_admin"] as const;

export type AssignableOrgRoleSlug = (typeof ASSIGNABLE_ORG_ROLE_SLUGS)[number];
export type AssignableSystemRoleSlug =
  (typeof ASSIGNABLE_SYSTEM_ROLE_SLUGS)[number];

/**
 * Derive the legacy `members.role` value from the current set of assignable
 * org- and system-role tags. Used by the member PATCH route to keep the
 * legacy column consistent whenever the admin saves permission tags.
 *
 * Priority (highest first):
 *   1. platform_admin system role → "Admin"
 *   2. Any executive-board slug   → "ExecutiveBoard"
 *   3. committee_chair            → "CommitteeChair"
 *   5. else                       → "Member"
 */
export function deriveLegacyRole(
  orgRoleSlugs: readonly string[],
  systemRoleSlugs: readonly string[],
): string {
  if (systemRoleSlugs.includes("platform_admin")) return "Admin";
  const EXEC_SLUGS = new Set([
    "president",
    "vice_president",
    "secretary",
    "treasurer",
    "parliamentarian",
    "historian",
  ]);
  if (orgRoleSlugs.some((s) => EXEC_SLUGS.has(s))) return "ExecutiveBoard";
  if (orgRoleSlugs.includes("committee_chair") || orgRoleSlugs.includes("bylaws_chair")) return "CommitteeChair";
  return "Member";
}

/**
 * Replaces a member's assignments among the whitelisted org-role tags only.
 * Any org role a member holds outside this whitelist (e.g. committee
 * leadership roles, general_member) is left untouched.
 */
export async function setMemberOrgRoleTags(
  memberId: number,
  slugs: string[],
  grantedBy: number | null,
): Promise<void> {
  const desired = Array.from(
    new Set(slugs.filter((s) => (ASSIGNABLE_ORG_ROLE_SLUGS as readonly string[]).includes(s))),
  );

  const whitelistRoles = await db
    .select({ id: orgRolesTable.id, slug: orgRolesTable.slug })
    .from(orgRolesTable)
    .where(inArray(orgRolesTable.slug, ASSIGNABLE_ORG_ROLE_SLUGS as unknown as string[]));

  const idBySlug = new Map(whitelistRoles.map((r) => [r.slug, r.id]));
  const whitelistIds = whitelistRoles.map((r) => r.id);

  if (whitelistIds.length > 0) {
    await db
      .delete(memberOrgRolesTable)
      .where(
        and(
          eq(memberOrgRolesTable.memberId, memberId),
          inArray(memberOrgRolesTable.orgRoleId, whitelistIds),
        ),
      );
  }

  const toInsert = desired
    .map((slug) => idBySlug.get(slug))
    .filter((id): id is number => id != null)
    .map((orgRoleId) => ({ memberId, orgRoleId, grantedBy }));

  if (toInsert.length > 0) {
    await db.insert(memberOrgRolesTable).values(toInsert);
  }
}

/**
 * Replaces a member's assignments among the whitelisted system-role tags only
 * (currently just platform_admin — technology_chair remains driven by the
 * legacy `members.role` column, see .agents/memory/tech-chair-role.md).
 */
export async function setMemberSystemRoleTags(
  memberId: number,
  slugs: string[],
  grantedBy: number | null,
): Promise<void> {
  const desired = Array.from(
    new Set(
      slugs.filter((s) => (ASSIGNABLE_SYSTEM_ROLE_SLUGS as readonly string[]).includes(s)),
    ),
  );

  const whitelistRoles = await db
    .select({ id: systemRolesTable.id, slug: systemRolesTable.slug })
    .from(systemRolesTable)
    .where(inArray(systemRolesTable.slug, ASSIGNABLE_SYSTEM_ROLE_SLUGS as unknown as string[]));

  const idBySlug = new Map(whitelistRoles.map((r) => [r.slug, r.id]));
  const whitelistIds = whitelistRoles.map((r) => r.id);

  if (whitelistIds.length > 0) {
    await db
      .delete(memberSystemRolesTable)
      .where(
        and(
          eq(memberSystemRolesTable.memberId, memberId),
          inArray(memberSystemRolesTable.systemRoleId, whitelistIds),
        ),
      );
  }

  const toInsert = desired
    .map((slug) => idBySlug.get(slug))
    .filter((id): id is number => id != null)
    .map((systemRoleId) => ({ memberId, systemRoleId, grantedBy }));

  if (toInsert.length > 0) {
    await db.insert(memberSystemRolesTable).values(toInsert);
  }
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * Requires the authenticated member to hold the given permission group slug.
 * Technology Chair always passes (blanket superuser).
 * Platform Admin must hold the permission group explicitly.
 *
 * Note: does not include its own auth check — must be used inside requireAuth
 * or requirePermGroup (c100.ts) which handles auth + member resolution.
 *
 * Usage (inside requireAuth):
 *   requireAuth(requirePermissionGroup("manage_members")(handler))
 * Or prefer the self-contained requirePermGroup from c100.ts:
 *   requirePermGroup("manage_members")(handler)
 */
export function requirePermissionGroup(permGroupSlug: string) {
  return (handler: AuthedHandler) =>
    async (req: Request & { user: any; member: MemberRow }, res: Response, next: NextFunction) => {
      const ctx = await resolveRbacContext(req.member.id);
      // No blanket bypass for Tech Chair or Platform Admin.
      // All access is driven by explicit permission-group membership in the matrix.
      if (!hasPermissionGroup(ctx, permGroupSlug)) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }
      return handler(req as any, res, next);
    };
}

/**
 * Like requirePermissionGroup but with a pre-resolved context to avoid
 * double-querying when the route handler also needs the context.
 *
 * Usage inside requireAuth:
 *   const ctx = await resolveRbacContext(req.member.id);
 *   if (!hasPermissionGroup(ctx, "manage_events")) { ... }
 */
export { resolveRbacContext as resolvePermissionContext };
