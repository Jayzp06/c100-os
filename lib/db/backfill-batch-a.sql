-- Batch A / A2 — one-time data backfill and consolidation.
-- Idempotent: safe to re-run (uses WHERE NOT EXISTS / ON CONFLICT guards).

BEGIN;

-- 1) De-duplicate committee_assignments (earlier seeding produced exact dupes).
DELETE FROM committee_assignments a
USING committee_assignments b
WHERE a.id > b.id
  AND a.member_id = b.member_id
  AND a.committee_id = b.committee_id
  AND a.role = b.role;

-- 2) Merge duplicate committee "Economic Development" (id 3) into
--    "Economic Empowerment" (id 8) — same chair (Roland Carter, member 6).
UPDATE members SET committee_id = 8 WHERE committee_id = 3;
UPDATE events SET committee_id = 8 WHERE committee_id = 3;
UPDATE committee_assignments SET committee_id = 8 WHERE committee_id = 3;

-- Re-dedupe after the repoint (member 6 was chair of both 3 and 8).
DELETE FROM committee_assignments a
USING committee_assignments b
WHERE a.id > b.id
  AND a.member_id = b.member_id
  AND a.committee_id = b.committee_id
  AND a.role = b.role;

DELETE FROM committees WHERE id = 3;

-- 3) Sync stale chair_user_id for Community Service (id 11) —
--    committee_assignments already has Darius Freeman (27) as chair.
UPDATE committees SET chair_user_id = 27 WHERE id = 11 AND chair_user_id IS NULL;

-- 4) Convert Bylaws from a normal committee to a support-officer role:
--    mark inactive, keep the row for historical event/attendance references.
UPDATE committees SET active = false WHERE id = 5;

-- 5) Backfill member_org_roles for leadership positions not yet mapped from
--    the legacy `members.role` / `committees.chair_user_id` / `officer_terms` data.
--    (general_member baseline rows are left in place — permissions union across
--    all of a member's org roles, so this is additive, not a replacement.)
INSERT INTO member_org_roles (member_id, org_role_id, granted_at)
SELECT m.id, r.id, now()
FROM (VALUES
  (1, 'president'),
  (2, 'vice_president'),
  (3, 'treasurer'),
  (3, 'bylaws_officer'),
  (4, 'mentoring_chair'),
  (5, 'education_chair'),
  (6, 'economic_empowerment_chair'),
  (7, 'health_wellness_chair'),
  (27, 'community_service_chair')
) AS m(id, slug)
JOIN org_roles r ON r.slug = m.slug
WHERE NOT EXISTS (
  SELECT 1 FROM member_org_roles mor
  WHERE mor.member_id = m.id AND mor.org_role_id = r.id
);

-- 6) Backfill officer_terms for the committee chairs (already exist for
--    president/vice_president/treasurer from the Phase 0 migration), so every
--    leadership position is time-bound and auditable the same way.
INSERT INTO officer_terms (member_id, position, position_type, started_at, semester_label, notes)
SELECT m.id, m.position, 'appointed', '2026-01-08', 'Spring 2026', 'Backfilled from committee chair_user_id (Batch A)'
FROM (VALUES
  (4, 'mentoring_chair'),
  (5, 'education_chair'),
  (6, 'economic_empowerment_chair'),
  (7, 'health_wellness_chair'),
  (27, 'community_service_chair')
) AS m(id, position)
WHERE NOT EXISTS (
  SELECT 1 FROM officer_terms ot
  WHERE ot.member_id = m.id AND ot.position = m.position AND ot.ended_at IS NULL
);

COMMIT;
