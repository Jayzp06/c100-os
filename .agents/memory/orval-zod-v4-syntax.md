---
name: orval zod plugin emits v4-only syntax
description: openapi.yaml `format: email` / `format: uri` breaks codegen when the workspace pins zod v3
---

Orval's `@orval/zod` generator (as of orval 8.19.x) unconditionally emits
`zod.email()` / `zod.url()` for any schema property with `format: email` or
`format: uri`. Those top-level functions only exist in zod v4 — they don't
exist on the zod v3 namespace (`zod.string().email()` is the v3 form). This
repo's `pnpm-workspace.yaml` catalog pins `zod: ^3.25.76`, so codegen silently
produced generated code that then fails `tsc --build` with
`Property 'email' does not exist on type '...zod/index'`.

**Why:** discovered while adding new member endpoints — codegen had not been
run in a while, so this latent incompatibility wasn't caught until a fresh
`pnpm --filter @workspace/api-spec run codegen` was needed.

**How to apply:** don't add `format: email` / `format: uri` to
`lib/api-spec/openapi.yaml` schemas while zod stays pinned to v3. Plain
`type: string` still validates as a string at the API boundary; do
app-level email/URL validation manually if needed. If the project ever
upgrades to zod v4 workspace-wide, these format hints can be restored.
