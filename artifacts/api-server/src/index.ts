import app from "./app";
import { logger } from "./lib/logger";
import { ensureEventTypeConfigSeeded } from "./lib/c100";
import { repairProductionData } from "./lib/production-repair";
import { seedRbac } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run startup seeds and one-time idempotent data repairs before serving traffic.
// Order: data repair first, then RBAC seed (so committee state is correct when
// permission groups are seeded), then event-type config.
repairProductionData()
  .catch((err) => logger.error({ err }, "Failed to run production data repair"))
  .then(() =>
    Promise.all([
      seedRbac().catch((err) => logger.error({ err }, "Failed to seed RBAC")),
      ensureEventTypeConfigSeeded().catch((err) =>
        logger.error({ err }, "Failed to seed event_type_config"),
      ),
    ]),
  )
  .catch((err) => logger.error({ err }, "Failed during startup seeds"))
  .finally(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  });
