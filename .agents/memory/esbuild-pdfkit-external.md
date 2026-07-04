---
name: esbuild native/font packages must be externalized
description: pdfkit (and any package with a dynamic-require font/native stack) breaks esbuild bundling in api-server; must be added to the external list.
---

Packages like `pdfkit` pull in `fontkit` → `brotli` → dynamic `require()` calls
(e.g. for `@swc/helpers` decompression helpers) that esbuild cannot resolve
correctly when bundled into a single ESM file. The build succeeds but the
bundled output throws `MODULE_NOT_FOUND` at runtime only when that code path
actually executes (e.g. first PDF generated), not at build time.

**Why:** esbuild's static bundling can't fully rewrite/resolve conditional or
dynamically-computed `require()` paths inside pdfkit's dependency chain, so
the resulting `.mjs` bundle references a module esbuild never included.

**How to apply:** When adding a PDF/font-rendering (or similar native-ish)
dependency to `artifacts/api-server`, add it plus its risky transitive deps
(e.g. `pdfkit`, `fontkit`, `brotli`, `png-js`) to the `external` array in
`artifacts/api-server/build.mjs`, next to the other unbundleable packages.
Verify by restarting the workflow and checking startup logs, not just
`typecheck` — this class of failure only shows up at runtime.
