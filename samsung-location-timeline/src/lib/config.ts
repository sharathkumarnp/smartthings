import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://timeline:timeline@localhost:5432/timeline?schema=public"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32).default("development-only-secret-change-me-now"),
  ADMIN_EMAIL: z.string().email().default("owner@example.com"),
  ADMIN_PASSWORD_HASH: z.string().default(""),
  LOCATION_PROVIDER: z.enum(["mock", "samsung"]).default("mock"),
  LOCATION_POLL_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
  COLLECTOR_INTERNAL_SECRET: z.string().min(16).default("development-collector-secret"),
  STALE_LOCATION_MINUTES: z.coerce.number().int().positive().default(30),
  STOP_RADIUS_METERS: z.coerce.number().positive().default(100),
  STOP_MIN_DURATION_MINUTES: z.coerce.number().positive().default(30),
  TRIP_MIN_DISTANCE_METERS: z.coerce.number().nonnegative().default(150),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  PROVIDER_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(3),
  SMARTTHINGS_ACCESS_TOKEN: z.string().optional(),
  SAMSUNG_DEVICE_ID: z.string().optional(),
  LOG_LEVEL: z.string().default("info")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid configuration: ${parsed.error.message}`);
const e = parsed.data;

export const config = {
  nodeEnv: e.NODE_ENV,
  databaseUrl: e.DATABASE_URL,
  appUrl: e.APP_URL,
  secureCookies: new URL(e.APP_URL).protocol === "https:",
  authSecret: e.AUTH_SECRET,
  adminEmail: e.ADMIN_EMAIL.toLowerCase(),
  adminPasswordHash: e.ADMIN_PASSWORD_HASH,
  locationProvider: e.LOCATION_PROVIDER,
  pollIntervalMinutes: e.LOCATION_POLL_INTERVAL_MINUTES,
  collectorSecret: e.COLLECTOR_INTERNAL_SECRET,
  staleMinutes: e.STALE_LOCATION_MINUTES,
  stopRadiusMeters: e.STOP_RADIUS_METERS,
  stopMinDurationMinutes: e.STOP_MIN_DURATION_MINUTES,
  tripMinDistanceMeters: e.TRIP_MIN_DISTANCE_METERS,
  providerTimeoutMs: e.PROVIDER_TIMEOUT_MS,
  providerMaxRetries: e.PROVIDER_MAX_RETRIES,
  smartThingsAccessToken: e.SMARTTHINGS_ACCESS_TOKEN,
  samsungDeviceId: e.SAMSUNG_DEVICE_ID,
  logLevel: e.LOG_LEVEL
} as const;
