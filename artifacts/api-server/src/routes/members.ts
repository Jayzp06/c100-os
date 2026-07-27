import { Router, type IRouter } from "express";
import {
  ListMembersQueryParams,
  GetMemberParams,
  UpdateMemberBody,
  UpdateMemberParams,
  CreateMemberBody,
  BulkImportMembersBody,
  DeleteMemberParams,
  RestoreMemberParams,
} from "@workspace/api-zod";
import { db, membersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import {
  LEADERSHIP_ROLES,
  TECH_OR_ADMIN,
  buildMemberDto,
  requireRole,
  writeAuditLog,
} from "../lib/c100";
import {
  setMemberOrgRoleTags,
  setMemberSystemRoleTags,
  resolveRbacContext,
  ASSIGNABLE_ORG_ROLE_SLUGS,
  ASSIGNABLE_SYSTEM_ROLE_SLUGS,
  deriveLegacyRole,
} from "../lib/rbac";
import { isValidEmail, sanitizeStringFields } from "../lib/validation";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get(
  "/members",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const parsed = ListMembersQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query" });
      return;
    }
    const rows = parsed.data.committeeId
      ? await db
          .select()
          .from(membersTable)
          .where(
            and(
              eq(membersTable.committeeId, parsed.data.committeeId),
              isNull(membersTable.deletedAt),
            ),
          )
      : await db
          .select()
          .from(membersTable)
          .where(isNull(membersTable.deletedAt));

    const dtos = await Promise.all(rows.map((m) => buildMemberDto(m)));
    res.json(dtos);
  }),
);

router.post(
  "/members",
  requireRole(...TECH_OR_ADMIN)(async (req, res) => {
    const parsed = CreateMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        fields: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    // Email format validation (Zod v3 has no built-in email validator)
    if (!isValidEmail(parsed.data.email)) {
      res.status(400).json({
        error: "Validation failed",
        fields: { email: ["Must be a valid email address."] },
      });
      return;
    }

    // Control-character rejection for free-text fields
    const sanitizeErrors = sanitizeStringFields(
      parsed.data as Record<string, unknown>,
      ["fullName"],
    );
    if (Object.keys(sanitizeErrors).length > 0) {
      res.status(400).json({ error: "Validation failed", fields: sanitizeErrors });
      return;
    }

    const emailNorm = parsed.data.email.toLowerCase().trim();
    const [existing] = await db
      .select({ id: membersTable.id })
      .from(membersTable)
      .where(eq(membersTable.email, emailNorm));
    if (existing) {
      res
        .status(400)
        .json({ error: "A member with this email already exists" });
      return;
    }

    const authId = `manual-${randomUUID()}`;
    const [created] = await db
      .insert(membersTable)
      .values({
        authId,
        fullName: parsed.data.fullName.trim(),
        email: emailNorm,
        role: parsed.data.role ?? "Member",
        committeeId: parsed.data.committeeId ?? null,
        studentId: parsed.data.studentId ?? null,
        membershipStatus: parsed.data.membershipStatus ?? "Active",
        accountActive: true,
        duesPaid: false,
      })
      .returning();

    await writeAuditLog({
      actorId: req.member.id,
      targetType: "member",
      targetId: created.id,
      action: "member_created",
      before: null,
      after: {
        fullName: created.fullName,
        email: created.email,
        role: created.role,
        committeeId: created.committeeId,
        membershipStatus: created.membershipStatus,
      },
      ipAddress: req.ip,
    });

    const dto = await buildMemberDto(created);
    res.json(dto);
  }),
);

router.post(
  "/members/bulk-import",
  requireRole(...TECH_OR_ADMIN)(async (req, res) => {
    const parsed = BulkImportMembersBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: "Invalid request body",
          details: parsed.error.flatten(),
        });
      return;
    }

    const { members } = parsed.data;

    const existingRows = await db
      .select({ email: membersTable.email })
      .from(membersTable);
    const existingEmails = new Set(
      existingRows.map((r) => r.email.toLowerCase()),
    );

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of members) {
      const emailNorm = row.email.toLowerCase().trim();
      if (existingEmails.has(emailNorm)) {
        skipped++;
        continue;
      }
      try {
        const authId = `import-${randomUUID()}`;
        await db.insert(membersTable).values({
          authId,
          fullName: row.fullName.trim(),
          email: emailNorm,
          role: row.role ?? "Member",
          committeeId: row.committeeId ?? null,
          studentId: row.studentId ?? null,
          membershipStatus: row.membershipStatus ?? "Inactive",
          accountActive: false,
          duesPaid: false,
        });
        existingEmails.add(emailNorm);
        created++;
      } catch (err) {
        errors.push(
          `${row.email}: ${err instanceof Error ? err.message : "insert failed"}`,
        );
      }
    }

    res.json({ created, skipped, errors });
  }),
);

router.get(
  "/members/:id",
  requireRole(...LEADERSHIP_ROLES)(async (req, res) => {
    const params = GetMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [m] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, params.data.id));
    if (!m) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const dto = await buildMemberDto(m);
    res.json(dto);
  }),
);

router.patch(
  "/members/:id",
  requireRole(...TECH_OR_ADMIN)(async (req, res) => {
    const params = UpdateMemberParams.safeParse(req.params);
    const body = UpdateMemberBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [before] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const update: Record<string, unknown> = {};
    if (body.data.role !== undefined) update["role"] = body.data.role;
    if (body.data.committeeId !== undefined)
      update["committeeId"] = body.data.committeeId;
    if (body.data.membershipStatus !== undefined)
      update["membershipStatus"] = body.data.membershipStatus;
    if (body.data.duesPaid !== undefined)
      update["duesPaid"] = body.data.duesPaid;
    if (body.data.accountActive !== undefined)
      update["accountActive"] = body.data.accountActive;
    if (body.data.fullName !== undefined)
      update["fullName"] = body.data.fullName;

    let updated = before;
    if (Object.keys(update).length > 0) {
      const rows = await db
        .update(membersTable)
        .set(update)
        .where(eq(membersTable.id, params.data.id))
        .returning();
      if (!rows[0]) {
        res.status(404).json({ error: "Member not found" });
        return;
      }
      updated = rows[0];
    }

    // Additive permission tags — layered on top of the legacy `role` column
    // above, never redefining it. See rbac.ts ASSIGNABLE_ORG_ROLE_SLUGS /
    // ASSIGNABLE_SYSTEM_ROLE_SLUGS for the exact whitelist.
    if (body.data.orgRoleSlugs !== undefined) {
      await setMemberOrgRoleTags(
        params.data.id,
        body.data.orgRoleSlugs,
        req.member.id,
      );
    }
    if (body.data.systemRoleSlugs !== undefined) {
      await setMemberSystemRoleTags(
        params.data.id,
        body.data.systemRoleSlugs,
        req.member.id,
      );
    }

    // Auto-sync the legacy `role` column from the final assignable tag set.
    // This keeps requireRole() gates consistent when the admin saves tags
    // without explicitly setting the role field.
    if (body.data.orgRoleSlugs !== undefined || body.data.systemRoleSlugs !== undefined) {
      const ctx = await resolveRbacContext(params.data.id);
      const assignableOrgSlugs = ctx.orgRoles.filter((s) =>
        (ASSIGNABLE_ORG_ROLE_SLUGS as readonly string[]).includes(s),
      );
      const assignableSysSlugs = ctx.systemRoles.filter((s) =>
        (ASSIGNABLE_SYSTEM_ROLE_SLUGS as readonly string[]).includes(s),
      );
      const derivedRole = deriveLegacyRole(assignableOrgSlugs, assignableSysSlugs);
      const [derivedResult] = await db
        .update(membersTable)
        .set({ role: derivedRole })
        .where(eq(membersTable.id, params.data.id))
        .returning();
      if (derivedResult) updated = derivedResult;
    }

    await writeAuditLog({
      actorId: req.member.id,
      targetType: "member",
      targetId: params.data.id,
      action: "member_updated",
      before: {
        role: before.role,
        committeeId: before.committeeId,
        membershipStatus: before.membershipStatus,
        duesPaid: before.duesPaid,
        accountActive: before.accountActive,
      },
      after: {
        role: updated.role,
        committeeId: updated.committeeId,
        membershipStatus: updated.membershipStatus,
        duesPaid: updated.duesPaid,
        accountActive: updated.accountActive,
      },
      ipAddress: req.ip,
    });

    const dto = await buildMemberDto(updated);
    res.json(dto);
  }),
);

router.delete(
  "/members/:id",
  requireRole(...TECH_OR_ADMIN)(async (req, res) => {
    const params = DeleteMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    if (params.data.id === req.member.id) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const [before] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (before.deletedAt) {
      res.status(400).json({ error: "Member is already deleted" });
      return;
    }

    const [updated] = await db
      .update(membersTable)
      .set({ deletedAt: new Date(), accountActive: false })
      .where(eq(membersTable.id, params.data.id))
      .returning();

    await writeAuditLog({
      actorId: req.member.id,
      targetType: "member",
      targetId: params.data.id,
      action: "member_deleted",
      before: { deletedAt: before.deletedAt, accountActive: before.accountActive },
      after: { deletedAt: updated.deletedAt, accountActive: updated.accountActive },
      ipAddress: req.ip,
    });

    const dto = await buildMemberDto(updated);
    res.json(dto);
  }),
);

router.post(
  "/members/:id/restore",
  requireRole(...TECH_OR_ADMIN)(async (req, res) => {
    const params = RestoreMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [before] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (!before.deletedAt) {
      res.status(400).json({ error: "Member is not deleted" });
      return;
    }

    const [updated] = await db
      .update(membersTable)
      .set({ deletedAt: null })
      .where(eq(membersTable.id, params.data.id))
      .returning();

    await writeAuditLog({
      actorId: req.member.id,
      targetType: "member",
      targetId: params.data.id,
      action: "member_restored",
      before: { deletedAt: before.deletedAt },
      after: { deletedAt: updated.deletedAt },
      ipAddress: req.ip,
    });

    const dto = await buildMemberDto(updated);
    res.json(dto);
  }),
);

export default router;
