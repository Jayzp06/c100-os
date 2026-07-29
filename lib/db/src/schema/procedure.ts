import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { membersTable } from "./c100";
import { meetingRecordsTable } from "./secretary";
import { governanceDocumentsTable } from "./governance";

// ─── Parliamentarian workspace tables ──────────────────────────────────────

export const MOTION_RESULT_VALUES = [
  "Passed",
  "Failed",
  "Tabled",
  "Withdrawn",
  "Other",
] as const;
export type MotionResult = (typeof MOTION_RESULT_VALUES)[number];

export const motionsTable = pgTable("motions", {
  id: serial("id").primaryKey(),
  motionText: text("motion_text").notNull(),
  meetingRecordId: integer("meeting_record_id").references(
    () => meetingRecordsTable.id,
    { onDelete: "set null" },
  ),
  moverId: integer("mover_id").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  seconderId: integer("seconder_id").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  result: varchar("result", { length: 16 }).notNull().default("Other"),
  voteYes: integer("vote_yes").notNull().default(0),
  voteNo: integer("vote_no").notNull().default(0),
  voteAbstain: integer("vote_abstain").notNull().default(0),
  governanceDocId: integer("governance_doc_id").references(
    () => governanceDocumentsTable.id,
    { onDelete: "set null" },
  ),
  governanceRef: varchar("governance_ref", { length: 200 }),
  notes: text("notes"),
  createdById: integer("created_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Motion = typeof motionsTable.$inferSelect;

export const parliamentaryRulingsTable = pgTable("parliamentary_rulings", {
  id: serial("id").primaryKey(),
  rulingText: text("ruling_text").notNull(),
  authoritySource: varchar("authority_source", { length: 300 }).notNull(),
  meetingRecordId: integer("meeting_record_id").references(
    () => meetingRecordsTable.id,
    { onDelete: "set null" },
  ),
  governanceDocId: integer("governance_doc_id").references(
    () => governanceDocumentsTable.id,
    { onDelete: "set null" },
  ),
  governanceRef: varchar("governance_ref", { length: 200 }),
  createdById: integer("created_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ParliamentaryRuling = typeof parliamentaryRulingsTable.$inferSelect;

export const quorumRecordsTable = pgTable("quorum_records", {
  id: serial("id").primaryKey(),
  meetingRecordId: integer("meeting_record_id").references(
    () => meetingRecordsTable.id,
    { onDelete: "set null" },
  ),
  totalMembership: integer("total_membership").notNull(),
  quorumThreshold: integer("quorum_threshold").notNull(),
  membersPresent: integer("members_present").notNull(),
  quorumMet: integer("quorum_met").notNull().default(0), // 0 = false, 1 = true
  notes: text("notes"),
  createdById: integer("created_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type QuorumRecord = typeof quorumRecordsTable.$inferSelect;
