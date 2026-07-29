import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { membersTable } from "./c100";

// ─── Historian workspace tables ─────────────────────────────────────────────

export const ARCHIVE_CATEGORY_VALUES = [
  "Photo",
  "Program",
  "Flyer",
  "Award",
  "Announcement",
  "Milestone",
  "Other",
] as const;
export type ArchiveCategory = (typeof ARCHIVE_CATEGORY_VALUES)[number];

export const ARCHIVE_VISIBILITY_VALUES = ["Officers", "Public"] as const;
export type ArchiveVisibility = (typeof ARCHIVE_VISIBILITY_VALUES)[number];

export const archiveEntriesTable = pgTable("archive_entries", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  eventDate: varchar("event_date", { length: 20 }).notNull(), // ISO date string
  category: varchar("category", { length: 32 }).notNull().default("Other"),
  peopleText: text("people_text"),
  // JSON-encoded integer array of member ids
  memberRefs: text("member_refs").notNull().default("[]"),
  storageKey: varchar("storage_key", { length: 500 }),
  originalFilename: varchar("original_filename", { length: 300 }),
  visibility: varchar("visibility", { length: 16 }).notNull().default("Officers"),
  // JSON-encoded string array
  tags: text("tags").notNull().default("[]"),
  createdById: integer("created_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ArchiveEntry = typeof archiveEntriesTable.$inferSelect;
