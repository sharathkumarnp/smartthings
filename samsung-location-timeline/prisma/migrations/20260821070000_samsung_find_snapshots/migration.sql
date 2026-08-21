CREATE TABLE "SamsungFindSnapshot" (
  "id" TEXT PRIMARY KEY,
  "deviceId" TEXT NOT NULL REFERENCES "Device"("id") ON DELETE CASCADE,
  "address" TEXT,
  "providerStatus" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SamsungFindSnapshot_deviceId_capturedAt_idx"
ON "SamsungFindSnapshot"("deviceId", "capturedAt");

CREATE INDEX "SamsungFindSnapshot_capturedAt_idx"
ON "SamsungFindSnapshot"("capturedAt");

INSERT INTO "SamsungFindSnapshot" ("id", "deviceId", "address", "providerStatus", "capturedAt")
SELECT
  'backfill-' || "id",
  "id",
  "lastAddress",
  COALESCE("providerStatus", 'Unknown'),
  COALESCE("lastSyncedAt", CURRENT_TIMESTAMP)
FROM "Device"
WHERE "providerDeviceId" LIKE 'find-web:%';
