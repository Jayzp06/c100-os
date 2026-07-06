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
import orgRouter from "./org";
import techRouter from "./tech";
import eventTypeConfigRouter from "./event-type-config";
import systemRouter from "./system";

const router: IRouter = Router();

router.use(healthRouter);
router.use(systemRouter);
router.use(authRouter);
router.use(bootstrapRouter);
router.use(orgRouter);
router.use(techRouter);
router.use(eventTypeConfigRouter);
router.use(profileRouter);
router.use(membersRouter);
router.use(committeesRouter);
router.use(eventsRouter);
router.use(nudgesRouter);
router.use(reportsRouter);

export default router;
