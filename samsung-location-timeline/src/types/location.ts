export type ProviderName = "samsung" | "mock";

export interface TrackedDevice {
  provider: ProviderName;
  providerDeviceId: string;
  name: string;
  model?: string;
  capabilities?: string[];
}

export interface LocationSample {
  provider: ProviderName;
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  providerTimestamp?: Date;
  collectedAt: Date;
  rawStatus?: string;
}

export interface LocationProvider {
  getDevices(): Promise<TrackedDevice[]>;
  getCurrentLocation(deviceId: string): Promise<LocationSample>;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: Date;
}
