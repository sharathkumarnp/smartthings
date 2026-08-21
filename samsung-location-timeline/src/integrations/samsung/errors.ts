export type SamsungErrorCode =
  | "AUTH_REQUIRED"
  | "DEVICE_NOT_FOUND"
  | "LOCATION_UNSUPPORTED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "PROVIDER_UNAVAILABLE";

export class SamsungProviderError extends Error {
  constructor(
    public readonly code: SamsungErrorCode,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "SamsungProviderError";
  }
}
