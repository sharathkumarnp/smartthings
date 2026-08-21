# TracePrivate — Samsung Location Timeline

A private, single-owner location timeline that periodically collects the **latest sampled location** available through an authorized provider, stores each new observation in PostgreSQL, and independently derives movement, stops, trips, places, replay, and analytics.

> Samsung provides sampled latest locations. This application creates history from the samples it successfully collects. Lines and animations between samples are estimates and must not be interpreted as continuous or exact GPS telemetry.

## Samsung feasibility status (Phase 1 gate)

The provider in `src/integrations/samsung` uses only Samsung's official SmartThings REST API: authorized device listing and the documented `geolocation` device capability. Samsung does **not** document a general consumer API for reading Galaxy phone coordinates from Samsung Find / Find My Mobile. A Galaxy may therefore be visible in Samsung Find but unavailable in the SmartThings REST API, or visible without `geolocation`.

Validate your own account/device before selecting the provider:

1. Establish owner-authorized SmartThings OAuth access (or an owner-issued supported token) with least-privilege device read scopes.
2. Set `SMARTTHINGS_ACCESS_TOKEN` and run `npm run poc:samsung`. This lists only the authorized devices and their capabilities.
3. Set `SAMSUNG_DEVICE_ID` to a device that exposes `geolocation`, then rerun. Success prints normalized JSON.
4. Test timestamp freshness, reliability, rate limits, and token refresh/expiry over time.

If the official API does not expose coordinates, the POC returns `LOCATION_UNSUPPORTED`. There is deliberately no Samsung web scraping, cookie extraction, credential capture, MFA/CAPTCHA bypass, or undocumented Find endpoint. Keep `LOCATION_PROVIDER=mock` until the POC succeeds reliably.

### Interactive Samsung Find viewer

The Docker deployment includes a dedicated Chromium sidecar and exposes its noVNC display only on `127.0.0.1:7900`. The authenticated `/samsung-find` page starts Chromium at Samsung's official Find website and embeds that local display. Enter Samsung credentials and MFA only inside that displayed browser. TracePrivate does not receive, store, log, proxy, or inspect those values or the resulting Samsung cookies. The profile persists in the local `samsung-browser-config` Docker volume, and the interactive WebDriver session remains active for up to 24 hours without activity.

This is an owner-operated viewer, not a location API. It lets the dashboard display the official Samsung Find experience without replaying credentials or bypassing authentication. The **Read location** action inspects the rendered, authenticated page inside Chromium and returns only validated coordinates plus any visible accuracy, timestamp, address, and device label. Raw HTML, credentials, cookies, storage, request headers, and tokens never leave that browser session. Extracted coordinates are displayed for confirmation but are not yet imported into PostgreSQL or timeline analytics.

## Architecture

```text
Official SmartThings geolocation or MockLocationProvider
                         │
                resilient collector worker
                         │ validate / deduplicate
                         ▼
                     PostgreSQL
             raw samples / stops / trips / places / audit
                         │
              authenticated Next.js server API
                         │
          live map / history / replay / analytics / export
```

Provider, collection, processing, persistence, API, and UI are separate. `LocationProvider` is the only contract consumed by collection. The scheduler is a standalone process so collection does not rely on a page visit or serverless timer.

## Local installation

Requirements: Node.js 22+, npm, and PostgreSQL 15+.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

In a second terminal run `npm run collector`. Open `http://localhost:3000`.

Generate secure secrets and a password hash:

```bash
openssl rand -base64 48
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'your-password'
```

Set distinct outputs as `AUTH_SECRET`, `COLLECTOR_INTERNAL_SECRET`, and `ADMIN_PASSWORD_HASH`. The development defaults are intentionally invalid for a real deployment.

## Docker

Copy and edit `.env.example` as `.env`; when using Compose, change the database host to `postgres`:

```env
DATABASE_URL=postgresql://timeline:timeline@postgres:5432/timeline?schema=public
```

Then run `docker compose up --build`. Compose starts PostgreSQL, applies migrations, seeds the owner/device, and starts web plus collector services at `http://localhost:3001`. The database persists in the `timeline-data` volume. Port 3001 is bound only to the local loopback interface.

## Configuration

- `LOCATION_PROVIDER`: `mock` or `samsung`.
- `TZ`: the owner's IANA timezone used for daily boundaries (for example `Asia/Kolkata`).
- `LOCATION_POLL_INTERVAL_MINUTES`: 5–60, default 15.
- `STALE_LOCATION_MINUTES`: age after which a provider observation is labeled stale.
- `STOP_RADIUS_METERS`, `STOP_MIN_DURATION_MINUTES`: accuracy-aware stop thresholds.
- `TRIP_MIN_DISTANCE_METERS`: discard tiny candidate trips.
- `PROVIDER_TIMEOUT_MS`, `PROVIDER_MAX_RETRIES`: bounded provider resilience.
- `SMARTTHINGS_ACCESS_TOKEN`, `SAMSUNG_DEVICE_ID`: server-only official SmartThings POC credentials.

Coordinates use PostgreSQL `DECIMAL(10,7)` and are never rounded during distance calculations. Place cache keys alone use four-decimal cells to cluster nearby stops. Reverse geocoding is intentionally left provider-neutral; only stops/current/user-selected points should be geocoded when a privacy-approved provider is configured.

## Collection and processing

Each poll validates range/shape, rejects duplicate provider timestamp + coordinate observations, stores the raw sample, calculates accuracy-adjusted Haversine movement, classifies stale/moving/stopped state, updates candidate trips, evaluates the recent stop window, clusters stops, and records a sanitized system event. Transient provider errors receive bounded exponential backoff with jitter. Authentication failures are non-retryable and surface as `SAMSUNG_AUTH_EXPIRED` / “Authentication required.”

GPS-sampled distance is not road distance. `estimatedRouteDistanceMeters` is separate and remains empty unless a future routes integration explicitly computes it. The map renders sampled points and a dashed inferred connection; replay interpolation is labeled estimated.

## Security model

- Single-owner email/password authentication; password is bcrypt-hashed and never stored in the database.
- Short-lived signed, `HttpOnly`, `SameSite=Strict`, production-secure session cookie.
- Every data API validates the signature server-side and scopes queries through the owner's user row.
- Mutations enforce same-origin checks. The collector endpoint requires a separate constant-time-compared bearer secret.
- Login throttling, restrictive security headers, no indexing, server-only provider/database credentials, structured secret-redacted logs.
- Deploy only behind HTTPS. Limit network access to PostgreSQL. Store production secrets in the platform's encrypted secret manager and rotate them.

The in-memory login limiter is suitable for the default single instance. For multiple replicas, replace it with a shared Redis/database limiter. Live and history map panels use Google Maps embeds. Opening those panels sends the displayed coordinates and normal browser request metadata to Google, as explicitly selected for this local project.

## Routes and APIs

UI: `/`, `/live`, `/history`, `/analytics`, `/places`, `/debug/locations`.

Authenticated APIs: `/api/devices`, `/api/location/current`, `/api/location/history`, `/api/location/raw`, `/api/location/export`, `/api/stops`, `/api/trips`, `/api/analytics`, `/api/places`, `/api/health`. `POST /api/internal/collect-location` is service-authenticated and not a browser endpoint.

Exports support CSV, JSON, and GeoJSON. GeoJSON contains recorded points, not an invented continuous line.

## Tests and production checks

```bash
npm run typecheck
npm test
npm run build
```

Tests cover precision distance, GPS uncertainty/jitter, deduplication, stale and missing provider timestamps, stop duration/radius, trip thresholds, and signed-session rejection. Before production also perform authenticated browser testing, database backup/restore testing, provider expiry drills, TLS verification, dependency scanning, and retention-policy review.

## Known limitations and troubleshooting

- **`LOCATION_UNSUPPORTED`**: the authorized device lacks official SmartThings `geolocation`; do not switch to private scraping.
- **`AUTH_REQUIRED`**: renew owner authorization through a supported OAuth/token flow. Tokens are never shown in the dashboard.
- **No data**: run migrations/seed and ensure the collector process is running.
- **Repeated points**: expected when Samsung has not refreshed its provider timestamp; duplicates are audited but not stored as movement.
- **Sparse or stale paths**: Samsung determines when it refreshes. The app cannot create missing evidence.
- **Map unavailable**: tile-network failure does not stop collection or exports.
- **Road distance/geocoding**: schemas and UI terminology support them, but no third-party provider is enabled by default to avoid unnecessary location disclosure and cost.

This system is exclusively for the account owner's devices. It must never be used to obtain another person's account, credentials, session, or location.
