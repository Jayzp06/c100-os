---
name: Await in sync callbacks
description: Using await inside .map() or .filter() callbacks causes TS1308 because the callback is not async. Pre-fetch async values before the callback.
---

TypeScript (TS1308) rejects `await` expressions inside a non-async function, including arrow-function callbacks passed to `.map()` and `.filter()`.

**Why:** Encountered in committees.ts and reports.ts when replacing `CURRENT_SEMESTER` with `await getActiveSemester()` inside `.map()` and `.filter()` callbacks.

**How to apply:** Always pre-fetch any async value before a synchronous callback:

```typescript
// WRONG
const dtos = items.map((item) => ({
  semester: await getActiveSemester(), // TS1308
}));

// CORRECT
const sem = await getActiveSemester();
const dtos = items.map((item) => ({
  semester: sem,
}));
```

For multiple concurrent fetches, use `Promise.all` before the map:
```typescript
const [items, sem] = await Promise.all([
  db.select().from(table),
  getActiveSemester(),
]);
const dtos = items.map((item) => ({ semester: sem, ...item }));
```
