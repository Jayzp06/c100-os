---
name: Exec Suite Tauri fetch
description: How exec workspace pages make authenticated API calls in Tauri vs web.
---

## Rule
All exec workspace pages that use raw `fetch()` must import and use `apiFetch()` from `@/lib/desktop-auth` instead.

**Why:** In Tauri, the webview has no cookie session with the production server. Every protected request must carry `Authorization: Bearer <token>` and resolve against `DESKTOP_API_URL`. Raw `fetch("/api/...")` succeeds in web (cookie auth) but 401s in Tauri.

**How to apply:**
- `apiFetch(path, init?)` in desktop-auth.ts: Tauri → prepends `DESKTOP_API_URL`, adds Bearer token. Web → passes through unchanged.
- Pages already on the generated API client hooks (`useGetAdminOverview`, `useListCommittees`, etc.) do NOT need apiFetch — `setAuthTokenGetter` handles them.
- Affected pages (as of v0.9.7): bylaws, chief-of-staff, historian, parliamentarian, secretary, sergeant-at-arms, treasurer.
- President and vice-president use generated hooks — no change needed.
- When adding a new exec page, always check whether it uses raw `fetch()` or generated hooks.
