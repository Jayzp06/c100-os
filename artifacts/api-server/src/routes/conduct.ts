/**
 * Sergeant-at-Arms workspace routes — conduct records.
 * All routes require manage_conduct_records.
 * Conduct records are confidential — never accessible without permission.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { conductRecordsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermGroup, writeAuditLog } from "../lib/c100";

const router: IRouter = Router();

const CreateConductRecordBody = z.object({
  recordType: z.enum(["IncidentReport", "AttendanceIrregularity", "MeetingOrderNote"]),
  reportDate: z.string().min(1),
  memberId: z.number().int().optional(),
  eventId: z.number().int().optional(),
  summary: z.string().min(1),
  privateDetails: z.string().default(""),
});

const UpdateConductRecordBody = CreateConductRecordBody.partial().extend({
  status: z.enum(["Open", "UnderReview", "Resolved", "Archived"]).optional(),
  resolution: z.string().optional(),
});

// GET /conduct/records
router.get(
  "/conduct/records",
  requirePermGroup("manage_conduct_records")(async (req, res) => {
    const rows = await db
      .select()
      .from(conductRecordsTable)
      .orderBy(desc(conductRecordsTable.reportDate));
    res.json(rows);
  }),
);

// POST /conduct/records
router.post(
  "/conduct/records",
  requirePermGroup("manage_conduct_records")(async (req, res) => {
    const parsed = CreateConductRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .insert(conductRecordsTable)
      .values({ ...parsed.data, reporterId: (req as any).member.id, status: "Open" })
      .returning();
    await writeAuditLog({ action: "conduct_record.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { recordType: row.recordType } });
    res.status(201).json(row);
  }),
);

// GET /conduct/records/:id
router.get(
  "/conduct/records/:id",
  requirePermGroup("manage_conduct_records")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(conductRecordsTable).where(eq(conductRecordsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

// PATCH /conduct/records/:id
router.patch(
  "/conduct/records/:id",
  requirePermGroup("manage_conduct_records")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateConductRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(conductRecordsTable)
      .set(parsed.data)
      .where(eq(conductRecordsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "conduct_record.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

router.put(
  "/conduct/records/:id",
  requirePermGroup("manage_conduct_records")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateConductRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(conductRecordsTable)
      .set(parsed.data)
      .where(eq(conductRecordsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "conduct_record.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

// POST /conduct/records/:id/resolve
router.post(
  "/conduct/records/:id/resolve",
  requirePermGroup("manage_conduct_records")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = z.object({ resolution: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "resolution is required" });
      return;
    }
    const [row] = await db
      .update(conductRecordsTable)
      .set({ status: "Resolved", resolution: parsed.data.resolution })
      .where(eq(conductRecordsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "conduct_record.resolve", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: { resolution: parsed.data.resolution } });
    res.json(row);
  }),
);

// POST /conduct/records/:id/archive
router.post(
  "/conduct/records/:id/archive",
  requirePermGroup("manage_conduct_records")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db
      .update(conductRecordsTable)
      .set({ status: "Archived" })
      .where(eq(conductRecordsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "conduct_record.archive", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: {} });
    res.json(row);
  }),
);

export default router;
