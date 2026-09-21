/**
 * A course, taken offline before the bus leaves.
 *
 * The app has had an offline promise since `public/sw.js` was written: audio,
 * decks and handouts are cached on first play and kept, so a lesson works on a
 * walk and a drill works on a plane. What it has never had is a way to fill
 * that cache *on purpose*. Everything in it arrived because somebody happened
 * to open it while they still had signal, which is the one condition a student
 * on a bus to an away fixture does not have.
 *
 * So this is not a new offline system. It is the existing one, asked ahead of
 * time: fetch the files, let the worker cache them exactly as it caches a file
 * somebody pressed play on, and report what landed.
 *
 * ## It only offers files that exist
 *
 * `lib/handout.ts` already carries the list of courses with a .pdf and a .pptx
 * built for them, and says why: `pipeline/handout.py` runs on a laptop against
 * the four sample courses, so a course imported from a syllabus has no files
 * on that server and never will. A pack that queued them anyway would download
 * four 404s and call it a study pack. Lessons and podcast editions come from
 * the course's own data instead, which is the only place that knows whether a
 * recording exists — and an edition marked `ready: false` is not one.
 *
 * ## Every failure is named
 *
 * `lib/bundle.ts`'s rule, for the same reason: a pack that quietly lost half
 * its contents is how somebody boards a flight with three of five readings and
 * no idea which two are missing. Each file comes back as landed or as a reason,
 * and the screen shows the reasons.
 */

import type { Catalog } from '../data/catalog';
import { asset } from './asset';
import { runsOver } from './athletics';
import { describe, type Kind } from './downloads';
import { hasPrebuiltDeck, hasPrebuiltDocs } from './handout';
import type { CourseId } from './types';

/** One file a pack would fetch. */
export interface PackFile {
  /** The path from the site root, as the data writes it. `asset()` is applied at fetch. */
  path: string;
  /** How it reads in a list — "Unit 3 · Elasticity". */
  label: string;
  kind: Kind;
  course: CourseId;
}

/** A file that did not land, and what went wrong. Never silent. */
export interface PackMiss {
  file: PackFile;
  why: string;
}

export interface PackResult {
  got: PackFile[];
  missed: PackMiss[];
  /** Bytes fetched, from the responses themselves. */
  bytes: number;
}

/**
 * The courses a trip actually runs over.
 *
 * Classes in those days and deadlines falling inside them — `runsOver` in
 * `lib/athletics.ts`, which the absence email is built from too, so the pack
 * and the letter cannot disagree about which courses a trip touches. The pack
 * is therefore built from the conflict the student is already looking at
 * rather than from every course they are enrolled in: somebody missing two of
 * four classes does not want four courses' audio on a phone.
 *
 * Days come in as `YYYY-MM-DD`, from `eventDays`.
 */
export function coursesInDays(catalog: Catalog, days: string[], now: Date): CourseId[] {
  return runsOver(catalog, days, now).map((m) => m.course);
}

/**
 * Everything downloadable for one course, in the order somebody would work
 * through it: the narrated units first, then the podcast, then the written
 * material.
 */
export function packFor(catalog: Catalog, courses: CourseId[]): PackFile[] {
  const out: PackFile[] = [];
  for (const id of courses) {
    const mod = catalog.modules.find((m) => m.course.id === id);
    if (!mod) continue;

    const lessons = Object.values(mod.lessons ?? {}).sort((a, b) => a.unit - b.unit);
    for (const lesson of lessons) {
      if (!lesson.file) continue;
      out.push({
        path: lesson.file,
        label: lesson.title || `Unit ${lesson.unit + 1}`,
        kind: describe(lesson.file).kind,
        course: id,
      });
    }

    for (const edition of mod.podcast?.editions ?? []) {
      // `ready` is the course's own word for "this recording exists". An
      // edition that is not ready has a path and no file behind it.
      if (!edition.ready || !edition.file) continue;
      out.push({
        path: edition.file,
        label: `${edition.label} · ${edition.len}`,
        kind: describe(edition.file).kind,
        course: id,
      });
    }

    if (hasPrebuiltDeck(id)) {
      out.push({ path: `/decks/${id}.pptx`, label: 'Slides', kind: 'deck', course: id });
    }
    if (hasPrebuiltDocs(id)) {
      out.push({ path: `/handouts/${id}.pdf`, label: 'Handout', kind: 'handout', course: id });
    }
  }
  return out;
}

/**
 * Fetch the pack, so the worker caches it.
 *
 * Sequential rather than parallel, deliberately. These are 3-to-20 MB audio
 * files on whatever connection a student has in a dorm the night before a
 * trip; twelve at once is a stall with no progress, and the whole value of
 * this screen is watching the count go up. `onDone` fires per file so the
 * caller can say where it is.
 *
 * `cache: 'no-store'` is *not* used, which is the point: the request has to
 * reach the service worker's fetch handler exactly as a play would, so the
 * response lands in the media cache under the same rules and the same cap.
 */
export async function fetchPack(
  files: PackFile[],
  opts: {
    onDone?: (done: number, total: number) => void;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
  } = {},
): Promise<PackResult> {
  const call = opts.fetcher ?? fetch;
  const got: PackFile[] = [];
  const missed: PackMiss[] = [];
  let bytes = 0;

  for (const [n, file] of files.entries()) {
    if (opts.signal?.aborted) {
      missed.push({ file, why: 'Stopped before this one.' });
      continue;
    }
    try {
      const res = await call(asset(file.path), { signal: opts.signal });
      if (!res.ok) {
        missed.push({ file, why: `The server answered ${res.status}.` });
      } else {
        // Read the body. A response left unread is a response the cache may
        // never receive, and the size is wanted anyway.
        const blob = await res.blob();
        bytes += blob.size;
        got.push(file);
      }
    } catch (e) {
      missed.push({
        file,
        why: opts.signal?.aborted ? 'Stopped before this one.' : ((e as Error).message || 'Could not be fetched.'),
      });
    }
    opts.onDone?.(n + 1, files.length);
  }

  return { got, missed, bytes };
}

/** "24 MB", "870 KB" — a size as somebody would say it. */
export function showBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
