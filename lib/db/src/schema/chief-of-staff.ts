/**
 * Chief of Staff workspace schema.
 *
 * Executive action items, assignments, collaborators, and decision log.
 * All tables are gated by manage_executive_operations — no cross-domain
 * data is stored here; linked records reference only their opaque IDs.
 */
import {
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { eventsTable, membersTable } from "./c100";
import { executiveMeetingsTable } from "./governance";

export const EXEC_TASK_PRIORITY_VALUES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export type ExecTaskPriority = (typeof EXEC_TASK_PRIORITY_VALUES)[number];

export const EXEC_TASK_STATUS_VALUES = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
  "archived",
] as const;
export type ExecTaskStatus = (typeof EXEC_TASK_STATUS_VALUES)[number];

export const executiveTasksTable = pgTable("executive_tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  /** Primary responsible officer. */
  ownerId: integer("owner_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "restrict" }),
  priority: varchar("priority", { length: 16 }).notNull().default("medium"),
  status: varchar("status", { length: 16 }).notNull().default("not_started"),
  dueDate: date("due_date"),
  completionDate: timestamp("completion_date", { withTimezone: true }),
  /**
   * Slug of the related officer workspace (e.g. "treasurer", "secretary").
   * Chief of Staff can see the name but NOT the underlying records unless
   * they separately hold that workspace's permission.
   */
  relatedWorkspace: varchar("related_workspace", { length: 64 }),
  /**
   * Opaque identifier pointing to a source record in another workspace.
   * Format: "{workspace}:{id}" — e.g. "finances:42". Opening the record
   * requires the domain permission, not manage_executive_operations.
   */
  relatedSourceRecord: varchar("related_source_record", { length: 200 }),
  /** Optional: the meeting that generated this action item. */
  sourceMeetingId: integer("source_meeting_id").references(
    () => executiveMeetingsTable.id,
    { onDelete: "set null" },
  ),
  /** Optional: the event tied to this task. */
  sourceEventId: integer("source_event_id").references(() => eventsTable.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  updatedById: integer("updated_by_id").references(() => membersTable.id, {
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

export type ExecutiveTask = typeof executiveTasksTable.$inferSelect;

export const executiveTaskCollaboratorsTable = pgTable(
  "executive_task_collaborators",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => executiveTasksTable.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    addedById: integer("added_by_id").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("uq_task_collaborator").on(t.taskId, t.memberId)],
);

export type ExecutiveTaskCollaborator =
  typeof executiveTaskCollaboratorsTable.$inferSelect;
