import { Router, type IRouter } from "express";
import {
  requireRole,
  writeAuditLog,
  syntheticPermissionsFor,
  resolvePermissions,
  buildMemberDto,
  isValidViewAs,
} from "../lib/c100";
import {
  getSession,
  getSessionId,
  updateSession,
} from "../lib/auth";

const router: IRouter = Router();

router.post(
  "/tech/impersonate",
  requireRole("TechnologyChair")(async (req, res) => {
    const { viewAs } = req.body as { viewAs?: unknown };
    if (!isValidViewAs(viewAs)) {
      res.status(400).json({ error: "Invalid viewAs value" });
      return;
    }

    const sid = getSessionId(req);
    if (!sid) {
      res.status(401).json({ error: "No session" });
      return;
    }
    const session = await getSession(sid);
    if (!session) {
      res.status(401).json({ error: "Session not found" });
      return;
    }

    const startedAt = new Date().toISOString();
    session.impersonating = { viewAs, startedAt };
    await updateSession(sid, session);

    await writeAuditLog({
      actorId: req.member.id,
      targetType: "impersonation",
      targetId: req.member.id,
      action: "impersonation_started",
      after: { viewAs, startedAt },
      ipAddress: req.ip,
    });

    const [dto, realPerms] = await Promise.all([
      buildMemberDto(req.member),
      resolvePermissions(req.member),
    ]);
    const perms = syntheticPermissionsFor(viewAs);

    res.json({
      ...(dto as object),
      experience: perms.experience,
      officerPositions: perms.officerPositions,
      committeeChairId: perms.committeeChairId,
      isTechChair: realPerms.isTechChair,
      impersonating: { viewAs, startedAt },
    });
  }),
);

router.delete(
  "/tech/impersonate",
  requireRole("TechnologyChair")(async (req, res) => {
    const sid = getSessionId(req);
    if (!sid) {
      res.status(401).json({ error: "No session" });
      return;
    }
    const session = await getSession(sid);
    if (!session) {
      res.status(401).json({ error: "Session not found" });
      return;
    }

    const previous = session.impersonating;
    delete session.impersonating;
    await updateSession(sid, session);

    if (previous) {
      await writeAuditLog({
        actorId: req.member.id,
        targetType: "impersonation",
        targetId: req.member.id,
        action: "impersonation_ended",
        before: previous,
        ipAddress: req.ip,
      });
    }

    const [dto, perms] = await Promise.all([
      buildMemberDto(req.member),
      resolvePermissions(req.member),
    ]);

    res.json({
      ...(dto as object),
      experience: perms.experience,
      officerPositions: perms.officerPositions,
      committeeChairId: perms.committeeChairId,
      isTechChair: perms.isTechChair,
      impersonating: null,
    });
  }),
);

export default router;
