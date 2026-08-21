import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import { collectLocation } from "@/services/location/collector";

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    logger.info(await collectLocation(), "Collection completed");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "unknown" },
      "Collection failed without terminating worker"
    );
  } finally {
    running = false;
  }
}

logger.info(
  { intervalMinutes: config.pollIntervalMinutes, provider: config.locationProvider },
  "Location collector started"
);
void tick();
setInterval(() => void tick(), config.pollIntervalMinutes * 60_000);
