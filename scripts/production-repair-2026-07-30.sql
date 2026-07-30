-- ============================================================
-- C100 Production Data Repair — 2026-07-30
--
-- PURPOSE
--   Remove fake seed events and attendance, reconcile committees.
--   Run this in the Replit production DB pane (database/production).
--   The RBAC seed runs automatically on the next server restart after Publish.
--
-- DRY-RUN VERIFIED FACTS (read-only audit 2026-07-30):
--   Fake seed events:
--     Batch 1 (2026-04-30): IDs 1-8
--     Batch 2 (2026-07-01 18:13 UTC): IDs 9-16
--     Batch 3 (2026-07-01 18:37 UTC): IDs 17-24
--   Attendance records on fake events: event_ids 1,2,3,4,5,9,10,11,12,13,17,18,19,20,21,22
--   Total attendance records before repair: 213
--   Events to preserve: 27 ("Test 2"), 28 ("Calander test1")
--
--   Committees:
--     Bylaws (id=5):               0 members, 0 events → deactivate
--     Economic Development (id=3): 0 members, 2 events (3,7 → deleted here) → deactivate
--     Economic Empowerment (id=8): 2 members (Roland Carter, Brandon Sims) → rename
--
--   Members confirmed preserved: Jaylin Phillips (id=19), Kaleb Baldwin (id=53), Paris Jolley (id=54)
--   Fake/test members: Toeattryin (id=52) — confirm with user before deleting
--
-- INSTRUCTIONS:
--   1. Confirm this list matches what you see in the database pane.
--   2. Run the BEGIN...COMMIT block below.
--   3. Run the verification queries at the bottom to confirm results.
-- ============================================================

BEGIN;

-- ── Step 1: Delete attendance records for fake seed events ─────────────────
DELETE FROM attendance
WHERE event_id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24);

-- ── Step 2: Delete check-in sessions linked to fake events (if table exists)
-- Wrapped in a DO block so it skips gracefully if the table doesn't exist.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'check_in_sessions') THEN
    DELETE FROM check_in_sessions
    WHERE event_id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24);
  END IF;
END;
$$;

-- ── Step 3: Delete the fake events ────────────────────────────────────────
DELETE FROM events
WHERE id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24);

-- ── Step 4: Deactivate Bylaws committee (no members, no events) ───────────
UPDATE committees SET active = false WHERE id = 5;

-- ── Step 5: Deactivate Economic Development (no members, events deleted) ──
UPDATE committees SET active = false WHERE id = 3;

-- ── Step 6: Rename Economic Empowerment → canonical merged name ───────────
UPDATE committees
SET
  name        = 'Economic Empowerment & Development',
  description = 'Hosts financial-literacy series, professional development clinics, '
             || 'and chapter fundraising. Empowers members through economic education '
             || 'and community investment.'
WHERE id = 8;

COMMIT;

-- ============================================================
-- VERIFICATION — run after the transaction above
-- ============================================================

-- Should return only events 27 and 28
SELECT id, title, status FROM events ORDER BY id;

-- Should show Bylaws and Economic Development as inactive (active = f)
SELECT id, name, active FROM committees ORDER BY id;

-- Should be 0 (all fake attendance deleted)
SELECT COUNT(*) AS remaining_attendance FROM attendance WHERE event_id <= 24;

-- Should show Economic Empowerment & Development as the only active economic committee
SELECT id, name, active FROM committees WHERE name ILIKE '%economic%' ORDER BY id;
