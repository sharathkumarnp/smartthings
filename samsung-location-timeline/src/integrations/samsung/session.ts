// Samsung/SmartThings secrets are intentionally read only from the server environment.
// This module is a future seam for encrypted OAuth refresh-token storage.
export interface SamsungSessionState {
  status: "CONNECTED" | "AUTH_REQUIRED" | "UNAVAILABLE";
  expiresAt?: Date;
}
