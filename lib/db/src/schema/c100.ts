import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { organizationsTable } from "./orgs";

export const ROLE_VALUES = [
  "Member",
  "CommitteeChair",
  "BylawsChair",
  "ExecutiveBoard",
  "Admin",
  "TechnologyChair",
] as const;
export type Role = (typeof ROLE_VALUES)[number];

export const MEMBERSHIP_STATUS_VALUES = [
  "Active",
  "Probationary",
  "Suspended",
  "Inactive",
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUS_VALUES)[number];

export const EVENT_TYPE_VALUES = [
  "GeneralBodyMeeting",
  "CommitteeMeeting",
  "CommunityService",
  "MentoringSession",
  "Workshop",
  "Fundraiser",
  "Conference",
  "Social",
] as const;
export type EventType = (typeof EVENT_TYPE_VALUES)[number];

export const EVENT_STATUS_VALUES = [
  "Upcoming",
  "Active",
  "Completed",
  "Cancelled",
] as const;
export type EventStatus = (typeof EVENT_STATUS_VALUES)[number];

export const ATTENDANCE_METHOD_VALUES = [
  "QrScan",
  "Manual",
  "Corrected",
] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHOD_VALUES)[number];

export const EXPERIENCE_TYPE_VALUES = [
  "operations_console",
  "committee_portal",
  "member_portal",
] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPE_VALUES)[number];

export const EVENT_VISIBILITY_VALUES = [
  "Chapter",
  "Committee",
  "Private",
] as const;
export type EventVisibility = (typeof EVENT_VISIBILITY_VALUES)[number];

export const EVENT_ELIGIBILITY_VALUES = ["Chapter", "Committee"] as const;
export type EventEligibility = (typeof EVENT_ELIGIBILITY_VALUES)[number];

export const committeesTable = pgTable("committees", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description").notNull().default(""),
  fourForFutureAlignment: varchar("four_for_future_alignment", { length: 80 })
    .notNull()
    .default(""),
  chairUserId: integer("chair_user_id"),
  // Inactive committees (e.g. retired/merged) are hidden from active rosters
  // and leaderboards but their historical events/attendance are preserved.
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const membersTable = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(
      () => organizationsTable.id,
      { onDelete: "set null" },
    ),
    authId: varchar("auth_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    email: varchar("email", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    studentId: varchar("student_id", { length: 32 }),
    gpa: numeric("gpa", { precision: 4, scale: 2 }),
    graduationYear: integer("graduation_year"),
    role: varchar("role", { length: 32 }).notNull().default("Member"),
    committeeId: integer("committee_id").references(() => committeesTable.id, {
      onDelete: "set null",
    }),
    membershipStatus: varchar("membership_status", { length: 32 })
      .notNull()
      .default("Active"),
    duesPaid: boolean("dues_paid").notNull().default(false),
    dateJoined: timestamp("date_joined", { withTimezone: true })
      .notNull()
      .defaultNow(),
    streakCount: integer("streak_count").notNull().default(0),
    accountActive: boolean("account_active").notNull().default(true),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    profileImageUrl: varchar("profile_image_url", { length: 500 }),
    // Soft-delete: member is hidden from active rosters/counts but attendance,
    // audit-log, and historical references are preserved. Never hard-deleted.
    // Real historical data is protected by this soft-delete/restore mechanism
    // plus the audit_log trail, not by classifying rows as seed-vs-real.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("members_committee_idx").on(table.committeeId)],
);

export const eventsTable = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    committeeId: integer("committee_id").references(() => committeesTable.id, {
      onDelete: "set null",
    }),
    createdBy: integer("created_by")
      .notNull()
      .references(() => membersTable.id, { onDelete: "set null" }),
    // Ownership is distinct from "who created the row" — ownership can be
    // reassigned (e.g. a chair hands an event off) without losing audit trail.
    ownerId: integer("owner_id").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    // Who can SEE this event in listings (separate from who it counts for).
    visibility: varchar("visibility", { length: 16 })
      .notNull()
      .default("Chapter"),
    // Whose attendance/points this event counts toward (separate from visibility).
    attendanceEligibility: varchar("attendance_eligibility", { length: 16 })
      .notNull()
      .default("Chapter"),
    date: date("date").notNull(),
    startTime: varchar("start_time", { length: 8 }).notNull(),
    endTime: varchar("end_time", { length: 8 }).notNull(),
    location: varchar("location", { length: 200 }).notNull(),
    pointValue: integer("point_value").notNull().default(10),
    impactMultiplier: numeric("impact_multiplier", { precision: 4, scale: 2 })
      .notNull()
      .default("1.00"),
    qrActive: boolean("qr_active").notNull().default(false),
    checkInWindowMinutes: integer("check_in_window_minutes")
      .notNull()
      .default(30),
    currentQrToken: varchar("current_qr_token", { length: 80 }),
    currentQrExpiresAt: timestamp("current_qr_expires_at", {
      withTimezone: true,
    }),
    status: varchar("status", { length: 16 }).notNull().default("Upcoming"),
    semester: varchar("semester", { length: 24 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_status_idx").on(table.status),
    index("events_committee_idx").on(table.committeeId),
    index("events_date_idx").on(table.date),
  ],
);

export const attendanceTable = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    checkInTime: timestamp("check_in_time", { withTimezone: true })
      .notNull()
      .defaultNow(),
    method: varchar("method", { length: 16 }).notNull().default("QrScan"),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    correctionReason: text("correction_reason"),
    correctedBy: integer("corrected_by").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    semester: varchar("semester", { length: 24 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attendance_user_idx").on(table.userId),
    index("attendance_event_idx").on(table.eventId),
  ],
);

export const semesterConfigTable = pgTable("semester_config", {
  id: serial("id").primaryKey(),
  semester: varchar("semester", { length: 24 }).notNull().unique(),
  participationThreshold: numeric("participation_threshold", {
    precision: 4,
    scale: 2,
  })
    .notNull()
    .default("75.00"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  active: boolean("active").notNull().default(false),
});

// ─── Phase 0 new tables ──────────────────────────────────────────────────────

export const officerTermsTable = pgTable(
  "officer_terms",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    position: varchar("position", { length: 80 }).notNull(),
    positionType: varchar("position_type", { length: 20 })
      .notNull()
      .default("elected"),
    startedAt: date("started_at").notNull(),
    endedAt: date("ended_at"),
    semesterLabel: varchar("semester_label", { length: 24 }),
    appointedBy: integer("appointed_by").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("officer_terms_member_idx").on(table.memberId),
    index("officer_terms_ended_idx").on(table.endedAt),
  ],
);

export const committeeAssignmentsTable = pgTable(
  "committee_assignments",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    committeeId: integer("committee_id")
      .notNull()
      .references(() => committeesTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    assignedAt: date("assigned_at").notNull(),
    unassignedAt: date("unassigned_at"),
    assignedBy: integer("assigned_by").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    semesterLabel: varchar("semester_label", { length: 24 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("comm_assign_member_idx").on(table.memberId),
    index("comm_assign_committee_idx").on(table.committeeId),
  ],
);

export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    targetType: varchar("target_type", { length: 40 }).notNull(),
    targetId: integer("target_id").notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    before: text("before"),
    after: text("after"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_actor_idx").on(table.actorId),
    index("audit_log_target_idx").on(table.targetType, table.targetId),
    index("audit_log_created_idx").on(table.createdAt),
  ],
);

// ─── Org Settings ─────────────────────────────────────────────────────────────
// Single-row settings table. Holds all organisation-configurable values so that
// no university name, chapter name, branding colour, or eligibility threshold
// is hardcoded in application code. FVSU/Trailblazing values live only in seed.

export const orgSettingsTable = pgTable("org_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(
    () => organizationsTable.id,
    { onDelete: "set null" },
  ),
  // Identity
  universityName: varchar("university_name", { length: 120 }).notNull(),
  chapterName: varchar("chapter_name", { length: 120 }).notNull(),
  chapterIdentifier: varchar("chapter_identifier", { length: 60 }).notNull(),
  motto: varchar("motto", { length: 200 }),
  // Branding
  primaryColor: varchar("primary_color", { length: 40 })
    .notNull()
    .default("hsl(221 100% 31%)"),
  secondaryColor: varchar("secondary_color", { length: 40 })
    .notNull()
    .default("#C9A227"),
  logoUrl: varchar("logo_url", { length: 512 }),
  // Participation & eligibility thresholds (org-wide defaults;
  // semesterConfigTable.participationThreshold overrides per semester)
  participationGoalPct: numeric("participation_goal_pct", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("75.00"),
  scholarshipMinPct: numeric("scholarship_min_pct", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("80.00"),
  conferenceMinPct: numeric("conference_min_pct", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("85.00"),
  awardsMinPct: numeric("awards_min_pct", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("90.00"),
  // Dues (in cents, 0 = no dues)
  duesAmountCents: integer("dues_amount_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Event Type Scoring Configuration ────────────────────────────────────────
// Admin-configurable point/impact values per event type. Committee Chairs pick
// only the event type; the point value and impact multiplier are derived here
// automatically, replacing the previously hardcoded POINT_VALUES/IMPACT_MULTIPLIER
// maps. Seeded once from those maps so existing chapter rules are preserved.

export const eventTypeConfigTable = pgTable("event_type_config", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 32 }).notNull().unique(),
  pointValue: integer("point_value").notNull().default(10),
  impactMultiplier: numeric("impact_multiplier", { precision: 4, scale: 2 })
    .notNull()
    .default("1.00"),
  updatedBy: integer("updated_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type EventTypeConfig = typeof eventTypeConfigTable.$inferSelect;

// ─── Event Operational Details (facility-use / planning form data) ──────────
// Collected once at event creation so the same structured data can be reused
// to generate facility-use requests, planning forms, and approval documents
// without re-entering it (Phase 14). 1:1 with an event.

export const eventOperationalDetailsTable = pgTable(
  "event_operational_details",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .unique()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    expectedAttendance: integer("expected_attendance"),
    requestedFacility: varchar("requested_facility", { length: 200 }),
    contactName: varchar("contact_name", { length: 200 }),
    contactInfo: varchar("contact_info", { length: 200 }),
    setupRequirements: text("setup_requirements"),
    equipmentRequirements: text("equipment_requirements"),
    cateringInfo: text("catering_info"),
    securityRequirements: text("security_requirements"),
    accessibilityRequirements: text("accessibility_requirements"),
    additionalNotes: text("additional_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export type EventOperationalDetails =
  typeof eventOperationalDetailsTable.$inferSelect;

export type Committee = typeof committeesTable.$inferSelect;
export type Member = typeof membersTable.$inferSelect;
export type EventRow = typeof eventsTable.$inferSelect;
export type AttendanceRow = typeof attendanceTable.$inferSelect;
export type SemesterConfig = typeof semesterConfigTable.$inferSelect;
export type OfficerTerm = typeof officerTermsTable.$inferSelect;
export type CommitteeAssignment = typeof committeeAssignmentsTable.$inferSelect;
export type AuditLogEntry = typeof auditLogTable.$inferSelect;
export type OrgSettings = typeof orgSettingsTable.$inferSelect;
