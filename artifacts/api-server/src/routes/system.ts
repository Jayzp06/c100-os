import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, desktopReleasesTable } from "@workspace/db";
import { getOrgSettings, requireAuth } from "../lib/c100";

const router: IRouter = Router();

const BUILD_VERSION = process.env.C100_VERSION ?? "0.1.0";
const BUILD_NUMBER = process.env.C100_BUILD_NUMBER ?? "dev";
const BUILD_TIMESTAMP = process.env.C100_BUILD_TIMESTAMP ?? new Date().toISOString();

router.get(
  "/system/info",
  requireAuth(async (_req, res) => {
    const org = await getOrgSettings();
    res.json({
      appName: "C100 Operations Console",
      chapterName: `${org.chapterName} \u2014 ${org.universityName}`,
      description:
        "Mobile-responsive performance and accountability platform for Collegiate 100 chapter operations: attendance, participation, committees, and eligibility reporting.",
      version: BUILD_VERSION,
      buildNumber: BUILD_NUMBER,
      buildTimestamp: BUILD_TIMESTAMP,
      environment: process.env.NODE_ENV ?? "development",
      serverTime: new Date().toISOString(),
      copyright: `\u00A9 ${new Date().getFullYear()} ${org.chapterName}, ${org.universityName}. All rights reserved.`,
      supportEmail: process.env.C100_SUPPORT_EMAIL ?? "support@fvsu-collegiate100.org",
    });
  }),
);

router.get(
  "/system/releases",
  requireAuth(async (_req, res) => {
    const rows = await db
      .select()
      .from(desktopReleasesTable)
      .orderBy(desc(desktopReleasesTable.pubDate));

    res.json(
      rows.map((r) => ({
        version: r.version,
        channel: r.channel,
        releaseNotes: r.releaseNotes,
        pubDate: r.pubDate.toISOString(),
      })),
    );
  }),
);

async function latestMigrationVersion(): Promise<string | null> {
  try {
    const rows = await db.execute<{ tag: string }>(
      sql`select tag from drizzle.__drizzle_migrations order by created_at desc limit 1`,
    );
    const first = (rows as unknown as { rows: { tag: string }[] }).rows?.[0];
    return first?.tag ?? null;
  } catch {
    return null;
  }
}

router.get(
  "/system/diagnostics",
  requireAuth(async (_req, res) => {
    const dbStart = Date.now();
    let dbConnected = true;
    try {
      await db.execute(sql`select 1`);
    } catch {
      dbConnected = false;
    }
    const dbLatencyMs = Date.now() - dbStart;
    const migrationVersion = dbConnected ? await latestMigrationVersion() : null;

    res.json({
      database: {
        connected: dbConnected,
        latencyMs: dbLatencyMs,
        migrationVersion,
      },
      api: {
        status: "ok",
        latencyMs: 0,
      },
      environment: process.env.NODE_ENV ?? "development",
      serverTime: new Date().toISOString(),
    });
  }),
);

export default router;
