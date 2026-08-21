"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./DataState";
import { PageHeader, duration } from "./Dashboard";
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), { ssr: false });

interface Point {
  id: string;
  latitude: number;
  longitude: number;
  collectedAt: string;
  providerTimestamp?: string;
  state: string;
}
interface Stop {
  id: string;
  latitude: number;
  longitude: number;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  radiusMeters: number;
  placeName?: string;
}
interface Data {
  date: string;
  points: Point[];
  stops: Stop[];
  trips: Array<{ id: string; startedAt: string; endedAt?: string; distanceMeters: number }>;
  samsungSnapshots: Array<{
    id: string;
    deviceId: string;
    deviceName: string;
    address?: string | null;
    providerStatus: string;
    capturedAt: string;
  }>;
}

export function HistoryView({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<Data>();
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [index, setIndex] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const timer = useRef<number | undefined>(undefined);
  const samsungSnapshots = data?.samsungSnapshots.filter((snapshot) =>
    selectedDeviceId ? snapshot.deviceId === selectedDeviceId : true
  ) || [];
  const playbackLength = samsungSnapshots.length || data?.points.length || 0;
  useEffect(() => {
    fetch(`/api/location/history?date=${date}`)
      .then((response) => {
        if (!response.ok) throw new Error("History request failed");
        return response.json();
      })
      .then((value) => {
        setData(value);
        const defaultDevice = value.samsungSnapshots.find((snapshot: Data["samsungSnapshots"][number]) =>
          /Ultra/i.test(snapshot.deviceName) && snapshot.address
        ) || value.samsungSnapshots.find((snapshot: Data["samsungSnapshots"][number]) => snapshot.address) || value.samsungSnapshots[0];
        setSelectedDeviceId(defaultDevice?.deviceId);
        const length = defaultDevice
          ? value.samsungSnapshots.filter((snapshot: Data["samsungSnapshots"][number]) => snapshot.deviceId === defaultDevice.deviceId).length
          : value.points.length;
        setIndex(Math.max(0, length - 1));
      })
      .catch((reason) => setError(reason.message));
  }, [date]);
  useEffect(() => {
    if (timer.current) cancelAnimationFrame(timer.current);
    if (playing && playbackLength > 1) {
      let previous = performance.now();
      const animate = (now: number) => {
        const elapsed = Math.min(100, now - previous);
        previous = now;
        setIndex((current) => {
          const next = current + elapsed / (900 / speed);
          return next >= playbackLength - 1 ? 0 : next;
        });
        timer.current = requestAnimationFrame(animate);
      };
      timer.current = requestAnimationFrame(animate);
    }
    return () => {
      if (timer.current) cancelAnimationFrame(timer.current);
    };
  }, [playing, speed, playbackLength]);
  function selectDate(value: string) {
    setData(undefined);
    setError("");
    setDate(value);
    setPlaying(false);
  }
  function step(days: number) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    selectDate(next.toISOString().slice(0, 10));
  }
  return (
    <div className="page-stack">
      <PageHeader title="Daily history" subtitle="Recorded samples, detected stops, and estimated movement" />
      <div className="date-nav">
        <button onClick={() => step(-1)} aria-label="Previous day">
          <ChevronLeft />
        </button>
        <input
          type="date"
          value={date}
          max={initialDate}
          onChange={(event) => selectDate(event.target.value)}
        />
        <button onClick={() => step(1)} disabled={date >= initialDate} aria-label="Next day">
          <ChevronRight />
        </button>
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <LoadingState label="Reconstructing the sampled day…" />
      ) : data.samsungSnapshots.length ? (
        <SamsungHistory
          data={data}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={(deviceId) => {
            setSelectedDeviceId(deviceId);
            setIndex(0);
            setPlaying(false);
          }}
          index={index}
          setIndex={setIndex}
          playing={playing}
          setPlaying={setPlaying}
          speed={speed}
          setSpeed={setSpeed}
        />
      ) : !data.points.length ? (
        <EmptyState
          title="No samples on this day"
          detail="The collector did not store any provider locations for this date."
        />
      ) : (
        <>
          <section className="history-layout">
            <LocationMap
              className="history-map"
              points={data.points}
              stops={data.stops}
              playbackIndex={index}
            />
            <div className="timeline-panel">
              <div className="timeline-heading">
                <span>DAY TIMELINE</span>
                <strong>{data.points.length} samples</strong>
              </div>
              <div className="timeline-list">
                {timeline(data).map((item) => (
                  <article key={item.key}>
                    <time>
                      {new Date(item.time).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata"
                      })}
                    </time>
                    <i />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
          <section className="playback">
            <button className="play" onClick={() => setPlaying(!playing)}>
              {playing ? <Pause /> : <Play />}
              {playing ? "Pause" : "Replay day"}
            </button>
            <button
              onClick={() => {
                setIndex(0);
                setPlaying(false);
              }}
              aria-label="Reset replay"
            >
              <RotateCcw size={17} />
            </button>
            <input
              aria-label="Replay position"
              type="range"
              min="0"
              max={data.points.length - 1}
              step="0.01"
              value={index}
              onChange={(event) => {
                setIndex(Number(event.target.value));
                setPlaying(false);
              }}
            />
            <div className="speed-buttons">
              {[1, 2, 5, 10].map((value) => (
                <button
                  className={speed === value ? "active" : ""}
                  key={value}
                  onClick={() => setSpeed(value)}
                >
                  {value}×
                </button>
              ))}
            </div>
            <span>Interpolation is visual estimation</span>
          </section>
        </>
      )}
    </div>
  );
}

function SamsungHistory({
  data,
  selectedDeviceId,
  setSelectedDeviceId,
  index,
  setIndex,
  playing,
  setPlaying,
  speed,
  setSpeed
}: {
  data: Data;
  selectedDeviceId?: string;
  setSelectedDeviceId: (deviceId: string) => void;
  index: number;
  setIndex: (value: number) => void;
  playing: boolean;
  setPlaying: (value: boolean) => void;
  speed: number;
  setSpeed: (value: number) => void;
}) {
  const devices = [...new Map(data.samsungSnapshots.map((snapshot) => [snapshot.deviceId, snapshot.deviceName])).entries()];
  const snapshots = data.samsungSnapshots.filter((snapshot) => snapshot.deviceId === selectedDeviceId);
  const current = snapshots[Math.min(Math.floor(index), Math.max(0, snapshots.length - 1))];
  return (
    <>
      <section className="history-device-tabs">
        {devices.map(([deviceId, deviceName]) => (
          <button key={deviceId} className={deviceId === selectedDeviceId ? "active" : ""} onClick={() => setSelectedDeviceId(deviceId)}>
            {deviceName}
          </button>
        ))}
      </section>
      <section className="history-layout">
        {current?.address ? (
          <LocationMap className="history-map" points={[]} query={current.address} />
        ) : (
          <div className="history-address-empty"><MapPinIcon /><strong>Location unavailable</strong><p>Samsung Find did not provide an address for this device.</p></div>
        )}
        <div className="timeline-panel">
          <div className="timeline-heading"><span>SAMSUNG FIND HISTORY</span><strong>{snapshots.length} snapshots</strong></div>
          <div className="timeline-list">
            {snapshots.map((snapshot) => (
              <article key={snapshot.id}>
                <time>{new Date(snapshot.capturedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</time>
                <i />
                <div><strong>{snapshot.providerStatus}</strong><p>{snapshot.address || "Location unavailable"}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="playback">
        <button className="play" onClick={() => setPlaying(!playing)} disabled={snapshots.length < 2}>
          {playing ? <Pause /> : <Play />}{playing ? "Pause" : "Replay snapshots"}
        </button>
        <button onClick={() => { setIndex(0); setPlaying(false); }} aria-label="Reset replay"><RotateCcw size={17} /></button>
        <input aria-label="Replay position" type="range" min="0" max={Math.max(0, snapshots.length - 1)} step="0.01" value={Math.min(index, Math.max(0, snapshots.length - 1))} onChange={(event) => { setIndex(Number(event.target.value)); setPlaying(false); }} />
        <div className="speed-buttons">{[1, 2, 5, 10].map((value) => <button className={speed === value ? "active" : ""} key={value} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
        <span>Samsung address snapshots</span>
      </section>
    </>
  );
}

function MapPinIcon() {
  return <span aria-hidden="true">⌖</span>;
}
function timeline(data: Data) {
  const items = [
    ...data.stops.map((stop) => ({
      key: `s-${stop.id}`,
      time: stop.startedAt,
      title: stop.placeName || "Detected stop",
      detail: `Stayed ${duration(stop.durationSeconds)}`
    })),
    ...data.trips.map((trip) => ({
      key: `t-${trip.id}`,
      time: trip.startedAt,
      title: "Started moving",
      detail: `~${(trip.distanceMeters / 1000).toFixed(2)} km sampled`
    }))
  ];
  return items.length
    ? items.sort((a, b) => +new Date(a.time) - +new Date(b.time))
    : data.points
        .filter((_, i) => i === 0 || i === data.points.length - 1)
        .map((point, i) => ({
          key: point.id,
          time: point.collectedAt,
          title: i ? "Last recorded sample" : "First recorded sample",
          detail: point.state
        }));
}
