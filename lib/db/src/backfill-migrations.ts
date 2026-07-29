/**
 * One-time backfill: records migrations 0003 and 0004 in the Drizzle
 * tracking table so the migrator does not try to re-run them.
 * Safe to run multiple times (skips already-recorded entries).
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../drizzle");
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows: current } = await pool.query(
  "SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY id",
);
const currentWhens = new Set(current.map((r: any) => String(r.created_at)));
console.log("[backfill] Recorded timestamps:", [...currentWhens]);

const missing = [
  { tag: "0003_remove_nudge_logs_and_nudge_status", when: 1785349000000 },
  { tag: "0004_officer_workspaces_foundation",      when: 1787000000000 },
];

for (const m of missing) {
  if (currentWhens.has(String(m.when))) {
    console.log("[backfill] Already recorded:", m.tag);
    continue;
  }
  const sql = fs.readFileSync(
    path.join(MIGRATIONS_DIR, `${m.tag}.sql`),
    "utf-8",
  );
  const hash = createHash("sha256").update(sql).digest("hex");
  await pool.query(
    "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
    [hash, m.when],
  );
  console.log(`[backfill] Recorded ${m.tag} (hash=${hash.slice(0, 12)}…)`);
}

await pool.end();
console.log("[backfill] Done.");
