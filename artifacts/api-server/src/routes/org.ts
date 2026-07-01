import { Router, type IRouter } from "express";
import { db, orgSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getOrgSettings,
  invalidateOrgCache,
  requireRole,
} from "../lib/c100";

const router: IRouter = Router();

// GET /org/settings
// Public — no auth required; the login page calls this before the user signs in.
router.get("/org/settings", async (_req, res) => {
  const settings = await getOrgSettings();
  res.json(settings);
});

// PATCH /org/settings
// Admin only — update any subset of org settings fields.
router.patch(
  "/org/settings",
  requireRole("Admin")(async (req, res) => {
    const body = req.body as Partial<{
      universityName: string;
      chapterName: string;
      chapterIdentifier: string;
      motto: string | null;
      primaryColor: string;
      secondaryColor: string;
      logoUrl: string | null;
      participationGoalPct: number;
      scholarshipMinPct: number;
      conferenceMinPct: number;
      awardsMinPct: number;
      duesAmountCents: number;
    }>;

    const [existing] = await db
      .select({ id: orgSettingsTable.id })
      .from(orgSettingsTable)
      .limit(1);

    if (existing) {
      // Partial update — only set fields that were provided
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (body.universityName !== undefined) set.universityName = body.universityName;
      if (body.chapterName !== undefined) set.chapterName = body.chapterName;
      if (body.chapterIdentifier !== undefined) set.chapterIdentifier = body.chapterIdentifier;
      if ("motto" in body) set.motto = body.motto;
      if (body.primaryColor !== undefined) set.primaryColor = body.primaryColor;
      if (body.secondaryColor !== undefined) set.secondaryColor = body.secondaryColor;
      if ("logoUrl" in body) set.logoUrl = body.logoUrl;
      if (body.participationGoalPct !== undefined)
        set.participationGoalPct = body.participationGoalPct.toFixed(2);
      if (body.scholarshipMinPct !== undefined)
        set.scholarshipMinPct = body.scholarshipMinPct.toFixed(2);
      if (body.conferenceMinPct !== undefined)
        set.conferenceMinPct = body.conferenceMinPct.toFixed(2);
      if (body.awardsMinPct !== undefined)
        set.awardsMinPct = body.awardsMinPct.toFixed(2);
      if (body.duesAmountCents !== undefined) set.duesAmountCents = body.duesAmountCents;

      await db
        .update(orgSettingsTable)
        .set(set as Parameters<ReturnType<typeof db.update>["set"]>[0])
        .where(eq(orgSettingsTable.id, existing.id));
    } else {
      // First-time insert — require the mandatory identity fields
      const { universityName, chapterName, chapterIdentifier } = body;
      if (!universityName || !chapterName || !chapterIdentifier) {
        res.status(400).json({
          error:
            "universityName, chapterName, and chapterIdentifier are required for first-time org setup",
        });
        return;
      }
      await db.insert(orgSettingsTable).values({
        universityName,
        chapterName,
        chapterIdentifier,
        motto: body.motto ?? null,
        primaryColor: body.primaryColor ?? "hsl(221 100% 31%)",
        secondaryColor: body.secondaryColor ?? "#C9A227",
        logoUrl: body.logoUrl ?? null,
        participationGoalPct:
          body.participationGoalPct != null
            ? body.participationGoalPct.toFixed(2)
            : "75.00",
        scholarshipMinPct:
          body.scholarshipMinPct != null
            ? body.scholarshipMinPct.toFixed(2)
            : "80.00",
        conferenceMinPct:
          body.conferenceMinPct != null
            ? body.conferenceMinPct.toFixed(2)
            : "85.00",
        awardsMinPct:
          body.awardsMinPct != null ? body.awardsMinPct.toFixed(2) : "90.00",
        duesAmountCents: body.duesAmountCents ?? 0,
      });
    }

    // Bust in-process cache so next read reflects the change immediately
    invalidateOrgCache();
    const settings = await getOrgSettings();
    res.json(settings);
  }),
);

export default router;
