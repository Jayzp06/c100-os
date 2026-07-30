-- ============================================================
-- C100 Production Data Repair — 2026-07-30 (REVISED v2)
--
-- PURPOSE
--   Remove all fake/test events and their dependent rows.
--   Reconcile duplicate economic committees and deactivate Bylaws.
--   Safe to run multiple times (idempotent).
--
-- ── PRE-EXECUTION CHECKLIST ─────────────────────────────────
--   [ ] Confirm Replit database checkpoint/backup is current.
--       (Replit creates automatic database snapshots. Verify via
--        the Replit DB pane → "Backups" before proceeding.)
--   [ ] Run the PRE-CHANGE VERIFICATION block below and save output.
--   [ ] Have this file open in a second tab so you can compare
--       PRE vs POST counts after the transaction commits.
--
-- ── DRY-RUN VERIFIED FACTS (2026-07-30) ─────────────────────
--   Events to delete (all confirmed test/seed data):
--     IDs 1–8   : Batch 1 seed (2026-04-30) — 6 with attendance
--     IDs 9–16  : Batch 2 seed (2026-07-01 18:13 UTC) — 5 with attendance
--     IDs 17–24 : Batch 3 seed (2026-07-01 18:37 UTC) — 5 with attendance
--     ID  27    : "Test 2"       — created by member 53; description says
--                  "test to see if event can be created after its end time"
--                  — zero attendance, zero child rows
--     ID  28    : "Calander test1" — created by member 53; description "1";
--                  future date with wrong semester label
--                  — zero attendance, zero child rows
--
--   Total attendance records to delete: 213 (events 1–22 only; 27/28 = 0)
--   Total events to delete: 26 (IDs 1–24, 27, 28)
--
--   Events to preserve: NONE — final state has zero events
--
--   FK dependencies confirmed in production:
--     attendance.event_id             → events  (213 rows, all on IDs 1-22)
--     conduct_records.event_id        → events  (0 rows on any target event)
--     event_operational_details.event_id → events (0 rows on any target event)
--     executive_tasks.source_event_id → events  (0 rows on any target event)
--     generated_documents.event_id    → events  (0 rows on any target event)
--
--   Committees:
--     Bylaws (id=5):               0 members, 0 events → deactivate
--     Economic Development (id=3): 0 members, events deleted above → deactivate
--     Economic Empowerment (id=8): 2 members (Roland Carter, Brandon Sims)
--                                  → rename to "Economic Empowerment & Development"
--
--   Members: NOT touched. Members 52–54 preserved pending Jaylin confirmation.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PRE-CHANGE VERIFICATION — run these first and save the output
-- ─────────────────────────────────────────────────────────────
-- SELECT id, title, status, committee_id, created_at FROM events ORDER BY id;
-- SELECT event_id, COUNT(*) cnt FROM attendance GROUP BY event_id ORDER BY event_id;
-- SELECT id, name, active FROM committees ORDER BY id;
-- SELECT COUNT(*) AS total_events FROM events;
-- SELECT COUNT(*) AS total_attendance FROM attendance;
-- SELECT COUNT(*) AS total_conduct_on_targets
--   FROM conduct_records WHERE event_id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,27,28);
-- SELECT COUNT(*) AS total_gendocs_on_targets
--   FROM generated_documents WHERE event_id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,27,28);

-- ─────────────────────────────────────────────────────────────
-- REPAIR TRANSACTION
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- ── Step 1: Delete attendance for all target events ───────────────────────
-- Expected: 213 rows deleted (all on IDs 1–22; IDs 23,24,27,28 = 0 attendance)
DELETE FROM attendance
WHERE event_id IN (
  1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
  17,18,19,20,21,22,23,24,27,28
);

-- ── Step 2: Defensive deletes for other FK children ───────────────────────
-- All confirmed empty for target IDs, but executed defensively in case
-- data was added between audit and execution.
DELETE FROM conduct_records
WHERE event_id IN (
  1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
  17,18,19,20,21,22,23,24,27,28
);

DELETE FROM event_operational_details
WHERE event_id IN (
  1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
  17,18,19,20,21,22,23,24,27,28
);

DELETE FROM executive_tasks
WHERE source_event_id IN (
  1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
  17,18,19,20,21,22,23,24,27,28
);

DELETE FROM generated_documents
WHERE event_id IN (
  1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
  17,18,19,20,21,22,23,24,27,28
);

-- ── Step 3: Delete the target events ─────────────────────────────────────
-- Expected: 26 rows deleted (IDs 1-24, 27, 28)
DELETE FROM events
WHERE id IN (
  1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
  17,18,19,20,21,22,23,24,27,28
);

-- ── Step 4: Deactivate Bylaws committee ───────────────────────────────────
-- Expected: 1 row updated (id=5, active: true → false)
-- No-op if already deactivated (idempotent).
UPDATE committees SET active = false WHERE id = 5 AND active = true;

-- ── Step 5: Deactivate Economic Development committee ─────────────────────
-- Expected: 1 row updated (id=3, active: true → false)
UPDATE committees SET active = false WHERE id = 3 AND active = true;

-- ── Step 6: Rename Economic Empowerment → canonical merged name ───────────
-- Expected: 1 row updated (id=8)
-- No-op if already renamed (idempotent).
UPDATE committees
SET
  name        = 'Economic Empowerment & Development',
  description = 'Hosts financial-literacy series, professional development clinics, '
             || 'and chapter fundraising. Empowers members through economic education '
             || 'and community investment.'
WHERE id = 8
  AND name != 'Economic Empowerment & Development';

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- POST-CHANGE VERIFICATION — run after COMMIT and compare to PRE
-- ─────────────────────────────────────────────────────────────

-- ① Events: should return 0 rows
SELECT id, title, status FROM events ORDER BY id;

-- ② Attendance: should return 0 rows
SELECT COUNT(*) AS remaining_attendance FROM attendance;

-- ③ Committees: Bylaws (5) and Economic Development (3) should show active=f;
--              Economic Empowerment & Development (8) should be active=t
SELECT id, name, active FROM committees ORDER BY id;

-- ④ Orphan check — should return 0 for each
SELECT COUNT(*) AS orphan_attendance FROM attendance a
  WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = a.event_id);
SELECT COUNT(*) AS orphan_conduct FROM conduct_records c
  WHERE c.event_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id = c.event_id);
SELECT COUNT(*) AS orphan_gendocs FROM generated_documents g
  WHERE g.event_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id = g.event_id);

-- ⑤ Member count: must be unchanged (no member rows touched)
SELECT COUNT(*) AS total_members FROM members;
