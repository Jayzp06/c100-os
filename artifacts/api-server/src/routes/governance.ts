/**
 * Bylaws / Governance Documents workspace routes.
 *
 * Reads:  requires view_governance_documents (parliamentarian + bylaws_chair + president)
 * Writes: requires manage_governance_documents (bylaws_chair + president)
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { governanceDocumentsTable } from "@workspace/db";
import { eq, desc, isNull } from "drizzle-orm";
import { requirePermGroup, writeAuditLog } from "../lib/c100";

const router: IRouter = Router();

const CreateGovernanceDocBody = z.object({
  title: z.string().min(1).max(200),
  category: z.enum([
    "ChapterConstitution",
    "ChapterBylaws",
    "InstitutionPolicy",
    "NationalGuidance",
    "StandingRules",
    "Amendment",
    "Other",
  ]).default("Other"),
  versionLabel: z.string().max(50).default("1.0"),
  effectiveDate: z.string().min(1),
  approvalDate: z.string().optional(),
  notes: z.string().optional(),
  originalFilename: z.string().max(300).optional(),
  mimeType: z.string().max(100).optional(),
  fileSizeBytes: z.number().int().optional(),
  storageKey: z.string().max(500).optional(),
});

const UpdateGovernanceDocBody = CreateGovernanceDocBody.partial();

// GET /governance/documents — list (view_governance_documents)
router.get(
  "/governance/documents",
  requirePermGroup("view_governance_documents")(async (req, res) => {
    const rows = await db
      .select()
      .from(governanceDocumentsTable)
      .orderBy(desc(governanceDocumentsTable.createdAt));
    res.json(rows);
  }),
);

// POST /governance/documents — create (manage_governance_documents)
router.post(
  "/governance/documents",
  requirePermGroup("manage_governance_documents")(async (req, res) => {
    const parsed = CreateGovernanceDocBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .insert(governanceDocumentsTable)
      .values({
        ...parsed.data,
        createdById: (req as any).member.id,
        status: "draft",
      })
      .returning();
    await writeAuditLog({ action: "governance_doc.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { title: row.title } });
    res.status(201).json(row);
  }),
);

// GET /governance/documents/:id
router.get(
  "/governance/documents/:id",
  requirePermGroup("view_governance_documents")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(governanceDocumentsTable).where(eq(governanceDocumentsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

// PUT/PATCH /governance/documents/:id
router.patch(
  "/governance/documents/:id",
  requirePermGroup("manage_governance_documents")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateGovernanceDocBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(governanceDocumentsTable)
      .set({ ...parsed.data, updatedById: (req as any).member.id })
      .where(eq(governanceDocumentsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "governance_doc.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

router.put(
  "/governance/documents/:id",
  requirePermGroup("manage_governance_documents")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateGovernanceDocBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(governanceDocumentsTable)
      .set({ ...parsed.data, updatedById: (req as any).member.id })
      .where(eq(governanceDocumentsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "governance_doc.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

// POST /governance/documents/:id/publish — set status to current
// Supersedes any previously current doc in the same category ATOMICALLY.
// Both UPDATEs run inside a single DB transaction: if either fails, neither
// is committed. This prevents a state where old docs are superseded but the
// new one was never promoted to current.
router.post(
  "/governance/documents/:id/publish",
  requirePermGroup("manage_governance_documents")(async (req, res) => {
    const id = Number(req.params.id);
    const [doc] = await db.select().from(governanceDocumentsTable).where(eq(governanceDocumentsTable.id, id));
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    if (doc.status === "current") { res.status(400).json({ error: "Already current" }); return; }

    const actorId = (req as any).member.id;

    // Wrap both UPDATEs in a single transaction so the supersede and the
    // promote are atomic — partial failure leaves the database unchanged.
    const updated = await db.transaction(async (tx) => {
      // Step 1: mark all existing current docs in this category as superseded.
      await tx
        .update(governanceDocumentsTable)
        .set({ status: "superseded", updatedById: actorId })
        .where(
          eq(governanceDocumentsTable.category, doc.category),
        );

      // Step 2: promote this document to current.
      const [promoted] = await tx
        .update(governanceDocumentsTable)
        .set({ status: "current", updatedById: actorId })
        .where(eq(governanceDocumentsTable.id, id))
        .returning();

      return promoted;
    });

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "governance_doc.publish", targetType: "officer_workspace", actorId, targetId: id, after: { category: doc.category } });
    res.json(updated);
  }),
);

// POST /governance/documents/:id/supersede
router.post(
  "/governance/documents/:id/supersede",
  requirePermGroup("manage_governance_documents")(async (req, res) => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(governanceDocumentsTable)
      .set({ status: "superseded", updatedById: (req as any).member.id })
      .where(eq(governanceDocumentsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "governance_doc.supersede", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: {} });
    res.json(updated);
  }),
);

// POST /governance/documents/:id/archive
router.post(
  "/governance/documents/:id/archive",
  requirePermGroup("manage_governance_documents")(async (req, res) => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(governanceDocumentsTable)
      .set({ status: "archived", updatedById: (req as any).member.id })
      .where(eq(governanceDocumentsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "governance_doc.archive", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: {} });
    res.json(updated);
  }),
);

// POST /governance/documents/:id/restore
router.post(
  "/governance/documents/:id/restore",
  requirePermGroup("manage_governance_documents")(async (req, res) => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(governanceDocumentsTable)
      .set({ status: "draft", updatedById: (req as any).member.id })
      .where(eq(governanceDocumentsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "governance_doc.restore", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: {} });
    res.json(updated);
  }),
);

export default router;
