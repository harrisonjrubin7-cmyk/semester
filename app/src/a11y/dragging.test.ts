import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { boardLists } from '../lib/springboard';
import { shelfLists } from '../lib/launcher';
import type { Capabilities } from '../lib/school';

/**
 * What a drag does, a single pointer can do without dragging.
 *
 * WCAG 2.2 asks for this at 2.5.7, and the reason is not the criterion. A
 * drag is a press held still enough to travel — and a tremor, a head pointer
 * or an eye tracker can put a pointer exactly where it needs to go and cannot
 * hold it there while moving. On a tablet there is no keyboard either, so Alt
 * with the arrow keys, which this app has had all along, is an answer for a
 * laptop and not for the device most of this app is used on.
 *
 * Three of the app's five orderings already had one, all three by way of the
 * `Reorder` arrows: the courses, the tab bar, and Today's sections — that last
 * on the settings page rather than on Today, which is the shape the other two
 * now follow.
 */
function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

const FILES = tsx('src').map((f) => ({ file: f, src: readFileSync(f, 'utf8') }));

/** The five names under which this app stores an order. */
const ORDERINGS = ['setCourseOrder', 'setTabs', 'setFeedOrder', 'boardOrder', 'groupOrder'];

/** Which orderings a stretch of source writes. */
const writes = (text: string) => ORDERINGS.filter((o) => text.includes(o));

describe('every ordering that can be dragged', () => {
  /*
   * Followed from the handler, through one hop.
   *
   * Two weaker versions of this rule went in first and both were useless, in
   * the way a rule is worst: they passed. Reading the name of an order out of
   * each `onMove` and each `<Reorder>` found three of five, because both sides
   * hand off — `set(...)` in the tab chooser, `arrange(...)` on the
   * springboard, `moveOnShelf(...)` on the settings page. Widening to "does
   * the file mention it" then passed even with the whole shelves section
   * deleted, because the helper it called was still sitting there unused.
   *
   * So: take the handler's text, find the helpers it names, and read their
   * bodies too. One hop is enough for every case here and stops well short of
   * writing an interpreter.
   */
  function reach(text: string, src: string): string[] {
    const named = [...text.matchAll(/\b([a-z][A-Za-z0-9]*)\(/g)].map((m) => m[1]);
    const bodies = named.map((fn) => {
      const decl = new RegExp(`(?:const|function) ${fn}\\b[\\s\\S]{0,700}`).exec(src);
      return decl ? decl[0] : '';
    });
    return writes([text, ...bodies].join('\n'));
  }

  const from = (open: RegExp) =>
    new Set(
      FILES.flatMap(({ src }) => [...src.matchAll(open)].flatMap((m) => reach(m[0], src))),
    );

  /** Everything a drag can rearrange: `useMovable` is the app's one drag. */
  const draggable = from(/useMovable[\s\S]{0,700}?\n\s{2}\}\)/g);
  /** And everything the arrows can. */
  const tappable = from(/<Reorder[\s\S]{0,700}?\/>/g);

  it('is a set this test still recognises', () => {
    // Guards both assertions: a rename that made either set empty would
    // otherwise pass everything below without a single list being movable.
    expect(draggable.size, `found: ${[...draggable]}`).toBeGreaterThanOrEqual(4);
    expect(tappable.size, `found: ${[...tappable]}`).toBeGreaterThanOrEqual(4);
  });

  it('can also be rearranged by tapping', () => {
    const dragOnly = [...draggable].filter((o) => !tappable.has(o));
    expect(dragOnly, 'an order a pointer can only reach by dragging').toEqual([]);
  });
});

describe('the lists the settings page draws', () => {
  // A school with everything switched on, so every list is at full length —
  // the same fixture `springboard.test.ts` uses next door.
  const caps: Capabilities = {
    mealPlan: 'both',
    housing: true,
    campusMap: true,
    registrarUrl: 'https://yes.example',
    orgPortalUrl: 'https://link.example',
  };

  it('names every list the home screen stores separately', () => {
    const lists = boardLists(caps, undefined);
    // A page, a folder on it, and the dock are three keys, for the reason
    // `pageKey` gives: a screen can sit on two pages and inside a folder.
    expect(lists.some((l) => /^p\d+$/.test(l.key))).toBe(true);
    expect(lists.some((l) => l.key === 'dock')).toBe(true);
    expect(lists.some((l) => l.key.startsWith('+'))).toBe(true);
    for (const l of lists) expect(l.label).toBeTruthy();
  });

  it('leaves out a list of one, which no arrow could move', () => {
    for (const l of boardLists(caps, undefined)) expect(l.items.length).toBeGreaterThan(1);
    for (const l of shelfLists(caps, undefined)) expect(l.items.length).toBeGreaterThan(1);
  });

  it('gives every row a name, since the arrows are labelled from it', () => {
    const lists = [
      ...boardLists(caps, undefined).map((l) => ({ named: l.key, items: l.items })),
      ...shelfLists(caps, undefined).map((l) => ({ named: l.group, items: l.items })),
    ];
    for (const l of lists) {
      for (const item of l.items) {
        expect(item.label, `${l.named} has an unnamed row`).toBeTruthy();
        expect(item.label).not.toBe(item.id);
      }
    }
  });

  it('follows the order that was saved', () => {
    const first = boardLists(caps, undefined)[0];
    const flipped = [first.items[1].id, first.items[0].id];
    const saved = `${first.key}:${flipped.join(',')}`;
    const after = boardLists(caps, saved)[0];
    expect(after.items.slice(0, 2).map((i) => i.id)).toEqual(flipped);
  });
});
