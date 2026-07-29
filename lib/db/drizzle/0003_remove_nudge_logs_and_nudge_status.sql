-- Migration: remove nudge feature
-- Drops the nudge_logs table and nudge_status column from members.
-- Safe to run on a database that has already had nudge_logs data cleared.

ALTER TABLE "members" DROP COLUMN IF EXISTS "nudge_status";
DROP TABLE IF EXISTS "nudge_logs" CASCADE;
