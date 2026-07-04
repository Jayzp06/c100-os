import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { eventsTable, membersTable } from "./c100";

// ─── Executive Meetings, Decisions, and Action Items ───────────────────────
// Schema groundwork for Secretary/officer-collaboration workspaces (Phase 10-13).
// Kept in its own file since it is a new capability area, not part of the core
// membership/attendance model.

export const executiveMeetingsTable = pgTable("executive_meetings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  agendaOwnerId: integer("agenda_owner_id").references(
    () => membersTable.id,
    { onDelete: "set null" },
  ),
  status: varchar("status", { length: 16 }).notNull().default("Scheduled"),
  minutes: text("minutes"),
  minutesRecordedBy: integer("minutes_recorded_by").references(
    () => membersTable.id,
    { onDelete: "set null" },
  ),
  semesterLabel: varchar("semester_label", { length: 24 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ExecutiveMeeting = typeof executiveMeetingsTable.$inferSelect;

export const meetingAgendaItemsTable = pgTable("meeting_agenda_items", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id")
    .notNull()
    .references(() => executiveMeetingsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  ownerId: integer("owner_id").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MeetingAgendaItem = typeof meetingAgendaItemsTable.$inferSelect;

export const decisionsTable = pgTable("decisions", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(
    () => executiveMeetingsTable.id,
    { onDelete: "set null" },
  ),
  description: text("description").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Decision = typeof decisionsTable.$inferSelect;

export const ACTION_ITEM_STATUS_VALUES = [
  "Open",
  "InProgress",
  "Done",
  "Blocked",
] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUS_VALUES)[number];

// Every action item has exactly one owner and a due date, per the chapter
// handbook's operational model (Phase 13).
export const actionItemsTable = pgTable("action_items", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  dueDate: date("due_date").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("Open"),
  sourceMeetingId: integer("source_meeting_id").references(
    () => executiveMeetingsTable.id,
    { onDelete: "set null" },
  ),
  sourceDecisionId: integer("source_decision_id").references(
    () => decisionsTable.id,
    { onDelete: "set null" },
  ),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ActionItem = typeof actionItemsTable.$inferSelect;

// ─── Document Templates and Generated Documents (Phase 14) ─────────────────
// The document-generation architecture maps an event's structured operational
// data (event_operational_details) onto a named template. No fake/hardcoded
// form is baked in — templates are data, so a real approved chapter form can
// be added later without a schema change.

export const DOCUMENT_TEMPLATE_TYPE_VALUES = [
  "FacilityUseRequest",
  "EventPlanningForm",
  "ApprovalDocument",
  "EventSummary",
] as const;
export type DocumentTemplateType =
  (typeof DOCUMENT_TEMPLATE_TYPE_VALUES)[number];

export const documentTemplatesTable = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  templateType: varchar("template_type", { length: 32 }).notNull(),
  // JSON-encoded field schema describing which event_operational_details
  // fields map onto which template fields/labels.
  fieldSchema: text("field_schema").notNull().default("{}"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DocumentTemplate = typeof documentTemplatesTable.$inferSelect;

export const generatedDocumentsTable = pgTable("generated_documents", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => documentTemplatesTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id")
    .notNull()
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  generatedBy: integer("generated_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  // JSON snapshot of the data used at generation time, so the document
  // remains accurate even if the underlying event is edited later.
  dataSnapshot: text("data_snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GeneratedDocument = typeof generatedDocumentsTable.$inferSelect;
