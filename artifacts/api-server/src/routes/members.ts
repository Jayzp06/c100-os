import { Router, type IRouter } from "express";
import {
  ListMembersQueryParams,
  GetMemberParams,
  UpdateMemberBody,
  UpdateMemberParams,
} from "@workspace/api-zod";
import { db, membersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  LEADERSHIP_ROLES,
  buildMemberDto,
  requireRole,
} from "../lib/c100";

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
          .where(eq(membersTable.committeeId, parsed.data.committeeId))
      : await db.select().from(membersTable);

    const dtos = await Promise.all(rows.map((m) => buildMemberDto(m)));
    res.json(dtos);
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
  requireRole("Admin")(async (req, res) => {
    const params = UpdateMemberParams.safeParse(req.params);
    const body = UpdateMemberBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const update: Record<string, unknown> = {};
    if (body.data.role !== undefined) update["role"] = body.data.role;
    if (body.data.committeeId !== undefined)
      update["committeeId"] = body.data.committeeId;
    if (body.data.membershipStatus !== undefined)
      update["membershipStatus"] = body.data.membershipStatus;
    if (body.data.duesPaid !== undefined) update["duesPaid"] = body.data.duesPaid;
    if (body.data.accountActive !== undefined)
      update["accountActive"] = body.data.accountActive;
    if (body.data.fullName !== undefined) update["fullName"] = body.data.fullName;

    const [updated] = await db
      .update(membersTable)
      .set(update)
      .where(eq(membersTable.id, params.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const dto = await buildMemberDto(updated);
    res.json(dto);
  }),
);

export default router;
