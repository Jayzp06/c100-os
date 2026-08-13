---
name: positionLabel — never use legacy role enum for display
description: How the sidebar user panel derives a display label for the current user's role.
---

## Rule
`SidebarUserPanel` and any other UI that shows the user's role/position must render `me.positionLabel` — never `me.member.role`.

**Why:** `members.role` is a legacy enum auto-synced by `deriveLegacyRole()` on server-side mutations, but a stale desktop cache can serve an outdated value (e.g. "ExecutiveBoard" after the exec tag is removed). `positionLabel` is derived fresh on every `/api/me` response from `officerPositions → systemRoles → orgRoles`.

**How to apply:**
- `computePositionLabel(officerPositions, systemRoles, orgRoles)` in `me.ts` — priority: active officer term > platform_admin > technology_chair > orgRoles > "Member".
- `positionLabel: string` is on `MeValue`; computed inside `useMeValue()`.
- `POSITION_DISPLAY` in me.ts maps all known slugs to human labels; unknown slugs are title-cased.
- Backend companion: `deriveLegacyRole()` in rbac.ts is the server-side sync; the frontend label is independent of it.
- Regression tests: 31 new tests in rbac-permissions.test.ts cover both functions (v0.9.7).
