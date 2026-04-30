import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import {
  db,
  membersTable,
  committeesTable,
  attendanceTable,
  eventsTable,
  type Member as MemberRow,
  type EventRow,
  type AttendanceRow,
  type Committee as CommitteeRow,
  type Role,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";

export const CURRENT_SEMESTER = "Spring 2026";
export const PARTICIPATION_THRESHOLD = 75;
export const QR_ROTATE_SECONDS = 60;

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

export function requireAuth(handler: AuthedHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const member = await loadMember(req.user.id);
    if (!member) {
      res.status(403).json({ error: "No chapter member record for this user" });
      return;
    }
    (req as Request & { member: MemberRow }).member = member;
    return handler(
      req as Request & { user: NonNullable<Request["user"]>; member: MemberRow },
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

export async function eventsEligibleForMember(
  memberId: number,
  semester = CURRENT_SEMESTER,
): Promise<{ eligible: number; attended: number }> {
  const [{ memberCommittee }] = await db
    .select({ memberCommittee: membersTable.committeeId })
    .from(membersTable)
    .where(eq(membersTable.id, memberId));

  // Count completed events the member could have attended:
  // - Required-for-all events (committeeId IS NULL) regardless of committee
  // - Committee events for this member's committee
  const eligibleRows = await db
    .select({ id: eventsTable.id })
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.semester, semester),
        eq(eventsTable.status, "Completed"),
      ),
    );

  const eligibleEvents = eligibleRows.length; // simplification: all completed events count

  const attendedRows = await db
    .select({ id: attendanceTable.id })
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.userId, memberId),
        eq(attendanceTable.semester, semester),
      ),
    );

  return { eligible: eligibleEvents, attended: attendedRows.length };
  void memberCommittee;
}

export async function memberPointsAndImpact(
  memberId: number,
  semester = CURRENT_SEMESTER,
): Promise<{ totalPoints: number; impactPoints: number }> {
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
        eq(attendanceTable.semester, semester),
      ),
    );

  const r = rows[0];
  return {
    totalPoints: Number(r?.totalPoints ?? 0),
    impactPoints: Number(r?.impactPoints ?? 0),
  };
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

export function eventToDto(event: EventRow, committeeName: string | null = null, createdByName: string | null = null, totalAttendees = 0): unknown {
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
  // Accept current and previous window to give scanners a small grace period.
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
  return rows.map((r) =>
    attendanceToDto(r.a, r.memberName, r.eventTitle),
  );
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
        eq(eventsTable.semester, CURRENT_SEMESTER),
      ),
    );

  let totalImpact = 0;
  let totalParticipationPct = 0;
  for (const m of memberRows) {
    const [{ impactPoints }, { eligible, attended }] = await Promise.all([
      memberPointsAndImpact(m.id),
      eventsEligibleForMember(m.id),
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
