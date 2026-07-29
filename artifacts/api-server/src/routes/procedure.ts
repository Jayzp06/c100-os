/**
 * Parliamentarian workspace routes — motions, rulings, quorum records.
 * Writes require manage_procedure_records.
 * Governance doc lookups available to view_governance_documents holders.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  motionsTable,
  parliamentaryRulingsTable,
  quorumRecordsTable,
  governanceDocumentsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermGroup, writeAuditLog } from "../lib/c100";

const router: IRouter = Router();

const CreateMotionBody = z.object({
  motionText: z.string().min(1),
  meetingRecordId: z.number().int().optional(),
  moverId: z.number().int().optional(),
  seconderId: z.number().int().optional(),
  result: z.enum(["Passed", "Failed", "Tabled", "Withdrawn", "Other"]).default("Other"),
  voteYes: z.number().int().default(0),
  voteNo: z.number().int().default(0),
  voteAbstain: z.number().int().default(0),
  governanceDocId: z.number().int().optional(),
  governanceRef: z.string().max(200).optional(),
  notes: z.string().optional(),
});

const CreateRulingBody = z.object({
  rulingText: z.string().min(1),
  authoritySource: z.string().min(1).max(300),
  meetingRecordId: z.number().int().optional(),
  governanceDocId: z.number().int().optional(),
  governanceRef: z.string().max(200).optional(),
});

const CreateQuorumBody = z.object({
  meetingRecordId: z.number().int().optional(),
  totalMembership: z.number().int().positive(),
  quorumThreshold: z.number().int().positive(),
  membersPresent: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

// ── Motions ────────────────────────────────────────────────────────────────

router.get(
  "/procedure/motions",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const rows = await db.select().from(motionsTable).orderBy(desc(motionsTable.createdAt));
    res.json(rows);
  }),
);

router.post(
  "/procedure/motions",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const parsed = CreateMotionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .insert(motionsTable)
      .values({ ...parsed.data, createdById: (req as any).member.id })
      .returning();
    await writeAuditLog({ action: "motion.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { result: row.result } });
    res.status(201).json(row);
  }),
);

router.get(
  "/procedure/motions/:id",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(motionsTable).where(eq(motionsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

router.patch(
  "/procedure/motions/:id",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = CreateMotionBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(motionsTable)
      .set(parsed.data)
      .where(eq(motionsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "motion.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

router.put(
  "/procedure/motions/:id",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = CreateMotionBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(motionsTable)
      .set(parsed.data)
      .where(eq(motionsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "motion.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

// ── Parliamentary Rulings ─────────────────────────────────────────────────

router.get(
  "/procedure/rulings",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const rows = await db.select().from(parliamentaryRulingsTable).orderBy(desc(parliamentaryRulingsTable.createdAt));
    res.json(rows);
  }),
);

router.post(
  "/procedure/rulings",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const parsed = CreateRulingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .insert(parliamentaryRulingsTable)
      .values({ ...parsed.data, createdById: (req as any).member.id })
      .returning();
    await writeAuditLog({ action: "ruling.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: {} });
    res.status(201).json(row);
  }),
);

router.get(
  "/procedure/rulings/:id",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(parliamentaryRulingsTable).where(eq(parliamentaryRulingsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

router.patch(
  "/procedure/rulings/:id",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = CreateRulingBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(parliamentaryRulingsTable)
      .set(parsed.data)
      .where(eq(parliamentaryRulingsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "ruling.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

router.put(
  "/procedure/rulings/:id",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = CreateRulingBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(parliamentaryRulingsTable)
      .set(parsed.data)
      .where(eq(parliamentaryRulingsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "ruling.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

// ── Quorum Records ────────────────────────────────────────────────────────

router.get(
  "/procedure/quorum",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const rows = await db.select().from(quorumRecordsTable).orderBy(desc(quorumRecordsTable.recordedAt));
    res.json(rows);
  }),
);

router.post(
  "/procedure/quorum",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const parsed = CreateQuorumBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const quorumMet = parsed.data.membersPresent >= parsed.data.quorumThreshold ? 1 : 0;
    const [row] = await db
      .insert(quorumRecordsTable)
      .values({ ...parsed.data, quorumMet, createdById: (req as any).member.id })
      .returning();
    await writeAuditLog({ action: "quorum.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { quorumMet: !!quorumMet } });
    res.status(201).json(row);
  }),
);

router.get(
  "/procedure/quorum/:id",
  requirePermGroup("manage_procedure_records")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(quorumRecordsTable).where(eq(quorumRecordsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

// GET /procedure/governance-docs — read-only governance documents access
// Requires view_governance_documents (available to parliamentarian)
router.get(
  "/procedure/governance-docs",
  requirePermGroup("view_governance_documents")(async (req, res) => {
    const rows = await db
      .select()
      .from(governanceDocumentsTable)
      .orderBy(desc(governanceDocumentsTable.createdAt));
    res.json(rows);
  }),
);

export default router;
