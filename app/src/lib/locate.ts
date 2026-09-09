/**
 * Filling in a semester's buildings, once, in one tap.
 *
 * The map can measure a walk, say when to leave and draw a pin only for a
 * building it has a coordinate for, and it gets those from places you saved.
 * That left a new install with none of it: eight rooms across four syllabi,
 * each needing you to either stand in the doorway or search for it by hand.
 * A feature nobody can use until they have done eight things first is a
 * feature nobody uses.
 *
 * ## Why this rather than a table shipped with the app
 *
 * The obvious fix is a list of campus buildings compiled into the app. It was
 * not done, and the reason is the same one written across `place.ts` and
 * `maps.ts`: a coordinate nobody checked is a pin dropped confidently in the
 * wrong place, and a pin is believed. A hand-written table is also wrong for
 * every student who is not at the campus it was written for, and stale the
 * first time a department moves.
 *
 * So the buildings are looked up rather than remembered — from OpenStreetMap,
 * on the device, at the moment you ask — and what comes back is shown to you
 * before it is kept. That works at any university, needs no maintenance, and
 * nothing in it was invented here.
 *
 * ## It asks before it keeps
 *
 * Every result is displayed with what OpenStreetMap called it and whether it
 * landed near campus, and anything that missed can be dropped before saving.
 * A result outside the campus box is kept out of the "keep" set by default:
 * "Garland" is a building here and a road in three other counties, and the
 * difference between those two is a bus ride.
 *
 * ## It is polite to the service it uses
 *
 * Nominatim runs on donated hardware and asks for at most one request a
 * second. `findPlaces` in `findplace.ts` already holds to that with a promise
 * chain, so a run of eight buildings takes about nine seconds and issues them
 * in order rather than in a burst. Nothing here loops on its own: the run is
 * bounded by the number of buildings your syllabi name.
 */

import type { Stop } from './arrive';
import { BOXES, type Found, type Scope } from './findplace';

/**
 * The buildings a semester names that the app cannot place yet.
 *
 * Deduplicated case-insensitively and in the order they first appear, so
 * "Garland" and "Garland 162" — the same building written twice — are one
 * lookup rather than two, and the list reads in the order of your day.
 */
export function unplaced(stops: Stop[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const stop of stops) {
    if (stop.spot) continue;
    const name = stop.building.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Whether a coordinate is inside one of the boxes searches are biased to. */
export function inside(lat: number, lon: number, scope: Scope = 'campus'): boolean {
  const [w, n, e, s] = BOXES[scope];
  return lat <= n && lat >= s && lon >= w && lon <= e;
}

export interface Candidate {
  /** What the syllabus calls it, which is also what gets saved. */
  building: string;
  /** The result being offered, or nothing when the search found none. */
  hit: Found | null;
  /** Whether it landed inside the campus box. */
  near: boolean;
  /** Whether it is ticked — a miss and a far result both start unticked. */
  keep: boolean;
  /** The evidence, in one line: what OSM called it and where it put it. */
  line: string;
}

/**
 * One building's search results, turned into something to say yes or no to.
 *
 * The first result inside the campus box wins; failing that the first result
 * at all, marked as being off campus and left unticked. Nominatim orders by
 * its own relevance and the box only biases that order, so a building really
 * does sometimes come back second — but a result from another county is a
 * different answer, not a worse one, and it does not get ticked by default.
 */
export function judge(building: string, hits: Found[], scope: Scope = 'campus'): Candidate {
  if (hits.length === 0) {
    return {
      building,
      hit: null,
      near: false,
      keep: false,
      line: 'Nothing by that name — search for it yourself above.',
    };
  }
  const onCampus = hits.find((h) => inside(h.lat, h.lon, scope));
  const hit = onCampus ?? hits[0];
  const near = Boolean(onCampus);
  return {
    building,
    hit,
    near,
    keep: near,
    line: near
      ? [hit.name, hit.detail].filter(Boolean).join(' · ')
      : `${[hit.name, hit.detail].filter(Boolean).join(' · ')} — outside campus, so check it`,
  };
}

/** What the button says before it is pressed. */
export function fillLine(count: number): string {
  if (count === 0) return 'Every building this semester names is on the map.';
  return count === 1
    ? 'One building this semester has no place on the map yet.'
    : `${count} buildings this semester have no place on the map yet.`;
}

/** What the run says while it is going, so a slow search looks like progress. */
export function progressLine(done: number, total: number): string {
  return `Looking up ${Math.min(done + 1, total)} of ${total}…`;
}

/** How the result of a run reads once every building has been asked about. */
export function foundLine(candidates: Candidate[]): string {
  const hits = candidates.filter((c) => c.hit).length;
  const missed = candidates.length - hits;
  if (hits === 0) return 'None of them could be found by name.';
  const found = `${hits} of ${candidates.length} found`;
  return missed === 0 ? `${found}. Untick anything that looks wrong.` : `${found}; ${missed} not.`;
}
