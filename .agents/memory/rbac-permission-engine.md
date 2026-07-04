---
name: RBAC permission engine
description: DB-driven RBAC introduced in the multi-chapter refactor — key types, functions, and backward-compat shim.
---

## Rule
All permission checks should call helpers in `artifacts/api-server/src/lib/rbac.ts` rather than doing raw DB queries in route handlers.

## Key API
- `resolveRbacContext(db, memberId)` — returns `RbacContext { systemRoles, orgRoles, permissionGroups }` from the new tables.
- `requirePermissionGroup(ctx, slug)` — throws 403 if member lacks the named permission group.
- `deriveExperience(ctx)` — returns `'operations' | 'committee' | 'member'` shell name based on org roles.
- `hasSystemRole(ctx, slug)` / `hasPermissionGroup(ctx, slug)` / `isPlatformAdmin(ctx)` — boolean guards.

## Backward-compat shim
`resolvePermissions()` in `c100.ts` still works for existing routes. It now calls `resolveRbacContext()` in parallel and attaches the result as `rbac: RbacContext` on the returned `ResolvedPermissions` object. Routes that only read `resolvedPermissions.role` (legacy) continue to work unchanged.

## Why
Migrating all routes at once would be too risky. The shim lets new routes use `requirePermissionGroup()` while old routes use the legacy role string, with zero runtime divergence.

## org_roles composite unique constraint
The `org_roles` table requires a composite unique index on `(organization_id, slug)`, **not** just `slug`. This was added as a separate patch migration `0002_org_roles_unique_idx.sql` after the initial `0001_rbac_and_organizations.sql`.

## Legacy-branch cutover (completed)
`resolvePermissions()`/`deriveExperience()` no longer branch on `member.role` (isLegacyExec/isLegacyChair removed) — experience/shell routing is RBAC-only now (org_roles tier + officer_terms + committee_assignments/chairUserId). The `members.role` column itself is kept in the DB as a safety net and is still read by `requireRole()` route gates, which were intentionally left alone.

**Why:** an initial RBAC backfill pass had silently assigned every member only `general_member`, so before cutting the legacy branches, a one-time backfill (see `lib/db/backfill-batch-a.sql`) had to derive real org roles from `officer_terms`/`committees.chair_user_id`/legacy `members.role`. Always verify `member_org_roles` actually reflects real leadership before removing a legacy fallback that reads `members.role` — otherwise cutting the fallback silently demotes every leader to a general member.

**How to apply:** before trusting RBAC tables as sole source of truth anywhere else in this codebase, spot-check `member_org_roles`/`member_system_roles` against known leadership (president/treasurer/committee chairs) first.
