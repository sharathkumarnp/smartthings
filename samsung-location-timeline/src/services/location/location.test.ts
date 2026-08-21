import { describe, expect, it } from "vitest";
import { effectiveMovementMeters, haversineMeters } from "./distance";
import { isDuplicate, isStale } from "./validation";
import { classifyMovement, detectStop } from "../stop/detection";
import { summarizeTrip } from "../trip/detection";
import type { LocationSample } from "@/types/location";

const at = (minutes: number) => new Date(Date.UTC(2026, 7, 19, 12, minutes));
const sample = (overrides: Partial<LocationSample> = {}): LocationSample => ({
  provider: "mock",
  deviceId: "phone",
  latitude: 12.9715987,
  longitude: 77.5945662,
  accuracy: 20,
  providerTimestamp: at(0),
  collectedAt: at(1),
  ...overrides
});

describe("location processing", () => {
  it("calculates Haversine distance without coordinate rounding", () =>
    expect(haversineMeters(sample(), { latitude: 12.9815987, longitude: 77.5945662 })).toBeCloseTo(
      1111.95,
      0
    ));
  it("does not treat a 60 m jump with ±100 m accuracy as movement", () => {
    const a = { latitude: 12.9715987, longitude: 77.5945662, accuracy: 100 };
    const b = { latitude: 12.972138, longitude: 77.5945662, accuracy: 100 };
    expect(effectiveMovementMeters(a, b)).toBe(0);
    expect(classifyMovement(a, b)).toBe("STOPPED");
  });
  it("deduplicates the same provider observation", () =>
    expect(isDuplicate(sample(), sample({ collectedAt: at(15) }))).toBe(true));
  it("keeps changed coordinates at the same provider time", () =>
    expect(isDuplicate(sample(), sample({ latitude: 12.98 }))).toBe(false));
  it("classifies provider timestamps past the threshold as stale", () => {
    expect(isStale(at(0), at(31), 30)).toBe(true);
    expect(isStale(at(0), at(20), 30)).toBe(false);
  });
  it("treats a missing provider timestamp as stale", () => expect(isStale(undefined, at(2), 30)).toBe(true));
});

describe("stop and trip detection", () => {
  it("detects a 30 minute accuracy-aware stop", () => {
    const points = [0, 10, 20, 30].map((m, i) => ({
      latitude: 12.9715987 + i * 0.00005,
      longitude: 77.5945662,
      accuracy: 20,
      timestamp: at(m)
    }));
    expect(detectStop(points, 100, 30)?.durationSeconds).toBe(1800);
  });
  it("rejects a cluster shorter than minimum duration", () =>
    expect(
      detectStop(
        [
          { latitude: 12.97, longitude: 77.59, timestamp: at(0) },
          { latitude: 12.97, longitude: 77.59, timestamp: at(20) }
        ],
        100,
        30
      )
    ).toBeNull());
  it("summarizes sampled trip distance", () => {
    const trip = summarizeTrip(
      [
        { latitude: 12.97, longitude: 77.59, timestamp: at(0) },
        { latitude: 12.98, longitude: 77.59, timestamp: at(15) }
      ],
      150
    );
    expect(trip?.distanceMeters).toBeGreaterThan(1000);
  });
  it("discards sub-threshold trips", () =>
    expect(
      summarizeTrip(
        [
          { latitude: 12.97, longitude: 77.59, accuracy: 100, timestamp: at(0) },
          { latitude: 12.9702, longitude: 77.59, accuracy: 100, timestamp: at(15) }
        ],
        150
      )
    ).toBeNull());
});
