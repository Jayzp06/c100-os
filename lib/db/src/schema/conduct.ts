import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { membersTable, eventsTable } from "./c100";

// ─── Sergeant-at-Arms workspace tables ─────────────────────────────────────

export const CONDUCT_RECORD_TYPE_VALUES = [
  "IncidentReport",
  "AttendanceIrregularity",
  "MeetingOrderNote",
] as const;
export type ConductRecordType = (typeof CONDUCT_RECORD_TYPE_VALUES)[number];

export const CONDUCT_RECORD_STATUS_VALUES = [
  "Open",
  "UnderReview",
  "Resolved",
  "Archived",
] as const;
export type ConductRecordStatus = (typeof CONDUCT_RECORD_STATUS_VALUES)[number];

export const conductRecordsTable = pgTable("conduct_records", {
  id: serial("id").primaryKey(),
  recordType: varchar("record_type", { length: 32 }).notNull(),
  reportDate: varchar("report_date", { length: 20 }).notNull(), // ISO date string
  memberId: integer("member_id").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  eventId: integer("event_id").references(() => eventsTable.id, {
    onDelete: "set null",
  }),
  summary: text("summary").notNull(),
  privateDetails: text("private_details").notNull().default(""),
  status: varchar("status", { length: 16 }).notNull().default("Open"),
  resolution: text("resolution"),
  reporterId: integer("reporter_id").references(() => membersTable.id, {
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

export type ConductRecord = typeof conductRecordsTable.$inferSelect;
