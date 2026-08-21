<div align="center">

# Trace — Private Samsung Location Intelligence

**A local-first command center for Samsung devices, location snapshots, cameras, history, places, and movement insights.**

![Next.js](https://img.shields.io/badge/Next.js-16-111111?style=flat-square&logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169e1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?style=flat-square&logo=docker&logoColor=white)
![Private](https://img.shields.io/badge/Network-localhost-137333?style=flat-square)

[Quick start](#quick-start-with-docker) · [Samsung setup](#connect-samsung-find) · [Workflow](#complete-data-workflow) · [Troubleshooting](#troubleshooting)

</div>

---

## What Trace does

Trace combines two owner-authorized Samsung data paths in one private web application:

| Integration              | What it provides                                                                               | How it is authorized                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **SmartThings REST API** | Authorized device inventory, capabilities, supported `geolocation`, and camera stream commands | Server-side SmartThings access token                               |
| **Samsung Find website** | Device names, visible status, and the address currently rendered by Samsung Find               | Manual Samsung sign-in inside a dedicated local Chromium container |
| **Local collector**      | Periodic location samples, movement classification, stops, trips, and places                   | Internal service secret                                            |

The application then provides:

- A responsive device command center with search, provider filters, and inclusion controls.
- Overview and Live views with a Google Maps address/location visualization.
- Owner-triggered refresh across SmartThings and Samsung Find.
- Samsung Find address snapshots stored in PostgreSQL.
- Daily history, replay, analytics, frequent places, and raw-data export.
- Private SmartThings camera previews through an internal go2rtc gateway.
- CSV, JSON, and GeoJSON exports for recorded location points.

> [!IMPORTANT]
> Samsung Find normally exposes a rendered address, not a supported public GPS API. A map created from that address is approximate. SmartThings coordinates are available only when the authorized device exposes the official `geolocation` capability.

## Privacy and ownership boundary

This project is designed only for devices owned by the authenticated Samsung account holder.

- Samsung credentials, MFA codes, cookies, and browser storage are **not** written to `.env` or PostgreSQL.
- Samsung sign-in occurs directly inside Samsung's page in the dedicated browser container.
- Only normalized device name, status, visible address, and extraction timestamp leave that browser session.
- The SmartThings access token remains server-side and is never returned to the frontend.
- Web and Samsung browser ports bind to `127.0.0.1` by default.
- Google Maps receives the address or coordinates displayed in a map panel.
- Trace does not bypass Samsung authentication, MFA, CAPTCHA, or device confirmation.

## Architecture

```mermaid
flowchart LR
    ST["SmartThings REST API"] --> WEB["Next.js web and API"]
    SF["Samsung Find in private Chromium"] -->|"normalized visible snapshot"| WEB
    WEB --> DB[("PostgreSQL")]
    COL["Collector worker"] -->|"validated samples"| DB
    ST -->|"camera stream command"| CAM["go2rtc gateway"]
    CAM --> WEB
    DB --> UI["Overview · Live · History · Analytics · Places"]
    WEB --> UI
```

### Docker services

| Service           | Purpose                                                          | Host exposure                |
| ----------------- | ---------------------------------------------------------------- | ---------------------------- |
| `web`             | Next.js application and authenticated API                        | `http://127.0.0.1:3001`      |
| `postgres`        | Persistent application database                                  | Internal Docker network only |
| `migrate`         | Applies Prisma migrations and seeds the owner account            | One-shot startup task        |
| `collector`       | Periodically collects configured provider samples                | Internal Docker network only |
| `samsung-browser` | Owner-operated Chromium/Selenium session for Samsung Find        | `http://127.0.0.1:7900`      |
| `camera-gateway`  | Converts private SmartThings camera streams for browser playback | Internal Docker network only |

Persistent Docker volumes:

- `timeline-data` — PostgreSQL data.
- `samsung-browser-config` — the local Samsung browser profile/session.

## Requirements

### Recommended Docker setup

- Docker Desktop or Docker Engine with Compose v2.
- A Samsung account containing the devices you own.
- A SmartThings access token if SmartThings devices or cameras are required.
- Ports `3001` and `7900` available on localhost.

### Native development setup

- Node.js 22 or newer.
- npm.
- PostgreSQL 15 or newer.

## Quick start with Docker

Run these commands from the repository root:

```bash
cd samsung-location-timeline
cp .env.example .env
```

### 1. Generate local secrets

Generate two independent secrets:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Use one value for `AUTH_SECRET` and the other for `COLLECTOR_INTERNAL_SECRET`.

Generate the password hash used for the Trace login:

```bash
docker compose build migrate
docker compose run --rm --no-deps migrate node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'choose-a-strong-password'
```

If project dependencies are already installed locally, the shorter equivalent is:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'choose-a-strong-password'
```

### 2. Configure `.env`

At minimum, update these values:

```env
DATABASE_URL=postgresql://timeline:timeline@postgres:5432/timeline?schema=public
APP_URL=http://localhost:3001
TZ=Asia/Kolkata

AUTH_SECRET=paste-the-first-generated-secret
COLLECTOR_INTERNAL_SECRET=paste-the-second-generated-secret
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD_HASH=paste-the-generated-bcrypt-hash

# Use mock until official SmartThings geolocation is confirmed.
LOCATION_PROVIDER=mock

# Optional, but required for SmartThings inventory and cameras.
SMARTTHINGS_ACCESS_TOKEN=
SAMSUNG_DEVICE_ID=
```

Never add the Samsung account password or MFA code to this file.

### 3. Build and start everything

```bash
docker compose up -d --build
```

Compose automatically:

1. Starts PostgreSQL.
2. Waits for database health.
3. Applies Prisma migrations.
4. Seeds the configured owner account and initial device.
5. Starts the Samsung browser and camera gateway.
6. Starts the web application and collector.

Check service state:

```bash
docker compose ps
```

Open [http://localhost:3001](http://localhost:3001) and sign in with:

- **Email:** `ADMIN_EMAIL` from `.env`.
- **Password:** the plain password used to generate `ADMIN_PASSWORD_HASH`.

## Connect SmartThings

1. Create an owner-authorized SmartThings token with the minimum device-read permissions needed by this project.
2. Set `SMARTTHINGS_ACCESS_TOKEN` in `.env`.
3. Rebuild the services so the server receives the new value:

   ```bash
   docker compose up -d --build web collector
   ```

4. Open **Devices** and select **Update all devices**.

The update performs both operations:

- Synchronizes the SmartThings inventory and capabilities.
- Refreshes and reads the authenticated Samsung Find device list.

The result banner distinguishes full success, partial provider success, and failure. Tokens with expired or insufficient authorization return a clear SmartThings error without exposing the token.

### Verify official geolocation support

SmartThings device visibility does not guarantee phone-location access. Run the provider proof of concept:

```bash
docker compose run --rm --no-deps collector npm run poc:samsung
```

To test one device, set `SAMSUNG_DEVICE_ID` to a device that reports the official `geolocation` capability and run the command again. In a native installation, use `npm run poc:samsung` directly.

## Connect Samsung Find

Samsung credentials are entered interactively and are never configured as application environment variables.

1. Sign in to Trace.
2. Open **Samsung Find** in the sidebar.
3. Select **Connect Samsung Find**.
4. Complete Samsung sign-in, MFA, CAPTCHA, or device confirmation directly inside the displayed Samsung browser.
5. Ensure the Samsung Find page shows the owned devices.
6. Select **Read location**.
7. Return to **Devices** and select **Update all devices**, or use **Update overview** / **Refresh all Samsung devices**.

The manual refresh workflow reloads the Samsung Find page, waits for its device list to render, extracts normalized visible data, and stores one snapshot per device.

For a larger Samsung browser view, open [http://localhost:7900/?autoconnect=1&resize=scale](http://localhost:7900/?autoconnect=1&resize=scale).

> [!NOTE]
> The Samsung browser profile persists in the `samsung-browser-config` Docker volume. Samsung can still expire the session or request authentication again.

## Camera previews

Camera previews appear only for SmartThings devices that expose `videoStream`.

1. Open **Devices**.
2. Choose **Cameras** in the filter bar.
3. Select **View live preview** on a camera card.
4. Trace asks SmartThings to start the stream and passes the private stream through `camera-gateway`.
5. Leaving or replacing a preview sends a best-effort stop-stream request.

Signed stream addresses stay inside the private Docker network. Availability still depends on the camera being online, SmartThings authorization, and the device publishing an in-home stream.

## Complete data workflow

```mermaid
sequenceDiagram
    participant O as Owner
    participant UI as Trace UI
    participant API as Next.js API
    participant ST as SmartThings
    participant SF as Samsung Find browser
    participant DB as PostgreSQL

    O->>UI: Select Update all devices
    UI->>API: Start manual provider refresh
    par SmartThings sync
        API->>ST: Read devices and capabilities
        ST-->>API: Authorized inventory
    and Samsung Find sync
        API->>SF: Reload authenticated page
        SF-->>API: Render device state
        API->>SF: Read normalized visible fields
    end
    API->>DB: Upsert devices and store Find snapshots
    DB-->>UI: Fresh overview, history, places, and analytics
```

### Periodic collector workflow

For a provider device that exposes coordinates, every configured interval the collector:

1. Requests the latest provider observation.
2. Validates latitude, longitude, timestamps, and accuracy.
3. Rejects duplicate provider timestamp/coordinate observations.
4. Stores the raw sample with seven-decimal coordinate precision.
5. Calculates accuracy-adjusted Haversine movement.
6. Classifies the point as moving, stopped, stale, offline, or unknown.
7. Updates candidate trips, stop windows, and recurring place clusters.
8. Writes a sanitized system event.

Sampled distance is not road distance, and replay interpolation is a visual estimate between observations.

## Application guide

| Route              | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `/`                | Map-led Samsung Find overview and device switcher              |
| `/live`            | Current selected-device view and manual live refresh           |
| `/devices`         | Search, filter, update, enable/disable, and preview devices    |
| `/samsung-find`    | Owner-operated Samsung browser and location extraction         |
| `/history`         | Date-based snapshots, recorded points, stops, and replay       |
| `/analytics`       | Device coverage, snapshot totals, movement, and time summaries |
| `/places`          | Samsung addresses and detected recurring places                |
| `/debug/locations` | Raw evidence table and data exports                            |

All displayed times are formatted in `Asia/Kolkata` when the application is configured with `TZ=Asia/Kolkata`.

## Update-button behavior

| Button                          | Provider action                                             | Database/UI result                                      |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| **Update all devices**          | SmartThings inventory sync and fresh Samsung Find page read | Updates all device cards and shows full/partial success |
| **Update overview**             | Fresh Samsung Find page read                                | Stores snapshots and reloads Overview data              |
| **Refresh all Samsung devices** | Fresh Samsung Find page read                                | Refreshes Live and all device selectors                 |
| **Read location**               | Fresh Samsung Find page read                                | Shows extraction result in the Samsung Find workspace   |
| **Sync controls / toggles**     | Local authenticated mutation                                | Updates whether a device participates in Trace          |

Update buttons are disabled while active and display an explicit success or error result. Automatic background reads do not force a full Samsung page reload.

## Configuration reference

| Variable                         | Required                | Description                                                                  |
| -------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`                   | Yes                     | PostgreSQL connection string; use host `postgres` with Compose               |
| `APP_URL`                        | Yes                     | Public application origin used for secure-session behavior                   |
| `TZ`                             | Yes                     | Owner timezone and daily-boundary timezone                                   |
| `AUTH_SECRET`                    | Yes                     | Independent 32+ character session-signing secret                             |
| `ADMIN_EMAIL`                    | Yes                     | Seeded single-owner login email                                              |
| `ADMIN_PASSWORD_HASH`            | Yes                     | bcrypt hash of the Trace login password                                      |
| `COLLECTOR_INTERNAL_SECRET`      | Yes                     | Independent collector-to-web secret                                          |
| `LOCATION_PROVIDER`              | Yes                     | `mock` or `samsung`                                                          |
| `LOCATION_POLL_INTERVAL_MINUTES` | No                      | Collector interval, allowed range 5–60 minutes                               |
| `STALE_LOCATION_MINUTES`         | No                      | Provider-age threshold for stale status                                      |
| `STOP_RADIUS_METERS`             | No                      | Accuracy-aware stop clustering radius                                        |
| `STOP_MIN_DURATION_MINUTES`      | No                      | Minimum duration for a detected stop                                         |
| `TRIP_MIN_DISTANCE_METERS`       | No                      | Minimum distance retained as a trip                                          |
| `PROVIDER_TIMEOUT_MS`            | No                      | Provider request timeout                                                     |
| `PROVIDER_MAX_RETRIES`           | No                      | Bounded transient-provider retries, maximum 5                                |
| `SMARTTHINGS_ACCESS_TOKEN`       | SmartThings only        | Server-only owner authorization token                                        |
| `SAMSUNG_DEVICE_ID`              | Geolocation only        | SmartThings device selected by the collector/POC                             |
| `SAMSUNG_FIND_WEBDRIVER_URL`     | Docker default provided | Internal Selenium endpoint                                                   |
| `GOOGLE_MAPS_API_KEY`            | No                      | Reserved for future keyed Maps integration; current embeds do not require it |
| `LOG_LEVEL`                      | No                      | Structured server logging level; defaults to `info`                          |

## Native development

From `samsung-location-timeline`:

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

For native development, use a locally reachable database and app origin:

```env
DATABASE_URL=postgresql://timeline:timeline@localhost:5432/timeline?schema=public
APP_URL=http://localhost:3000
```

In a second terminal:

```bash
npm run collector
```

The native application is available at [http://localhost:3000](http://localhost:3000). The Samsung Find browser and camera gateway are easiest to run through Docker.

## Validation commands

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

The current tests cover authentication behavior, location precision, jitter/accuracy handling, deduplication, stale timestamps, stop detection, and trip thresholds. A successful build is not a substitute for an authenticated provider and camera smoke test.

## Docker operations

### View logs

```bash
docker compose logs -f web
docker compose logs -f collector
docker compose logs -f samsung-browser
```

### Rebuild after source or `.env` changes

```bash
docker compose up -d --build
```

### Stop without deleting data

```bash
docker compose down
```

### Database backup

```bash
docker compose exec -T postgres pg_dump -U timeline -d timeline > timeline-backup.sql
```

> [!CAUTION]
> `docker compose down -v` deletes the PostgreSQL and Samsung browser-profile volumes. It removes collected history and the persisted Samsung session. Use it only when a full local reset is intended and a backup is no longer required.

## Troubleshooting

| Symptom                          | Likely cause                                                                | Resolution                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Cannot sign in to Trace          | Email/password does not match the seeded `.env` values                      | Regenerate `ADMIN_PASSWORD_HASH`, then rerun `docker compose up -d --build`     |
| `AUTH_REQUIRED`                  | Samsung Find session expired or was never connected                         | Open `/samsung-find` and complete Samsung authentication again                  |
| SmartThings authorization error  | Token expired or lacks device permission                                    | Replace `SMARTTHINGS_ACCESS_TOKEN` and rebuild `web`/`collector`                |
| `LOCATION_UNSUPPORTED`           | Device lacks official SmartThings `geolocation`                             | Continue using Samsung Find address snapshots or choose a supported device      |
| Update reports partial success   | One provider succeeded while the other failed                               | Read the result banner; reconnect Samsung Find or correct the SmartThings token |
| No Samsung devices after refresh | Find page has not loaded its device list or requires confirmation           | Open `/samsung-find`, confirm devices are visible, then run the update again    |
| Location appears approximate     | Samsung Find supplied an address rather than coordinates                    | Treat the map as address-level visualization, not exact GPS evidence            |
| Camera preview unavailable       | Camera offline, missing `videoStream`, token issue, or stream not published | Update inventory, confirm the capability, and retry while the camera is online  |
| History is sparse                | Provider returned only occasional samples                                   | Keep the collector running; Trace does not invent missing observations          |
| Port already in use              | Another process owns `3001` or `7900`                                       | Stop that process or change the Compose port binding                            |
| Database has no data             | Migration/seed did not finish or collector is stopped                       | Inspect `docker compose ps` and the `migrate`/`collector` logs                  |

## Security checklist

- [ ] Replace all development secrets.
- [ ] Keep `.env` out of Git.
- [ ] Use a least-privilege SmartThings token and rotate it periodically.
- [ ] Keep ports loopback-only unless an authenticated reverse proxy is intentionally configured.
- [ ] Use HTTPS and secure secret storage before any non-local deployment.
- [ ] Back up PostgreSQL before upgrades or destructive Docker operations.
- [ ] Review data retention because location history is sensitive personal data.
- [ ] Never use the system for another person's account or devices without explicit authorization.

## Known limitations

- Samsung does not provide this project with a documented general-purpose Samsung Find location API.
- Samsung Find extraction depends on the authenticated website's rendered structure and can require maintenance if Samsung changes that UI.
- An address snapshot can differ materially from the device's precise physical position.
- SmartThings phone location is available only when `geolocation` is exposed to the authorized token.
- Provider snapshots are periodic evidence, not continuous GPS telemetry.
- Camera streaming is best-effort and device/network dependent.
- Map availability depends on Google Maps network access.

---

<div align="center">

**Local-first. Owner-authorized. Evidence-aware.**

Trace is an internal private-device project. It must not be used to capture another person's credentials, session, devices, or location.

</div>
