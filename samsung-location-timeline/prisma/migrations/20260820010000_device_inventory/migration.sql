ALTER TABLE "Device"
ADD COLUMN "capabilities" JSONB,
ADD COLUMN "locationSupported" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
