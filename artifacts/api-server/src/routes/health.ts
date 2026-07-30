import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Primary health endpoint — used by diagnostics and load balancers.
// Also served at /healthz for backwards-compatibility.
function healthHandler(_req: import("express").Request, res: import("express").Response) {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}

router.get("/health", healthHandler);
router.get("/healthz", healthHandler);

export default router;
