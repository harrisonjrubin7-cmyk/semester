/**
 * The eight minutes between Buttrick and Furman.
 *
 * A course knows its room as text — "Buttrick 101", "Commons 363A" — and the
 * map knows the places you have stood in and named. The two never met, so a
 * Tuesday with a class ending at 10:00 in one building and another starting
 * at 10:10 in another looked exactly like a Tuesday with both in the same
 * room. It is not, and the difference is the one thing about a timetable a
 * person actually gets caught out by.
 *
 * ## Between two classes, not from wherever you are standing
 *
 * Deliberately no geolocation. The useful question is not "how far am I from
 * my next class" — you generally know — but "is the gap between these two
 * enough", which is a question about the timetable and can be answered before
 * the day starts, at a desk, with the phone in a pocket. It also needs no
 * permission and reveals nothing.
 *
 * ## Where the numbers come from
 *
 * The distance is between two places *you* saved, so it is real rather than
 * geocoded — the app has never geocoded anything and does not start here.
 * A room whose building has no saved place simply produces no estimate, and
 * is counted rather than guessed at.
 *
 * Eighty metres a minute is an unhurried walking pace, about 4.8 km/h. It is
 * on the slow side on purpose: an estimate that says you will make it and is
 * wrong costs more than one that says you will not and is wrong.
 */

import { far, metresBetween, type SavedPlace } from './place';

/** Metres a minute, walking, unhurried and slightly pessimistic. */
export const PACE = 80;

/**
 * Where a block actually is, for reading a building out of.
 *
 * A class block's `meta` reads "Alumni Hall 201 · Dr. Hogue" — the room
 * first, which is what `buildingOf` is written to read. Nothing else on the
 * rail is shaped that way. A commitment's reads "Club sport · Boathouse", its
 * kind first and the place second; an appointment with nowhere stated reads
 * "Added by you"; a deadline reads "CORE 2500 · Reflection". Read as prose,
 * those sent a student walking from Garland to "Club sport", from there to
 * "Added by you", and never once to the Boathouse, which is the only real
 * place among them.
 *
 * So a block that knows its own place says so, `''` included — a commitment
 * with nowhere stated has nowhere to walk to, and belongs in no route at all.
 * The prose is read only where nothing was said, which is the class block it
 * was written for.
 */
function placeText(block: { meta: string; where?: string }): string {
  return block.where ?? block.meta;
}

/**
 * The building out of a room string.
 *
 * "Buttrick 101" is Buttrick; "Commons 363A" is Commons; "Featheringill Hall
 * 134" is Featheringill Hall. The rule is: everything up to the first thing
 * that looks like a room number. A room with no number in it is all building,
 * which is right for "The Wond'ry" and for "Online".
 */
export function buildingOf(room: string): string {
  const cleaned = room.split('·')[0].trim();
  const m = /^(.*?)[\s,]+\d/.exec(cleaned);
  return (m ? m[1] : cleaned).replace(/[,\s]+$/, '').trim();
}

/**
 * The saved place a room is in, if you have named one.
 *
 * Matched on the building, both ways round and case-insensitively, so a place
 * you called "Buttrick" matches "Buttrick Hall 101" and a place called
 * "Buttrick Hall" matches "Buttrick 101". Nothing fuzzier than that: a near
 * miss here would put a walk between two buildings that are not the ones you
 * are walking between.
 */
export function matchPlace(room: string, places: SavedPlace[]): SavedPlace | null {
  const building = buildingOf(room).toLowerCase();
  if (!building) return null;
  return (
    places.find((p) => {
      const label = p.label.trim().toLowerCase();
      if (!label) return false;
      return label === building || label.startsWith(building) || building.startsWith(label);
    }) ?? null
  );
}

/** Minutes to walk a distance. Never less than one, always rounded up. */
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.ceil(metres / PACE));
}

/** How long a thing runs when nothing says. An ordinary teaching hour. */
export const USUAL_CLASS = 50;

export interface Hop {
  /** The block you are leaving and the one you are going to. */
  from: { title: string; meta: string; at: number };
  to: { title: string; meta: string; at: number };
  /** Minutes between the two starting times. */
  apart: number;
  /**
   * Minutes actually free to walk in: the gap, less however long the first
   * one runs.
   *
   * Worked out once, here, rather than by each caller subtracting a fifty it
   * was given as a default. Every caller took that default, so a seventy-five
   * minute seminar was treated as fifty and the walk after it looked
   * twenty-five minutes roomier than it was — in the direction that makes
   * somebody late.
   */
  spare: number;
  /** Metres between the two buildings, where both are saved places. */
  metres: number;
  /** Minutes of walking. Zero when the app cannot say. */
  walk: number;
  /** Whether both ends matched a place you saved. */
  known: boolean;
  /** The two buildings, for a sentence. */
  fromPlace: string;
  toPlace: string;
}

/**
 * Consecutive pairs on a day, with the walk between them.
 *
 * Only where the two buildings differ — a pair of classes in the same room is
 * not a walk, and saying "0 minutes" about it is noise. Only where both ends
 * matched a saved place, and pairs that did not are still returned with
 * `known: false` so a screen can say how many it could not work out rather
 * than pretending there were none.
 */
export function hops(
  blocks: {
    title: string;
    meta: string;
    at: number;
    canceled?: boolean;
    where?: string;
    /** How long this one runs. `USUAL_CLASS` where nothing states it. */
    minutes?: number;
  }[],
  places: SavedPlace[],
): Hop[] {
  const real = blocks.filter((b) => !b.canceled && buildingOf(placeText(b)));
  const out: Hop[] = [];

  for (let i = 0; i < real.length - 1; i += 1) {
    const from = real[i];
    const to = real[i + 1];
    const a = buildingOf(placeText(from));
    const b = buildingOf(placeText(to));
    if (!a || !b || a.toLowerCase() === b.toLowerCase()) continue;

    const pa = matchPlace(placeText(from), places);
    const pb = matchPlace(placeText(to), places);
    const metres = pa && pb ? Math.round(metresBetween(pa, pb)) : 0;

    const apart = to.at - from.at;
    out.push({
      from: { title: from.title, meta: from.meta, at: from.at },
      to: { title: to.title, meta: to.meta, at: to.at },
      apart,
      // The class you are leaving occupies the front of the gap.
      spare: Math.max(0, apart - (from.minutes ?? USUAL_CLASS)),
      metres,
      walk: pa && pb ? walkMinutes(metres) : 0,
      known: Boolean(pa && pb),
      fromPlace: a,
      toPlace: b,
    });
  }

  return out;
}

/**
 * Whether a hop is tight: the walk uses more than the gap leaves.
 *
 * The gap less the class is `hop.spare`, worked out where the class's own
 * length is known. This used to take a `classMinutes` parameter defaulting to
 * fifty, and every caller took the default.
 */
export function tight(hop: Hop): boolean {
  if (!hop.known) return false;
  return hop.walk > hop.spare;
}

/** The sentence a hop earns. Distances and minutes, never advice. */
export function hopLine(hop: Hop): string {
  if (!hop.known) {
    return `${hop.fromPlace} to ${hop.toPlace} — no saved place for one of them, so there is no distance to give.`;
  }
  const spare = hop.spare;
  const walk = `${far(hop.metres)}, about ${hop.walk} ${hop.walk === 1 ? 'minute' : 'minutes'}`;
  if (tight(hop)) {
    return `${hop.fromPlace} to ${hop.toPlace} is ${walk}, and there are ${spare} between them.`;
  }
  return `${hop.fromPlace} to ${hop.toPlace} is ${walk}, inside the ${spare} you have.`;
}

/** How many hops a day has, and how many are tight. For one line on a screen. */
export function daySummary(list: Hop[]): string {
  const known = list.filter((h) => h.known);
  const pressed = known.filter((h) => tight(h));
  if (list.length === 0) return '';
  if (known.length === 0) {
    return `${list.length} ${list.length === 1 ? 'move' : 'moves'} between buildings today, and no saved places to measure them.`;
  }
  if (pressed.length === 0) {
    return `${known.length} ${known.length === 1 ? 'walk' : 'walks'} between buildings today, all of them inside the gap.`;
  }
  return `${pressed.length} of today's ${known.length} walks ${pressed.length === 1 ? 'is' : 'are'} tighter than the gap.`;
}
