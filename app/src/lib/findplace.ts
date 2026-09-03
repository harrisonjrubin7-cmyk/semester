/**
 * Searching for a place, without buying a map.
 *
 * The earlier version of this file said an embedded map needs a Google Maps
 * API key. That is true of Google's map and false of the alternative: OpenStreetMap's
 * tiles and Nominatim's search are both open, both free, and neither wants a
 * key sitting in the page for anyone to lift. So the app can have a real
 * pannable map after all, and this is the search behind it.
 *
 * Two scopes, because "Rand" means the dining hall when you are a student and
 * a road in Bellevue when you are not. Campus search is boxed tightly around
 * Vanderbilt and answers with buildings; city search covers Nashville and what
 * surrounds it. Neither is a hard filter — a bounded box that returns nothing
 * is worse than a biased one that returns the right answer from just outside —
 * so the box orders results rather than excluding them.
 *
 * Nominatim is run on donated hardware and asks callers for no more than one
 * request a second. That is not a formality: hammering it gets an app blocked
 * and takes the service down for everyone. So this throttles, it never
 * searches on a keystroke, and it caches, and those are the reasons.
 */

export interface Found {
  id: string;
  /** The short name — "Rand Dining Center". */
  name: string;
  /** Everything after it — "West End Avenue, Nashville, Davidson County". */
  detail: string;
  lat: number;
  lon: number;
  /** "building", "restaurant", "bus_stop" — what OSM calls it. */
  kind: string;
}

export type Scope = 'campus' | 'city';

/**
 * The boxes results are biased towards, as [west, north, east, south].
 *
 * Campus is drawn around Vanderbilt's main campus rather than around a point,
 * so a search for "Stevenson" prefers the science centre over the road of that
 * name. City covers Davidson County and enough of Williamson and Rutherford to
 * reach the places students actually drive to.
 */
export const BOXES: Record<Scope, [number, number, number, number]> = {
  campus: [-86.812, 36.155, -86.788, 36.136],
  city: [-87.05, 36.42, -86.5, 35.95],
};

export const CENTRES: Record<Scope, { lat: number; lon: number; zoom: number }> = {
  campus: { lat: 36.1447, lon: -86.8027, zoom: 16 },
  city: { lat: 36.1627, lon: -86.7816, zoom: 12 },
};

/** Words that make a campus search land on the campus rather than in Texas. */
const CAMPUS_HINT = 'Vanderbilt University Nashville';

/**
 * The query actually sent.
 *
 * A campus search gets the university appended unless the person already said
 * it, because "Buttrick" alone is a surname before it is a building. A city
 * search is left as typed — the box does the work — except that a bare word
 * gets "Nashville" so the first result is not in another state.
 */
export function queryFor(text: string, scope: Scope): string {
  const q = text.trim();
  if (!q) return '';
  const said = /vanderbilt|vandy/i.test(q);
  if (scope === 'campus') return said ? q : `${q}, ${CAMPUS_HINT}`;
  return /nashville|tennessee|,\s*tn\b/i.test(q) ? q : `${q}, Nashville, TN`;
}

export function searchUrl(text: string, scope: Scope, limit = 8): string {
  const [w, n, e, s] = BOXES[scope];
  const params = new URLSearchParams({
    q: queryFor(text, scope),
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'us',
    // Bias, not a fence: bounded=0 keeps a right answer that sits just outside.
    viewbox: `${w},${n},${e},${s}`,
    bounded: '0',
  });
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

interface Raw {
  place_id?: number | string;
  osm_id?: number | string;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  type?: string;
  category?: string;
}

/**
 * What comes back, made usable.
 *
 * Nominatim's display_name is the full comma-separated chain from building to
 * country, which is unreadable in a list. The first part is the name and the
 * next few are the useful context; the country and the postcode are not.
 */
export function readResults(raw: unknown): Found[] {
  if (!Array.isArray(raw)) return [];
  const out: Found[] = [];
  for (const item of raw as Raw[]) {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const chain = (item.display_name ?? '').split(',').map((p) => p.trim());
    const name = item.name?.trim() || chain[0] || 'Unnamed place';
    const rest = chain.slice(chain[0] === name ? 1 : 0, 4).filter((p) => !/^\d{5}/.test(p));
    out.push({
      id: String(item.place_id ?? item.osm_id ?? `${lat},${lon}`),
      name,
      detail: rest.join(', '),
      lat,
      lon,
      kind: (item.type ?? item.category ?? '').replace(/_/g, ' '),
    });
  }
  return out;
}

/**
 * One search a second, at most, and never the same one twice.
 *
 * The throttle is a promise chain rather than a timer per call, so results
 * cannot arrive out of order and overwrite a newer search with an older one.
 */
const cache = new Map<string, Found[]>();
let ready = Promise.resolve();
const GAP = 1100;

export async function findPlaces(
  text: string,
  scope: Scope,
  signal?: AbortSignal,
): Promise<Found[]> {
  const key = `${scope}:${text.trim().toLowerCase()}`;
  if (!text.trim()) return [];
  const hit = cache.get(key);
  if (hit) return hit;

  const mine = ready.then(() => new Promise<void>((go) => setTimeout(go, GAP)));
  ready = mine;
  await mine;
  if (signal?.aborted) return [];

  const res = await fetch(searchUrl(text, scope), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 429
        ? 'The search is rate-limited — it is a donated service. Wait a moment and try again.'
        : `Place search failed (${res.status}).`,
    );
  }
  const found = readResults(await res.json());
  cache.set(key, found);
  return found;
}

/** Required by OpenStreetMap's licence, and shown on the map. */
export const OSM_CREDIT = '© OpenStreetMap contributors';
export const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
