/**
 * Handing a destination to a map app.
 *
 * There is a map in the app now — see `findplace.ts` and `LiveMap.tsx`, which
 * use OpenStreetMap, because OSM asks for attribution where Google asks for an
 * API key. What that map does not do is route, and this file is the reason it
 * does not need to: turn-by-turn is a hard problem four companies have already
 * solved, on a device that already knows where you are, talks to you, and
 * works with the screen off. Looking at a map and being guided along a route
 * are different jobs, and the app is only better at the first one.
 *
 * So every button here opens the map app the phone already has, with the
 * destination filled in. The app's contribution is knowing *where you are
 * going*: every room from every syllabus, and every place you have named.
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
 * Wordings that are in the room field and are not rooms.
 *
 * A syllabus writes its meeting details in prose, and a parser reading one
 * files whatever sat in the room-shaped position. In the sample semester that
 * was "Section 9:05" for ECON 1020, and the app dutifully offered walking
 * directions to *"Section 9:05, Vanderbilt University"* — a search that lands
 * somewhere, confidently, and nowhere near a lecture.
 *
 * That is worse than having no room at all. No room says "I do not know"; a
 * wrong one says "go here", and it is believed, and somebody follows it.
 *
 * Each pattern below is a thing seen in the room slot rather than a guess:
 * a clock time, a section number, a run of meeting days, a delivery mode, or
 * an admission that the room is not yet decided.
 */
const NOT_A_PLACE: RegExp[] = [
  /\d{1,2}:\d{2}/,                       // a clock time — "9:05", "14:30"
  /\bsect?(ion)?\b\s*\.?\s*\d/i,         // "Section 9", "Sec. 03", "Sect 2"
  /^\s*(m|t|w|r|f|s|u|mw|tr|mwf|tth|mtwrf)\s*$/i, // meeting days on their own
  /\b(online|remote|virtual|zoom|teams|asynchronous|async|hybrid)\b/i,
  /\b(tba|tbd|tbc|n\/?a|none|unknown)\b/i,
  /^\s*\d+\s*$/,                         // a bare number: a room with no building
];

/**
 * Whether this room string names somewhere a map could take you.
 *
 * Deliberately a rejector rather than a matcher. Campus buildings are named
 * anything at all — "Buttrick", "The Wond'ry", "E. Bronson Ingram" — so a rule
 * that tried to recognise a building would refuse real ones constantly. What
 * can be recognised is the handful of things that are definitely *not* a
 * building, and everything else is taken at its word.
 */
export function isPlace(room: string): boolean {
  const r = room.trim();
  if (r.length < 2) return false;
  return !NOT_A_PLACE.some((re) => re.test(r));
}

/**
 * A room becomes something a map can find, or nothing at all.
 *
 * "Alumni Hall 201" on its own lands in the wrong state; the building plus the
 * university plus the city is what makes it unambiguous. The room number is
 * dropped because no map service knows about rooms and including it only makes
 * the search worse.
 *
 * `null` when the string is not a place. Callers offer no directions rather
 * than confident directions to nowhere — see `isPlace`.
 */
export function fromRoom(
  room: string,
  campus = 'Vanderbilt University, Nashville, TN',
): Destination | null {
  if (!isPlace(room)) return null;
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
