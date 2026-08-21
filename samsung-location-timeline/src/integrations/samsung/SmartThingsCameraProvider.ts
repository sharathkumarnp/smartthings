import { config } from "@/lib/config";
import { SamsungAuthProvider } from "./SamsungAuthProvider";
import { SamsungProviderError } from "./errors";

const API = "https://api.smartthings.com/v1";

export class SmartThingsCameraProvider {
  constructor(private readonly auth = new SamsungAuthProvider()) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.providerTimeoutMs);
    try {
      const response = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: this.auth.getAuthorizationHeader(),
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers
        },
        cache: "no-store",
        signal: controller.signal
      });
      if (response.status === 401 || response.status === 403)
        throw new SamsungProviderError("AUTH_REQUIRED", "SmartThings camera authorization is unavailable.");
      if (!response.ok)
        throw new SamsungProviderError("PROVIDER_UNAVAILABLE", `SmartThings camera request returned HTTP ${response.status}.`, response.status >= 500);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async startStream(deviceId: string) {
    await this.request(`/devices/${encodeURIComponent(deviceId)}/commands`, {
      method: "POST",
      body: JSON.stringify({
        commands: [{ component: "main", capability: "videoStream", command: "startStream", arguments: [] }]
      })
    });
    for (let attempt = 0; attempt < 7; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 750));
      const status = await this.request<{
        components?: { main?: { videoStream?: { stream?: { value?: { InHomeURL?: unknown } } } } };
      }>(`/devices/${encodeURIComponent(deviceId)}/status`);
      const candidate = status.components?.main?.videoStream?.stream?.value?.InHomeURL;
      if (typeof candidate !== "string") continue;
      const streamUrl = new URL(candidate);
      if (streamUrl.protocol !== "rtsp:")
        throw new SamsungProviderError("MALFORMED_RESPONSE", "SmartThings returned an unsupported camera stream protocol.");
      // Samsung labels its port-443 camera endpoint as RTSP, while the endpoint
      // requires RTSP over TLS. Preserve the signed query exactly when correcting it.
      return streamUrl.port === "443" ? candidate.replace(/^rtsp:/i, "rtsps:") : candidate;
    }
    throw new SamsungProviderError("PROVIDER_UNAVAILABLE", "The camera did not publish an in-home stream in time.", true);
  }

  async stopStream(deviceId: string) {
    await this.request(`/devices/${encodeURIComponent(deviceId)}/commands`, {
      method: "POST",
      body: JSON.stringify({
        commands: [{ component: "main", capability: "videoStream", command: "stopStream", arguments: [] }]
      })
    });
  }
}
