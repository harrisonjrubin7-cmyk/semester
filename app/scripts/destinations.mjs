/*
 * Every destination in the app, read from the app's own registry.
 *
 * Both instruments in this directory walk screens, and until now each decided
 * for itself which ones. They did not agree, and neither said so:
 *
 *   targets-sweep.mjs   57 of the 60 destinations, parsed from nav.ts
 *   contrast-sweep.mjs   6, written out by hand
 *
 * So every contrast figure this repository holds is a figure about six screens
 * out of sixty, printed under a heading that says FINDINGS and nothing beside
 * it about what was never opened.
 * `contrast-audit.js` already argues this case one level down: "a pass that
 * measured nothing is not a pass that found nothing". The same sentence is
 * true of screens, and this is where it gets said.
 *
 * One read, in one place, so the two cannot drift apart again.
 * `src/lib/sweepscreens.test.ts` holds this file to `DESTINATIONS` and holds
 * both sweeps to this file.
 *
 * ## Why a parse and not an import
 *
 * `lib/nav.ts` is TypeScript that imports five other modules and calls into
 * the store's types; node cannot load it and these scripts are plain node.
 * `parseGrounds` in `contrast-sweep.mjs` reads `lib/look.ts` the same way and
 * for the same reason. A parse of a file that moved reads as an empty list,
 * which is why both parsers here throw on a short answer rather than
 * returning one.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Every row of `DESTINATIONS`, in registry order: `{ screen, label }`.
 *
 * Scoped to the array rather than grepping the file, because `nav.ts` also
 * declares `screen: Screen` on the interface and names screens in prose.
 * Entries are split on the array's own indentation, and the two fields are
 * found within an entry rather than next to each other: three destinations
 * carry a `short` or a paragraph of comment between the two, and a pattern
 * that wanted them adjacent silently returned 56 of the 60.
 */
export function destinations() {
  const src = readFileSync(join(here, '..', 'src', 'lib', 'nav.ts'), 'utf8');
  const start = src.indexOf('export const DESTINATIONS');
  if (start < 0) throw new Error('no DESTINATIONS in nav.ts — its shape changed');
  const body = src.slice(start);
  const out = [];
  for (const entry of body.split(/\n {2}\{\n/).slice(1)) {
    const screen = /^\s*screen: '([^']+)'/m.exec(entry);
    const label = /^ {4}label: '((?:[^'\\]|\\.)*)'/m.exec(entry);
    if (!screen || !label) continue;
    out.push({ screen: screen[1], label: label[1].replace(/\\'/g, "'") });
  }
  if (out.length < 40) throw new Error(`parsed only ${out.length} destinations from nav.ts — its shape changed`);
  return out;
}

/**
 * What proves the page is on a screen, where the screen's own heading does not
 * say so by itself.
 *
 * A table of fact, taken by opening all sixty and reading what they drew, not
 * a table of intentions. Seven destinations file under one word in the
 * registry and draw another at the top of the screen — the directory lists
 * "Registration" and the screen says "YES", the directory lists "Add a course"
 * and the screen says "New course". Both are defensible and neither is a
 * sweep's business to change; but a sweep that proves it arrived by reading
 * the heading has to know, or it reports seven reachable screens as unreached.
 *
 * `search` is the one that is proved by something other than a heading. It is
 * not in the registry — it is the workspace's front door, and the tab strip's
 * + lands on it under every navigation (`components/Tabs.tsx`: "`search` is
 * `SearchHome` in every navigation") — so the shell has no row to take a title
 * from and the header falls back to Today's. The screen underneath is really
 * `SearchHome`: its wordmark is what says so.
 *
 * A table rather than a looser match, because a looser match is what would let
 * a real failure through: if a screen ever renders Today because its route
 * quietly fell back, "the heading is non-empty" says fine.
 */
export const PROOF = {
  /*
   * `home` is the one destination whose screen is a function of the
   * *navigation* rather than of `state.screen` — App.tsx says exactly that,
   * and `lib/chrome.ts`'s `homeShape` returns the four shapes it can take.
   * Four shapes, four headings, measured under every navigation rather than
   * reasoned about:
   *
   *     tabs · shelves · workspace   Today
   *     feed                         Everything
   *     springboard                  Semester
   *     guides                       Guides
   *
   * `targets-sweep.mjs` seeds `nav: 'springboard'` deliberately, so it draws
   * the third of those — and an arrival check holding the screen to the
   * registry's label alone read "Semester", called it a screen it had not
   * reached, and skipped it. One destination of the fifty-eight dropped
   * silently out of that walk, by the check written to stop screens being
   * dropped silently. Its own run is what caught it: `57 of 58 destinations
   * opened, 1 not reached: home (saw "Semester")`, which is the line this
   * table exists to make readable.
   *
   * A list rather than "any non-empty heading", for the reason under it: a
   * screen that falls back to Today has to fail, and three of these four are
   * the headings it would fall back *to*.
   */
  home: { h1: ['Today', 'Everything', 'Semester', 'Guides'] },
  equations: { h1: 'Equations' },
  import: { h1: 'New course' },
  yes: { h1: 'YES' },
  connect: { h1: 'Connect' },
  data: { h1: 'Your data' },
  privacy: { h1: 'Privacy' },
  help: { h1: 'Guide' },
  search: { css: '.deskhome-mark' },
};

/** The selector that proves this screen, where a heading will not do it. */
export function proofSelector(screen) {
  return PROOF[screen]?.css ?? null;
}

/**
 * Did the page arrive at this screen?
 *
 * `seen` is what the page was asked for: `{ h1, css }`, the heading text and
 * whether `proofSelector`'s element is there. A screen may have more than one
 * heading it legitimately draws — see `home` above — and then any of them is
 * an arrival and nothing else is. Read from what was rendered,
 * never from `location.hash` — the hash is the value the sweep just wrote, and
 * a check that reads back its own write is mistake 2 in
 * `contrast-sweep.mjs`'s header: it agrees with itself on every pass,
 * including the passes where nothing happened.
 */
export function arrived(screen, label, seen) {
  const want = PROOF[screen];
  if (want?.css) return Boolean(seen?.css);
  const headings = want?.h1 === undefined ? [label] : [want.h1].flat();
  const got = String(seen?.h1 ?? '').trim().toLowerCase();
  return headings.some((h) => String(h).trim().toLowerCase() === got);
}
