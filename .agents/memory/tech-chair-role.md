---
name: TechnologyChair system role
description: Architecture decisions for the TechnologyChair role, impersonation system, and TECH_OR_ADMIN permission set.
---

## TechnologyChair — system role, not an org leadership role

`TechnologyChair` is a **system-level role** (like `Admin`) distinct from all organizational roles (Member, CommitteeChair, BylawsChair, ExecutiveBoard). It is stored in the same `role` varchar column — no migration needed beyond adding it to `ROLE_VALUES`.

**Why:** The tech chair manages the platform itself (org settings, member roster, role assignment) but does not participate in chapter governance. Mixing it into leadership roles would give them a "seat" in the org's accountability chain, which is wrong.

**How to apply:** Always gate tech-admin actions on `TECH_OR_ADMIN` (not `requireRole("Admin")` alone). Never add `TechnologyChair` to `LEADERSHIP_ROLES` or `EXEC_OR_ABOVE`.

## `TECH_OR_ADMIN` constant

Exported from `artifacts/api-server/src/lib/c100.ts` as `const TECH_OR_ADMIN = ["TechnologyChair", "Admin"] as const`. Used as spread args: `requireRole(...TECH_OR_ADMIN)`.

Routes that use it: `/members/bulk-import`, `PATCH /members/:id`, `PATCH /org/settings`, and all `/tech/*` routes.

## Impersonation — session-stored, not DB-persisted

`SessionData.impersonating?: { viewAs: ViewAs; startedAt: string }` (stored in the sessions table JSON blob). `GET /me` returns **synthetic** permissions (experience, officerPositions, committeeChairId) when impersonating, but always returns real `isTechChair: true` so the amber banner and System nav item remain visible.

**Why:** Session-scoped impersonation avoids a separate DB table and auto-clears on session end. The tech chair can never "get stuck" in another view after a session expires.

## OperationsConsoleShell layout change

Wrapping div changed from `flex h-screen overflow-hidden` to `flex h-screen flex-col overflow-hidden`, with a new inner `flex flex-1 overflow-hidden` div wrapping sidebar + main area. This was required to stack the amber ImpersonationBanner at the top without collapsing the shell content.

The outer div **must** have three closing tags in sequence: main-area `</div>`, inner `</div>`, outer `</div>`.
