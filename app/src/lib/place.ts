/**
 * Where you are, and whether that means anything.
 *
 * A coordinate on its own is useless to a student app — nobody wants to be told
 * they are at 36.1447, −86.8027. What is useful is *Alumni Hall*, and there is
 * no free way to turn one into the other that does not mean sending your
 * position to somebody else's server.
 *
 * So the app never geocodes. You stand somewhere that matters, tap once, and
 * name it. From then on the app can say "you're at Alumni Hall", know when you
 * are near a class, and tag a study session with where it happened — all from
 * a handful of coordinates you chose, held on your own device.
 *
 * Nothing here leaves the browser. There is no lookup, no map tile, no request:
 * the only thing that ever sees your position is the arithmetic below.
 */

export interface SavedPlace {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** Metres. A lecture hall is 60; a campus is 400. */
  radius: number;
  created: number;
}

export interface Fix {
  lat: number;
  lon: number;
  /** Metres of uncertainty the device itself reports. */
  accuracy: number;
  at: number;
}

export function locationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * One position, once.
 *
 * Deliberately not `watchPosition`. A study app has no business holding the GPS
 * open — it drains a battery, keeps the location indicator lit, and answers a
 * question nobody asked continuously. Every feature here wants the answer at a
 * moment: when you tap save, when a drill ends.
 */
export function here(timeout = 10_000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!locationSupported()) {
      reject(new Error('This browser will not give the app a location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy: p.coords.accuracy,
          at: p.timestamp,
        }),
      (e) => reject(new Error(explainPlaceError(e))),
      { enableHighAccuracy: true, timeout, maximumAge: 30_000 },
    );
  });
}

export function explainPlaceError(e: unknown): string {
  const code = (e as GeolocationPositionError)?.code;
  if (code === 1) {
    return (
      'Location was refused. The app cannot ask again — turn it back on for this site in the ' +
      'browser’s settings, then try once more.'
    );
  }
  if (code === 2) return 'The device could not work out where it is. Indoors this is common.';
  if (code === 3) return 'Locating timed out. Try again near a window, or outside.';
  return e instanceof Error ? e.message : String(e);
}

/**
 * Metres between two coordinates, by the haversine formula.
 *
 * Accurate to well under a metre at campus distances, which is far finer than
 * the twenty-odd metres a phone actually knows its position to.
 */
export function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * The saved place you are in, if any.
 *
 * The device's own accuracy is added to the radius, because refusing to say
 * "you are at Alumni Hall" when the phone is only sure to fifty metres would
 * make the feature useless indoors, which is where lectures happen.
 */
export function placeAt(fix: Fix, places: SavedPlace[]): SavedPlace | null {
  let best: SavedPlace | null = null;
  let bestDistance = Infinity;
  for (const p of places) {
    const d = metresBetween(fix, p);
    if (d <= p.radius + Math.min(fix.accuracy, 100) && d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best;
}

/** Every saved place, nearest first, with how far away each is. */
export function nearest(fix: Fix, places: SavedPlace[]): { place: SavedPlace; metres: number }[] {
  return places
    .map((place) => ({ place, metres: Math.round(metresBetween(fix, place)) }))
    .sort((a, b) => a.metres - b.metres);
}

/** "40 m", "1.2 km" — a distance a person reads rather than parses. */
export function far(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** The default radius for a new place: a building, not a campus. */
export const DEFAULT_RADIUS = 80;
