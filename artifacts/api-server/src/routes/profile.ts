import { Router, type IRouter } from "express";
import { UpdateMyProfileBody } from "@workspace/api-zod";
import {
  db,
  membersTable,
  eventsTable,
  attendanceTable,
  nudgeLogsTable,
  committeesTable,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  attendanceToDto,
  buildCommitteeAggregate,
  buildMemberDto,
  eventToDto,
  getActiveSemester,
  getParticipationThreshold,
  loadMember,
  requireAuth,
  resolvePermissions,
  syntheticPermissionsFor,
  writeAuditLog,
} from "../lib/c100";
import { getSession, getSessionId } from "../lib/auth";

const router: IRouter = Router();

router.get(
  "/me",
  requireAuth(async (req, res) => {
    const [dto, realPerms] = await Promise.all([
      buildMemberDto(req.member),
      resolvePermissions(req.member),
    ]);

    let perms = realPerms;
    let impersonating: { viewAs: string; startedAt: string } | null = null;

    if (realPerms.isTechChair) {
      const sid = getSessionId(req);
      if (sid) {
        const session = await getSession(sid);
        if (session?.impersonating) {
          impersonating = session.impersonating;
          perms = {
            ...syntheticPermissionsFor(session.impersonating.viewAs),
            isTechChair: true,
          };
        }
      }
    }

    res.json({
      ...(dto as object),
      experience: perms.experience,
      officerPositions: perms.officerPositions,
      committeeChairId: perms.committeeChairId,
      isTechChair: realPerms.isTechChair,
      systemRoles: realPerms.rbac.systemRoles,
      orgRoles: realPerms.rbac.orgRoles,
      permissionGroups: [...realPerms.rbac.permissionGroups],
      impersonating,
    });
  }),
);

router.patch(
  "/me",
  requireAuth(async (req, res) => {
    const parsed = UpdateMyProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid profile body" });
      return;
    }
    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.fullName !== undefined) update["fullName"] = data.fullName;
    if (data.phone !== undefined) update["phone"] = data.phone;
    if (data.studentId !== undefined) update["studentId"] = data.studentId;
    if (data.gpa !== undefined)
      update["gpa"] = data.gpa != null ? String(data.gpa) : null;
    if (data.graduationYear !== undefined)
      update["graduationYear"] = data.graduationYear;

    const before = { ...req.member };
    const [updated] = await db
      .update(membersTable)
      .set(update)
      .where(eq(membersTable.id, req.member.id))
      .returning();
    if (!updated) {
      res.status(500).json({ error: "Update failed" });
      return;
    }

    await writeAuditLog({
      actorId: req.member.id,
      targetType: "member",
      targetId: req.member.id,
      action: "profile_updated",
      before: { gpa: before.gpa, phone: before.phone, studentId: before.studentId },
      after: { gpa: updated.gpa, phone: updated.phone, studentId: updated.studentId },
    });

    const [dto, permissions] = await Promise.all([
      buildMemberDto(updated),
      resolvePermissions(updated),
    ]);
    res.json({
      ...(dto as object),
      experience: permissions.experience,
      officerPositions: permissions.officerPositions,
      committeeChairId: permissions.committeeChairId,
    });
  }),
);

router.get(
  "/me/dashboard",
  requireAuth(async (req, res) => {
    const member = await loadMember(req.member.authId);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const sem = await getActiveSemester();
    const memberDto = (await buildMemberDto(member)) as {
      committeeId: number | null;
    };

    const upcomingRows = await db
      .select({ e: eventsTable, c: membersTable.fullName })
      .from(eventsTable)
      .leftJoin(membersTable, eq(membersTable.id, eventsTable.createdBy))
      .where(
        and(
          gte(eventsTable.date, new Date().toISOString().slice(0, 10)),
          eq(eventsTable.semester, sem),
        ),
      )
      .orderBy(eventsTable.date)
      .limit(5);

    const upcoming = upcomingRows.map((r) =>
      eventToDto(r.e, null, r.c ?? null, 0),
    );

    let committeeDto: unknown = null;
    if (member.committeeId) {
      const [committeeRow] = await db
        .select()
        .from(committeesTable)
        .where(eq(committeesTable.id, member.committeeId));
      if (committeeRow) {
        const agg = await buildCommitteeAggregate(committeeRow);
        const allCommittees = await db.select().from(committeesTable);
        const aggregates = await Promise.all(
          allCommittees.map((c) => buildCommitteeAggregate(c)),
        );
        const sorted = [...aggregates].sort(
          (a, b) => b.totalImpactPoints - a.totalImpactPoints,
        );
        const rank =
          sorted.findIndex((s) => s.committee.id === committeeRow.id) + 1;
        committeeDto = {
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
      }
    }

    const allCommittees = await db.select().from(committeesTable);
    const aggregates = await Promise.all(
      allCommittees.map((c) => buildCommitteeAggregate(c)),
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

    const activeNudgeRows = await db
      .select()
      .from(nudgeLogsTable)
      .where(eq(nudgeLogsTable.userId, member.id))
      .orderBy(desc(nudgeLogsTable.sentAt))
      .limit(5);
    const activeNudges = activeNudgeRows.map((n) => ({
      id: n.id,
      userId: n.userId,
      userName: member.fullName,
      nudgeType: n.nudgeType,
      messageContent: n.messageContent,
      sentAt: n.sentAt.toISOString(),
      deliveryChannel: n.deliveryChannel,
      triggerReason: n.triggerReason,
      memberStatusAtSend: n.memberStatusAtSend,
      responseAction: n.responseAction,
      read: n.read,
    }));

    const recentRows = await db
      .select({ a: attendanceTable, eventTitle: eventsTable.title })
      .from(attendanceTable)
      .innerJoin(eventsTable, eq(eventsTable.id, attendanceTable.eventId))
      .where(eq(attendanceTable.userId, member.id))
      .orderBy(desc(attendanceTable.checkInTime))
      .limit(5);
    const recentAttendance = recentRows.map((r) =>
      attendanceToDto(r.a, member.fullName, r.eventTitle),
    );

    res.json({
      member: memberDto,
      upcomingEvents: upcoming,
      committee: committeeDto,
      committeeLeaderboard: ranked,
      activeNudges,
      recentAttendance,
      participationGoalPct: await getParticipationThreshold(),
    });
  }),
);

router.get(
  "/me/nudges",
  requireAuth(async (req, res) => {
    const rows = await db
      .select()
      .from(nudgeLogsTable)
      .where(eq(nudgeLogsTable.userId, req.member.id))
      .orderBy(desc(nudgeLogsTable.sentAt));
    res.json(
      rows.map((n) => ({
        id: n.id,
        userId: n.userId,
        userName: req.member.fullName,
        nudgeType: n.nudgeType,
        messageContent: n.messageContent,
        sentAt: n.sentAt.toISOString(),
        deliveryChannel: n.deliveryChannel,
        triggerReason: n.triggerReason,
        memberStatusAtSend: n.memberStatusAtSend,
        responseAction: n.responseAction,
        read: n.read,
      })),
    );
  }),
);

export default router;
