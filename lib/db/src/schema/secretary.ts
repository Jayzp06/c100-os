import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { membersTable } from "./c100";

// ─── Secretary workspace tables ────────────────────────────────────────────────

export const MEETING_TYPE_VALUES = [
  "GeneralBody",
  "ExecutiveBoard",
  "Committee",
  "Special",
  "Emergency",
  "Other",
] as const;
export type MeetingType = (typeof MEETING_TYPE_VALUES)[number];

export const MEETING_RECORD_STATUS_VALUES = [
  "draft",
  "submitted",
  "approved",
  "archived",
] as const;
export type MeetingRecordStatus = (typeof MEETING_RECORD_STATUS_VALUES)[number];

export const meetingRecordsTable = pgTable("meeting_records", {
  id: serial("id").primaryKey(),
  meetingType: varchar("meeting_type", { length: 32 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  meetingDate: varchar("meeting_date", { length: 20 }).notNull(), // ISO date string
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  agendaText: text("agenda_text"),
  notes: text("notes"),
  preparedById: integer("prepared_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  approvedById: integer("approved_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type MeetingRecord = typeof meetingRecordsTable.$inferSelect;

export const meetingRecordRevisionsTable = pgTable(
  "meeting_record_revisions",
  {
    id: serial("id").primaryKey(),
    meetingRecordId: integer("meeting_record_id")
      .notNull()
      .references(() => meetingRecordsTable.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull().default(1),
    reason: text("reason").notNull().default(""),
    snapshot: text("snapshot").notNull().default("{}"),
    revisedById: integer("revised_by").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    revisedAt: timestamp("revised_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type MeetingRecordRevision =
  typeof meetingRecordRevisionsTable.$inferSelect;

export const CORRESPONDENCE_DIRECTION_VALUES = [
  "Inbound",
  "Outbound",
] as const;
export type CorrespondenceDirection =
  (typeof CORRESPONDENCE_DIRECTION_VALUES)[number];

export const correspondenceLogTable = pgTable("correspondence_log", {
  id: serial("id").primaryKey(),
  direction: varchar("direction", { length: 16 }).notNull(),
  correspondent: varchar("correspondent", { length: 200 }).notNull(),
  subject: varchar("subject", { length: 300 }).notNull(),
  dateSent: varchar("date_sent", { length: 20 }).notNull(), // ISO date string
  description: text("description").notNull().default(""),
  attachmentStorageKey: varchar("attachment_storage_key", { length: 500 }),
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

export type CorrespondenceLog = typeof correspondenceLogTable.$inferSelect;
