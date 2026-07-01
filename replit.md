# C100 System — Trailblazing Chapter Operating Platform

Fort Valley State University · Collegiate 100 · Trailblazing Chapter

## Overview

pnpm workspace monorepo. Mobile-responsive performance and accountability platform (NOT social media). Role-based dashboards, event management with dynamic QR attendance, participation tracking, committee leaderboard, and eligibility reporting.

**Deployment targets:** Local development · Cloud web (Replit) · Native desktop macOS/Windows (Tauri 2.0) · Future mobile (Tauri iOS/Android). No business logic changes between targets.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js**: 24 · **TypeScript**: 5.9 · **Package manager**: pnpm
- **Frontend**: React 19 + Vite + Tailwind CSS (shadcn/ui components)
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **Auth**: Replit Auth (OpenID Connect / PKCE)
- **API**: OpenAPI-first with Orval codegen (React Query hooks + Zod schemas)
- **Validation**: Zod v4 + drizzle-zod
- **Build**: esbuild (API) · Vite (web) · Tauri 2.0 (desktop)
- **Offline**: React Query persistence to localStorage (24 h cache)

## Artifacts

| Artifact | Path | Purpose |
|---|---|---|
| `artifacts/c100` | `/` | Main web app (React + Vite) — shared source for all UI targets |
| `artifacts/api-server` | `/api` | REST API (Express) — single source of business logic |
| `artifacts/c100-desktop` | N/A | Tauri 2.0 native desktop wrapper (macOS .dmg · Windows .msi) |
| `artifacts/mockup-sandbox` | `/__mockup` | Design canvas sandbox |

## Key Commands

```bash
pnpm run typecheck                             # full typecheck across all packages
pnpm run typecheck:libs                        # build composite libs only
pnpm --filter @workspace/api-spec run codegen  # regen API hooks + Zod schemas from OpenAPI
pnpm --filter @workspace/db run push           # push DB schema changes (dev only)
pnpm --filter @workspace/scripts run seed-c100 # reseed database
```

## Deployment

See `DEPLOYMENT.md` for the full four-target deployment guide.

- **Web**: `pnpm --filter @workspace/c100 run build` → static files on Replit
- **Desktop**: Push a `v*` tag → GitHub Actions builds macOS (.dmg) + Windows (.msi) via `.github/workflows/desktop-release.yml`
- **Desktop local dev**: Requires Rust on your machine; `pnpm --filter @workspace/c100-desktop run dev`

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
- **Committees** — 6 committees (V2), private roster (leaders only), stats
- **Leaderboard** — committee-level only, no individual public rankings
- **Nudge System** — 4 tiers (Green/Yellow/Orange/Red), exec-managed
- **Reports** — chapter overview, scholarship eligibility, conference eligibility
- **Member Admin** — role changes, committee assignment, standing updates

## Participation Thresholds

- Goal: 75% attendance across events
- Awards/scholarship/conference eligibility computed per semester

## Database Seed

16 members seeded with realistic V2 participation data:
- 1 Admin (`seed-admin-001`), 3 Exec Board, 6 Committee Chairs, 6 Members
- 6 committees (added Community Service in V2), 8 events (5 completed, 1 active with QR, 2 upcoming)
- authIds are stable across reseeds — see `.agents/memory/seed-authid-idempotency.md`

## Design

- FVSU royal blue `hsl(221 100% 31%)` + gold `#C9A227` (hsl 42 86% 39%)
- Mobile-first, no emojis, clean/professional typography (Inter Tight + Inter + JetBrains Mono)
- Three-shell AppShell: OperationsConsole (sidebar, exec/admin) · CommitteePortal (top-nav, chairs) · MemberPortal (bottom-tabs, members)

## Desktop Architecture (Tauri 2.0)

`artifacts/c100-desktop/src-tauri/` is a pure Rust shell with zero business logic.

| File | Purpose |
|---|---|
| `tauri.conf.json` | Window config, CSP, deep-link scheme (`c100ops://`), updater endpoint |
| `capabilities/default.json` | Tauri permission allowlist |
| `src/lib.rs` | Plugin registration (notifications, shell-open, updater, deep-link) |
| `src/main.rs` | Entry point (sets `windows_subsystem = "windows"` for release) |

In dev, Tauri WebView points at `http://localhost:23873` (the running Vite server).
In production builds, Tauri bundles `artifacts/c100/dist/public/` directly.

## Key Files

```
lib/db/src/schema/c100.ts              # DB schema (members, events, attendance, nudges, committees, officer_terms)
lib/db/src/schema/auth.ts             # Auth/session schema
lib/api-spec/openapi.yaml             # OpenAPI contract (source of truth)
artifacts/api-server/src/lib/c100.ts  # Business logic + semester engine
artifacts/api-server/src/routes/      # Route handlers (c100, events, profile, nudges, reports)
artifacts/c100/src/App.tsx            # Router + QueryClient with offline persistence
artifacts/c100/src/lib/me.ts          # useMe() hook (auth + profile + shell routing)
artifacts/c100/src/components/        # AppShell (three shells), badges, page-states
artifacts/c100/src/pages/             # 14 pages
artifacts/c100-desktop/src-tauri/     # Tauri 2.0 native shell
.github/workflows/desktop-release.yml # CI/CD for macOS + Windows installers
DEPLOYMENT.md                         # Full four-target deployment guide
scripts/src/seed-c100.ts              # Database seed script
```

## User Preferences

- No emojis in the UI
- Professional typography — Inter Tight (headings), Inter (body), JetBrains Mono (code/data)
- Clean, minimal design — never social-media-like
