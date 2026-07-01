---
name: React Query persist-client context mismatch
description: Using PersistQueryClientProvider in a pnpm workspace causes "No QueryClient set" because the persist package may resolve its own copy of @tanstack/react-query, creating a separate React context.
---

`@tanstack/react-query-persist-client` imports `QueryClientProvider` from its own bundled/resolved copy of `@tanstack/react-query`. In a pnpm workspace, even when both packages resolve to the same version string, pnpm may install separate instances. `PersistQueryClientProvider` then sets context A, while `useQuery` in the app reads context B — mismatch → "No QueryClient set".

**Why:** Discovered when adding offline cache persistence to the C100 frontend. Same version (5.101.2) reported for both packages by `pnpm list`, yet the context mismatch still occurred.

**How to apply:** Never use `PersistQueryClientProvider` in a pnpm monorepo. Instead, use the functional API:

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const persister = createSyncStoragePersister({ storage: window.localStorage, key: "app-cache-v1" });
const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 86_400_000 } } });

// Call BEFORE the component tree renders — module-level side effect is fine
persistQueryClient({ queryClient, persister, maxAge: 86_400_000 });

// Then use the normal provider — no context mismatch possible
<QueryClientProvider client={queryClient}>...</QueryClientProvider>
```

This keeps a single instance of react-query's context throughout the tree.
gcTime (formerly cacheTime) must be ≥ maxAge for persistence to be meaningful.
