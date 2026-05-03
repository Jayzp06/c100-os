import { Router, type IRouter, type Request, type Response } from "express";
import { db, membersTable } from "@workspace/db";
import { and, eq, like, ne } from "drizzle-orm";

const router: IRouter = Router();

/**
 * One-time bootstrap: lets the first authenticated Replit user claim
 * the seeded Admin slot (authId starts with "seed-").
 * Once claimed, this endpoint becomes a no-op for anyone else.
 */
router.post("/bootstrap/claim-admin", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Find a seed admin that hasn't been claimed yet
  const [seedAdmin] = await db
    .select()
    .from(membersTable)
    .where(
      and(eq(membersTable.role, "Admin"), like(membersTable.authId, "seed-%")),
    );

  if (!seedAdmin) {
    res
      .status(409)
      .json({
        error: "No unclaimed admin slot available. Bootstrap is already done.",
      });
    return;
  }

  const [claimed] = await db
    .update(membersTable)
    .set({
      authId: req.user.id,
      accountActive: true,
      membershipStatus: "Active",
      email: req.user.email ?? seedAdmin.email,
      profileImageUrl: req.user.profileImageUrl ?? seedAdmin.profileImageUrl,
      fullName:
        [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") ||
        seedAdmin.fullName,
    })
    .where(eq(membersTable.id, seedAdmin.id))
    .returning();

  if (!claimed) {
    res.status(500).json({ error: "Failed to claim admin slot" });
    return;
  }

  // Remove any auto-created inactive duplicate that shares this authId
  // (created by resolveOrCreateMember on first sign-in before bootstrap)
  await db
    .delete(membersTable)
    .where(
      and(
        eq(membersTable.authId, req.user.id),
        ne(membersTable.id, claimed.id),
        eq(membersTable.accountActive, false),
      ),
    );

  res.json({ success: true, memberId: claimed.id, role: claimed.role });
});

/**
 * Returns whether bootstrap is still needed (no real admin yet).
 * Safe to call unauthenticated.
 */
router.get("/bootstrap/status", async (_req: Request, res: Response) => {
  const [seedAdmin] = await db
    .select({ id: membersTable.id })
    .from(membersTable)
    .where(
      and(eq(membersTable.role, "Admin"), like(membersTable.authId, "seed-%")),
    );

  res.json({ bootstrapNeeded: !!seedAdmin });
});

export default router;
