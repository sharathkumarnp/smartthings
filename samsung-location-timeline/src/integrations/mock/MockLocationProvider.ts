import type { LocationProvider, LocationSample, TrackedDevice } from "@/types/location";

const route = [
  [12.9715987, 77.5945662],
  [12.974942, 77.59931],
  [12.97931, 77.60421],
  [12.98314, 77.61011],
  [12.98772, 77.61525],
  [12.98776, 77.6153],
  [12.9821, 77.6085],
  [12.9762, 77.6018],
  [12.97162, 77.59459]
] as const;

export class MockLocationProvider implements LocationProvider {
  async getDevices(): Promise<TrackedDevice[]> {
    return [
      {
        provider: "mock",
        providerDeviceId: "mock-galaxy-s24",
        name: "My Galaxy (Demo)",
        model: "Galaxy S24",
        capabilities: ["geolocation"]
      }
    ];
  }
  async getCurrentLocation(deviceId: string): Promise<LocationSample> {
    const interval = 15 * 60_000;
    const index = Math.floor(Date.now() / interval) % route.length;
    const [latitude, longitude] = route[index];
    const providerTimestamp = new Date(Math.floor(Date.now() / interval) * interval);
    return {
      provider: "mock",
      deviceId,
      latitude,
      longitude,
      accuracy: 18 + (index % 4) * 4,
      providerTimestamp,
      collectedAt: new Date(),
      rawStatus: index === 4 || index === 5 ? "stationary" : "moving"
    };
  }
}
