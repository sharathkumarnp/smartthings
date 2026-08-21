import { config } from "@/lib/config";
import type { LocationProvider, LocationSample, TrackedDevice } from "@/types/location";
import { SamsungAuthProvider } from "./SamsungAuthProvider";
import { SamsungProviderError } from "./errors";
import type { SmartThingsDevice, SmartThingsGeolocation } from "./types";

const API = "https://api.smartthings.com/v1";

export class SamsungLocationProvider implements LocationProvider {
  constructor(private readonly auth = new SamsungAuthProvider()) {}

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.providerTimeoutMs);
    try {
      const response = await fetch(`${API}${path}`, {
        headers: { Accept: "application/json", Authorization: this.auth.getAuthorizationHeader() },
        signal: controller.signal,
        cache: "no-store"
      });
      if (response.status === 401 || response.status === 403)
        throw new SamsungProviderError(
          "AUTH_REQUIRED",
          "SmartThings authorization expired or lacks permission."
        );
      if (response.status === 404)
        throw new SamsungProviderError("DEVICE_NOT_FOUND", "The selected SmartThings device was not found.");
      if (response.status === 429)
        throw new SamsungProviderError("RATE_LIMITED", "SmartThings rate limit reached.", true);
      if (!response.ok)
        throw new SamsungProviderError(
          "PROVIDER_UNAVAILABLE",
          `SmartThings returned HTTP ${response.status}.`,
          response.status >= 500
        );
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SamsungProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new SamsungProviderError("TIMEOUT", "SmartThings request timed out.", true);
      throw new SamsungProviderError("PROVIDER_UNAVAILABLE", "Could not reach SmartThings.", true);
    } finally {
      clearTimeout(timer);
    }
  }

  async getDevices(): Promise<TrackedDevice[]> {
    const result = await this.request<{ items: SmartThingsDevice[] }>("/devices");
    return result.items.map((device) => ({
      provider: "samsung",
      providerDeviceId: device.deviceId,
      name: device.label || device.name,
      model: device.deviceModel || device.manufacturerName,
      capabilities:
        device.components?.flatMap(
          (component) => component.capabilities?.map((capability) => capability.id) || []
        ) || []
    }));
  }

  async getCurrentLocation(deviceId: string): Promise<LocationSample> {
    const devices = await this.getDevices();
    const device = devices.find((candidate) => candidate.providerDeviceId === deviceId);
    if (!device)
      throw new SamsungProviderError(
        "DEVICE_NOT_FOUND",
        "The configured device is not available to this SmartThings authorization."
      );
    if (!device.capabilities?.includes("geolocation")) {
      throw new SamsungProviderError(
        "LOCATION_UNSUPPORTED",
        "This device is visible in SmartThings but does not expose the official geolocation capability. Samsung Find coordinates cannot be retrieved through the supported API for this account/device."
      );
    }
    const status = await this.request<SmartThingsGeolocation>(
      `/devices/${encodeURIComponent(deviceId)}/components/main/capabilities/geolocation/status`
    );
    const latitude = status.latitude?.value;
    const longitude = status.longitude?.value;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      throw new SamsungProviderError(
        "MALFORMED_RESPONSE",
        "SmartThings geolocation response did not contain valid coordinates."
      );
    const timestamp =
      status.lastUpdateTime?.value || status.latitude?.timestamp || status.longitude?.timestamp;
    return {
      provider: "samsung",
      deviceId,
      latitude: latitude!,
      longitude: longitude!,
      accuracy: status.accuracy?.value,
      providerTimestamp: timestamp ? new Date(timestamp) : undefined,
      collectedAt: new Date(),
      rawStatus: "official-smartthings-geolocation"
    };
  }
}
