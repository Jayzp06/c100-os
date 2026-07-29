/**
 * Secretary workspace routes — meeting records and correspondence.
 * All routes require manage_minutes permission.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  meetingRecordsTable,
  meetingRecordRevisionsTable,
  correspondenceLogTable,
} from "@workspace/db";
import { eq, desc, max } from "drizzle-orm";
import { requirePermGroup, writeAuditLog } from "../lib/c100";

const router: IRouter = Router();

const CreateMeetingRecordBody = z.object({
  meetingType: z.enum(["GeneralBody", "ExecutiveBoard", "Committee", "Special", "Emergency", "Other"]),
  title: z.string().min(1).max(200),
  meetingDate: z.string().min(1),
  agendaText: z.string().optional(),
  notes: z.string().optional(),
});

const UpdateMeetingRecordBody = CreateMeetingRecordBody.partial().extend({
  status: z.enum(["draft", "submitted", "archived"]).optional(),
});

const ReviseBody = z.object({
  reason: z.string().min(1),
  agendaText: z.string().optional(),
  notes: z.string().optional(),
});

const CreateCorrespondenceBody = z.object({
  direction: z.enum(["Inbound", "Outbound"]),
  correspondent: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  dateSent: z.string().min(1),
  description: z.string().default(""),
  attachmentStorageKey: z.string().max(500).optional(),
});

// ── Meeting Records ────────────────────────────────────────────────────────

router.get(
  "/secretary/meetings",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const rows = await db
      .select()
      .from(meetingRecordsTable)
      .orderBy(desc(meetingRecordsTable.meetingDate));
    res.json(rows);
  }),
);

router.post(
  "/secretary/meetings",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const parsed = CreateMeetingRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .insert(meetingRecordsTable)
      .values({ ...parsed.data, preparedById: (req as any).member.id, status: "draft" })
      .returning();
    await writeAuditLog({ action: "meeting_record.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { title: row.title } });
    res.status(201).json(row);
  }),
);

router.get(
  "/secretary/meetings/:id",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(meetingRecordsTable).where(eq(meetingRecordsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

router.patch(
  "/secretary/meetings/:id",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(meetingRecordsTable).where(eq(meetingRecordsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    // Approved records cannot be patched directly — must use /revise
    if (existing.status === "approved") {
      res.status(409).json({ error: "Approved record must be revised via /secretary/meetings/:id/revise" });
      return;
    }
    const parsed = UpdateMeetingRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(meetingRecordsTable)
      .set(parsed.data)
      .where(eq(meetingRecordsTable.id, id))
      .returning();
    await writeAuditLog({ action: "meeting_record.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

router.put(
  "/secretary/meetings/:id",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(meetingRecordsTable).where(eq(meetingRecordsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.status === "approved") {
      res.status(409).json({ error: "Approved record must be revised via /secretary/meetings/:id/revise" });
      return;
    }
    const parsed = UpdateMeetingRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(meetingRecordsTable)
      .set(parsed.data)
      .where(eq(meetingRecordsTable.id, id))
      .returning();
    await writeAuditLog({ action: "meeting_record.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

// POST /secretary/meetings/:id/approve
router.post(
  "/secretary/meetings/:id/approve",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(meetingRecordsTable).where(eq(meetingRecordsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.status === "approved") {
      res.status(409).json({ error: "Record is already approved" });
      return;
    }
    const [row] = await db
      .update(meetingRecordsTable)
      .set({ status: "approved", approvedById: (req as any).member.id, approvedAt: new Date() })
      .where(eq(meetingRecordsTable.id, id))
      .returning();
    await writeAuditLog({ action: "meeting_record.approve", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: {} });
    res.json(row);
  }),
);

// POST /secretary/meetings/:id/revise
router.post(
  "/secretary/meetings/:id/revise",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(meetingRecordsTable).where(eq(meetingRecordsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const parsed = ReviseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }

    // Snapshot current state, then increment revision
    const snapshot = JSON.stringify(existing);
    const [maxRev] = await db
      .select({ max: max(meetingRecordRevisionsTable.revisionNumber) })
      .from(meetingRecordRevisionsTable)
      .where(eq(meetingRecordRevisionsTable.meetingRecordId, id));
    const nextRevision = (maxRev?.max ?? 0) + 1;

    await db.insert(meetingRecordRevisionsTable).values({
      meetingRecordId: id,
      revisionNumber: nextRevision,
      reason: parsed.data.reason,
      snapshot,
      revisedById: (req as any).member.id,
    });

    const updates: Record<string, unknown> = { status: "submitted" };
    if (parsed.data.agendaText !== undefined) updates.agendaText = parsed.data.agendaText;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

    const [row] = await db
      .update(meetingRecordsTable)
      .set(updates)
      .where(eq(meetingRecordsTable.id, id))
      .returning();

    await writeAuditLog({ action: "meeting_record.revise", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: { reason: parsed.data.reason, revisionNumber: nextRevision } });
    res.json(row);
  }),
);

// GET /secretary/meetings/:id/revisions
router.get(
  "/secretary/meetings/:id/revisions",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(meetingRecordRevisionsTable)
      .where(eq(meetingRecordRevisionsTable.meetingRecordId, id))
      .orderBy(desc(meetingRecordRevisionsTable.revisionNumber));
    res.json(rows);
  }),
);

// ── Correspondence Log ─────────────────────────────────────────────────────

router.get(
  "/secretary/correspondence",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const rows = await db
      .select()
      .from(correspondenceLogTable)
      .orderBy(desc(correspondenceLogTable.dateSent));
    res.json(rows);
  }),
);

router.post(
  "/secretary/correspondence",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const parsed = CreateCorrespondenceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .insert(correspondenceLogTable)
      .values({ ...parsed.data, createdById: (req as any).member.id })
      .returning();
    await writeAuditLog({ action: "correspondence.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { subject: row.subject } });
    res.status(201).json(row);
  }),
);

router.get(
  "/secretary/correspondence/:id",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(correspondenceLogTable).where(eq(correspondenceLogTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

router.put(
  "/secretary/correspondence/:id",
  requirePermGroup("manage_minutes")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = CreateCorrespondenceBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(correspondenceLogTable)
      .set(parsed.data)
      .where(eq(correspondenceLogTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "correspondence.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

export default router;
