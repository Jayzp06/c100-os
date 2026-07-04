import { Router, type IRouter } from "express";
import {
  CreateEventBody,
  ListEventsQueryParams,
  GetEventParams,
  UpdateEventBody,
  UpdateEventParams,
  DeleteEventParams,
  ActivateEventQrParams,
  DeactivateEventQrParams,
  GetCurrentEventQrParams,
  CheckInToEventBody,
  CheckInToEventParams,
  ListEventAttendanceParams,
  ManualAttendanceBody,
  ManualAttendanceParams,
  DeleteEventAttendanceParams,
} from "@workspace/api-zod";
import {
  db,
  eventsTable,
  membersTable,
  attendanceTable,
  committeesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  IMPACT_MULTIPLIER,
  LEADERSHIP_ROLES,
  POINT_VALUES,
  QR_ROTATE_SECONDS,
  attendanceToDto,
  buildMemberDto,
  eventToDto,
  getActiveSemester,
  isValidQrToken,
  requireAuth,
  requireRole,
  rotateQrToken,
} from "../lib/c100";

const router: IRouter = Router();

async function attendeeCount(eventId: number): Promise<number> {
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .where(eq(attendanceTable.eventId, eventId));
  return Number(c);
}

router.get("/events", async (req, res) => {
  const parsed = ListEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const filters = [eq(eventsTable.semester, await getActiveSemester())];
  if (parsed.data.status) filters.push(eq(eventsTable.status, parsed.data.status));
  if (parsed.data.committeeId)
    filters.push(eq(eventsTable.committeeId, parsed.data.committeeId));
  const rows = await db
    .select({
      e: eventsTable,
      committeeName: committeesTable.name,
      createdByName: membersTable.fullName,
    })
    .from(eventsTable)
    .leftJoin(committeesTable, eq(committeesTable.id, eventsTable.committeeId))
    .leftJoin(membersTable, eq(membersTable.id, eventsTable.createdBy))
    .where(and(...filters))
    .orderBy(eventsTable.date);

  const dtos = await Promise.all(
    rows.map(async (r) =>
      eventToDto(
        r.e,
        r.committeeName ?? null,
        r.createdByName ?? null,
        await attendeeCount(r.e.id),
      ),
    ),
  );
  res.json(dtos);
});

router.post(
  "/events",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const parsed = CreateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid event body" });
      return;
    }
    const d = parsed.data;
    const [event] = await db
      .insert(eventsTable)
      .values({
        title: d.title,
        description: d.description,
        eventType: d.eventType,
        committeeId: d.committeeId ?? null,
        createdBy: req.member.id,
        date:
          d.date instanceof Date
            ? d.date.toISOString().slice(0, 10)
            : String(d.date),
        startTime: d.startTime,
        endTime: d.endTime,
        location: d.location,
        pointValue: d.pointValue ?? POINT_VALUES[d.eventType] ?? 10,
        impactMultiplier: String(
          d.impactMultiplier ?? IMPACT_MULTIPLIER[d.eventType] ?? 1.0,
        ),
        checkInWindowMinutes: d.checkInWindowMinutes ?? 30,
        status: "Upcoming",
        semester: await getActiveSemester(),
      })
      .returning();
    res.status(201).json(eventToDto(event!, null, req.member.fullName, 0));
  }),
);

router.get("/events/:id", async (req, res) => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select({
      e: eventsTable,
      committeeName: committeesTable.name,
      createdByName: membersTable.fullName,
    })
    .from(eventsTable)
    .leftJoin(committeesTable, eq(committeesTable.id, eventsTable.committeeId))
    .leftJoin(membersTable, eq(membersTable.id, eventsTable.createdBy))
    .where(eq(eventsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const attendanceRows = await db
    .select({ a: attendanceTable, name: membersTable.fullName })
    .from(attendanceTable)
    .innerJoin(membersTable, eq(membersTable.id, attendanceTable.userId))
    .where(eq(attendanceTable.eventId, row.e.id))
    .orderBy(attendanceTable.checkInTime);
  const dto = eventToDto(
    row.e,
    row.committeeName ?? null,
    row.createdByName ?? null,
    attendanceRows.length,
  ) as Record<string, unknown>;
  dto["attendance"] = attendanceRows.map((r) =>
    attendanceToDto(r.a, r.name, row.e.title),
  );
  res.json(dto);
});

router.patch(
  "/events/:id",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const params = UpdateEventParams.safeParse(req.params);
    const body = UpdateEventBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const d = body.data;
    const update: Record<string, unknown> = {};
    if (d.title !== undefined) update["title"] = d.title;
    if (d.description !== undefined) update["description"] = d.description;
    if (d.eventType !== undefined) update["eventType"] = d.eventType;
    if (d.committeeId !== undefined) update["committeeId"] = d.committeeId;
    if (d.date !== undefined)
      update["date"] =
        d.date instanceof Date
          ? d.date.toISOString().slice(0, 10)
          : String(d.date);
    if (d.startTime !== undefined) update["startTime"] = d.startTime;
    if (d.endTime !== undefined) update["endTime"] = d.endTime;
    if (d.location !== undefined) update["location"] = d.location;
    if (d.pointValue !== undefined) update["pointValue"] = d.pointValue;
    if (d.impactMultiplier !== undefined)
      update["impactMultiplier"] = String(d.impactMultiplier);
    if (d.checkInWindowMinutes !== undefined)
      update["checkInWindowMinutes"] = d.checkInWindowMinutes;
    if (d.status !== undefined) update["status"] = d.status;
    const [updated] = await db
      .update(eventsTable)
      .set(update)
      .where(eq(eventsTable.id, params.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(eventToDto(updated, null, null, await attendeeCount(updated.id)));
  }),
);

router.delete(
  "/events/:id",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const params = DeleteEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db
      .update(eventsTable)
      .set({ status: "Cancelled", qrActive: false })
      .where(eq(eventsTable.id, params.data.id));
    res.status(204).end();
  }),
);

router.post(
  "/events/:id/qr/activate",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const params = ActivateEventQrParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { token, expiresAt } = rotateQrToken(params.data.id);
    await db
      .update(eventsTable)
      .set({
        qrActive: true,
        status: "Active",
        currentQrToken: token,
        currentQrExpiresAt: expiresAt,
      })
      .where(eq(eventsTable.id, params.data.id));
    res.json({
      eventId: params.data.id,
      token,
      expiresAt: expiresAt.toISOString(),
      rotateSeconds: QR_ROTATE_SECONDS,
    });
  }),
);

router.post(
  "/events/:id/qr/deactivate",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const params = DeactivateEventQrParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [updated] = await db
      .update(eventsTable)
      .set({
        qrActive: false,
        status: "Completed",
        currentQrToken: null,
        currentQrExpiresAt: null,
      })
      .where(eq(eventsTable.id, params.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(eventToDto(updated, null, null, await attendeeCount(updated.id)));
  }),
);

router.get(
  "/events/:id/qr/current",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const params = GetCurrentEventQrParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, params.data.id));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const { token, expiresAt } = rotateQrToken(event.id);
    await db
      .update(eventsTable)
      .set({ currentQrToken: token, currentQrExpiresAt: expiresAt })
      .where(eq(eventsTable.id, event.id));
    res.json({
      eventId: event.id,
      token,
      expiresAt: expiresAt.toISOString(),
      rotateSeconds: QR_ROTATE_SECONDS,
    });
  }),
);

router.post(
  "/events/:id/check-in",
  requireAuth(async (req, res) => {
    const params = CheckInToEventParams.safeParse(req.params);
    const body = CheckInToEventBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, params.data.id));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (!event.qrActive) {
      res.status(400).json({ error: "Check-in is not active for this event" });
      return;
    }
    if (!isValidQrToken(event.id, body.data.token)) {
      res
        .status(400)
        .json({ error: "QR token is invalid or has expired. Try again." });
      return;
    }
    const existing = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.userId, req.member.id),
          eq(attendanceTable.eventId, event.id),
        ),
      );
    if (existing.length > 0) {
      res.status(400).json({ error: "Already checked in" });
      return;
    }
    const points = Math.round(
      event.pointValue * Number(event.impactMultiplier),
    );
    const [att] = await db
      .insert(attendanceTable)
      .values({
        userId: req.member.id,
        eventId: event.id,
        method: "QrScan",
        pointsAwarded: points,
        semester: event.semester,
      })
      .returning();
    const memberDto = await buildMemberDto(req.member);
    res.json({
      attendance: attendanceToDto(att!, req.member.fullName, event.title),
      member: memberDto,
    });
  }),
);

router.get(
  "/events/:id/attendance",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const params = ListEventAttendanceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const rows = await db
      .select({ a: attendanceTable, name: membersTable.fullName, eventTitle: eventsTable.title })
      .from(attendanceTable)
      .innerJoin(membersTable, eq(membersTable.id, attendanceTable.userId))
      .innerJoin(eventsTable, eq(eventsTable.id, attendanceTable.eventId))
      .where(eq(attendanceTable.eventId, params.data.id))
      .orderBy(attendanceTable.checkInTime);
    res.json(rows.map((r) => attendanceToDto(r.a, r.name, r.eventTitle)));
  }),
);

router.post(
  "/events/:id/attendance",
  requireRole("Admin")(async (req, res) => {
    const params = ManualAttendanceParams.safeParse(req.params);
    const body = ManualAttendanceBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, params.data.id));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const [member] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, body.data.userId));
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const points = Math.round(
      event.pointValue * Number(event.impactMultiplier),
    );
    const [att] = await db
      .insert(attendanceTable)
      .values({
        userId: member.id,
        eventId: event.id,
        method: body.data.method ?? "Manual",
        pointsAwarded: points,
        correctionReason: body.data.reason,
        correctedBy: req.member.id,
        semester: event.semester,
      })
      .returning();
    res.status(201).json(attendanceToDto(att!, member.fullName, event.title));
  }),
);

router.delete(
  "/events/:id/attendance/:attendanceId",
  requireRole("Admin")(async (req, res) => {
    const params = DeleteEventAttendanceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const [deleted] = await db
      .delete(attendanceTable)
      .where(
        and(
          eq(attendanceTable.id, params.data.attendanceId),
          eq(attendanceTable.eventId, params.data.id),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Attendance record not found" });
      return;
    }
    res.status(204).end();
  }),
);

export default router;
