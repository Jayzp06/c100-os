---
name: Validation test runner
description: How to run the api-server regression tests and key validation gotchas for the C100 project.
---

## Test runner

tsx lives at:
```
node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/cli.mjs
```

Run the api-server validation regression tests:
```
cd artifacts/api-server
node /home/runner/workspace/node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/cli.mjs \
  --test src/__tests__/validation.test.ts
```

Or via the package script:
```
pnpm --filter @workspace/api-server run test
```

## Key gotchas

**`format: email` in openapi.yaml generates `zod.email()` (Zod v4 syntax)**
Orval v8 generates `zod.email()` for `format: email`. This does NOT compile with Zod v3 (`zod@3.x`). The project uses Zod v3. Always validate email server-side using `isValidEmail()` in `artifacts/api-server/src/lib/validation.ts` instead.

**Why:** Zod v3 email validation is `zod.string().email()` (a method on ZodString), not a standalone `zod.email()` function. Orval generates the v4 form unconditionally for `format: email`.

**How to apply:** Never add `format: email` to openapi.yaml schemas in this project. Use a `description: "Must be a valid email address."` comment instead, and add `isValidEmail()` checks in the route handler.

**Test import extension convention**
Test files must import local `.ts` files using the `.js` extension (e.g., `../lib/validation.js`), not `.ts`. The tsx runner resolves `.js` → `.ts` at runtime; the TypeScript compiler requires `.js` extension for ESM TypeScript files (`allowImportingTsExtensions` is not enabled).
