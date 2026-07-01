import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

// ─── Organizations ─────────────────────────────────────────────────────────────
// Root multi-chapter entity.  All roles, permissions, and chapter data ultimately
// belong to an Organization.  The current FVSU Trailblazing instance is seeded
// as the default organization (id = 1, slug = "fvsu-trailblazing").

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  shortName: varchar("short_name", { length: 64 }),
  logoUrl: varchar("logo_url", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Organization = typeof organizationsTable.$inferSelect;
