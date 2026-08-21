"use client";
import { useEffect, useState } from "react";
import { Clock3, Database, MapPin, MonitorSmartphone, Route, Trophy } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./DataState";
import { PageHeader, duration } from "./Dashboard";
type Analytics = {
  approximate: boolean;
  distanceMeters: number;
  tripCount: number;
  placesVisited: number;
  movingSeconds: number;
  stationarySeconds: number;
  longestTripMeters: number;
  mostVisitedPlace: string | null;
  samsung: {
    snapshotCount: number;
    deviceCount: number;
    locatedDeviceCount: number;
    unavailableDeviceCount: number;
    uniqueAddressCount: number;
    latestSync: string | null;
    devices: Array<{
      deviceName: string;
      providerStatus: string;
      address?: string | null;
      capturedAt: string;
    }>;
  };
};
export function AnalyticsView() {
  const [period, setPeriod] = useState("today");
  const [data, setData] = useState<Analytics>();
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/analytics?period=${period}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Analytics request failed"))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [period]);
  return (
    <div className="page-stack">
      <PageHeader title="Movement analytics" subtitle="Patterns inferred from sparse Samsung samples" />
      <div className="segmented">
        {[
          ["today", "Today"],
          ["week", "This week"],
          ["month", "This month"],
          ["year", "This year"]
        ].map(([value, label]) => (
          <button
            key={value}
            className={period === value ? "active" : ""}
            onClick={() => {
              setData(undefined);
              setError("");
              setPeriod(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <LoadingState />
      ) : data.samsung.snapshotCount > 0 ? (
        <>
          <section className="analytics-grid">
            <Card icon={MonitorSmartphone} label="Samsung devices" value={String(data.samsung.deviceCount)} />
            <Card icon={MapPin} label="Devices with location" value={String(data.samsung.locatedDeviceCount)} />
            <Card icon={Database} label="Find snapshots" value={String(data.samsung.snapshotCount)} />
            <Card icon={Trophy} label="Unique addresses" value={String(data.samsung.uniqueAddressCount)} />
          </section>
          <section className="bar-card">
            <h3>Latest Samsung Find device state</h3>
            <div className="bar">
              <i
                style={{
                  width: `${(100 * data.samsung.locatedDeviceCount) / Math.max(1, data.samsung.deviceCount)}%`
                }}
              />
            </div>
            <div className="bar-key">
              <span><i />Located · {data.samsung.locatedDeviceCount}</span>
              <span><i />Unavailable · {data.samsung.unavailableDeviceCount}</span>
            </div>
            <div className="analytics-device-list">
              {data.samsung.devices.map((device) => (
                <article key={device.deviceName}>
                  <div><strong>{device.deviceName}</strong><span>{device.providerStatus}</span></div>
                  <p>{device.address || "Location unavailable"}</p>
                  <small>{new Date(device.capturedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</small>
                </article>
              ))}
            </div>
            <p>Analytics are calculated from authenticated Samsung Find snapshots. No mock GPS distance is mixed into these figures.</p>
          </section>
        </>
      ) : data.distanceMeters === 0 && data.tripCount === 0 ? (
        <EmptyState
          title="Not enough movement data"
          detail="Analytics will appear after the collector records samples."
        />
      ) : (
        <>
          <section className="analytics-grid">
            <Card
              icon={Route}
              label="Sampled distance"
              value={`~${(data.distanceMeters / 1000).toFixed(2)} km`}
            />
            <Card icon={Clock3} label="Time travelling" value={`~${duration(data.movingSeconds)}`} />
            <Card icon={MapPin} label="Places visited" value={String(data.placesVisited)} />
            <Card
              icon={Trophy}
              label="Longest trip"
              value={`~${(data.longestTripMeters / 1000).toFixed(2)} km`}
            />
          </section>
          <section className="bar-card">
            <h3>Time balance</h3>
            <div className="bar">
              <i
                style={{
                  width: `${Math.max(4, (100 * data.movingSeconds) / Math.max(1, data.movingSeconds + data.stationarySeconds))}%`
                }}
              />
            </div>
            <div className="bar-key">
              <span>
                <i />
                Moving · {duration(data.movingSeconds)}
              </span>
              <span>
                <i />
                Stationary · {duration(data.stationarySeconds)}
              </span>
            </div>
            <p>
              Distances and time are estimates derived from periodic samples—not continuous GPS telemetry.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
function Card({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return (
    <article className="analytics-card">
      <Icon />
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
