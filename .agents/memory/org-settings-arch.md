---
name: Org settings architecture
description: How organisation-level configuration is stored, cached, and exposed — singleton DB table, cached getters, public API endpoint.
---

## Pattern

`orgSettingsTable` is a **single-row** settings table in PostgreSQL. Every deployment has exactly one row. Future multi-tenancy would add an `org_id` FK to other tables; for now all members/events/committees belong to the one configured org.

**Why:** Chosen over a key-value store because Drizzle gives typed access, the fields are well-known, and the schema enforces required values.

## Cached getters in `artifacts/api-server/src/lib/c100.ts`

- `getOrgSettings()` — 5-min in-process cache; returns `OrgConfig` with all numeric fields parsed to `number`.
- `invalidateOrgCache()` — called by the PATCH route after update so the next read reflects the change.
- `getParticipationThreshold()` — reads active `semesterConfigTable.participationThreshold` first, falls back to `orgSettings.participationGoalPct`, then to 75.

**How to apply:** Any route that needs org config should call these functions, never hardcode org strings or threshold numbers.

## API endpoint

`GET /api/org/settings` — **public, no auth**. The login page calls this before the user signs in. Every other authenticated route can use the cached getter directly.

`PATCH /api/org/settings` — Admin only. Busts the cache after a successful update.

## Frontend

`useGetOrgSettings()` from `@workspace/api-client-react` — React Query deduplicates calls across components; no need for a context provider. Call the hook directly in each component that needs org data.

## FVSU defaults

Seeded in `scripts/src/seed-c100.ts` via an existence check (no upsert). Will NOT overwrite existing settings on reseed. FVSU strings appear ONLY in the seed, never hardcoded in app code.

## computeNudgeTier thresholds

`computeNudgeTier(pct, goalPct = 75)` now derives Warning/AtRisk from `goalPct`:
- Warning ≥ goalPct × 0.80 (60 when goal = 75)
- AtRisk ≥ goalPct × 0.533 (40 when goal = 75)
- Critical below that
