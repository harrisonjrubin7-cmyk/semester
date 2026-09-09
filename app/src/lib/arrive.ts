/**
 * Getting there on time, which is the question a campus map is actually asked.
 *
 * The map screen used to answer "where is Buttrick" and stop. The question a
 * student has at 8:52 is a different one — *do I have to leave now* — and it
 * needs three things the app already holds: when the class starts, which
 * building it is in, and where you are standing. This file joins those three
 * up and says a sentence about them.
 *
 * ## Nothing here invents a coordinate
 *
 * A room is text on a syllabus. It becomes a position only when it matches a
 * place *you* saved — the rule `lib/rooms.ts` already uses for the walk
 * between two classes — or when you looked it up on this screen and pressed
 * save. There is no built-in table of campus buildings, because a table of
 * coordinates nobody checked is a set of pins dropped confidently in the
 * wrong place, and a pin is believed. A stop with no coordinate says so and
 * offers to be found; it never guesses.
 *
 * ## Only walking gets an estimate
 *
 * The distance is a straight line, and a straight line is honest about a
 * six-minute walk across a quad and a lie about a drive: roads turn, buses
 * have timetables, and a straight-line "12 minute drive" would be wrong in a
 * way somebody plans around. So the estimate is walking, at the unhurried and
 * deliberately slow pace `lib/rooms.ts` set, and every other mode is handed
 * to the map app that routes properly.
 */

import type { Destination } from './maps';
import { far, metresBetween, type SavedPlace } from './place';
import { buildingOf, matchPlace, walkMinutes } from './rooms';

/**
 * "9:05a", "11:00a" — a time in a sentence.
 *
 * `lib/drag.ts` has a `timeLabel` that drops the minutes on the hour, which is
 * right on an hour grid where the column already says which hour it is and
 * wrong in a line of prose: "leave at 10:52a to make 11a" reads as two
 * different kinds of time. The minutes stay here, so a start written in a
 * sentence matches the one written on the timetable.
 */
export function said(minutes: number): string {
  const whole = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(whole / 60);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(whole % 60).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`;
}

export interface Spot {
  lat: number;
  lon: number;
}

/**
 * Minutes of slack between arriving and starting.
 *
 * A walk ends at a door, and the class is up two flights and along a corridor.
 * Three minutes is the difference between an estimate that gets you into the
 * building and one that gets you into the seat.
 */
export const CUSHION = 3;

export interface Reach {
  /** Straight-line metres. */
  metres: number;
  /** Minutes at walking pace, never under one. */
  minutes: number;
  /** "260 m · about 4 min walk" — the whole thing for one line of a row. */
  line: string;
}

/** How far, and how long on foot. A straight line, and it says so on screen. */
export function reach(from: Spot, to: Spot): Reach {
  const metres = Math.round(metresBetween(from, to));
  const minutes = walkMinutes(metres);
  return { metres, minutes, line: `${far(metres)} · about ${minutes} min walk` };
}

export type StopKind = 'class' | 'room' | 'saved' | 'found';

/**
 * One thing on this screen you might want to get to.
 *
 * A class today, a room from a syllabus, a place you saved, a search result —
 * four sources, one shape, so the map, the list and the directions panel are
 * all looking at the same object rather than at four near-copies of it.
 */
export interface Stop {
  key: string;
  kind: StopKind;
  /** What it is called: "ECON 1020", "Rand Dining Center", "Home". */
  label: string;
  /** The line under it: the room, the OSM detail, the radius. */
  detail: string;
  /** Where it is, when the app honestly knows. Null is a real answer. */
  spot: Spot | null;
  /** What gets handed to the phone's map app. */
  dest: Destination;
  /** The building name, for looking it up and for naming what you save. */
  building: string;
  /** A class's start, in minutes past midnight. */
  at?: number;
  /** How that start is written — "9:05a". */
  time?: string;
  /** The saved place this resolved to, so a row can offer to forget it. */
  placeId?: string;
}

/** A room becomes a stop, taking its coordinates from a place you saved. */
export function roomStop(
  key: string,
  kind: StopKind,
  label: string,
  room: string,
  dest: Destination,
  places: SavedPlace[],
  extra: Partial<Stop> = {},
): Stop {
  const known = matchPlace(room, places);
  return {
    key,
    kind,
    label,
    detail: room,
    building: buildingOf(room),
    spot: known ? { lat: known.lat, lon: known.lon } : null,
    dest: known ? { query: room, lat: known.lat, lon: known.lon } : dest,
    placeId: known?.id,
    ...extra,
  };
}

/** A place you stood in and named. Its coordinates are the best kind there is. */
export function savedStop(place: SavedPlace): Stop {
  return {
    key: `place-${place.id}`,
    kind: 'saved',
    label: place.label,
    detail: `${place.radius} m across`,
    building: place.label,
    spot: { lat: place.lat, lon: place.lon },
    dest: { query: place.label, lat: place.lat, lon: place.lon },
    placeId: place.id,
  };
}

/** A search result, which has coordinates but is not yours until you save it. */
export function foundStop(hit: {
  id: string;
  name: string;
  detail: string;
  kind: string;
  lat: number;
  lon: number;
}): Stop {
  return {
    key: `found-${hit.id}`,
    kind: 'found',
    label: hit.name,
    detail: [hit.kind, hit.detail].filter(Boolean).join(' · '),
    building: hit.name,
    spot: { lat: hit.lat, lon: hit.lon },
    dest: { query: hit.name, lat: hit.lat, lon: hit.lon },
  };
}

export type Urgency = 'later' | 'soon' | 'now' | 'late';

export interface Leaving {
  /** When to set off, in minutes past midnight. */
  at: number;
  /** Minutes until then. Negative means it has gone by. */
  inMinutes: number;
  urgency: Urgency;
  /** The sentence, ready to print. */
  line: string;
}

/**
 * When to leave, and how loudly to say it.
 *
 * The four states are worth keeping apart because they want different words.
 * "Leave at 8:53" is information; "leave now" is an instruction; "you should
 * have left four minutes ago" is neither, but it is true, and a screen that
 * rounded it up to "leave now" would be lying to somebody who is already late
 * and needs to know by how much.
 */
export function leaving(
  nowMinutes: number,
  startsAt: number,
  walk: number,
  cushion = CUSHION,
): Leaving {
  const at = startsAt - walk - cushion;
  const inMinutes = at - nowMinutes;
  const start = said(startsAt);

  if (inMinutes < -1) {
    return {
      at,
      inMinutes,
      urgency: 'late',
      line: `You needed to leave ${-inMinutes} minutes ago to make ${start}.`,
    };
  }
  if (inMinutes <= 1) {
    return { at, inMinutes, urgency: 'now', line: `Leave now to make ${start}.` };
  }
  if (inMinutes <= 15) {
    return {
      at,
      inMinutes,
      urgency: 'soon',
      line: `Leave in ${inMinutes} minutes — ${said(at)} — to make ${start}.`,
    };
  }
  return { at, inMinutes, urgency: 'later', line: `Leave by ${said(at)} to make ${start}.` };
}

/**
 * Stops with a distance attached, nearest first.
 *
 * The ones the app cannot measure keep their order and go last, rather than
 * being dropped or sorted as though they were infinitely far away — a room
 * with no saved building is not far, it is unknown, and the row still wants
 * to be there so it can offer to find it.
 */
export function nearestFirst(stops: Stop[], you: Spot | null): { stop: Stop; reach: Reach | null }[] {
  const measured = stops.map((stop) => ({
    stop,
    reach: you && stop.spot ? reach(you, stop.spot) : null,
  }));
  const known = measured.filter((m) => m.reach);
  const rest = measured.filter((m) => !m.reach);
  known.sort((a, b) => (a.reach?.metres ?? 0) - (b.reach?.metres ?? 0));
  return [...known, ...rest];
}

/**
 * What you have typed, matched against what the app already knows.
 *
 * The old screen sent every search to Nominatim, which is a donated service
 * that asks for a second between requests — so looking for a place you saved
 * last week meant a network round trip, a throttle, and a result list. Your
 * own places and your own rooms are in memory. They answer instantly, they
 * answer offline, and they are almost always what was meant.
 *
 * A word that starts the name beats one that appears in the middle of it, so
 * "ran" finds Rand before it finds the Grand Reading Room.
 */
export function matchStops(stops: Stop[], text: string, limit = 6): Stop[] {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return [];
  const scored: { stop: Stop; score: number }[] = [];
  for (const stop of stops) {
    const label = stop.label.toLowerCase();
    const where = `${stop.detail} ${stop.building}`.toLowerCase();
    const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : where.includes(q) ? 2 : -1;
    if (score >= 0) scored.push({ stop, score });
  }
  scored.sort((a, b) => a.score - b.score);

  // The same building arrives as a class, as a room and as a saved place.
  // One row for it, and because the sort has already run it is the best
  // match of the three that survives rather than whichever came first.
  const out: Stop[] = [];
  const seen = new Set<string>();
  for (const { stop } of scored) {
    const id = `${stop.label.toLowerCase()}|${stop.building.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(stop);
    if (out.length === limit) break;
  }
  return out;
}
