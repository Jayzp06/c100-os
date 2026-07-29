---
name: Exec workspace gate design
description: How Executive Suite workspace access is gated after WO-6 — permission-based, not role-name based.
---

## Rule
Each EXEC_WORKSPACES entry declares `requiredPermission: string`. Frontend gates call `me.can(workspace.requiredPermission)`. No `orgRole` field, no `isTechChair` special case, no `isAdmin` bypass.

## Workspace → permission mapping
| Workspace        | requiredPermission       | Primary org role      |
|------------------|--------------------------|-----------------------|
| president        | manage_org_settings      | president             |
| vice-president   | view_committee_reports   | vice_president        |
| secretary        | manage_minutes           | secretary             |
| treasurer        | manage_finances          | treasurer             |
| historian        | manage_archives          | historian             |
| sergeant-at-arms | view_conduct_reports     | sergeant_at_arms      |
| parliamentarian  | manage_procedure_records | parliamentarian       |
| technology       | view_system_diagnostics  | technology_chair (sys)|

## President access model
President holds every officer permission explicitly in the RBAC matrix, so `me.can()` returns true for all 7 officer workspaces. President does NOT hold `view_system_diagnostics` → cannot access the Technology workspace (correct).

## Platform Admin / Tech Chair
- Platform Admin holds NONE of the 8 workspace permissions → no exec access.
- Technology Chair holds ONLY `view_system_diagnostics` → Technology workspace only.

**Why:** Removing orgRole string checks ensures that legacy `ExecutiveBoard` role names, system-role status, and other indirect signals cannot silently grant workspace access. Every workspace is protected by a specific, testable permission group.

**How to apply:** When adding a new workspace to EXEC_WORKSPACES, pick a permission slug that is (a) in the RBAC matrix, (b) granted only to the intended officer + president, and (c) descriptive of the workspace's function. Add a corresponding test in `rbac-permissions.test.ts` under the workspace matrix describe blocks.
