import pino from "pino";
import { config } from "./config";

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: [
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "cookie",
      "headers.authorization",
      "headers.cookie"
    ],
    censor: "[REDACTED]"
  }
});
