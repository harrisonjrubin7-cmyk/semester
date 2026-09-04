/**
 * Turning an address into a coordinate, and back.
 *
 * `lib/place.ts` opens by saying the app never geocodes, and gives the reason:
 * there is no free way to turn a position into a building name that does not
 * mean sending your position to somebody else's server. That reason has not
 * changed and this file does not pretend otherwise. What it does is make the
 * trade explicit and put it in the student's hands, rather than deciding for
 * them that the answer is always no.
 *
 * Two things worth separating, because they are not the same act:
 *
 * **Forward** — you type "2201 West End Ave" and get a coordinate. What leaves
 * the device is text you deliberately typed into a box marked "look this up".
 *
 * **Reverse** — the app takes where you are standing and asks what is there.
 * What leaves the device is your position. That is a different order of thing
 * and it is behind its own switch, off by default, and never automatic: no
 * background lookup, no "helpfully" naming every place you save, no request
 * the student did not press a button for.
 *
 * ## Off until it is turned on, and honest about what happens then
 *
 * Nothing here runs unless the student has switched it on, having read a
 * sentence saying what goes where. Off, every existing feature still works
 * exactly as before: you stand somewhere, tap, and name it yourself. That
 * remains the default because it is the one that sends nothing.
 *
 * ## No key, and a provider that says what it wants
 *
 * Nominatim and Photon are both keyless and both run on OpenStreetMap data. A
 * key would mean a shared secret in a static site, which this app has refused
 * everywhere else. Nominatim's usage policy asks for at most one request a
 * second and no bulk querying; `SPACING` holds it to that, and there is no way
 * from the UI to issue a bulk run.
 *
 * ## It never invents a result
 *
 * A search that matches nothing returns nothing, and the screen says so. It
 * does not fall back on a campus centre, on the last thing found, or on the
 * first result of a looser query — a pin dropped in the wrong place is worse
 * than no pin, because a pin is believed.
 */

/** Which keyless service to ask. Both read OpenStreetMap. */
export type Service = 'nominatim' | 'photon';

export const SERVICES: { id: Service; label: string; who: string; home: string }[] = [
  {
    id: 'nominatim',
    label: 'Nominatim',
    who: 'the OpenStreetMap Foundation',
    home: 'https://nominatim.org/',
  },
  {
    id: 'photon',
    label: 'Photon',
    who: 'Komoot, on OpenStreetMap data',
    home: 'https://photon.komoot.io/',
  },
];

/**
 * Least time between two requests, in milliseconds.
 *
 * One a second is what Nominatim's usage policy asks for, and it is a policy
 * rather than a rate limit — exceeding it gets an application blocked rather
 * than throttled. Honouring it in code is the only way it stays honoured.
 */
export const SPACING = 1100;

/** Most results to ask for. A list nobody scrolls is a list that wasted a call. */
export const MOST = 5;

export interface Found {
  /** A short name for the pin — "Alumni Hall". */
  name: string;
  /** The full address as the service returned it. */
  label: string;
  lat: number;
  lon: number;
  /** Which service answered, so a result can be attributed. */
  from: Service;
}

/**
 * A box to prefer results inside.
 *
 * Without one, "Alumni Hall" finds a dozen of them in five countries. The box
 * comes from a place the student has already saved — their own coordinates,
 * not a campus the app guessed at — so a student anywhere gets the same help.
 */
export interface Near {
  lat: number;
  lon: number;
  /** Half-width of the box, in degrees. ~0.1 is roughly seven miles. */
  span: number;
}

export const NEARBY: number = 0.15;

function box(near: Near): [number, number, number, number] {
  // left, top, right, bottom — the order Nominatim's viewbox wants.
  return [near.lon - near.span, near.lat + near.span, near.lon + near.span, near.lat - near.span];
}

/** The request a forward lookup makes, built rather than fetched. */
export function searchUrl(service: Service, query: string, near?: Near): string {
  const q = query.trim();
  if (service === 'photon') {
    const u = new URL('https://photon.komoot.io/api');
    u.searchParams.set('q', q);
    u.searchParams.set('limit', String(MOST));
    if (near) {
      u.searchParams.set('lat', String(near.lat));
      u.searchParams.set('lon', String(near.lon));
    }
    return u.toString();
  }
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('q', q);
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('limit', String(MOST));
  u.searchParams.set('addressdetails', '1');
  if (near) {
    u.searchParams.set('viewbox', box(near).join(','));
    // Preferred, not required: a student looking up a home address two states
    // away should still find it.
    u.searchParams.set('bounded', '0');
  }
  return u.toString();
}

/** The request a reverse lookup makes. */
export function reverseUrl(service: Service, lat: number, lon: number): string {
  if (service === 'photon') {
    const u = new URL('https://photon.komoot.io/reverse');
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lon', String(lon));
    return u.toString();
  }
  const u = new URL('https://nominatim.openstreetmap.org/reverse');
  u.searchParams.set('lat', String(lat));
  u.searchParams.set('lon', String(lon));
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('addressdetails', '1');
  return u.toString();
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Whether a pair of numbers is a place on Earth rather than a parse failure. */
export function onEarth(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * The first line of a long address, for the pin's name.
 *
 * Nominatim returns "Alumni Hall, 2205 West End Avenue, Nashville, Davidson
 * County, Tennessee, 37235, United States" and nobody wants that on a map.
 */
export function shortName(label: string): string {
  const first = label.split(',')[0]?.trim();
  return first || label.trim();
}

/** Nominatim's answer, read into `Found`. Anything unreadable is dropped. */
export function readNominatim(raw: unknown): Found[] {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Found[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const lat = num(r.lat);
    const lon = num(r.lon);
    if (lat === null || lon === null || !onEarth(lat, lon)) continue;
    const label = typeof r.display_name === 'string' ? r.display_name : '';
    if (!label) continue;
    const named = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : shortName(label);
    out.push({ name: named, label, lat, lon, from: 'nominatim' });
  }
  return out;
}

/** Photon's GeoJSON, read into `Found`. */
export function readPhoton(raw: unknown): Found[] {
  const features = (raw as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  const out: Found[] = [];
  for (const f of features) {
    const feature = f as { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    // GeoJSON is [lon, lat]. Getting this the wrong way round puts Nashville
    // in the Indian Ocean, which is exactly the kind of silent wrongness a
    // parse test is for.
    const lon = num(coords[0]);
    const lat = num(coords[1]);
    if (lat === null || lon === null || !onEarth(lat, lon)) continue;
    const p = feature.properties ?? {};
    const parts = [p.name, p.street, p.city, p.state, p.country]
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (parts.length === 0) continue;
    out.push({
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : parts[0],
      label: parts.join(', '),
      lat,
      lon,
      from: 'photon',
    });
  }
  return out;
}

export function read(service: Service, raw: unknown): Found[] {
  return service === 'photon' ? readPhoton(raw) : readNominatim(raw);
}

/**
 * How long to wait before the next request may go out.
 *
 * Kept as a function of two timestamps so the spacing is testable without
 * anything sleeping. Returns 0 when the request may go now.
 */
export function waitFor(lastAt: number, now: number, spacing = SPACING): number {
  if (lastAt <= 0) return 0;
  return Math.max(0, spacing - (now - lastAt));
}

/**
 * What the screen says when there is nothing.
 *
 * Never a fallback pin. A search that matched nothing produces a sentence, not
 * a guess at what was meant — a pin dropped in the wrong place is worse than
 * no pin, because a pin is believed.
 */
export function nothingLine(query: string): string {
  return query.trim()
    ? `Nothing found for “${query.trim()}”. Try the street address, or a nearby junction.`
    : 'Type an address or a building name.';
}

/** What is sent, said in one sentence, for the switch that turns this on. */
export function whatIsSent(service: Service, reverse: boolean): string {
  const who = SERVICES.find((s) => s.id === service)?.who ?? 'the service';
  return reverse
    ? `Your position is sent to ${who} and comes back as an address. Nothing else about you goes with it, and nothing is sent unless you press the button.`
    : `The text you type is sent to ${who} and comes back as coordinates. Nothing else about you goes with it, and nothing is sent unless you search.`;
}

export interface Settings {
  /** Nothing leaves the device until this is true. */
  on: boolean;
  /** Position-to-address, which is the one that sends where you are. */
  reverseOn: boolean;
  service: Service;
}

export const OFF: Settings = { on: false, reverseOn: false, service: 'nominatim' };

/** Stored settings made safe, defaulting to sending nothing. */
export function readSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...OFF };
  const s = raw as Partial<Settings>;
  const known = SERVICES.some((x) => x.id === s.service);
  return {
    on: s.on === true,
    // Reverse cannot be on while the whole thing is off: two switches that can
    // disagree is a way for somebody to believe they turned it off.
    reverseOn: s.on === true && s.reverseOn === true,
    service: known ? (s.service as Service) : 'nominatim',
  };
}
