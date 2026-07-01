import { Router, type IRouter } from "express";
import {
  GetCommitteeParams,
  GetCommitteeRosterParams,
} from "@workspace/api-zod";
import { db, committeesTable, membersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  buildCommitteeAggregate,
  buildMemberDto,
  getActiveSemester,
  LEADERSHIP_ROLES,
  requireAuth,
  requireRole,
} from "../lib/c100";

const router: IRouter = Router();

async function buildLeaderboard() {
  const all = await db.select().from(committeesTable);
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
    db.select().from(committeesTable),
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
  void requireAuth;
});

router.get(
  "/committees/:id/roster",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const params = GetCommitteeRosterParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
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
