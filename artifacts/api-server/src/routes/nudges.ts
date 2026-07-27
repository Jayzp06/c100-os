import { Router, type IRouter } from "express";
import { ListNudgesQueryParams } from "@workspace/api-zod";
import { db, membersTable, nudgeLogsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  EXEC_OR_ADMIN,
  computeNudgeTier,
  eventsEligibleForMember,
  getActiveSemester,
  getParticipationThreshold,
  nudgeMessageFor,
  requireAuth,
  requireRole,
} from "../lib/c100";

const router: IRouter = Router();

router.get(
  "/nudges",
  requireRole(...EXEC_OR_ADMIN)(async (req, res) => {
    const parsed = ListNudgesQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query" });
      return;
    }
    let rows = await db
      .select({
        n: nudgeLogsTable,
        userName: membersTable.fullName,
      })
      .from(nudgeLogsTable)
      .innerJoin(membersTable, eq(membersTable.id, nudgeLogsTable.userId))
      .orderBy(desc(nudgeLogsTable.sentAt));
    if (parsed.data.userId)
      rows = rows.filter((r) => r.n.userId === parsed.data.userId);
    if (parsed.data.tier)
      rows = rows.filter((r) => r.n.memberStatusAtSend === parsed.data.tier);
    res.json(
      rows.map((r) => ({
        id: r.n.id,
        userId: r.n.userId,
        userName: r.userName,
        nudgeType: r.n.nudgeType,
        messageContent: r.n.messageContent,
        sentAt: r.n.sentAt.toISOString(),
        deliveryChannel: r.n.deliveryChannel,
        triggerReason: r.n.triggerReason,
        memberStatusAtSend: r.n.memberStatusAtSend,
        responseAction: r.n.responseAction,
        read: r.n.read,
      })),
    );
  }),
);

router.post(
  "/nudges/run",
  requireRole(...EXEC_OR_ADMIN)(async (_req, res) => {
    const [members, goalPct] = await Promise.all([
      db.select().from(membersTable),
      getParticipationThreshold(),
    ]);
    let nudgesSent = 0;
    for (const m of members) {
      const { eligible, attended } = await eventsEligibleForMember(m.id);
      const pct =
        eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : 0;
      const { status } = computeNudgeTier(pct, goalPct);
      const { type, message, channel } = nudgeMessageFor(
        status,
        pct,
        m.fullName,
      );
      await db
        .update(membersTable)
        .set({ nudgeStatus: status })
        .where(eq(membersTable.id, m.id));
      await db.insert(nudgeLogsTable).values({
        userId: m.id,
        nudgeType: type,
        messageContent: message,
        deliveryChannel: channel,
        triggerReason: `participation=${pct}%`,
        memberStatusAtSend: status,
        semester: await getActiveSemester(),
      });
      nudgesSent += 1;
    }
    res.json({
      evaluated: members.length,
      nudgesSent,
      ranAt: new Date().toISOString(),
    });
  }),
);

/**
 * Mark a single nudge as read. Only the nudge's owner may mark it.
 */
router.patch(
  "/nudges/:id/read",
  requireAuth(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [log] = await db
      .select()
      .from(nudgeLogsTable)
      .where(eq(nudgeLogsTable.id, id));
    if (!log) {
      res.status(404).json({ error: "Nudge not found" });
      return;
    }
    if (log.userId !== req.member.id) {
      res.status(403).json({ error: "Not your nudge" });
      return;
    }
    await db
      .update(nudgeLogsTable)
      .set({ read: true })
      .where(and(eq(nudgeLogsTable.id, id), eq(nudgeLogsTable.userId, req.member.id)));
    res.json({ ok: true });
  }),
);

/**
 * Mark all of the current member's nudges as read.
 */
router.post(
  "/nudges/read-all",
  requireAuth(async (req, res) => {
    await db
      .update(nudgeLogsTable)
      .set({ read: true })
      .where(eq(nudgeLogsTable.userId, req.member.id));
    res.json({ ok: true });
  }),
);

export default router;
