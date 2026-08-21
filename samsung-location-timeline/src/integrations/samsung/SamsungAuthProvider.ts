import { config } from "@/lib/config";
import { SamsungProviderError } from "./errors";

export class SamsungAuthProvider {
  getAuthorizationHeader(): string {
    if (!config.smartThingsAccessToken) {
      throw new SamsungProviderError(
        "AUTH_REQUIRED",
        "SMARTTHINGS_ACCESS_TOKEN is not configured. Complete an owner-authorized SmartThings OAuth flow or use an owner-created token."
      );
    }
    return `Bearer ${config.smartThingsAccessToken}`;
  }
}
