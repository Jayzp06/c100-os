---
name: Drizzle migrate baseline strategy
description: How to pre-register an existing baseline migration so Drizzle skips re-running it on tables that already exist.
---

## Rule
When adopting versioned Drizzle migrations on an existing database, compute the SHA-256 of the baseline SQL file and insert it into `drizzle.__drizzle_migrations` with the exact `when` timestamp from `meta/_journal.json` **before** calling `migrate()`. This tells Drizzle the baseline already ran.

## Why
Drizzle's `migrate()` compares applied migrations by their `folderMillis` timestamp (the numeric prefix in `meta/_journal.json`). If the baseline row is absent, it tries to re-run baseline DDL against tables that already exist and crashes with "relation already exists".

## How to apply
- In `lib/db/src/migrate.ts`, read the journal, compute SHA-256 of baseline SQL (Node `crypto.createHash('sha256')`), then `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($hash, $when) ON CONFLICT DO NOTHING` before calling `migrate(db, { migrationsFolder, migrationsTable: '__drizzle_migrations', migrationsSchema: 'drizzle' })`.
- Delta migrations (0001, 0002, …) are applied normally by `migrate()`.
- `drizzle.config.ts` must have `migrationsTable: '__drizzle_migrations'` and `migrationsSchema: 'drizzle'`.
