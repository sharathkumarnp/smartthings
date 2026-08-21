"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  Check,
  CloudCog,
  LocateOff,
  LocateFixed,
  MapPin,
  Play,
  RefreshCw,
  Search,
  Smartphone,
  Video,
  Wifi
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./DataState";
import { PageHeader } from "./Dashboard";
import { CameraPreview } from "./CameraPreview";

interface Device {
  id: string;
  providerDeviceId: string;
  deviceName: string;
  model?: string | null;
  provider: "samsung" | "mock";
  enabled: boolean;
  capabilities?: unknown;
  locationSupported: boolean;
  lastAddress?: string | null;
  providerStatus?: string | null;
  lastSyncedAt?: string | null;
}

export function DevicesView() {
  const [devices, setDevices] = useState<Device[]>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; message: string }>();
  const [syncing, setSyncing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string>();
  const [activeCameraId, setActiveCameraId] = useState<string>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "find" | "camera">("all");
  const cameraIds = devices
    ?.filter((device) => Array.isArray(device.capabilities) && device.capabilities.includes("videoStream"))
    .map((device) => device.id) || [];
  const effectiveActiveCameraId = activeCameraId && cameraIds.includes(activeCameraId)
    ? activeCameraId
    : cameraIds.at(-1);
  const filteredDevices = devices?.filter((device) => {
    const capabilities = Array.isArray(device.capabilities) ? device.capabilities : [];
    const matchesFilter = filter === "all"
      || (filter === "find" && device.providerDeviceId.startsWith("find-web:"))
      || (filter === "camera" && capabilities.includes("videoStream"));
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery
      || device.deviceName.toLowerCase().includes(normalizedQuery)
      || device.model?.toLowerCase().includes(normalizedQuery)
      || device.lastAddress?.toLowerCase().includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });

  async function load() {
    try {
      const response = await fetch("/api/devices", { cache: "no-store" });
      if (!response.ok) throw new Error("Device inventory request failed");
      setDevices((await response.json()).devices);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error");
    }
  }

  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    return () => clearTimeout(initial);
  }, []);
  async function sync() {
    setSyncing(true);
    setError("");
    setNotice(undefined);
    const startedAt = Date.now();
    try {
      const [smartThingsResponse, findResponse] = await Promise.all([
        fetch("/api/devices", { method: "POST" }).catch(() => null),
        fetch("/api/samsung-find/location?refresh=1", { method: "POST" }).catch(() => null)
      ]);
      const smartThingsBody = await smartThingsResponse?.json().catch(() => null);
      const findBody = await findResponse?.json().catch(() => null);
      const smartThingsOk = Boolean(smartThingsResponse?.ok);
      const findOk = Boolean(findResponse?.ok && findBody?.syncedDevices);
      if (!smartThingsOk && !findOk) {
        throw new Error(
          [smartThingsBody?.error, findBody?.error].filter(Boolean).join(" · ")
          || "Neither SmartThings nor Samsung Find could be updated."
        );
      }
      await load();
      setNotice({
        tone: smartThingsOk && findOk ? "success" : "warning",
        message: smartThingsOk && findOk
          ? `${smartThingsBody.syncedCount} SmartThings devices and ${findBody.syncedDevices} Samsung Find devices updated.`
          : smartThingsOk
            ? `${smartThingsBody.syncedCount} SmartThings devices updated. Samsung Find needs attention: ${findBody?.error || "no locations returned"}.`
            : `${findBody.syncedDevices} Samsung Find devices updated. SmartThings needs attention: ${smartThingsBody?.error || "sync failed"}.`
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error");
    } finally {
      const remaining = 800 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      setSyncing(false);
    }
  }

  async function toggle(device: Device) {
    setUpdatingId(device.id);
    setError("");
    try {
      const response = await fetch(`/api/devices/${device.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !device.enabled })
      });
      if (!response.ok) throw new Error("Could not update device setting");
      setDevices((current) =>
        current?.map((candidate) =>
          candidate.id === device.id ? { ...candidate, enabled: !candidate.enabled } : candidate
        )
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error");
    } finally {
      setUpdatingId(undefined);
    }
  }

  return (
    <div className="page-stack">
      <div className="devices-header">
        <PageHeader
          title="Connected devices"
          subtitle="Your connected Samsung ecosystem, live and in one place"
        />
        <button className="sync-button" onClick={sync} disabled={syncing}>
          <RefreshCw size={16} className={syncing ? "spinning" : ""} />
          {syncing ? "Updating ecosystem…" : "Update all devices"}
        </button>
      </div>
      {error && <ErrorState message={error} />}
      {notice && <div className={notice.tone === "success" ? "success-banner" : "warning-banner"}><Check size={17} />{notice.message}</div>}
      {!devices ? (
        <LoadingState label="Loading authorized devices…" />
      ) : !devices.length ? (
        <EmptyState title="No connected devices" detail="Synchronize the authorized SmartThings account." />
      ) : (
        <>
          <section className="device-summary-grid" aria-label="Device inventory summary">
            <DeviceSummary icon={Smartphone} label="Connected" value={devices.length} note="Across your Samsung account" />
            <DeviceSummary icon={LocateFixed} label="Location ready" value={devices.filter((device) => device.locationSupported).length} note="Visible in Samsung Find" />
            <DeviceSummary icon={Video} label="Live cameras" value={cameraIds.length} note="SmartThings video streams" />
            <DeviceSummary icon={Wifi} label="Included" value={devices.filter((device) => device.enabled).length} note="Active in this workspace" />
          </section>

          <section className="device-command-bar">
            <label className="device-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search devices, models, or places"
                aria-label="Search connected devices"
              />
            </label>
            <div className="device-filters" aria-label="Filter devices">
              {([
                ["all", "All devices", devices.length],
                ["find", "Samsung Find", devices.filter((device) => device.providerDeviceId.startsWith("find-web:")).length],
                ["camera", "Cameras", cameraIds.length]
              ] as const).map(([value, label, count]) => (
                <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                  {label}<span>{count}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="device-section-heading">
            <div><p className="eyebrow">DEVICE INVENTORY</p><h2>{filter === "all" ? "Your ecosystem" : filter === "find" ? "Location devices" : "Live cameras"}</h2></div>
            <span>{filteredDevices?.length || 0} shown</span>
          </div>

          {!filteredDevices?.length ? (
            <EmptyState title="No matching devices" detail="Try a different search or device category." />
          ) : <section className="device-grid">
          {filteredDevices.map((device) => {
            const capabilities = Array.isArray(device.capabilities)
              ? device.capabilities.filter((item): item is string => typeof item === "string")
              : [];
            const isFindDevice = device.providerDeviceId.startsWith("find-web:");
            const isCamera = capabilities.includes("videoStream");
            const DeviceIcon = device.provider === "mock" ? Smartphone : Camera;
            return (
              <article className={`device-card ${device.enabled ? "" : "disabled"}`} key={device.id}>
                <div className="device-card-top">
                  <span className="device-icon">
                    <DeviceIcon size={22} />
                  </span>
                  <div className="device-provider">
                    <CloudCog size={13} /> {isFindDevice ? "Samsung Find" : device.provider === "samsung" ? "SmartThings" : "Demo provider"}
                  </div>
                  <button
                    className={`device-toggle ${device.enabled ? "on" : ""}`}
                    onClick={() => toggle(device)}
                    disabled={updatingId === device.id}
                    aria-label={`${device.enabled ? "Exclude" : "Include"} ${device.deviceName}`}
                    aria-pressed={device.enabled}
                  >
                    <i />
                  </button>
                </div>
                <div className="device-card-identity">
                  <div>
                    <h2>{device.deviceName}</h2>
                    <p>{device.model || (isFindDevice ? "Samsung Find device" : "SmartThings device")}</p>
                  </div>
                  <span className={`device-state ${/offline/i.test(device.providerStatus || "") ? "offline" : ""}`}>
                    <i />{device.providerStatus || (device.enabled ? "Connected" : "Excluded")}
                  </span>
                </div>
                {isCamera && (effectiveActiveCameraId === device.id ? (
                  <CameraPreview deviceId={device.id} deviceName={device.deviceName} />
                ) : (
                  <button className="camera-preview-button" onClick={() => setActiveCameraId(device.id)}>
                    <Play size={15} /> View live preview
                  </button>
                ))}
                <div className={`location-support ${device.locationSupported ? "available" : ""}`}>
                  {device.locationSupported ? <LocateFixed size={15} /> : <LocateOff size={15} />}
                  <span>
                    <strong>
                      {device.locationSupported ? "Location supported" : "Location unavailable"}
                    </strong>
                    <small>
                      {device.locationSupported
                        ? "Available to the private location timeline"
                        : "Location was not supplied by the provider"}
                    </small>
                  </span>
                </div>
                {device.lastAddress && <div className="device-address"><MapPin size={14} /><span>{device.lastAddress}</span></div>}
                <div className="capability-list">
                  {capabilities.length ? (
                    capabilities.map((capability) => <span key={capability}>{capability}</span>)
                  ) : (
                    <span>No capabilities synchronized</span>
                  )}
                </div>
                <footer>
                  <code>{device.providerDeviceId}</code>
                  <span>
                    {device.enabled ? <Check size={13} /> : null}
                    {device.enabled ? "Included" : "Excluded"}
                  </span>
                </footer>
              </article>
            );
          })}
        </section>}
        </>
      )}
      <p className="device-disclaimer">
        Device management controls inclusion in TracePrivate. Camera tiles use only SmartThings&apos; official
        start/stop stream commands and keep stream addresses inside the private Docker network.
      </p>
    </div>
  );
}

function DeviceSummary({ icon: Icon, label, value, note }: { icon: typeof Smartphone; label: string; value: number; note: string }) {
  return <article><span><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}
