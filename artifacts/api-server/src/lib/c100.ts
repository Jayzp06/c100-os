import crypto from "crypto";
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
  type Member as MemberRow,
  type EventRow,
  type AttendanceRow,
  type Committee as CommitteeRow,
  type Role,
  type ExperienceType,
} from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

export const FALLBACK_SEMESTER = "Spring 2026";
export const PARTICIPATION_THRESHOLD = 75;
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
      if (!roles.includes(req.member.role as Role)) {
        res.status(403).json({ error: "Insufficient role" });
        return;
      }
      return handler(req, res, next);
    });
}

export const LEADERSHIP_ROLES: Role[] = [
  "CommitteeChair",
  "BylawsChair",
  "ExecutiveBoard",
  "Admin",
];

export const EXEC_OR_ADMIN: Role[] = ["ExecutiveBoard", "Admin"];

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
  officerPositions: string[];
  committeeChairId: number | null;
};

export async function resolvePermissions(
  member: MemberRow,
): Promise<ResolvedPermissions> {
  const [activeTerms, chairAssignment] = await Promise.all([
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
  const isLegacyExec =
    member.role === "ExecutiveBoard" || member.role === "Admin";
  const isLegacyChair =
    member.role === "CommitteeChair" || member.role === "BylawsChair";

  let experience: ExperienceType;
  if (hasOfficerTerm || isLegacyExec) {
    experience = "operations_console";
  } else if (!!committeeChairId || isLegacyChair) {
    experience = "committee_portal";
  } else {
    experience = "member_portal";
  }

  return { experience, officerPositions, committeeChairId };
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
      impactPoints: sql<number>`coalesce(sum(case when ${eventsTable.eventType} in ('CommunityService','MentoringSession','Fundraiser','Conference') then ${attendanceTable.pointsAwarded} else 0 end), 0)`,
    })
    .from(attendanceTable)
    .innerJoin(eventsTable, eq(eventsTable.id, attendanceTable.eventId))
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
  const [{ totalPoints, impactPoints }, { eligible, attended }, committee] =
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
    nudgeStatus: member.nudgeStatus,
    accountActive: member.accountActive,
    lastLogin: member.lastLogin ? member.lastLogin.toISOString() : null,
    eventsAttended: attended,
    eventsEligible: eligible,
    profileImageUrl: member.profileImageUrl,
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

export function rotateQrToken(eventId: number): {
  token: string;
  expiresAt: Date;
} {
  const window = Math.floor(Date.now() / (QR_ROTATE_SECONDS * 1000));
  const token = crypto
    .createHash("sha256")
    .update(`${eventId}.${window}.${process.env.SESSION_SECRET ?? "c100"}`)
    .digest("hex")
    .slice(0, 16);
  const expiresAt = new Date((window + 1) * QR_ROTATE_SECONDS * 1000);
  return { token, expiresAt };
}

export function isValidQrToken(eventId: number, token: string): boolean {
  const window = Math.floor(Date.now() / (QR_ROTATE_SECONDS * 1000));
  for (const w of [window, window - 1]) {
    const expected = crypto
      .createHash("sha256")
      .update(`${eventId}.${w}.${process.env.SESSION_SECRET ?? "c100"}`)
      .digest("hex")
      .slice(0, 16);
    if (token === expected) return true;
  }
  return false;
}

export function computeNudgeTier(participationPct: number): {
  status: "Active" | "Warning" | "AtRisk" | "Critical";
} {
  if (participationPct >= PARTICIPATION_THRESHOLD) return { status: "Active" };
  if (participationPct >= 60) return { status: "Warning" };
  if (participationPct >= 40) return { status: "AtRisk" };
  return { status: "Critical" };
}

export function nudgeMessageFor(
  status: "Active" | "Warning" | "AtRisk" | "Critical",
  participationPct: number,
  fullName: string,
): { type: string; message: string; channel: "InApp" | "Email" | "Both" } {
  switch (status) {
    case "Active":
      return {
        type: "ActiveEncouragement",
        message: `You're at ${participationPct}% participation this semester. Keep showing up — your committee is counting on you.`,
        channel: "InApp",
      };
    case "Warning":
      return {
        type: "GentleReminder",
        message: `Hey ${fullName.split(" ")[0]}, you're at ${participationPct}%. A couple more events this month and you'll be back above the chapter standard.`,
        channel: "InApp",
      };
    case "AtRisk":
      return {
        type: "AtRiskWarning",
        message: `${fullName.split(" ")[0]}, your participation is ${participationPct}%. You're at risk of losing scholarship and conference eligibility this semester.`,
        channel: "Both",
      };
    case "Critical":
      return {
        type: "CriticalAlert",
        message: `Critical: participation is ${participationPct}%. Reach out to your committee chair this week — your standing in the chapter is at stake.`,
        channel: "Both",
      };
  }
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
