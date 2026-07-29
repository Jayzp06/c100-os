---
name: seed-rbac PERM_GROUPS sync
description: seed-rbac.ts creates permission groups from PERM_GROUPS array only; adding a slug to rbac-matrix.ts without adding it here silently skips the group and all its role assignments.
---

## Rule

Every permission slug used in `lib/db/src/rbac-matrix.ts` must also have a corresponding entry in the `PERM_GROUPS` array in `lib/db/src/seed-rbac.ts`.

**Why:** The seed creates `permission_groups` table rows from `PERM_GROUPS` (explicit catalog with name/scope/description), not by scanning the matrix. If a slug appears in `ORG_ROLE_PERMS` or `SYSTEM_ROLE_PERMS` but not in `PERM_GROUPS`, the INSERT into `permission_groups` never runs, and the `org_role_permissions` / `system_role_permissions` assignments for that slug are silently skipped. The seed reports a plausible-looking count with no error.

**How to apply:** Whenever adding a new permission slug to `rbac-matrix.ts`, immediately add the matching entry to `PERM_GROUPS` in `seed-rbac.ts` in the same commit. The missing-entry failure mode was hit with `manage_executive_operations` — it was added to the matrix for `chief_of_staff` and `president` but not to `PERM_GROUPS`, so neither role received the permission after the seed ran. The permission group had to be inserted manually into the live DB before president could access the Chief of Staff workspace.
