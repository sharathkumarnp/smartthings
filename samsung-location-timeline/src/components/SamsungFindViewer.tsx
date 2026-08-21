"use client";

import { useEffect, useState } from "react";
import { Crosshair, ExternalLink, LoaderCircle, MonitorSmartphone, RefreshCw, ShieldCheck } from "lucide-react";

type State = "checking" | "disconnected" | "connecting" | "connected" | "error";
type LocationExtraction = {
  status: "FOUND" | "AUTH_REQUIRED" | "NO_LOCATION";
  devices?: Array<{
    name: string;
    status: string;
    address?: string;
  }>;
  syncedDevices?: number;
  extractedAt: string;
};

export function SamsungFindViewer() {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState("");
  const [frameKey, setFrameKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [location, setLocation] = useState<LocationExtraction | null>(null);
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    fetch("/api/samsung-find/session", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { connected?: boolean };
        setState(data.connected ? "connected" : "disconnected");
      })
      .catch(() => setState("disconnected"));
  }, []);

  async function connect() {
    setState("connecting");
    setError("");
    try {
      const response = await fetch("/api/samsung-find/session", { method: "POST" });
      const data = (await response.json()) as { connected?: boolean; error?: string };
      if (!response.ok || !data.connected) throw new Error(data.error || "Could not open Samsung Find");
      setFrameKey((value) => value + 1);
      setState("connected");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open Samsung Find");
      setState("error");
    }
  }

  async function restart() {
    setState("connecting");
    setError("");
    await fetch("/api/samsung-find/session", { method: "DELETE" }).catch(() => undefined);
    await connect();
  }

  async function readLocation() {
    setScanning(true);
    setScanError("");
    try {
      const response = await fetch("/api/samsung-find/location?refresh=1", { method: "POST" });
      const data = (await response.json()) as LocationExtraction & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not read Samsung Find");
      setLocation(data);
    } catch (cause) {
      setScanError(cause instanceof Error ? cause.message : "Could not read Samsung Find");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="page-stack samsung-find-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">INTERACTIVE OWNER SESSION</p>
          <h1>Samsung Find</h1>
          <p>Samsung&apos;s official website, rendered inside a private local browser.</p>
        </div>
        <span className={`header-status ${state === "connected" ? "" : "waiting"}`}>
          <i /> {state === "connected" ? "Browser connected" : "Browser offline"}
        </span>
      </header>

      <div className="find-security-note">
        <ShieldCheck size={19} />
        <div>
          <strong>Credentials stay in the dedicated browser</strong>
          <span>TracePrivate does not receive, log, or save your Samsung username, password, MFA code, or cookies.</span>
        </div>
      </div>

      {state === "connected" ? (
        <section className="find-browser-shell">
          <div className="find-browser-toolbar">
            <span><i /> Local Samsung browser</span>
            <div>
              <button onClick={readLocation} disabled={scanning}>
                {scanning ? <LoaderCircle className="spinning" size={14} /> : <Crosshair size={14} />}
                Read location
              </button>
              <button onClick={() => setFrameKey((value) => value + 1)}><RefreshCw size={14} /> Reconnect view</button>
              <button onClick={restart}><MonitorSmartphone size={14} /> Restart browser</button>
              <a href="http://localhost:7900/?autoconnect=1&resize=scale" target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Full screen
              </a>
            </div>
          </div>
          <iframe
            key={frameKey}
            title="Private Samsung Find browser"
            src="http://localhost:7900/?autoconnect=1&resize=scale"
            allow="clipboard-read; clipboard-write"
            referrerPolicy="no-referrer"
          />
        </section>
      ) : (
        <section className="find-connect-card">
          {state === "checking" || state === "connecting" ? (
            <LoaderCircle className="spinning" size={36} />
          ) : (
            <MonitorSmartphone size={42} />
          )}
          <h2>{state === "connecting" ? "Starting private browser…" : "Open Samsung Find securely"}</h2>
          <p>You will sign in directly on Samsung&apos;s page in the browser displayed here.</p>
          {error && <div className="error-banner">{error}</div>}
          <button className="find-connect-button" onClick={connect} disabled={state === "connecting" || state === "checking"}>
            {state === "connecting" ? <LoaderCircle className="spinning" size={17} /> : <ShieldCheck size={17} />}
            Connect Samsung Find
          </button>
        </section>
      )}

      {state === "connected" && (location || scanError) && (
        <section className="find-extraction-card">
          {scanError ? (
            <div className="error-banner">{scanError}</div>
          ) : location?.status === "FOUND" ? (
            <>
              <div>
                <span className="status-pill"><Crosshair size={13} /> Location read</span>
                <h2>{location.devices?.length || 0} Samsung devices found</h2>
                <p>Live details read from the authenticated Samsung Find page.</p>
              </div>
              {location.devices && location.devices.length > 0 && (
                <div className="find-device-results">
                  {location.devices.map((device) => (
                    <article key={`${device.name}-${device.address}`}>
                      <div><strong>{device.name}</strong><span>{device.status}</span></div>
                      <p>{device.address || "Location not shown"}</p>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div>
              <span className="status-pill warning">{location?.status === "AUTH_REQUIRED" ? "Samsung sign-in required" : "No location visible"}</span>
              <h2>{location?.status === "AUTH_REQUIRED" ? "Complete Samsung sign-in in the browser above" : "Select the Galaxy device and refresh its location"}</h2>
              <p>The extractor reads only location details currently available in Samsung Find.</p>
            </div>
          )}
        </section>
      )}

      <p className="device-disclaimer">
        This viewer does not bypass Samsung authentication. Samsung may request MFA, CAPTCHA, or device confirmation.
        All visible Samsung device names, statuses, and addresses are synchronized to the private database.
        The Samsung map viewport center is never treated as a device GPS coordinate.
      </p>
    </div>
  );
}
