"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./DataState";
import { PageHeader } from "./Dashboard";
interface Point {
  id: string;
  collectedAt: string;
  providerTimestamp?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  distanceFromPrevious?: number;
  state: string;
}
interface SamsungSnapshot {
  id: string;
  capturedAt: string;
  deviceName: string;
  address?: string | null;
  providerStatus: string;
  source: string;
}
export function DebugLocations() {
  const [points, setPoints] = useState<Point[]>();
  const [snapshots, setSnapshots] = useState<SamsungSnapshot[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/location/raw")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Raw data request failed"))))
      .then((d) => {
        setPoints(d.points);
        setSnapshots(d.samsungSnapshots || []);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page-stack">
      <PageHeader title="Raw location samples" subtitle="Provider evidence for debugging and export" />
      <div className="export-row">
        {["csv", "json", "geojson"].map((format) => (
          <a key={format} href={`/api/location/export?format=${format}`}>
            <Download size={15} />
            {format.toUpperCase()}
          </a>
        ))}
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : !points || !snapshots ? (
        <LoadingState />
      ) : !points.length && !snapshots.length ? (
        <EmptyState
          title="No raw samples"
          detail="Collected points will appear here without coordinate rounding."
        />
      ) : snapshots.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Captured in IST</th>
                <th>Device</th>
                <th>Samsung status</th>
                <th>Samsung Find address</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{new Date(snapshot.capturedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                  <td>{snapshot.deviceName}</td>
                  <td>
                    <span className={`table-state ${/offline/i.test(snapshot.providerStatus) ? "offline" : "moving"}`}>
                      {snapshot.providerStatus}
                    </span>
                  </td>
                  <td>{snapshot.address || "Location unavailable"}</td>
                  <td>{snapshot.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Collection time</th><th>Latitude</th><th>Longitude</th><th>Status</th></tr></thead>
            <tbody>{points.map((point) => (
              <tr key={point.id}>
                <td>{new Date(point.collectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td>{point.latitude.toFixed(7)}</td><td>{point.longitude.toFixed(7)}</td><td>{point.state}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
