/**
 * Getting there.
 *
 * Two things this deliberately does not do. It does not embed a map — a live,
 * pannable map needs a Google Maps API key, which means a billing account and
 * a key in the page for anyone to lift. And it does not route: turn-by-turn is
 * a hard problem that four companies have already solved, on devices that
 * already know where you are.
 *
 * What it does is hand off well. Every button here opens the map app the phone
 * already has, with the destination already filled in — which is both better
 * than an embedded map (it has your live position, it talks, it works with the
 * screen off) and free of any key. The app's job is to know *where you are
 * going*, and it does: it holds every room from every syllabus and every place
 * you have named.
 *
 * Addresses are built to the documented URL schemes rather than scraped from a
 * browser's address bar, so none of them carry the session and campaign
 * parameters a copied link does.
 */

export type Travel = 'walking' | 'driving' | 'transit' | 'bicycling';

export const TRAVEL: { id: Travel; label: string }[] = [
  { id: 'walking', label: 'Walk' },
  { id: 'driving', label: 'Drive' },
  { id: 'transit', label: 'Transit' },
  { id: 'bicycling', label: 'Bike' },
];

/** The campus this app was built for. Editable like every other address. */
export const CAMPUS_MAP = 'https://www.vanderbilt.edu/map/';

/** Nashville, at a zoom that shows the city and what surrounds it. */
export const CITY_MAP = 'https://www.google.com/maps/@36.1626,-86.7816,12z';

export interface Destination {
  /** What to search for — "Alumni Hall, Vanderbilt University, Nashville, TN". */
  query: string;
  /** Exact coordinates when the app has them, which beat any search. */
  lat?: number;
  lon?: number;
}

/**
 * A room becomes something a map can find.
 *
 * "Alumni Hall 201" on its own lands in the wrong state; the building plus the
 * university plus the city is what makes it unambiguous. The room number is
 * dropped because no map service knows about rooms and including it only makes
 * the search worse.
 */
export function fromRoom(room: string, campus = 'Vanderbilt University, Nashville, TN'): Destination {
  const building = room.replace(/\s+\d+[A-Za-z]?$/, '').trim();
  return { query: `${building || room}, ${campus}` };
}

const target = (d: Destination) =>
  d.lat !== undefined && d.lon !== undefined ? `${d.lat},${d.lon}` : d.query;

/**
 * Directions, in whatever map app this device has.
 *
 * Google's universal URL is the one to use: on Android and on a desktop it
 * opens Google Maps, and on iOS Safari hands it to the Google Maps app when it
 * is installed and to the web otherwise. `appleMaps` below is offered
 * alongside it for iPhones without it.
 */
export function directionsUrl(d: Destination, mode: Travel = 'walking'): string {
  const params = new URLSearchParams({
    api: '1',
    destination: target(d),
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** The same journey, for a phone that would rather use Apple Maps. */
export function appleMapsUrl(d: Destination, mode: Travel = 'walking'): string {
  // Apple's flags: w walking, d driving, r transit. It has none for cycling,
  // so a bike ride falls back to walking rather than silently becoming a drive.
  const flag = mode === 'driving' ? 'd' : mode === 'transit' ? 'r' : 'w';
  const params = new URLSearchParams({ daddr: target(d), dirflg: flag });
  return `https://maps.apple.com/?${params.toString()}`;
}

/** Just show me where this is, without routing to it. */
export function placeUrl(d: Destination): string {
  const params = new URLSearchParams({ api: '1', query: target(d) });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Whether this device is likely to prefer Apple Maps.
 *
 * Used only to decide which button reads as primary. Both are always offered,
 * because a wrong guess here should cost a glance rather than a journey.
 */
export function prefersApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
}
