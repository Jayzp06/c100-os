import { type Request, type Response, type NextFunction } from "express";
import {
  db,
  membersTable,
  committeesTable,
  attendanceTable,
  eventsTable,
  semesterConfigTable,
  officerTermsTable,
  committeeAssignmentsTable,
  auditLogTable,
  orgSettingsTable,
  eventTypeConfigTable,
  type Member as MemberRow,
  type EventRow,
  type AttendanceRow,
  type Committee as CommitteeRow,
  type Role,
  type ExperienceType,
} from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  resolveRbacContext,
  deriveExperience,
  computeAvailableExperiences,
  hasSystemRole,
  hasPermissionGroup,
  type RbacContext,
} from "./rbac";
import { generateCheckInCode, isValidCheckInCode } from "@workspace/checkin-codes/server";

export const FALLBACK_SEMESTER = "Spring 2026";
// Internal fallback only — do not import this constant in routes.
// Use getParticipationThreshold() for the live, DB-sourced value.
const PARTICIPATION_THRESHOLD = 75;
export const QR_ROTATE_SECONDS = 60;

let _semesterCache: { value: string; expires: number } | null = null;

export async function getActiveSemester(): Promise<string> {
  const now = Date.now();
  if (_semesterCache && now < _semesterCache.expires) {
    return _semesterCache.value;
  }
  const [row] = await db
    .select({ semester: semesterConfigTable.semester })
    .from(semesterConfigTable)
    .where(eq(semesterConfigTable.active, true))
    .limit(1);
  const value = row?.semester ?? FALLBACK_SEMESTER;
  _semesterCache = { value, expires: now + 60_000 };
  return value;
}

export function invalidateSemesterCache() {
  _semesterCache = null;
}

// ─── Org Settings ──────────────────────────────────────────────────────────────

export interface OrgConfig {
  universityName: string;
  chapterName: string;
  chapterIdentifier: string;
  motto: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  participationGoalPct: number;
  scholarshipMinPct: number;
  conferenceMinPct: number;
  awardsMinPct: number;
  duesAmountCents: number;
}

const FALLBACK_ORG: OrgConfig = {
  universityName: "Collegiate 100",
  chapterName: "Chapter",
  chapterIdentifier: "Chapter",
  motto: null,
  primaryColor: "hsl(221 100% 31%)",
  secondaryColor: "#C9A227",
  logoUrl: null,
  participationGoalPct: PARTICIPATION_THRESHOLD,
  scholarshipMinPct: 80,
  conferenceMinPct: 85,
  awardsMinPct: 90,
  duesAmountCents: 0,
};

let _orgCache: { value: OrgConfig; expires: number } | null = null;

export async function getOrgSettings(): Promise<OrgConfig> {
  const now = Date.now();
  if (_orgCache && now < _orgCache.expires) return _orgCache.value;
  const [row] = await db.select().from(orgSettingsTable).limit(1);
  const value: OrgConfig = row
    ? {
        universityName: row.universityName,
        chapterName: row.chapterName,
        chapterIdentifier: row.chapterIdentifier,
        motto: row.motto ?? null,
        primaryColor: row.primaryColor,
        secondaryColor: row.secondaryColor,
        logoUrl: row.logoUrl ?? null,
        participationGoalPct: parseFloat(row.participationGoalPct),
        scholarshipMinPct: parseFloat(row.scholarshipMinPct),
        conferenceMinPct: parseFloat(row.conferenceMinPct),
        awardsMinPct: parseFloat(row.awardsMinPct),
        duesAmountCents: row.duesAmountCents,
      }
    : FALLBACK_ORG;
  _orgCache = { value, expires: now + 300_000 }; // 5-min cache
  return value;
}

export function invalidateOrgCache() {
  _orgCache = null;
}

/** Returns the effective participation threshold for the current semester.
 *  Priority: active semesterConfig.participationThreshold → org default → 75 */
export async function getParticipationThreshold(): Promise<number> {
  const [row] = await db
    .select({ threshold: semesterConfigTable.participationThreshold })
    .from(semesterConfigTable)
    .where(eq(semesterConfigTable.active, true))
    .limit(1);
  if (row?.threshold) return parseFloat(row.threshold);
  const org = await getOrgSettings();
  return org.participationGoalPct;
}

export const POINT_VALUES: Record<string, number> = {
  GeneralBodyMeeting: 10,
  CommitteeMeeting: 8,
  CommunityService: 15,
  MentoringSession: 12,
  Workshop: 10,
  Fundraiser: 12,
  Conference: 25,
  Social: 5,
};

export const IMPACT_MULTIPLIER: Record<string, number> = {
  GeneralBodyMeeting: 1.0,
  CommitteeMeeting: 1.0,
  CommunityService: 2.0,
  MentoringSession: 1.5,
  Workshop: 1.0,
  Fundraiser: 1.5,
  Conference: 2.0,
  Social: 0.5,
};

export const EVENT_TYPES = Object.keys(POINT_VALUES);

export type EventTypeScoring = { pointValue: number; impactMultiplier: number };

let _eventTypeConfigCache: {
  value: Map<string, EventTypeScoring>;
  expires: number;
} | null = null;

/** Admin-configurable scoring per event type, DB-driven via event_type_config.
 *  Falls back to the legacy hardcoded maps for any type missing a config row
 *  (should not happen once ensureEventTypeConfigSeeded() has run). */
export async function getEventTypeConfigs(): Promise<
  Map<string, EventTypeScoring>
> {
  const now = Date.now();
  if (_eventTypeConfigCache && now < _eventTypeConfigCache.expires) {
    return _eventTypeConfigCache.value;
  }
  const map = new Map<string, EventTypeScoring>();
  for (const eventType of EVENT_TYPES) {
    map.set(eventType, {
      pointValue: POINT_VALUES[eventType]!,
      impactMultiplier: IMPACT_MULTIPLIER[eventType]!,
    });
  }
  const rows = await db.select().from(eventTypeConfigTable);
  for (const row of rows) {
    map.set(row.eventType, {
      pointValue: row.pointValue,
      impactMultiplier: Number(row.impactMultiplier),
    });
  }
  _eventTypeConfigCache = { value: map, expires: now + 60_000 };
  return map;
}

export function invalidateEventTypeConfigCache() {
  _eventTypeConfigCache = null;
}

export async function getEventTypeScoring(
  eventType: string,
): Promise<EventTypeScoring> {
  const map = await getEventTypeConfigs();
  return (
    map.get(eventType) ?? {
      pointValue: POINT_VALUES[eventType] ?? 10,
      impactMultiplier: IMPACT_MULTIPLIER[eventType] ?? 1.0,
    }
  );
}

/** Idempotently seeds event_type_config from the legacy hardcoded maps for
 *  any event type that doesn't already have a row. Safe to call on every
 *  server startup — only inserts what's missing. */
export async function ensureEventTypeConfigSeeded(): Promise<void> {
  const existing = await db
    .select({ eventType: eventTypeConfigTable.eventType })
    .from(eventTypeConfigTable);
  const existingTypes = new Set(existing.map((r) => r.eventType));
  const missing = EVENT_TYPES.filter((t) => !existingTypes.has(t));
  if (missing.length === 0) return;
  await db.insert(eventTypeConfigTable).values(
    missing.map((eventType) => ({
      eventType,
      pointValue: POINT_VALUES[eventType]!,
      impactMultiplier: String(IMPACT_MULTIPLIER[eventType]!),
    })),
  );
  invalidateEventTypeConfigCache();
}

export type AuthedHandler = (
  req: Request & { user: NonNullable<Request["user"]>; member: MemberRow },
  res: Response,
  next: NextFunction,
) => Promise<void> | void;

export async function loadMember(
  authId: string,
): Promise<MemberRow | undefined> {
  const [m] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.authId, authId));
  return m;
}

export async function resolveOrCreateMember(user: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}): Promise<{ member: MemberRow; isPending: boolean }> {
  const [byId] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.authId, user.id));
  if (byId) {
    return { member: byId, isPending: !byId.accountActive };
  }

  if (user.email) {
    const [byEmail] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.email, user.email));
    if (byEmail && (!byEmail.authId || byEmail.authId.startsWith("seed-"))) {
      const [claimed] = await db
        .update(membersTable)
        .set({
          authId: user.id,
          profileImageUrl: user.profileImageUrl ?? byEmail.profileImageUrl,
        })
        .where(eq(membersTable.id, byEmail.id))
        .returning();
      if (claimed) {
        return { member: claimed, isPending: !claimed.accountActive };
      }
    }
  }

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "New Member";
  const email = user.email ?? `${user.id}@replit.user`;
  const [created] = await db
    .insert(membersTable)
    .values({
      authId: user.id,
      fullName,
      email,
      role: "Member",
      membershipStatus: "Inactive",
      accountActive: false,
      profileImageUrl: user.profileImageUrl ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return { member: created, isPending: true };
  }

  const [existing] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.authId, user.id));
  if (existing) {
    return { member: existing, isPending: !existing.accountActive };
  }

  throw new Error(`Failed to resolve or create member for authId: ${user.id}`);
}

export function requireAuth(handler: AuthedHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const { member, isPending } = await resolveOrCreateMember(req.user);
    if (isPending) {
      res.status(403).json({
        error: "Account pending approval by Executive Board",
        isPendingApproval: true,
      });
      return;
    }
    (req as Request & { member: MemberRow }).member = member;
    return handler(
      req as Request & {
        user: NonNullable<Request["user"]>;
        member: MemberRow;
      },
      res,
      next,
    );
  };
}

export function requireRole(...roles: Role[]) {
  return (handler: AuthedHandler) =>
    requireAuth(async (req, res, next) => {
      if (roles.includes(req.member.role as Role)) {
        return handler(req, res, next);
      }
      // No blanket bypass for system roles. Platform Admin and Technology Chair
      // only pass this gate when their legacy `role` field is included in the
      // allowed list, or when they have been explicitly granted the permission
      // via requirePermGroup. Removing the bypass ensures that Tech Chair and
      // Platform Admin cannot silently access officer workspaces or APIs.
      res.status(403).json({ error: "Insufficient role" });
    });
}

/**
 * Like requireRole but authorizes by RBAC permission-group slug instead of
 * the legacy role string.  Includes its own auth + approval gate.
 *
 * No system-role bypass: every caller — including Technology Chair and
 * Platform Admin — must hold the named permission group explicitly.
 * Access is determined solely by the RBAC matrix in rbac-matrix.ts.
 *
 * Usage: requirePermGroup("view_eligibility_reports")(async (req, res) => { … })
 */
export function requirePermGroup(slug: string) {
  return (handler: AuthedHandler): ReturnType<typeof requireAuth> =>
    requireAuth(async (req, res, next) => {
      const ctx = await resolveRbacContext(req.member.id);
      if (!hasPermissionGroup(ctx, slug)) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }
      return handler(req, res, next);
    });
}

export const LEADERSHIP_ROLES: Role[] = [
  "CommitteeChair",
  "ExecutiveBoard",
  "Admin",
  "TechnologyChair",
];

export const EXEC_OR_ADMIN: Role[] = ["ExecutiveBoard", "Admin"];

export const TECH_OR_ADMIN: Role[] = ["TechnologyChair", "Admin"];

const EXECUTIVE_POSITIONS = [
  "president",
  "vice_president",
  "treasurer",
  "membership_director",
  "communications_director",
  "chief_of_staff",
  "sergeant_at_arms",
  "parliamentarian",
  "historian",
  "bylaws_officer",
];

export type ResolvedPermissions = {
  experience: ExperienceType;
  /** All experience shells this member legitimately qualifies for (see B4 switcher). */
  availableExperiences: ExperienceType[];
  officerPositions: string[];
  committeeChairId: number | null;
  isTechChair: boolean;
  /** Full RBAC context resolved from the new role/permission tables. */
  rbac: RbacContext;
};

const VALID_VIEW_AS = [
  "Member",
  "CommitteeChair",
  "ExecutiveBoard",
  "Admin",
] as const;
export type ViewAs = (typeof VALID_VIEW_AS)[number];
export const isValidViewAs = (v: unknown): v is ViewAs =>
  VALID_VIEW_AS.includes(v as ViewAs);

const EMPTY_RBAC: RbacContext = {
  systemRoles: [],
  orgRoles: [],
  highestTier: null,
  permissionGroups: new Set(),
};

export function syntheticPermissionsFor(viewAs: string): ResolvedPermissions {
  switch (viewAs as ViewAs) {
    case "CommitteeChair":
      return {
        experience: "committee_portal",
        availableExperiences: ["committee_portal", "member_portal"],
        officerPositions: [],
        committeeChairId: 1,
        isTechChair: true,
        rbac: EMPTY_RBAC,
      };
    case "ExecutiveBoard":
      return {
        experience: "operations_console",
        availableExperiences: ["operations_console", "member_portal"],
        officerPositions: ["vice_president"],
        committeeChairId: null,
        isTechChair: true,
        rbac: EMPTY_RBAC,
      };
    case "Admin":
      return {
        experience: "operations_console",
        availableExperiences: ["operations_console", "member_portal"],
        officerPositions: ["president"],
        committeeChairId: null,
        isTechChair: true,
        rbac: EMPTY_RBAC,
      };
    default:
      return {
        experience: "member_portal",
        availableExperiences: ["member_portal"],
        officerPositions: [],
        committeeChairId: null,
        isTechChair: true,
        rbac: EMPTY_RBAC,
      };
  }
}

export async function resolvePermissions(
  member: MemberRow,
): Promise<ResolvedPermissions> {
  const [activeTerms, chairAssignment, rbac] = await Promise.all([
    db
      .select({ position: officerTermsTable.position })
      .from(officerTermsTable)
      .where(
        and(
          eq(officerTermsTable.memberId, member.id),
          isNull(officerTermsTable.endedAt),
        ),
      ),
    db
      .select({ committeeId: committeeAssignmentsTable.committeeId })
      .from(committeeAssignmentsTable)
      .where(
        and(
          eq(committeeAssignmentsTable.memberId, member.id),
          eq(committeeAssignmentsTable.role, "chair"),
          isNull(committeeAssignmentsTable.unassignedAt),
        ),
      )
      .limit(1),
    resolveRbacContext(member.id),
  ]);

  const officerPositions = activeTerms.map((t) => t.position);
  let committeeChairId: number | null =
    chairAssignment[0]?.committeeId ?? null;

  if (!committeeChairId) {
    const [legacyChair] = await db
      .select({ id: committeesTable.id })
      .from(committeesTable)
      .where(eq(committeesTable.chairUserId, member.id));
    committeeChairId = legacyChair?.id ?? null;
  }

  const hasOfficerTerm = officerPositions.some((p) =>
    EXECUTIVE_POSITIONS.includes(p),
  );
  const isTechChair = hasSystemRole(rbac, "technology_chair", "platform_admin");

  const experience = deriveExperience(rbac, {
    hasOfficerTerm,
    isTechChair,
    hasCommitteeChair: !!committeeChairId,
  });
  const availableExperiences = computeAvailableExperiences(rbac, {
    hasOfficerTerm,
    isTechChair,
    hasCommitteeChair: !!committeeChairId,
  });

  return {
    experience,
    availableExperiences,
    officerPositions,
    committeeChairId,
    isTechChair,
    rbac,
  };
}

export async function writeAuditLog(entry: {
  actorId: number | null;
  targetType: string;
  targetId: number;
  action: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}) {
  await db.insert(auditLogTable).values({
    actorId: entry.actorId,
    targetType: entry.targetType,
    targetId: entry.targetId,
    action: entry.action,
    before: entry.before != null ? JSON.stringify(entry.before) : null,
    after: entry.after != null ? JSON.stringify(entry.after) : null,
    ipAddress: entry.ipAddress ?? null,
  });
}

export async function eventsEligibleForMember(
  memberId: number,
  semester?: string,
): Promise<{ eligible: number; attended: number }> {
  const sem = semester ?? (await getActiveSemester());

  const [{ memberCommittee }] = await db
    .select({ memberCommittee: membersTable.committeeId })
    .from(membersTable)
    .where(eq(membersTable.id, memberId));

  const eligibleRows = await db
    .select({ id: eventsTable.id })
    .from(eventsTable)
    .where(
      and(eq(eventsTable.semester, sem), eq(eventsTable.status, "Completed")),
    );

  const attendedRows = await db
    .select({ id: attendanceTable.id })
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.userId, memberId),
        eq(attendanceTable.semester, sem),
      ),
    );

  return { eligible: eligibleRows.length, attended: attendedRows.length };
  void memberCommittee;
}

export async function memberPointsAndImpact(
  memberId: number,
  semester?: string,
): Promise<{ totalPoints: number; impactPoints: number }> {
  const sem = semester ?? (await getActiveSemester());
  const rows = await db
    .select({
      totalPoints: sql<number>`coalesce(sum(${attendanceTable.pointsAwarded}), 0)`,
      impactPoints: sql<number>`coalesce(sum(case when coalesce(${eventTypeConfigTable.impactMultiplier}, 1.00) > 1.00 then ${attendanceTable.pointsAwarded} else 0 end), 0)`,
    })
    .from(attendanceTable)
    .innerJoin(eventsTable, eq(eventsTable.id, attendanceTable.eventId))
    .leftJoin(
      eventTypeConfigTable,
      eq(eventTypeConfigTable.eventType, eventsTable.eventType),
    )
    .where(
      and(
        eq(attendanceTable.userId, memberId),
        eq(attendanceTable.semester, sem),
      ),
    );

  const r = rows[0];
  return {
    totalPoints: Number(r?.totalPoints ?? 0),
    impactPoints: Number(r?.impactPoints ?? 0),
  };
}

export async function computeStreakCount(memberId: number): Promise<number> {
  const attendedEvents = await db
    .select({ eventId: attendanceTable.eventId })
    .from(attendanceTable)
    .innerJoin(eventsTable, eq(eventsTable.id, attendanceTable.eventId))
    .where(eq(attendanceTable.userId, memberId))
    .orderBy(desc(eventsTable.date));

  if (attendedEvents.length === 0) return 0;

  const allEvents = await db
    .select({ id: eventsTable.id })
    .from(eventsTable)
    .where(eq(eventsTable.status, "Completed"))
    .orderBy(desc(eventsTable.date));

  if (allEvents.length === 0) return 0;

  const attendedSet = new Set(attendedEvents.map((r) => r.eventId));
  let streak = 0;
  for (const ev of allEvents) {
    if (attendedSet.has(ev.id)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function buildMemberDto(member: MemberRow): Promise<unknown> {
  const [{ totalPoints, impactPoints }, { eligible, attended }, committee, rbac] =
    await Promise.all([
      memberPointsAndImpact(member.id),
      eventsEligibleForMember(member.id),
      member.committeeId
        ? db
            .select()
            .from(committeesTable)
            .where(eq(committeesTable.id, member.committeeId))
            .then((r) => r[0])
        : Promise.resolve(undefined),
      resolveRbacContext(member.id),
    ]);

  const participationPct =
    eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : 0;

  return {
    id: member.id,
    authId: member.authId,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    studentId: member.studentId,
    gpa: member.gpa != null ? Number(member.gpa) : null,
    graduationYear: member.graduationYear,
    role: member.role,
    committeeId: member.committeeId,
    committeeName: committee?.name ?? null,
    membershipStatus: member.membershipStatus,
    duesPaid: member.duesPaid,
    dateJoined: member.dateJoined.toISOString(),
    totalPoints,
    impactPoints,
    participationPct,
    streakCount: member.streakCount,
    accountActive: member.accountActive,
    deletedAt: member.deletedAt ? member.deletedAt.toISOString() : null,
    lastLogin: member.lastLogin ? member.lastLogin.toISOString() : null,
    eventsAttended: attended,
    eventsEligible: eligible,
    profileImageUrl: member.profileImageUrl,
    // Additive permission tags (see rbac.ts ASSIGNABLE_ORG_ROLE_SLUGS /
    // ASSIGNABLE_SYSTEM_ROLE_SLUGS). Distinct from — and layered on top of —
    // the legacy `role` column above.
    orgRoles: rbac.orgRoles,
    systemRoles: rbac.systemRoles,
  };
}

export function eventToDto(
  event: EventRow,
  committeeName: string | null = null,
  createdByName: string | null = null,
  totalAttendees = 0,
): unknown {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    committeeId: event.committeeId,
    committeeName,
    createdBy: event.createdBy,
    createdByName,
    date:
      typeof event.date === "string"
        ? event.date
        : new Date(event.date as unknown as string).toISOString().slice(0, 10),
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    pointValue: event.pointValue,
    impactMultiplier: Number(event.impactMultiplier),
    qrActive: event.qrActive,
    checkInWindowMinutes: event.checkInWindowMinutes,
    totalAttendees,
    status: event.status,
    createdAt: event.createdAt.toISOString(),
  };
}

export function attendanceToDto(
  row: AttendanceRow,
  userName: string | null = null,
  eventTitle: string | null = null,
): unknown {
  return {
    id: row.id,
    userId: row.userId,
    userName,
    eventId: row.eventId,
    eventTitle,
    checkInTime: row.checkInTime.toISOString(),
    method: row.method,
    pointsAwarded: row.pointsAwarded,
    correctionReason: row.correctionReason,
    correctedBy: row.correctedBy,
    semester: row.semester,
  };
}

function qrSecret(): string {
  return process.env.SESSION_SECRET ?? "c100";
}

export function rotateQrToken(eventId: number): {
  token: string;
  expiresAt: Date;
} {
  const { code, expiresAt } = generateCheckInCode(
    eventId,
    qrSecret(),
    QR_ROTATE_SECONDS,
  );
  return { token: code, expiresAt };
}

export function isValidQrToken(eventId: number, token: string): boolean {
  return isValidCheckInCode(eventId, token, qrSecret(), QR_ROTATE_SECONDS);
}


export async function recentChapterAttendance(limit = 10) {
  const rows = await db
    .select({
      a: attendanceTable,
      memberName: membersTable.fullName,
      eventTitle: eventsTable.title,
    })
    .from(attendanceTable)
    .innerJoin(membersTable, eq(membersTable.id, attendanceTable.userId))
    .innerJoin(eventsTable, eq(eventsTable.id, attendanceTable.eventId))
    .orderBy(desc(attendanceTable.checkInTime))
    .limit(limit);
  return rows.map((r) => attendanceToDto(r.a, r.memberName, r.eventTitle));
}

export type CommitteeAggregate = {
  committee: CommitteeRow;
  memberCount: number;
  totalEventsHosted: number;
  totalImpactPoints: number;
  aggregateParticipationPct: number;
  chairName: string | null;
};

export async function buildCommitteeAggregate(
  committee: CommitteeRow,
): Promise<CommitteeAggregate> {
  const sem = await getActiveSemester();

  const memberRows = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.committeeId, committee.id));

  const eventRows = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.committeeId, committee.id),
        eq(eventsTable.semester, sem),
      ),
    );

  let totalImpact = 0;
  let totalParticipationPct = 0;
  for (const m of memberRows) {
    const [{ impactPoints }, { eligible, attended }] = await Promise.all([
      memberPointsAndImpact(m.id, sem),
      eventsEligibleForMember(m.id, sem),
    ]);
    totalImpact += impactPoints;
    totalParticipationPct += eligible > 0 ? (attended / eligible) * 100 : 0;
  }

  let chairName: string | null = null;
  if (committee.chairUserId) {
    const [chair] = await db
      .select({ fullName: membersTable.fullName })
      .from(membersTable)
      .where(eq(membersTable.id, committee.chairUserId));
    chairName = chair?.fullName ?? null;
  }

  return {
    committee,
    memberCount: memberRows.length,
    totalEventsHosted: eventRows.filter((e) => e.status === "Completed").length,
    totalImpactPoints: totalImpact,
    aggregateParticipationPct:
      memberRows.length > 0
        ? Math.round((totalParticipationPct / memberRows.length) * 10) / 10
        : 0,
    chairName,
  };
}
