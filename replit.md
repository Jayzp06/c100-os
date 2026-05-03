# C100 System — Trailblazing Chapter Operating Platform

Fort Valley State University · Collegiate 100 · Trailblazing Chapter

## Overview

pnpm workspace monorepo. Mobile-responsive performance and accountability platform (NOT social media). Role-based dashboards, event management with dynamic QR attendance, participation tracking, committee leaderboard, and eligibility reporting.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js**: 24 · **TypeScript**: 5.9 · **Package manager**: pnpm
- **Frontend**: React 19 + Vite + Tailwind CSS (shadcn/ui components)
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **Auth**: Replit Auth (OpenID Connect / PKCE)
- **API**: OpenAPI-first with Orval codegen (React Query hooks + Zod schemas)
- **Validation**: Zod v4 + drizzle-zod
- **Build**: esbuild

## Artifacts

| Artifact | Path | Purpose |
|---|---|---|
| `artifacts/c100` | `/` | Main web app (React + Vite) |
| `artifacts/api-server` | `/api` | REST API (Express) |
| `artifacts/mockup-sandbox` | `/__mockup` | Design canvas sandbox |

## Key Commands

```bash
pnpm run typecheck                          # full typecheck across all packages
pnpm run typecheck:libs                     # build composite libs only
pnpm --filter @workspace/api-spec run codegen  # regen API hooks + Zod schemas from OpenAPI
pnpm --filter @workspace/db run push        # push DB schema changes (dev only)
pnpm --filter @workspace/scripts run seed-c100  # reseed database
```

## Roles

| Role | Access |
|---|---|
| `Member` | Own dashboard, events, committees, leaderboard |
| `CommitteeChair` | + committee roster |
| `BylawsChair` | + committee roster |
| `ExecutiveBoard` | + all member data, nudge management, reports |
| `Admin` | Full access including member role/status editing |

## Features

- **Dashboard** — participation %, nudge status, upcoming events, committee leaderboard
- **Events** — 8 event types, create/edit, dynamic QR check-in (60s rotation), manual attendance override
- **QR Attendance** — `/events/:id/qr` full-bleed display page, 10s auto-refresh token
- **Committees** — 5 preloaded committees, private roster (leaders only), stats
- **Leaderboard** — committee-level only, no individual public rankings
- **Nudge System** — 4 tiers (Green/Yellow/Orange/Red), exec-managed
- **Reports** — chapter overview, scholarship eligibility, conference eligibility
- **Member Admin** — role changes, committee assignment, standing updates

## Participation Thresholds

- Goal: 75% attendance across events
- Awards/scholarship/conference eligibility computed per semester

## Database Seed

15 members seeded with realistic participation data:
- 1 Admin (`seed-admin-001`), 4 Exec Board, 4 Committee Chairs, 6 Members
- 5 committees, 8 events (5 completed, 1 active with QR, 2 upcoming)

## Design

- FVSU royal blue `hsl(221 100% 31%)` + gold `hsl(42 100% 47%)`
- Mobile-first, no emojis, clean/professional typography (Geist + Playfair Display)
- AppShell pattern: sticky header, role-gated nav, mobile sheet drawer

## Key Files

```
lib/db/src/schema/c100.ts         # DB schema (members, events, attendance, nudges, committees)
lib/db/src/schema/auth.ts         # Auth/session schema
lib/api-spec/openapi.yaml         # OpenAPI contract (source of truth)
artifacts/api-server/src/lib/c100.ts  # Business logic
artifacts/api-server/src/routes/  # Route handlers (c100, events, profile, nudges, reports)
artifacts/c100/src/App.tsx        # Router
artifacts/c100/src/lib/me.ts      # useMe() hook (auth + profile)
artifacts/c100/src/components/    # AppShell, badges, page-states
artifacts/c100/src/pages/         # 14 pages
scripts/src/seed-c100.ts          # Database seed script
```
