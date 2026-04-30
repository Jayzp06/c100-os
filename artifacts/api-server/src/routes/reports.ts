import { Router, type IRouter } from "express";
import { db, membersTable, eventsTable, committeesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CURRENT_SEMESTER,
  EXEC_OR_ADMIN,
  PARTICIPATION_THRESHOLD,
  buildCommitteeAggregate,
  eventsEligibleForMember,
  memberPointsAndImpact,
  recentChapterAttendance,
  requireRole,
} from "../lib/c100";

const router: IRouter = Router();

interface EligibilityInput {
  participationPct: number;
  totalPoints: number;
  impactPoints: number;
  gpa: number | null;
  duesPaid: boolean;
  membershipStatus: string;
}

function eligibility(rec: EligibilityInput) {
  const meetsParticipation = rec.participationPct >= PARTICIPATION_THRESHOLD;
  const meetsGpa = rec.gpa != null ? rec.gpa >= 2.5 : false;
  const meetsDues = rec.duesPaid;
  const meetsStatus =
    rec.membershipStatus === "Active" ||
    rec.membershipStatus === "Probationary";
  const score =
    rec.participationPct * 0.4 +
    Math.min(rec.totalPoints, 200) * 0.2 +
    Math.min(rec.impactPoints, 200) * 0.3 +
    (rec.gpa != null ? rec.gpa * 10 : 0) * 0.1;
  return {
    meetsParticipation,
    meetsGpa,
    meetsDues,
    meetsStatus,
    systemScore: Math.round(score * 10) / 10,
    eligible: meetsParticipation && meetsGpa && meetsDues && meetsStatus,
  };
}

async function buildEligibilityList() {
  const members = await db
    .select({ m: membersTable, committeeName: committeesTable.name })
    .from(membersTable)
    .leftJoin(committeesTable, eq(committeesTable.id, membersTable.committeeId));
  const records = await Promise.all(
    members.map(async ({ m, committeeName }) => {
      const [{ totalPoints, impactPoints }, { eligible, attended }] =
        await Promise.all([
          memberPointsAndImpact(m.id),
          eventsEligibleForMember(m.id),
        ]);
      const participationPct =
        eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : 0;
      const elig = eligibility({
        participationPct,
        totalPoints,
        impactPoints,
        gpa: m.gpa != null ? Number(m.gpa) : null,
        duesPaid: m.duesPaid,
        membershipStatus: m.membershipStatus,
      });
      return {
        userId: m.id,
        fullName: m.fullName,
        committeeName: committeeName ?? null,
        participationPct,
        totalPoints,
        impactPoints,
        gpa: m.gpa != null ? Number(m.gpa) : null,
        duesPaid: m.duesPaid,
        membershipStatus: m.membershipStatus,
        ...elig,
      };
    }),
  );
  return records;
}

router.get(
  "/reports/scholarship-eligibility",
  requireRole(...EXEC_OR_ADMIN)(async (_req, res) => {
    const records = await buildEligibilityList();
    res.json(
      records.map((r) => ({ ...r, rank: null })),
    );
  }),
);

router.get(
  "/reports/conference-eligibility",
  requireRole(...EXEC_OR_ADMIN)(async (_req, res) => {
    const records = await buildEligibilityList();
    const ranked = [...records]
      .sort((a, b) => b.systemScore - a.systemScore)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
    res.json(ranked);
  }),
);

router.get(
  "/reports/admin-overview",
  requireRole(...EXEC_OR_ADMIN)(async (_req, res) => {
    const members = await db.select().from(membersTable);
    const events = await db.select().from(eventsTable);
    const committees = await db.select().from(committeesTable);
    const aggregates = await Promise.all(
      committees.map((c) => buildCommitteeAggregate(c)),
    );
    const ranked = [...aggregates]
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

    let totalParticipation = 0;
    for (const m of members) {
      const { eligible, attended } = await eventsEligibleForMember(m.id);
      totalParticipation += eligible > 0 ? (attended / eligible) * 100 : 0;
    }
    const chapterParticipationPct =
      members.length > 0
        ? Math.round((totalParticipation / members.length) * 10) / 10
        : 0;

    res.json({
      totalMembers: members.length,
      activeMembers: members.filter((m) => m.nudgeStatus === "Active").length,
      atRiskMembers: members.filter((m) => m.nudgeStatus === "AtRisk").length,
      criticalMembers: members.filter((m) => m.nudgeStatus === "Critical")
        .length,
      totalEvents: events.length,
      upcomingEvents: events.filter(
        (e) => e.status === "Upcoming" && e.semester === CURRENT_SEMESTER,
      ).length,
      completedEvents: events.filter((e) => e.status === "Completed").length,
      chapterParticipationPct,
      committees: ranked,
      recentActivity: await recentChapterAttendance(10),
    });
    void sql;
  }),
);

export default router;
