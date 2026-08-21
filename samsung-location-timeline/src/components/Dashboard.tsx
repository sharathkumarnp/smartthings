"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, Clock3, Crosshair, LoaderCircle, MapPin, RefreshCw, Route, ShieldCheck, SignalHigh, Smartphone } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./DataState";
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), { ssr: false });

type Current = {
  devices: Array<{
    id: string;
    deviceName: string;
    model?: string;
    lastAddress?: string;
    providerStatus?: string;
    lastSyncedAt?: string;
    lastSeenAt?: string;
    locationSupported: boolean;
  }>;
  point: null | {
    latitude: number;
    longitude: number;
    accuracy?: number;
    collectedAt: string;
    providerTimestamp?: string;
    providerAgeMinutes: number | null;
    isStale: boolean;
    state: string;
    device: { deviceName: string; model?: string; movementState: string };
  };
};
type Analytics = {
  distanceMeters: number;
  tripCount: number;
  placesVisited: number;
  movingSeconds: number;
  stationarySeconds: number;
  approximate: boolean;
  samsung?: {
    snapshotCount: number;
    deviceCount: number;
    locatedDeviceCount: number;
    unavailableDeviceCount: number;
    uniqueAddressCount: number;
    latestSync: string | null;
  };
};
type Health = {
  status: string;
  lastCollection: string | null;
  nextCollection: string | null;
  provider: string;
};
type History = {
  points: Array<{ latitude: number; longitude: number; collectedAt: string; state: string }>;
  stops: Array<{ latitude: number; longitude: number; radiusMeters: number; placeName?: string }>;
};

export function Dashboard({ liveOnly = false }: { liveOnly?: boolean }) {
  const [data, setData] = useState<{
    current: Current;
    analytics: Analytics;
    health: Health;
    history: History;
  }>();
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshingSamsung, setRefreshingSamsung] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  async function load() {
    try {
      const [current, analytics, health, history] = await Promise.all(
        ["/api/location/current", "/api/analytics?period=today", "/api/health", "/api/location/history"].map(
          async (url) => {
            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) throw new Error("Private API unavailable");
            return response.json();
          }
        )
      );
      setData({ current, analytics, health, history });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error");
    }
  }
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const syncSamsung = async () => {
      const response = await fetch("/api/samsung-find/location", { method: "POST" }).catch(() => null);
      if (response?.ok) await load();
    };
    const samsungInitial = setTimeout(() => void syncSamsung(), 1_500);
    const timer = setInterval(() => void syncSamsung(), 60_000);
    return () => {
      clearTimeout(initial);
      clearTimeout(samsungInitial);
      clearInterval(timer);
    };
  }, []);
  async function refreshSamsungLocation() {
    setRefreshingSamsung(true);
    setRefreshError("");
    setRefreshMessage("");
    try {
      const response = await fetch("/api/samsung-find/location?refresh=1", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Samsung Find refresh failed");
      if (!body.syncedDevices) throw new Error("Samsung Find did not expose any device locations");
      await load();
      setRefreshMessage(`${body.syncedDevices} Samsung devices updated from a fresh Find page read.`);
    } catch (reason) {
      setRefreshError(reason instanceof Error ? reason.message : "Samsung Find refresh failed");
    } finally {
      setRefreshingSamsung(false);
    }
  }
  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const findDevices = data.current.devices || [];
  if (!liveOnly && findDevices.length) {
    const selected =
      findDevices.find((device) => device.id === selectedDeviceId) ||
      findDevices.find((device) => /Ultra/i.test(device.deviceName) && device.lastAddress) ||
      findDevices.find((device) => device.lastAddress) ||
      findDevices[0];
    const latestSync = findDevices
      .flatMap((device) => device.lastSyncedAt ? [device.lastSyncedAt] : [])
      .sort((a, b) => +new Date(b) - +new Date(a))[0];
    const locatedCount = findDevices.filter((device) => device.lastAddress).length;
    return (
      <div className="page-stack">
        <div className="devices-header">
          <PageHeader
            title="Samsung Find overview"
            subtitle={`${findDevices.length} devices synchronized from the authenticated Samsung account`}
            status={latestSync ? `Updated ${relativeDate(latestSync)}` : "Waiting for refresh"}
          />
          <button className="sync-button" onClick={refreshSamsungLocation} disabled={refreshingSamsung}>
            {refreshingSamsung ? <LoaderCircle className="spinning" size={16} /> : <RefreshCw size={16} />}
            {refreshingSamsung ? "Updating all devices…" : "Update overview"}
          </button>
        </div>
        {refreshError && <div className="error-banner">{refreshError}</div>}
        {refreshMessage && <div className="success-banner"><ShieldCheck size={17} />{refreshMessage}</div>}
        <section className="overview-command-grid">
          <div className="overview-map-panel">
            <div className="overview-map-heading">
              <div><p className="eyebrow">ACTIVE DEVICE</p><h2>{selected.deviceName}</h2></div>
              <span className={`status-pill ${selected.lastAddress ? "" : "warning"}`}><SignalHigh size={14} /> {selected.providerStatus || "UNKNOWN"}</span>
            </div>
            <div className="hero-map-card overview-map-card">
              {selected.lastAddress ? (
                <LocationMap points={[]} query={selected.lastAddress} />
              ) : (
                <div className="overview-location-empty"><MapPin size={30} /><strong>Location unavailable</strong><p>Samsung Find did not provide an address for this device.</p></div>
              )}
              <div className="live-overlay overview-map-info">
                <p>{selected.lastAddress || "Location unavailable"}</p>
                {selected.lastSyncedAt && <div className="coordinates"><Clock3 size={15} /> Synchronized {relativeDate(selected.lastSyncedAt)}</div>}
              </div>
            </div>
          </div>
          <aside className="overview-device-rail">
            <div className="overview-rail-heading">
              <div><p className="eyebrow">DEVICE SWITCHER</p><h2>All devices</h2></div>
              <span>{locatedCount}/{findDevices.length} located</span>
            </div>
            <div className="overview-device-list">
              {findDevices.map((device) => (
                <button key={device.id} className={device.id === selected.id ? "active" : ""} onClick={() => setSelectedDeviceId(device.id)}>
                  <span className="device-list-icon"><Smartphone size={18} /></span>
                  <span className="device-list-copy"><strong>{device.deviceName}</strong><small>{device.lastAddress || "Location unavailable"}</small></span>
                  <span className={`device-list-state ${device.lastAddress ? "" : "missing"}`}><i />{device.providerStatus || "Unknown"}</span>
                </button>
              ))}
            </div>
          </aside>
        </section>
        <section className="metric-grid overview-metrics">
          <Metric icon={Crosshair} label="Samsung devices" value={String(findDevices.length)} note="All Find devices" />
          <Metric icon={MapPin} label="Located devices" value={String(locatedCount)} note={`${findDevices.length - locatedCount} unavailable`} />
          <Metric icon={Activity} label="Snapshots today" value={String(data.analytics.samsung?.snapshotCount || 0)} note="Authenticated reads" />
          <Metric icon={Route} label="Unique addresses" value={String(data.analytics.samsung?.uniqueAddressCount || new Set(findDevices.flatMap((device) => device.lastAddress ? [device.lastAddress] : [])).size)} note="Samsung-provided" />
        </section>
        <section className="health-card">
          <div><p className="eyebrow">SAMSUNG DATA HEALTH</p><h3><span className="health-dot" />Current device inventory</h3></div>
          <dl>
            <div><dt>Provider</dt><dd>Samsung Find</dd></div>
            <div><dt>Last refresh</dt><dd>{latestSync ? relativeDate(latestSync) : "Never"}</dd></div>
            <div><dt>Stored today</dt><dd>{data.analytics.samsung?.snapshotCount || 0} snapshots</dd></div>
          </dl>
          <ShieldCheck size={28} />
        </section>
      </div>
    );
  }
  if (liveOnly && findDevices.length) {
    const selected =
      findDevices.find((device) => device.id === selectedDeviceId) ||
      findDevices.find((device) => /Ultra/i.test(device.deviceName) && device.lastAddress) ||
      findDevices.find((device) => device.lastAddress) ||
      findDevices[0];
    return (
      <div className="page-stack">
        <PageHeader
          title={selected.deviceName}
          subtitle={selected.model || "Samsung Find device"}
          status={selected.providerStatus || "Unknown"}
        />
        <button className="live-refresh-button" onClick={refreshSamsungLocation} disabled={refreshingSamsung}>
          {refreshingSamsung ? <LoaderCircle className="spinning" size={16} /> : <RefreshCw size={16} />}
          {refreshingSamsung ? "Reading Samsung Find…" : "Refresh all Samsung devices"}
        </button>
        {refreshError && <div className="error-banner">{refreshError}</div>}
        {refreshMessage && <div className="success-banner"><ShieldCheck size={17} />{refreshMessage}</div>}
        <section className="hero-map-card">
          <LocationMap points={[]} query={selected.lastAddress || undefined} />
          <div className="live-overlay">
            <span className={`status-pill ${selected.lastAddress ? "" : "warning"}`}>
              <SignalHigh size={14} /> {selected.providerStatus || "UNKNOWN"}
            </span>
            <h2>{selected.lastAddress ? "Samsung Find location" : "Location unavailable"}</h2>
            <p>{selected.lastAddress || "Samsung Find did not provide a location for this device."}</p>
            {selected.lastSyncedAt && (
              <div className="coordinates"><Clock3 size={15} /> Updated {relativeDate(selected.lastSyncedAt)}</div>
            )}
          </div>
        </section>
        <section className="live-device-strip">
          {findDevices.map((device) => (
            <button
              key={device.id}
              className={device.id === selected.id ? "active" : ""}
              onClick={() => setSelectedDeviceId(device.id)}
            >
              <span><Crosshair size={14} /> {device.deviceName}</span>
              <strong>{device.providerStatus || "Unknown"}</strong>
              <small>{device.lastAddress || "Location unavailable"}</small>
            </button>
          ))}
        </section>
      </div>
    );
  }
  const point = data.current.point;
  if (!point)
    return (
      <>
        <PageHeader
          title="My Galaxy"
          subtitle="Private Samsung location timeline"
          status={data.health.status}
        />
        <EmptyState
          title="No recorded locations yet"
          detail="Start the collector, or run it once after seeding the database."
        />
      </>
    );
  const age = point.providerAgeMinutes === null ? "Unknown age" : relativeMinutes(point.providerAgeMinutes);
  return (
    <div className="page-stack">
      <PageHeader
        title={point.device.deviceName}
        subtitle={point.device.model || "Samsung Galaxy"}
        status={point.isStale ? "Provider stale" : data.health.status}
      />
      {liveOnly && (
        <button className="live-refresh-button" onClick={refreshSamsungLocation} disabled={refreshingSamsung}>
          {refreshingSamsung ? <LoaderCircle className="spinning" size={16} /> : <RefreshCw size={16} />}
          {refreshingSamsung ? "Reading Samsung Find…" : "Refresh Samsung location"}
        </button>
      )}
      {liveOnly && refreshError && <div className="error-banner">{refreshError}</div>}
      {liveOnly && refreshMessage && <div className="success-banner"><ShieldCheck size={17} />{refreshMessage}</div>}
      <section className="hero-map-card">
        <LocationMap
          points={data.history.points.length ? data.history.points : [point]}
          stops={data.history.stops}
        />
        <div className="live-overlay">
          <span className={`status-pill ${point.isStale ? "warning" : ""}`}>
            <SignalHigh size={14} />
            {point.isStale ? "LAST KNOWN" : point.state}
          </span>
          <h2>{point.isStale ? "Location is stale" : "Current sampled location"}</h2>
          <p>
            {age} · ±{point.accuracy ?? "—"} m accuracy
          </p>
          <div className="coordinates">
            <Crosshair size={15} />
            {point.latitude.toFixed(7)}, {point.longitude.toFixed(7)}
          </div>
        </div>
      </section>
      <section className="metric-grid">
        <Metric
          icon={Route}
          label="Today’s distance"
          value={`~${(data.analytics.distanceMeters / 1000).toFixed(2)} km`}
          note="GPS sampled"
        />
        <Metric
          icon={Activity}
          label="Moving time"
          value={duration(data.analytics.movingSeconds)}
          note={`${data.analytics.tripCount} detected trips`}
        />
        <Metric
          icon={MapPin}
          label="Stops"
          value={String(data.analytics.placesVisited)}
          note={duration(data.analytics.stationarySeconds)}
        />
        <Metric
          icon={Clock3}
          label="Last collection"
          value={relativeDate(point.collectedAt)}
          note={`Provider ${age.toLowerCase()}`}
        />
      </section>
      {!liveOnly && (
        <section className="health-card">
          <div>
            <p className="eyebrow">TRACKING HEALTH</p>
            <h3>
              <span className={`health-dot ${data.health.status !== "Healthy" ? "warn" : ""}`} />
              {data.health.status}
            </h3>
          </div>
          <dl>
            <div>
              <dt>Provider</dt>
              <dd>{data.health.provider}</dd>
            </div>
            <div>
              <dt>Last collection</dt>
              <dd>{data.health.lastCollection ? relativeDate(data.health.lastCollection) : "Never"}</dd>
            </div>
            <div>
              <dt>Next collection</dt>
              <dd>{data.health.nextCollection ? relativeDate(data.health.nextCollection) : "Pending"}</dd>
            </div>
          </dl>
          <ShieldCheck size={28} />
        </section>
      )}
    </div>
  );
}


export function PageHeader({
  title,
  subtitle,
  status
}: {
  title: string;
  subtitle: string;
  status?: string;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">LOCATION INTELLIGENCE</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {status && (
        <span className="header-status">
          <i />
          {status}
        </span>
      )}
    </header>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  note
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="metric">
      <span>
        <Icon size={18} />
      </span>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
export const relativeDate = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  return relativeMinutes(minutes);
};
const relativeMinutes = (minutes: number) =>
  minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${Math.floor(minutes)} min ago`
      : `${Math.floor(minutes / 60)}h ${Math.floor(minutes % 60)}m ago`;
