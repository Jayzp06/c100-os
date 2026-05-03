import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import bootstrapRouter from "./bootstrap";
import profileRouter from "./profile";
import membersRouter from "./members";
import committeesRouter from "./committees";
import eventsRouter from "./events";
import nudgesRouter from "./nudges";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(bootstrapRouter);
router.use(profileRouter);
router.use(membersRouter);
router.use(committeesRouter);
router.use(eventsRouter);
router.use(nudgesRouter);
router.use(reportsRouter);

export default router;
