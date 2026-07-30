import app from "./app";
import { logger } from "./lib/logger";
import { ensureEventTypeConfigSeeded } from "./lib/c100";
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

// Run startup seeds (all idempotent — safe to re-execute on every server boot).
// RBAC seed runs first so permission groups are present before any request is served.
Promise.all([
  seedRbac().catch((err) => logger.error({ err }, "Failed to seed RBAC")),
  ensureEventTypeConfigSeeded().catch((err) =>
    logger.error({ err }, "Failed to seed event_type_config"),
  ),
]).finally(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
