/**
 * repairProductionData — idempotent one-time data repair for production.
 *
 * Runs on every server startup; all operations are idempotent (no-op when
 * already applied).  Repairs applied:
 *
 *   1. Delete test/seed attendance rows for event IDs 1–24, 27, 28.
 *   2. Delete FK dependents (conduct_records, event_operational_details,
 *      executive_tasks, generated_documents) for the same event IDs.
 *   3. Delete the 26 test/seed events themselves.
 *   4. Deactivate committee 3 (Economic Development) — empty, test-only.
 *   5. Deactivate committee 5 (Bylaws) — not a participation committee.
 *   6. Rename committee 8 to "Economic Empowerment & Development".
 *
 * Guard: checks whether committee 3 or 5 is still active, and whether any
 * events still exist, before doing any writes.  If already applied → skip.
 */

import { logger } from "./logger";
import {
  db,
  committeesTable,
  eventsTable,
  attendanceTable,
  conductRecordsTable,
  eventOperationalDetailsTable,
  executiveTasksTable,
  generatedDocumentsTable,
} from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";

const TEST_EVENT_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 23, 24, 27, 28,
];

export async function repairProductionData(): Promise<void> {
  // ── Idempotency guard ─────────────────────────────────────────────────────
  const [committeeCheck, eventCheck] = await Promise.all([
    db
      .select({ id: committeesTable.id })
      .from(committeesTable)
      .where(
        or(
          eq(committeesTable.id, 3),
          eq(committeesTable.id, 5),
        ),
      )
      .then((rows) => rows.filter((r) => r.id !== null)),
    db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(inArray(eventsTable.id, TEST_EVENT_IDS))
      .limit(1),
  ]);

  // Check if committee ids 3 or 5 are still active
  const activeCommittees = await db
    .select({ id: committeesTable.id, active: committeesTable.active })
    .from(committeesTable)
    .where(
      or(
        eq(committeesTable.id, 3),
        eq(committeesTable.id, 5),
      ),
    );

  const anyCommitteeActive = activeCommittees.some((c) => c.active);
  const hasTestEvents = eventCheck.length > 0;

  if (!anyCommitteeActive && !hasTestEvents) {
    logger.info("Production data repair: already applied — skipping");
    return;
  }

  logger.info(
    { anyCommitteeActive, hasTestEvents },
    "Production data repair: applying",
  );

  // ── Step 1: Delete FK dependents for test events ──────────────────────────
  const [attDel, conductDel, opDetailsDel, tasksDel, genDocsDel] =
    await Promise.all([
      db
        .delete(attendanceTable)
        .where(inArray(attendanceTable.eventId, TEST_EVENT_IDS)),
      db
        .delete(conductRecordsTable)
        .where(inArray(conductRecordsTable.eventId, TEST_EVENT_IDS)),
      db
        .delete(eventOperationalDetailsTable)
        .where(inArray(eventOperationalDetailsTable.eventId, TEST_EVENT_IDS)),
      db
        .delete(executiveTasksTable)
        .where(inArray(executiveTasksTable.sourceEventId, TEST_EVENT_IDS)),
      db
        .delete(generatedDocumentsTable)
        .where(inArray(generatedDocumentsTable.eventId, TEST_EVENT_IDS)),
    ]);
  void [committeeCheck, attDel, conductDel, opDetailsDel, tasksDel, genDocsDel];

  logger.info("Production data repair: FK dependents deleted");

  // ── Step 2: Delete test events ────────────────────────────────────────────
  await db
    .delete(eventsTable)
    .where(inArray(eventsTable.id, TEST_EVENT_IDS));

  logger.info("Production data repair: test events deleted");

  // ── Step 3: Deactivate committees 3 and 5 ────────────────────────────────
  await db
    .update(committeesTable)
    .set({ active: false })
    .where(
      or(
        eq(committeesTable.id, 3),
        eq(committeesTable.id, 5),
      ),
    );

  logger.info("Production data repair: committees 3 and 5 deactivated");

  // ── Step 4: Rename committee 8 ────────────────────────────────────────────
  await db
    .update(committeesTable)
    .set({
      name: "Economic Empowerment & Development",
      description:
        "Hosts financial-literacy series, professional development clinics, " +
        "and chapter fundraising. Empowers members through economic education " +
        "and community investment.",
    })
    .where(eq(committeesTable.id, 8));

  logger.info(
    "Production data repair: committee 8 renamed to 'Economic Empowerment & Development'",
  );

  logger.info("Production data repair: complete");
}
