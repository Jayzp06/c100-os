import { Router, type IRouter } from "express";
import {
  GetCommitteeParams,
  GetCommitteeRosterParams,
} from "@workspace/api-zod";
import {
  db,
  committeesTable,
  membersTable,
  eventsTable,
  attendanceTable,
  type Role,
} from "@workspace/db";

// ─── Reserved committee names ──────────────────────────────────────────────────

/**
 * Committee names that are permanently reserved and may not be used for new
 * or renamed committees.  Add a name here whenever a committee is deactivated
 * and its name should not be recycled.  Matching is case-insensitive.
 */
export const RESERVED_COMMITTEE_NAMES = ["Bylaws"] as const;

/**
 * Validates a proposed committee name against length rules and the reserved
 * names list.  Returns an error string on failure, or null when valid.
 *
 * Apply this to every committee create/update route that accepts a name.
 */
export function validateCommitteeName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Committee name cannot be empty.";
  if (trimmed.length < 2) return "Committee name must be at least 2 characters.";
  if (trimmed.length > 100) return "Committee name must be 100 characters or fewer.";
  const lower = trimmed.toLowerCase();
  const hit = RESERVED_COMMITTEE_NAMES.find((n) => n.toLowerCase() === lower);
  if (hit) return `"${hit}" is a reserved committee name and cannot be reused.`;
  return null;
}
import { and, desc, eq } from "drizzle-orm";
import {
  buildCommitteeAggregate,
  buildMemberDto,
  eventToDto,
  getActiveSemester,
  memberPointsAndImpact,
  eventsEligibleForMember,
  requireAuth,
  resolvePermissions,
} from "../lib/c100";
import { hasSystemRole } from "../lib/rbac";

const router: IRouter = Router();

async function buildLeaderboard() {
  const all = await db.select().from(committeesTable).where(eq(committeesTable.active, true));
  const aggregates = await Promise.all(all.map((c) => buildCommitteeAggregate(c)));
  return [...aggregates]
    .sort((a, b) => b.totalImpactPoints - a.totalImpactPoints)
    .map((agg, idx) => ({
      committeeId: agg.committee.id,
      name: agg.committee.name,
      rank: idx + 1,
      participationPct: agg.aggregateParticipationPct,
      totalImpactPoints: agg.totalImpactPoints,
      totalEventsHosted: agg.totalEventsHosted,
      memberCount: agg.memberCount,
    }));
}

// Place /committees/leaderboard before /committees/:id to avoid path collision.
router.get("/committees/leaderboard", async (_req, res) => {
  res.json(await buildLeaderboard());
});

router.get("/committees", async (_req, res) => {
  const [all, sem] = await Promise.all([
    db.select().from(committeesTable).where(eq(committeesTable.active, true)),
    getActiveSemester(),
  ]);
  const aggregates = await Promise.all(all.map((c) => buildCommitteeAggregate(c)));
  const ranked = [...aggregates].sort(
    (a, b) => b.totalImpactPoints - a.totalImpactPoints,
  );
  const dtos = aggregates.map((agg) => ({
    id: agg.committee.id,
    name: agg.committee.name,
    description: agg.committee.description,
    chairUserId: agg.committee.chairUserId,
    chairName: agg.chairName,
    memberCount: agg.memberCount,
    totalEventsHosted: agg.totalEventsHosted,
    aggregateParticipationPct: agg.aggregateParticipationPct,
    totalImpactPoints: agg.totalImpactPoints,
    committeeRank:
      ranked.findIndex((r) => r.committee.id === agg.committee.id) + 1,
    semester: sem,
    fourForFutureAlignment: agg.committee.fourForFutureAlignment,
  }));
  res.json(dtos);
});

// Place /committees/mine before /committees/:id to avoid path collision.
router.get(
  "/committees/mine",
  requireAuth(async (req, res) => {
    const perms = await resolvePermissions(req.member);
    const committeeId = req.member.committeeId ?? perms.committeeChairId;
    if (!committeeId) {
      res.status(404).json({ error: "You are not assigned to a committee" });
      return;
    }
    const [committeeRow] = await db
      .select()
      .from(committeesTable)
      .where(eq(committeesTable.id, committeeId));
    if (!committeeRow) {
      res.status(404).json({ error: "Committee not found" });
      return;
    }

    const [agg, all, sem, myStats] = await Promise.all([
      buildCommitteeAggregate(committeeRow),
      db.select().from(committeesTable).where(eq(committeesTable.active, true)),
      getActiveSemester(),
      buildMemberDto(req.member),
    ]);
    const aggregates = await Promise.all(all.map((c) => buildCommitteeAggregate(c)));
    const ranked = [...aggregates].sort(
      (a, b) => b.totalImpactPoints - a.totalImpactPoints,
    );
    const rank = ranked.findIndex((r) => r.committee.id === committeeRow.id) + 1;

    const committeeDto = {
      id: committeeRow.id,
      name: committeeRow.name,
      description: committeeRow.description,
      chairUserId: committeeRow.chairUserId,
      chairName: agg.chairName,
      memberCount: agg.memberCount,
      totalEventsHosted: agg.totalEventsHosted,
      aggregateParticipationPct: agg.aggregateParticipationPct,
      totalImpactPoints: agg.totalImpactPoints,
      committeeRank: rank,
      semester: sem,
      fourForFutureAlignment: committeeRow.fourForFutureAlignment,
    };

    // Own-committee members always see the committee's own upcoming events.
    const upcomingRows = await db
      .select({
        e: eventsTable,
        committeeName: committeesTable.name,
        createdByName: membersTable.fullName,
      })
      .from(eventsTable)
      .leftJoin(committeesTable, eq(committeesTable.id, eventsTable.committeeId))
      .leftJoin(membersTable, eq(membersTable.id, eventsTable.createdBy))
      .where(
        and(
          eq(eventsTable.committeeId, committeeId),
          eq(eventsTable.status, "Upcoming"),
        ),
      )
      .orderBy(eventsTable.date)
      .limit(5);
    const upcomingEvents = upcomingRows.map((r) =>
      eventToDto(r.e, r.committeeName ?? null, r.createdByName ?? null, 0),
    );

    const isChair =
      committeeRow.chairUserId === req.member.id ||
      perms.committeeChairId === committeeId;

    if (!isChair) {
      res.json({
        committee: committeeDto,
        isChair: false,
        myStats,
        upcomingEvents,
      });
      return;
    }

    const rosterMembers = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.committeeId, committeeId));
    const roster = await Promise.all(
      rosterMembers.map(async (m) => {
        const [{ totalPoints, impactPoints }, { eligible, attended }] =
          await Promise.all([
            memberPointsAndImpact(m.id, sem),
            eventsEligibleForMember(m.id, sem),
          ]);
        return {
          id: m.id,
          fullName: m.fullName,
          role: m.role,
          participationPct:
            eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : 0,
          totalPoints,
          impactPoints,
          nudgeStatus: m.nudgeStatus,
        };
      }),
    );
    const followUpMembers = roster.filter((m) => m.nudgeStatus !== "Active");

    const activityRows = await db
      .select({ a: attendanceTable, memberName: membersTable.fullName, eventTitle: eventsTable.title })
      .from(attendanceTable)
      .innerJoin(membersTable, eq(membersTable.id, attendanceTable.userId))
      .innerJoin(eventsTable, eq(eventsTable.id, attendanceTable.eventId))
      .where(eq(eventsTable.committeeId, committeeId))
      .orderBy(desc(attendanceTable.checkInTime))
      .limit(10);
    const recentActivity = activityRows.map((r) => ({
      id: r.a.id,
      memberName: r.memberName,
      eventTitle: r.eventTitle,
      checkInTime: r.a.checkInTime.toISOString(),
      pointsAwarded: r.a.pointsAwarded,
    }));

    res.json({
      committee: committeeDto,
      isChair: true,
      myStats,
      roster,
      followUpMembers,
      upcomingEvents,
      recentActivity,
    });
  }),
);

router.get("/committees/:id", async (req, res) => {
  const params = GetCommitteeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [committee] = await db
    .select()
    .from(committeesTable)
    .where(eq(committeesTable.id, params.data.id));
  if (!committee) {
    res.status(404).json({ error: "Committee not found" });
    return;
  }
  const [agg, all, sem] = await Promise.all([
    buildCommitteeAggregate(committee),
    db.select().from(committeesTable),
    getActiveSemester(),
  ]);
  const aggregates = await Promise.all(all.map((c) => buildCommitteeAggregate(c)));
  const ranked = [...aggregates].sort(
    (a, b) => b.totalImpactPoints - a.totalImpactPoints,
  );
  const rank = ranked.findIndex((r) => r.committee.id === committee.id) + 1;
  res.json({
    id: committee.id,
    name: committee.name,
    description: committee.description,
    chairUserId: committee.chairUserId,
    chairName: agg.chairName,
    memberCount: agg.memberCount,
    totalEventsHosted: agg.totalEventsHosted,
    aggregateParticipationPct: agg.aggregateParticipationPct,
    totalImpactPoints: agg.totalImpactPoints,
    committeeRank: rank,
    semester: sem,
    fourForFutureAlignment: committee.fourForFutureAlignment,
  });
});

const CHAPTER_WIDE_ROSTER_ROLES: Role[] = [
  "BylawsChair",
  "ExecutiveBoard",
  "Admin",
  "TechnologyChair",
];

router.get(
  "/committees/:id/roster",
  requireAuth(async (req, res) => {
    const params = GetCommitteeRosterParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (!CHAPTER_WIDE_ROSTER_ROLES.includes(req.member.role as Role)) {
      const perms = await resolvePermissions(req.member);
      const isOwnCommitteeChair = perms.committeeChairId === params.data.id;
      const isPlatformAdmin =
        perms.isTechChair || hasSystemRole(perms.rbac, "platform_admin");
      if (!isOwnCommitteeChair && !isPlatformAdmin) {
        res.status(403).json({ error: "Insufficient role" });
        return;
      }
    }
    const rows = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.committeeId, params.data.id));
    const dtos = await Promise.all(rows.map((m) => buildMemberDto(m)));
    res.json(dtos);
  }),
);

export default router;
