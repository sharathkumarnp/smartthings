"use client";
import { useEffect, useState } from "react";
import { MapPin, Pencil } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./DataState";
import { PageHeader } from "./Dashboard";
interface Place {
  id: string;
  name?: string;
  address?: string;
  latitude?: string | null;
  longitude?: string | null;
  visitCount: number;
  lastVisitedAt: string;
  editable?: boolean;
  source?: string;
}
export function PlacesView() {
  const [places, setPlaces] = useState<Place[]>();
  const [error, setError] = useState("");
  async function load() {
    try {
      const response = await fetch("/api/places");
      if (!response.ok) throw new Error("Places request failed");
      setPlaces((await response.json()).places);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    return () => clearTimeout(initial);
  }, []);
  async function rename(place: Place) {
    const name = window.prompt("Name this place", place.name || "");
    if (!name) return;
    const response = await fetch(`/api/places/${place.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (response.ok) void load();
  }
  return (
    <div className="page-stack">
      <PageHeader title="Frequent places" subtitle="Nearby detected stops clustered into places" />
      {error ? (
        <ErrorState message={error} />
      ) : !places ? (
        <LoadingState />
      ) : !places.length ? (
        <EmptyState
          title="No places discovered yet"
          detail="Places are created as recurring stops are detected."
        />
      ) : (
        <section className="places-grid">
          {places.map((place) => (
            <article key={place.id}>
              <span>
                <MapPin />
              </span>
              <div>
                <h3>{place.name || "Unknown place"}</h3>
                <p>
                  {place.address ||
                    (place.latitude !== null && place.latitude !== undefined
                      ? `${Number(place.latitude).toFixed(5)}, ${Number(place.longitude).toFixed(5)}`
                      : "Location unavailable")}
                </p>
                <small>
                  {place.source === "Samsung Find" ? `Samsung Find · ${place.visitCount} snapshots` : `${place.visitCount} visits`} · updated {new Date(place.lastVisitedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </small>
              </div>
              {place.editable && (
                <button onClick={() => rename(place)} aria-label={`Rename ${place.name || "place"}`}>
                  <Pencil size={16} />
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
