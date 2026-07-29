---
name: Drizzle missing migration records
description: If tables exist in the DB but have no record in drizzle.__drizzle_migrations, the migrator re-runs the SQL and fails. Backfill by inserting SHA-256 of the SQL file + the journal `when` timestamp.
---

## Rule

When `drizzle.__drizzle_migrations` is missing records for migrations whose SQL has already been applied to the database, the Drizzle migrator will attempt to re-run them and fail with `42P07` (relation already exists), even if the migration uses `IF NOT EXISTS`.

**Why:** The migrator compares `folderMillis` (the `when` field in `_journal.json`) against `created_at` in the tracking table. It only skips a migration if its timestamp is already recorded. The custom `migrate.ts` in this project only auto-handles the baseline (idx=0) — it does not detect other gaps.

**How to apply:** To backfill a missing record:
1. Compute SHA-256 of the SQL file content (exactly as Drizzle does).
2. Insert into `drizzle.__drizzle_migrations (hash, created_at)` with `created_at` = the `when` value from `_journal.json` for that entry.
3. Re-run the migrator — it will skip the backfilled entry and only run new ones.

A one-shot backfill script lives at `lib/db/src/backfill-migrations.ts`. Run it with `node --import tsx/esm ./src/backfill-migrations.ts` from `lib/db/`. This was needed for migrations 0003 and 0004 when the journal and DB got out of sync.
