---
name: Rollup CI native binary — pnpm-workspace overrides
description: Why the Tauri desktop CI fails with "Source phase import must be external" and how the fix works
---

## The rule

Never add `rollup>@rollup/rollup-<platform>: '-'` overrides in `pnpm-workspace.yaml` for platforms that GitHub Actions CI runners use (darwin-arm64, darwin-x64, win32-x64-msvc).

**Why:** pnpm-workspace overrides are unconditional — they override `supportedArchitectures` in `.npmrc` and any explicit `optionalDependencies` in `package.json`. When `rollup@X` cannot load its exact-version native binary (e.g. darwin-arm64@X), it falls back to the JS implementation. The JS fallback does not support the source-phase import API that Vite 7 uses internally, producing: `Source phase import "vite/modulepreload-polyfill" in "index.html" must be external` after only ~2 modules transformed.

**How to apply:** Keep these three rollup platform binaries NOT excluded in `pnpm-workspace.yaml`:
- `@rollup/rollup-darwin-arm64` — macOS arm64 (`macos-latest` runner)
- `@rollup/rollup-darwin-x64` — macOS x64
- `@rollup/rollup-win32-x64-msvc` — Windows x64

All other exotic platforms (android, freebsd, linux-arm64, loong64, ppc64, riscv64, s390x, openbsd, openharmony, win32-arm64, win32-ia32) can remain excluded.

## Related wrong fixes (do NOT repeat)

- `optionalDependencies` in root `package.json` pinned to a DIFFERENT version (e.g. 4.59.0 when rollup is 4.62.2) → ABI mismatch, same error.
- `modulePreload: false` in vite.config.ts → shifts error from polyfill to `/src/main.tsx`, masks real cause.
- `--no-frozen-lockfile` alone → does not fix if workspace overrides block the binary.

## Correct lockfile state

`pnpm-lock.yaml` snapshot for `rollup@X` should show:
```yaml
optionalDependencies:
  '@rollup/rollup-darwin-arm64': X
  '@rollup/rollup-darwin-x64': X
  '@rollup/rollup-win32-x64-msvc': X
```
Not `'-'`. Regenerate with `pnpm install --force` after removing the blocking overrides.
