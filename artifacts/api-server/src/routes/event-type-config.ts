import { Router, type IRouter } from "express";
import { db, eventTypeConfigTable, membersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  EVENT_TYPES,
  getEventTypeConfigs,
  invalidateEventTypeConfigCache,
  requireRole,
  TECH_OR_ADMIN,
  writeAuditLog,
} from "../lib/c100";
import { UpdateEventTypeConfigBody, UpdateEventTypeConfigParams } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /event-type-config
// Admin / TechnologyChair only. Lists the current point value + impact
// multiplier for every event type, driving the auto-scoring engine and the
// admin scoring-rules settings UI.
router.get(
  "/event-type-config",
  requireRole(...TECH_OR_ADMIN)(async (_req, res) => {
    const configs = await getEventTypeConfigs();
    const rows = await db
      .select({
        eventType: eventTypeConfigTable.eventType,
        updatedAt: eventTypeConfigTable.updatedAt,
        updatedByName: membersTable.fullName,
      })
      .from(eventTypeConfigTable)
      .leftJoin(membersTable, eq(membersTable.id, eventTypeConfigTable.updatedBy));
    const metaByType = new Map(rows.map((r) => [r.eventType, r]));

    const dtos = EVENT_TYPES.map((eventType) => {
      const scoring = configs.get(eventType)!;
      const meta = metaByType.get(eventType);
      return {
        eventType,
        pointValue: scoring.pointValue,
        impactMultiplier: scoring.impactMultiplier,
        updatedAt: meta?.updatedAt ? meta.updatedAt.toISOString() : null,
        updatedByName: meta?.updatedByName ?? null,
      };
    });
    res.json(dtos);
  }),
);

// PATCH /event-type-config/:eventType
// Admin / TechnologyChair only. Updates the point value and/or impact
// multiplier used to auto-score future events of this type. Existing events
// keep the scoring value they were created with — this only changes what
// new events get going forward.
router.patch(
  "/event-type-config/:eventType",
  requireRole(...TECH_OR_ADMIN)(async (req, res) => {
    const params = UpdateEventTypeConfigParams.safeParse(req.params);
    const body = UpdateEventTypeConfigBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    if (!EVENT_TYPES.includes(params.data.eventType)) {
      res.status(404).json({ error: "Unknown event type" });
      return;
    }
    const d = body.data;
    if (d.pointValue === undefined && d.impactMultiplier === undefined) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [existing] = await db
      .select()
      .from(eventTypeConfigTable)
      .where(eq(eventTypeConfigTable.eventType, params.data.eventType));

    const before = existing
      ? {
          pointValue: existing.pointValue,
          impactMultiplier: Number(existing.impactMultiplier),
        }
      : null;

    const set: Record<string, unknown> = {
      updatedBy: req.member.id,
      updatedAt: new Date(),
    };
    if (d.pointValue !== undefined) set.pointValue = d.pointValue;
    if (d.impactMultiplier !== undefined)
      set.impactMultiplier = String(d.impactMultiplier);

    if (existing) {
      await db
        .update(eventTypeConfigTable)
        .set(set)
        .where(eq(eventTypeConfigTable.id, existing.id));
    } else {
      await db.insert(eventTypeConfigTable).values({
        eventType: params.data.eventType,
        pointValue: d.pointValue ?? 10,
        impactMultiplier: String(d.impactMultiplier ?? 1.0),
        updatedBy: req.member.id,
      });
    }

    invalidateEventTypeConfigCache();
    await writeAuditLog({
      actorId: req.member.id,
      targetType: "event_type_config",
      targetId: existing?.id ?? 0,
      action: "update_event_type_scoring",
      before,
      after: { pointValue: d.pointValue, impactMultiplier: d.impactMultiplier },
    });

    const configs = await getEventTypeConfigs();
    const scoring = configs.get(params.data.eventType)!;
    res.json({
      eventType: params.data.eventType,
      pointValue: scoring.pointValue,
      impactMultiplier: scoring.impactMultiplier,
    });
  }),
);

export default router;
