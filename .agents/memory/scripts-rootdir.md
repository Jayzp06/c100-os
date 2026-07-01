---
name: scripts package rootDir restriction
description: Why scripts/src cannot directly import lib/db/src/* source files, and the correct patterns.
---

## Rule
Never import `lib/db/src/*.ts` (or any other lib source) via a relative path from `scripts/src/`. TypeScript enforces `rootDir: "./src"` on the scripts package and rejects files outside that tree with TS6059.

## Why
The scripts tsconfig sets `"rootDir": "./src"`. Any file reachable through an import chain that lives outside `scripts/src/` causes a TS6059 "file not under rootDir" error — including transitive imports (e.g. importing `seed-rbac.ts` which itself imports `lib/db/src/schema/index.ts`).

## Correct patterns
1. **Import from the compiled package:** `import { something } from "@workspace/db"` — this resolves through the package's `exports` map and the compiled declarations, not raw source files.
2. **Add an npm script to the lib package:** Add `"seed-rbac": "node --import tsx/esm ./src/seed-rbac.ts"` to `lib/db/package.json` and run it as a separate step (`pnpm --filter @workspace/db run seed-rbac`).
3. **Never use relative `../../lib/…` imports in scripts/**.

## Seed sequence (RBAC)
```
pnpm --filter @workspace/db run migrate   # apply pending migrations
pnpm --filter @workspace/scripts run seed-c100  # seed main data
pnpm --filter @workspace/db run seed-rbac       # seed RBAC data + back-fill org roles
```
