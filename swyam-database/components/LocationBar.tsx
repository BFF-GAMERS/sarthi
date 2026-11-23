import { useEffect, useState } from "react";
import { MapPin, Crosshair, X } from "lucide-react";
import {
  CITIES,
  type CityPoint,
  CITY_NAMES,
  DISTANCE_OPTIONS,
  distanceKm,
  type DistanceOption,
} from "../lib/location";
import { getPreferredCity, setPreferredCity } from "../lib/local-store";
import { states } from "../data/mock";
import { useTx } from "../lib/i18n";

export interface LocationState {
  city: string | null;
  state: string;
  distance: DistanceOption;
  remoteOnly: boolean;
}

export const defaultLocationState: LocationState = {
  city: null,
  state: "All",
  distance: "any",
  remoteOnly: false,
};

/**
 * City / state / distance / remote controls shared by every listing page.
 * The chosen city persists, so it carries across jobs, internships and events.
 */
export default function LocationBar({
  value,
  onChange,
  showRemote = true,
}: {
  value: LocationState;
  onChange: (next: LocationState) => void;
  showRemote?: boolean;
}) {
  const tx = useTx();
  const [locating, setLocating] = useState(false);
  const set = (patch: Partial<LocationState>) => onChange({ ...value, ...patch });

  // Restore the saved city once, on mount.
  useEffect(() => {
    const saved = getPreferredCity();
    if (saved && !value.city) onChange({ ...value, city: saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseCity = (city: string | null) => {
    setPreferredCity(city);
    set({ city });
  };

  /** Optional convenience — snaps to the nearest known city, never stores coords. */
  const detect = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Only lat/lon are read by distanceKm; the rest satisfies the type.
        const here: CityPoint = {
          city: "",
          state: "",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          tier: 2,
        };
        const nearest = [...CITIES].sort((a, b) => distanceKm(here, a) - distanceKm(here, b))[0];
        if (nearest) chooseCity(nearest.city);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-ink-line pt-4">
      <span className="inline-flex items-center gap-1.5 font-body text-[11px] font-medium uppercase tracking-wide text-ink-mute">
        <MapPin size={13} className="text-saffron-500" aria-hidden /> {tx("Near")}
      </span>

      <select
        value={value.city ?? ""}
        onChange={(e) => chooseCity(e.target.value || null)}
        aria-label={tx("Your city")}
        className="input !w-auto !py-2 !text-xs"
      >
        <option value="">{tx("Choose your city")}</option>
        {CITY_NAMES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>

      <button type="button" onClick={detect} className="filter-pill" disabled={locating}>
        <Crosshair size={13} aria-hidden /> {locating ? "Locating…" : "Use my location"}
      </button>

      <select
        value={value.state}
        onChange={(e) => set({ state: e.target.value })}
        aria-label={tx("Filter by state")}
        className="input !w-auto !py-2 !text-xs"
      >
        <option value="All">{tx("All states")}</option>
        {states.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      <select
        value={value.distance}
        onChange={(e) => set({ distance: e.target.value as DistanceOption })}
        aria-label={tx("Maximum distance")}
        disabled={!value.city}
        className="input !w-auto !py-2 !text-xs disabled:opacity-50"
      >
        {DISTANCE_OPTIONS.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>

      {showRemote && (
        <button
          type="button"
          onClick={() => set({ remoteOnly: !value.remoteOnly })}
          aria-pressed={value.remoteOnly}
          className="filter-pill"
        >
          {tx("Remote only")}
        </button>
      )}

      {value.city && (
        <button
          type="button"
          onClick={() => chooseCity(null)}
          className="inline-flex items-center gap-1 font-body text-xs font-medium text-saffron-600 hover:underline"
        >
          <X size={12} aria-hidden /> {tx("Clear city")}
        </button>
      )}
    </div>
  );
}
