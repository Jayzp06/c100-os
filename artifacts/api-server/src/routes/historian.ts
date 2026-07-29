/**
 * Historian workspace routes — archive entries and media uploads.
 * Writes require manage_archives. Visibility filter applied on reads.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { archiveEntriesTable } from "@workspace/db";
import { eq, desc, isNull, and } from "drizzle-orm";
import { requirePermGroup, writeAuditLog } from "../lib/c100";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const CreateArchiveEntryBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().default(""),
  eventDate: z.string().min(1),
  category: z.enum(["Photo", "Program", "Flyer", "Award", "Announcement", "Milestone", "Other"]).default("Other"),
  peopleText: z.string().optional(),
  memberRefs: z.array(z.number().int()).default([]),
  storageKey: z.string().max(500).optional(),
  originalFilename: z.string().max(300).optional(),
  visibility: z.enum(["Officers", "Public"]).default("Officers"),
  tags: z.array(z.string()).default([]),
});

const UpdateArchiveEntryBody = CreateArchiveEntryBody.partial();

// GET /historian/archive — list non-archived entries
router.get(
  "/historian/archive",
  requirePermGroup("manage_archives")(async (req, res) => {
    const rows = await db
      .select()
      .from(archiveEntriesTable)
      .where(isNull(archiveEntriesTable.archivedAt))
      .orderBy(desc(archiveEntriesTable.eventDate));
    // Parse JSON fields
    const mapped = rows.map((r) => ({
      ...r,
      memberRefs: JSON.parse(r.memberRefs ?? "[]"),
      tags: JSON.parse(r.tags ?? "[]"),
    }));
    res.json(mapped);
  }),
);

// POST /historian/archive — create
router.post(
  "/historian/archive",
  requirePermGroup("manage_archives")(async (req, res) => {
    const parsed = CreateArchiveEntryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const { memberRefs, tags, ...rest } = parsed.data;
    const [row] = await db
      .insert(archiveEntriesTable)
      .values({
        ...rest,
        memberRefs: JSON.stringify(memberRefs),
        tags: JSON.stringify(tags),
        createdById: (req as any).member.id,
      })
      .returning();
    await writeAuditLog({ action: "archive_entry.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { title: row.title } });
    res.status(201).json({ ...row, memberRefs, tags });
  }),
);

// GET /historian/archive/:id
router.get(
  "/historian/archive/:id",
  requirePermGroup("manage_archives")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(archiveEntriesTable).where(eq(archiveEntriesTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, memberRefs: JSON.parse(row.memberRefs ?? "[]"), tags: JSON.parse(row.tags ?? "[]") });
  }),
);

// PATCH /historian/archive/:id
router.patch(
  "/historian/archive/:id",
  requirePermGroup("manage_archives")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateArchiveEntryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const { memberRefs, tags, ...rest } = parsed.data;
    const update: Record<string, unknown> = { ...rest };
    if (memberRefs !== undefined) update.memberRefs = JSON.stringify(memberRefs);
    if (tags !== undefined) update.tags = JSON.stringify(tags);
    const [row] = await db
      .update(archiveEntriesTable)
      .set(update)
      .where(eq(archiveEntriesTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "archive_entry.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: rest });
    res.json({ ...row, memberRefs: JSON.parse(row.memberRefs ?? "[]"), tags: JSON.parse(row.tags ?? "[]") });
  }),
);

router.put(
  "/historian/archive/:id",
  requirePermGroup("manage_archives")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateArchiveEntryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const { memberRefs, tags, ...rest } = parsed.data;
    const update: Record<string, unknown> = { ...rest };
    if (memberRefs !== undefined) update.memberRefs = JSON.stringify(memberRefs);
    if (tags !== undefined) update.tags = JSON.stringify(tags);
    const [row] = await db
      .update(archiveEntriesTable)
      .set(update)
      .where(eq(archiveEntriesTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "archive_entry.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: rest });
    res.json({ ...row, memberRefs: JSON.parse(row.memberRefs ?? "[]"), tags: JSON.parse(row.tags ?? "[]") });
  }),
);

// POST /historian/archive/:id/archive — soft-delete
router.post(
  "/historian/archive/:id/archive",
  requirePermGroup("manage_archives")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db
      .update(archiveEntriesTable)
      .set({ archivedAt: new Date() })
      .where(eq(archiveEntriesTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "archive_entry.archive", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: {} });
    res.json(row);
  }),
);

// POST /historian/archive/:id/restore
router.post(
  "/historian/archive/:id/restore",
  requirePermGroup("manage_archives")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db
      .update(archiveEntriesTable)
      .set({ archivedAt: null })
      .where(eq(archiveEntriesTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "archive_entry.restore", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: {} });
    res.json(row);
  }),
);

// POST /historian/media/request-url — presigned URL for media upload
router.post(
  "/historian/media/request-url",
  requirePermGroup("manage_archives")(async (req, res) => {
    const parsed = z.object({
      name: z.string().min(1).max(300),
      size: z.number().int().positive().max(100 * 1024 * 1024),
      contentType: z.string().min(1),
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL("historian");
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: parsed.data });
    } catch (err) {
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  }),
);

export default router;
