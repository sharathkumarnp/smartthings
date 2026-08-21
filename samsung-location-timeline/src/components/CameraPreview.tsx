"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, VideoOff } from "lucide-react";

export function CameraPreview({ deviceId, deviceName, startDelayMs = 1_200 }: { deviceId: string; deviceName: string; startDelayMs?: number }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "playing" | "error">("loading");
  const [activated, setActivated] = useState(false);
  const source = `/api/cameras/${encodeURIComponent(deviceId)}/stream?attempt=${attempt}`;

  useEffect(() => {
    const timer = setTimeout(() => setActivated(true), startDelayMs);
    return () => {
      clearTimeout(timer);
      void fetch(`/api/cameras/${encodeURIComponent(deviceId)}/stream`, {
        method: "DELETE",
        keepalive: true
      }).catch(() => undefined);
    };
  }, [deviceId, startDelayMs]);

  return (
    <div className={`camera-preview ${state}`}>
      {activated && <video
        key={source}
        src={source}
        aria-label={`Live preview from ${deviceName}`}
        autoPlay
        muted
        playsInline
        controls
        onCanPlay={(event) => {
          setState("playing");
          void event.currentTarget.play().catch(() => undefined);
        }}
        onError={() => setState("error")}
      />}
      {state === "loading" && <div className="camera-preview-state"><LoaderCircle className="spinning" /><span>Starting secure live preview…</span></div>}
      {state === "error" && (
        <div className="camera-preview-state">
          <VideoOff />
          <span>Live preview unavailable</span>
          <button onClick={() => { setState("loading"); setAttempt((value) => value + 1); }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}
      <span className="camera-live-label">LIVE · SMARTTHINGS</span>
    </div>
  );
}
