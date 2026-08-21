import type { LocationProvider } from "@/types/location";
import { config } from "@/lib/config";
import { MockLocationProvider } from "./mock/MockLocationProvider";
import { SamsungLocationProvider } from "./samsung/SamsungLocationProvider";

export function createLocationProvider(): LocationProvider {
  return config.locationProvider === "samsung" ? new SamsungLocationProvider() : new MockLocationProvider();
}
