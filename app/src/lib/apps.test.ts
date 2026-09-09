import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { appCount, appShelves } from './apps';
import { glyphFor } from '../components/icons.pick';
import { GROUPS, offered, saysFor, shortFor } from './nav';
import { writeOrder } from './launcher';
import type { Capabilities } from './school';
import type { Screen } from './types';

/**
 * The launcher the header button opens.
 *
 * Its whole claim is that it is *everything* — the reason it is worth a
 * permanent button is that you can stop wondering whether the thing you are
 * looking for is in it. A grid that quietly misses a screen is worse than no
 * grid, because it teaches somebody that the app does not have something it
 * does have, and nothing on screen would ever say so.
 *
 * So: every screen this school offers, exactly once, no matter what state the
 * saved arrangement is in.
 */

const CAPS: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };
const FULL: Capabilities = { mealPlan: 'swipes', housing: true, campusMap: true };

const flat = (caps: Capabilities, saved?: string) =>
  appShelves(caps, saved).flatMap((shelf) => shelf.apps.map((d) => d.screen));

describe('the app launcher', () => {
  it('holds every screen this school offers, once each', () => {
    const shown = flat(FULL);
    expect([...shown].sort()).toEqual(offered(FULL).map((d) => d.screen).sort());
    expect(new Set(shown).size).toBe(shown.length);
  });

  it('leaves out what the school has no equivalent of', () => {
    const shown = new Set(flat(CAPS));
    for (const d of offered(FULL)) {
      if (!offered(CAPS).some((o) => o.screen === d.screen)) {
        expect(shown.has(d.screen), `${d.screen} is not offered here`).toBe(false);
      }
    }
    // And the gate has actually gated something, or the check above passes on
    // an empty list and says nothing.
    expect(offered(CAPS).length).toBeLessThan(offered(FULL).length);
  });

  it('counts what it shows', () => {
    const shelves = appShelves(FULL, undefined);
    expect(appCount(shelves)).toBe(flat(FULL).length);
  });

  it('draws the shelves in the registry’s order and never an empty one', () => {
    const shelves = appShelves(FULL, undefined);
    expect(shelves.map((s) => s.group)).toEqual(
      GROUPS.filter((g) => shelves.some((s) => s.group === g)),
    );
    for (const shelf of shelves) expect(shelf.apps.length).toBeGreaterThan(0);
  });

  /*
   * The arrangement is a preference over the registry, never a replacement —
   * `launcher.test.ts` holds that for the folders and this holds that the
   * launcher inherited it rather than reading the registry raw. A student who
   * dragged Export to the front of Data should see it at the front here too,
   * and a saved order naming a screen that no longer exists should cost them
   * nothing.
   */
  it('follows the order the tiles were dragged into', () => {
    const data = appShelves(FULL, undefined).find((s) => s.group === 'Data')!;
    const last = data.apps[data.apps.length - 1].screen;
    const moved = appShelves(FULL, writeOrder({ Data: [last] }))!.find((s) => s.group === 'Data')!;
    expect(moved.apps[0].screen).toBe(last);
    expect(moved.apps.map((d) => d.screen).sort()).toEqual(
      data.apps.map((d) => d.screen).sort(),
    );
  });

  it('is unharmed by an order full of screens that are gone', () => {
    const stale = writeOrder({ Data: ['nowhere', 'gone'] as unknown as Screen[] });
    expect(flat(FULL, stale).sort()).toEqual(flat(FULL).sort());
  });

  /*
   * Vanderbilt calls its registrar YES. The launcher shipped printing
   * "Register" there, because the tile takes `short` — an abbreviation of the
   * *registry's* label — before the name the school actually uses, and `yes`
   * has both. Checked through `shortFor`, which is what the grid renders,
   * rather than through `saysFor`, which is what the first version of this
   * test checked and what made the bug invisible.
   */
  it('says a screen the way this school says it, short label or not', () => {
    const named: Capabilities = { ...FULL, registrarName: 'YES', registrarUrl: 'https://example.edu' };
    const yes = appShelves(named, undefined)
      .flatMap((s) => s.apps)
      .find((d) => d.screen === 'yes')!;
    expect(yes.short, 'the case only bites where there is a short label').toBe('Register');
    expect(saysFor(yes, named).label).toBe('YES');
    expect(shortFor(yes, named)).toBe('YES');
  });

  it('still cuts a long name down where the school has not renamed it', () => {
    const yes = appShelves(FULL, undefined)
      .flatMap((s) => s.apps)
      .find((d) => d.screen === 'brief')!;
    expect(shortFor(yes, FULL)).toBe('Report');
  });

  it('renders the name it was handed, not the registry’s short one', () => {
    // `AppGrid` is the grid both this and the Tools tab draw. The order of
    // that fallback is the whole of the bug above.
    const grid = readFileSync('src/components/nav/AppGrid.tsx', 'utf8');
    expect(grid).toMatch(/said\?\.label \?\? d\.short \?\? d\.label/);
  });
});

/*
 * The thing that makes a grid worth having, and the thing that quietly stops
 * being true.
 *
 * Icons earn their place by being told apart at a glance — that is the whole
 * of the argument for drawing fifty screens rather than listing them. Half
 * the app used to borrow its shelf's glyph, which was invisible while nothing
 * showed them all at once and became five identical pairs of rectangles under
 * five different words the moment something did.
 *
 * A screen added next term inherits the same fallback silently. This is what
 * says so.
 */
describe('the icons in the grid', () => {
  const CAPS_ALL: Capabilities = {
    ...FULL,
    registrarUrl: 'https://example.edu',
  };

  it('gives no two screens on a shelf the same drawing', () => {
    for (const shelf of appShelves(CAPS_ALL, undefined)) {
      const seen = new Map<unknown, string>();
      for (const d of shelf.apps) {
        const glyph = glyphFor(d.screen);
        const already = seen.get(glyph);
        expect(
          already,
          `${shelf.group}: ${d.screen} draws the same glyph as ${already} — one of them needs its own, in icons.data.ts`,
        ).toBeUndefined();
        seen.set(glyph, d.screen);
      }
    }
  });
});

/*
 * What the sheet covers, which is not the same box on both layouts.
 *
 * `absolute` fills `.device`, and on a phone `.device` is the app. On a desk
 * it is a strip beside the rail — so the sheet covered the strip, and the rail
 * stayed lit and clickable behind a dialog declaring `aria-modal="true"`.
 * Tapping Courses there navigated the screen underneath while the sheet stayed
 * over it, and a screen reader was told the rail was not there while it was.
 *
 * `Command` reached this conclusion first and switches to `fixed` at the same
 * width; `a11y/modal.ts` argues the Tab half of the same promise. jsdom has no
 * layout and no media queries, so the rule is held on the stylesheet.
 */
describe('what the sheet covers', () => {
  const css = () => readFileSync('src/styles/app.css', 'utf8');

  it('covers the window rather than the pane once the rail appears', () => {
    const at = /@media \(min-width: 760px\) \{([\s\S]*?)\n\}/g;
    const blocks = [...css().matchAll(at)].map((m) => m[1]);
    const folder = blocks.find((b) => /\.soft-folder \{/.test(b));
    expect(folder, 'no 760px rule for .soft-folder — the rail is live behind it').toBeDefined();
    expect(folder).toMatch(/position:\s*fixed/);
  });

  it('draws its content as a column there, not a grid stretched over a laptop', () => {
    const at = /@media \(min-width: 760px\) \{([\s\S]*?)\n\}/g;
    const blocks = [...css().matchAll(at)].map((m) => m[1]);
    expect(blocks.some((b) => /\.soft-folder-body/.test(b) && /max-width/.test(b))).toBe(true);
  });
});

/*
 * And the button that opens it, which is the half of the feature a unit test
 * cannot see. It is in the header — one header, drawn on every screen — and
 * it is deliberately outside the `atRoot` gate that hides Alerts and Me on an
 * inner screen: the case this exists for is being three levels into a course
 * and wanting the practice paper, which is exactly where those two are gone.
 */
describe('the button in the header', () => {
  const src = () => readFileSync('src/App.tsx', 'utf8');

  it('opens the launcher from every screen, not only a root one', () => {
    const button = /aria-label="All apps"/.exec(src());
    expect(button, 'the All apps button has gone from the header').not.toBeNull();
    // The three action buttons that are always drawn sit before the `atRoot`
    // block; the two gated ones after it. This one must be in the first half.
    const at = src().indexOf('aria-label="All apps"');
    const gate = src().indexOf('{atRoot && (');
    expect(gate).toBeGreaterThan(-1);
    expect(at, 'All apps must not be gated on being at a root screen').toBeLessThan(gate);
  });

  it('is mounted wherever the search overlay is', () => {
    /*
     * The phone and the wide pane are two separate trees in `App.tsx`, and an
     * overlay added to one of them only is how the search screen and the
     * search overlay came to be two different things — you got whichever one
     * your window was wide enough for.
     *
     * Counting the mounts would not catch that: the first attempt at this
     * change put both of its copies in the wide tree, which counts as two and
     * left the phone with a button that did nothing. So the check is the
     * invariant itself — every place `Command` is mounted, this is too.
     */
    const lines = src().split('\n');
    const search = lines.flatMap((l, i) => (/<Command onClose=/.test(l) ? [i] : []));
    expect(search.length, 'both layouts mount the search overlay').toBe(2);
    for (const at of search) {
      const near = lines.slice(Math.max(0, at - 6), at + 7).join('\n');
      expect(near, 'a layout that can search but cannot open the launcher').toMatch(
        /<AllApps onClose=/,
      );
    }
  });
});
