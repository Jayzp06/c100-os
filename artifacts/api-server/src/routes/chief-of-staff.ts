/**
 * Chief of Staff workspace routes — executive action items and decision log.
 *
 * All routes require manage_executive_operations.
 *
 * Confidentiality rules:
 *  - Tasks may reference another workspace by name and an opaque source-record
 *    identifier, but the route never fetches or returns content from that domain.
 *  - Opening a linked source record requires the domain permission, not this one.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  executiveTasksTable,
  executiveTaskCollaboratorsTable,
  membersTable,
} from "@workspace/db";
import { and, eq, desc, lt, lte, gte, or, inArray, isNull, ne, sql } from "drizzle-orm";
import { requirePermGroup, writeAuditLog } from "../lib/c100";

const router: IRouter = Router();

const VALID_STATUSES = [
  "not_started", "in_progress", "blocked", "completed", "cancelled", "archived",
] as const;

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const CreateTaskBody = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  ownerId: z.number().int().positive(),
  priority: z.enum(VALID_PRIORITIES).default("medium"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  relatedWorkspace: z.string().max(64).optional(),
  relatedSourceRecord: z.string().max(200).optional(),
  sourceMeetingId: z.number().int().positive().optional(),
  sourceEventId: z.number().int().positive().optional(),
  notes: z.string().optional(),
  collaboratorIds: z.array(z.number().int().positive()).optional(),
});

const UpdateTaskBody = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional().nullable(),
  ownerId: z.number().int().positive().optional(),
  priority: z.enum(VALID_PRIORITIES).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  completionDate: z.string().datetime().optional().nullable(),
  relatedWorkspace: z.string().max(64).optional().nullable(),
  relatedSourceRecord: z.string().max(200).optional().nullable(),
  sourceMeetingId: z.number().int().positive().optional().nullable(),
  sourceEventId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ── Summary ────────────────────────────────────────────────────────────────────

// GET /chief-of-staff/summary — dashboard counts
router.get(
  "/chief-of-staff/summary",
  requirePermGroup("manage_executive_operations")(async (_req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const all = await db.select().from(executiveTasksTable);

    const open        = all.filter((t) => t.status === "not_started" || t.status === "in_progress");
    const blocked     = all.filter((t) => t.status === "blocked");
    const overdue     = all.filter(
      (t) =>
        t.dueDate != null &&
        t.dueDate < today &&
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        t.status !== "archived",
    );
    const dueSoon     = all.filter(
      (t) =>
        t.dueDate != null &&
        t.dueDate >= today &&
        t.dueDate <= soonDate &&
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        t.status !== "archived",
    );
    const recentDone  = all
      .filter((t) => t.status === "completed")
      .sort((a, b) =>
        (b.completionDate?.getTime() ?? 0) - (a.completionDate?.getTime() ?? 0),
      )
      .slice(0, 5);

    res.json({
      open:       open.length,
      blocked:    blocked.length,
      overdue:    overdue.length,
      dueSoon:    dueSoon.length,
      recentDone: recentDone.map((t) => ({ id: t.id, title: t.title, completionDate: t.completionDate })),
    });
  }),
);

// ── Task list ──────────────────────────────────────────────────────────────────

// GET /chief-of-staff/tasks
router.get(
  "/chief-of-staff/tasks",
  requirePermGroup("manage_executive_operations")(async (req, res) => {
    const { status, priority, ownerId, relatedWorkspace } = req.query;

    const where: ReturnType<typeof and>[] = [];
    if (typeof status === "string" && status)
      where.push(eq(executiveTasksTable.status, status));
    if (typeof priority === "string" && priority)
      where.push(eq(executiveTasksTable.priority, priority));
    if (typeof ownerId === "string" && ownerId)
      where.push(eq(executiveTasksTable.ownerId, Number(ownerId)));
    if (typeof relatedWorkspace === "string" && relatedWorkspace)
      where.push(eq(executiveTasksTable.relatedWorkspace, relatedWorkspace));

    const rows = await db
      .select()
      .from(executiveTasksTable)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(executiveTasksTable.createdAt));

    // Attach collaborators for each task
    const taskIds = rows.map((r) => r.id);
    const collabs =
      taskIds.length > 0
        ? await db
            .select()
            .from(executiveTaskCollaboratorsTable)
            .where(inArray(executiveTaskCollaboratorsTable.taskId, taskIds))
        : [];

    const collabByTask = new Map<number, number[]>();
    for (const c of collabs) {
      const list = collabByTask.get(c.taskId) ?? [];
      list.push(c.memberId);
      collabByTask.set(c.taskId, list);
    }

    res.json(
      rows.map((r) => ({
        ...r,
        collaboratorIds: collabByTask.get(r.id) ?? [],
      })),
    );
  }),
);

// POST /chief-of-staff/tasks
router.post(
  "/chief-of-staff/tasks",
  requirePermGroup("manage_executive_operations")(async (req, res) => {
    const body = CreateTaskBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }

    const actorId = (req as any).member.id;
    const { collaboratorIds = [], ...fields } = body.data;

    const [task] = await db
      .insert(executiveTasksTable)
      .values({ ...fields, createdById: actorId, updatedById: actorId })
      .returning();

    if (!task) { res.status(500).json({ error: "Insert failed" }); return; }

    if (collaboratorIds.length > 0) {
      await db.insert(executiveTaskCollaboratorsTable).values(
        collaboratorIds.map((memberId) => ({ taskId: task.id, memberId, addedById: actorId })),
      ).onConflictDoNothing();
    }

    await writeAuditLog({
      actorId,
      targetType: "officer_workspace",
      targetId: task.id,
      action: "exec_task.create",
      after: { title: task.title, ownerId: task.ownerId, status: task.status },
    });

    res.status(201).json({ ...task, collaboratorIds });
  }),
);

// GET /chief-of-staff/tasks/:id
router.get(
  "/chief-of-staff/tasks/:id",
  requirePermGroup("manage_executive_operations")(async (req, res) => {
    const id = Number(req.params.id);
    const [task] = await db
      .select()
      .from(executiveTasksTable)
      .where(eq(executiveTasksTable.id, id));
    if (!task) { res.status(404).json({ error: "Not found" }); return; }

    const collabs = await db
      .select()
      .from(executiveTaskCollaboratorsTable)
      .where(eq(executiveTaskCollaboratorsTable.taskId, id));

    res.json({ ...task, collaboratorIds: collabs.map((c) => c.memberId) });
  }),
);

// PATCH /chief-of-staff/tasks/:id
router.patch(
  "/chief-of-staff/tasks/:id",
  requirePermGroup("manage_executive_operations")(async (req, res) => {
    const id = Number(req.params.id);
    const body = UpdateTaskBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }

    const [before] = await db
      .select()
      .from(executiveTasksTable)
      .where(eq(executiveTasksTable.id, id));
    if (!before) { res.status(404).json({ error: "Not found" }); return; }

    const actorId = (req as any).member.id;

    const update: Record<string, unknown> = { updatedById: actorId };
    for (const [k, v] of Object.entries(body.data)) {
      if (v !== undefined) update[k] = v;
    }

    // Auto-set completionDate when transitioning to completed
    if (body.data.status === "completed" && before.status !== "completed") {
      update["completionDate"] = new Date();
    }
    // Clear completionDate when un-completing
    if (body.data.status && body.data.status !== "completed" && before.status === "completed") {
      update["completionDate"] = null;
    }

    const [updated] = await db
      .update(executiveTasksTable)
      .set(update)
      .where(eq(executiveTasksTable.id, id))
      .returning();

    await writeAuditLog({
      actorId,
      targetType: "officer_workspace",
      targetId: id,
      action: "exec_task.update",
      before: { status: before.status, ownerId: before.ownerId },
      after: { status: updated?.status, ownerId: updated?.ownerId },
    });

    res.json(updated);
  }),
);

// DELETE /chief-of-staff/tasks/:id — archive (soft delete)
router.delete(
  "/chief-of-staff/tasks/:id",
  requirePermGroup("manage_executive_operations")(async (req, res) => {
    const id = Number(req.params.id);
    const actorId = (req as any).member.id;

    const [updated] = await db
      .update(executiveTasksTable)
      .set({ status: "archived", updatedById: actorId })
      .where(eq(executiveTasksTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    await writeAuditLog({
      actorId,
      targetType: "officer_workspace",
      targetId: id,
      action: "exec_task.archive",
    });

    res.json(updated);
  }),
);

// POST /chief-of-staff/tasks/:id/restore — un-archive
router.post(
  "/chief-of-staff/tasks/:id/restore",
  requirePermGroup("manage_executive_operations")(async (req, res) => {
    const id = Number(req.params.id);
    const actorId = (req as any).member.id;

    const [updated] = await db
      .update(executiveTasksTable)
      .set({ status: "not_started", updatedById: actorId })
      .where(
        and(
          eq(executiveTasksTable.id, id),
          eq(executiveTasksTable.status, "archived"),
        ),
      )
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found or not archived" }); return; }

    await writeAuditLog({
      actorId,
      targetType: "officer_workspace",
      targetId: id,
      action: "exec_task.restore",
    });

    res.json(updated);
  }),
);

// ── Collaborators ──────────────────────────────────────────────────────────────

// POST /chief-of-staff/tasks/:id/collaborators
router.post(
  "/chief-of-staff/tasks/:id/collaborators",
  requirePermGroup("manage_executive_operations")(async (req, res) => {
    const taskId = Number(req.params.id);
    const { memberId } = z.object({ memberId: z.number().int().positive() }).parse(req.body);
    const actorId = (req as any).member.id;

    await db
      .insert(executiveTaskCollaboratorsTable)
      .values({ taskId, memberId, addedById: actorId })
      .onConflictDoNothing();

    await writeAuditLog({
      actorId,
      targetType: "officer_workspace",
      targetId: taskId,
      action: "exec_task.collaborator_added",
      after: { memberId },
    });

    res.status(201).json({ taskId, memberId });
  }),
);

// DELETE /chief-of-staff/tasks/:id/collaborators/:memberId
router.delete(
  "/chief-of-staff/tasks/:id/collaborators/:memberId",
  requirePermGroup("manage_executive_operations")(async (req, res) => {
    const taskId   = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    const actorId  = (req as any).member.id;

    await db
      .delete(executiveTaskCollaboratorsTable)
      .where(
        and(
          eq(executiveTaskCollaboratorsTable.taskId, taskId),
          eq(executiveTaskCollaboratorsTable.memberId, memberId),
        ),
      );

    await writeAuditLog({
      actorId,
      targetType: "officer_workspace",
      targetId: taskId,
      action: "exec_task.collaborator_removed",
      after: { memberId },
    });

    res.status(204).end();
  }),
);

// ── Assignment candidates ───────────────────────────────────────────────────

/**
 * GET /chief-of-staff/assignment-candidates
 *
 * Returns a minimal list of active chapter members suitable for populating
 * a task-owner selector.  Deliberately exposes ONLY non-confidential fields
 * (id, name, email, status) — this endpoint must NOT grant the Chief of Staff
 * access to GPA, dues history, conduct records, or any other restricted data.
 *
 * Permission: manage_executive_operations (same gate as all CoS routes).
 */
router.get(
  "/chief-of-staff/assignment-candidates",
  requirePermGroup("manage_executive_operations")(async (_req, res) => {
    const candidates = await db
      .select({
        id: membersTable.id,
        fullName: membersTable.fullName,
        email: membersTable.email,
        membershipStatus: membersTable.membershipStatus,
      })
      .from(membersTable)
      .where(
        and(
          isNull(membersTable.deletedAt),
          inArray(membersTable.membershipStatus, ["Active", "Probationary"]),
        ),
      )
      .orderBy(membersTable.fullName);

    res.json(candidates);
  }),
);

export default router;
