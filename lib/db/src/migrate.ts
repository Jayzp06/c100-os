/**
 * Drizzle migration runner.
 *
 * Strategy for the baseline migration (0000_baseline.sql):
 *   The original 12 tables were created via `drizzle-kit push`, so there is no
 *   migration history. Drizzle's migrator uses schema `drizzle`, table
 *   `__drizzle_migrations`, and compares each migration's `folderMillis`
 *   timestamp against the last recorded `created_at`.
 *
 *   On first run we:
 *     1. Create the drizzle schema + tracking table if absent.
 *     2. Compute the SHA-256 hash of 0000_baseline.sql (exactly as Drizzle does).
 *     3. Insert the baseline row with its `when` timestamp from _journal.json.
 *   Drizzle then skips the baseline (already recorded) and only runs new ones.
 *
 * Usage:
 *   pnpm --filter @workspace/db run migrate
 *   Also exported and called by the API server on startup.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../drizzle");
const DRIZZLE_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

function getJournal(): JournalEntry[] {
  const raw = fs.readFileSync(
    path.join(MIGRATIONS_DIR, "meta/_journal.json"),
    "utf-8",
  );
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
}

export async function runMigrations(connectionString?: string): Promise<void> {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  // 1. Ensure the drizzle schema and tracking table exist.
  await pool.query(
    `CREATE SCHEMA IF NOT EXISTS ${DRIZZLE_SCHEMA}`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${DRIZZLE_SCHEMA}.${MIGRATIONS_TABLE} (
      id         SERIAL PRIMARY KEY,
      hash       TEXT NOT NULL,
      created_at BIGINT
    )
  `);

  // 2. If no migrations have been recorded, mark the baseline as pre-applied.
  //    This prevents Drizzle from trying to CREATE TABLE on tables that already exist.
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM ${DRIZZLE_SCHEMA}.${MIGRATIONS_TABLE} LIMIT 1`,
  );

  if (rows.length === 0) {
    const journal = getJournal();
    const baseline = journal.find((e) => e.idx === 0);
    if (!baseline) throw new Error("No baseline (idx=0) in migration journal");

    const baselineSql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, `${baseline.tag}.sql`),
      "utf-8",
    );
    const hash = createHash("sha256").update(baselineSql).digest("hex");

    await pool.query(
      `INSERT INTO ${DRIZZLE_SCHEMA}.${MIGRATIONS_TABLE} (hash, created_at)
       VALUES ($1, $2)`,
      [hash, baseline.when],
    );
    console.log(
      `[migrate] Baseline pre-applied (hash=${hash.slice(0, 12)}…, when=${baseline.when})`,
    );
  }

  // 3. Run all pending migrations. Drizzle skips anything already in the table.
  console.log(`[migrate] Applying pending migrations from ${MIGRATIONS_DIR}`);
  await migrate(db, {
    migrationsFolder: MIGRATIONS_DIR,
    migrationsTable: MIGRATIONS_TABLE,
    migrationsSchema: DRIZZLE_SCHEMA,
  });

  console.log("[migrate] All migrations applied successfully");
  await pool.end();
}

// Run directly when invoked as a script.
if (process.argv[1]) {
  if (!process.env.DATABASE_URL) {
    console.error("[migrate] DATABASE_URL must be set");
    process.exit(1);
  }
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[migrate] Failed:", err);
      process.exit(1);
    });
}
