import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { headerRow } from './header';
import { chromeFor } from './chrome';

/**
 * No two controls in one frame do the same job.
 *
 * `lib/chrome.ts` holds the invariant one level up — never two *navigations*
 * on screen together — and says in its own words that the header is not its
 * business, because the header belongs to the screen you are on. That was
 * true and it left a gap. The workspace draws three pieces of chrome at once,
 * a bar across the top, a column down the side and the header inside the
 * pane, and nothing ever compared their contents.
 *
 * They overlapped on five controls. Three had been noticed and dropped behind
 * a flag; the flag was a list written against the bar's *tools cluster* and
 * never checked against the rest of the layout, so the header went on drawing
 * a magnifier one row under the bar's search field and a `+` a few inches from
 * the sidebar's New button. On Alerts — a screen you cannot add to and would
 * not search from — that was the entire header.
 *
 * A route census cannot see this. It counts pathways over time: you can reach
 * Settings from here and also from there, which costs nothing while you are
 * not using either. Two buttons visible at once cost a decision every time you
 * look at the screen. So this is the census of what is *co-present*, and it is
 * a test rather than a paragraph because the fault it holds is invisible in a
 * type check, in a screenshot at one width, and in every other test here.
 */

const read = (f: string) => readFileSync(f, 'utf8');

/** The workspace's three pieces of chrome, as source. */
const BAR = () => read('src/components/desk/TopBar.tsx');
const SIDE = () => read('src/components/desk/Sidebar.tsx');

/**
 * What each jobs looks like in source.
 *
 * Matched on the dispatch rather than on the label, because a label is what
 * drifts and the dispatch is what the button actually does — two rows can be
 * called different things and still land you in the same place, which is the
 * half of this fault that a reading of the screenshots would miss.
 */
const JOBS: Record<string, RegExp> = {
  'the capture box': /type: 'quickAdd', open: true/,
  'the palette': /type: 'finder', open: true/,
  'the search home': /screen: 'search'/,
  'Settings': /screen: 'settings'/,
  'Alerts': /screen: 'notifs'/,
  'your profile': /screen: 'profile'/,
  'the launcher': /type: 'apps', open/,
};

describe('the workspace draws each job once', () => {
  for (const [job, mark] of Object.entries(JOBS)) {
    it(`does not put ${job} in both the bar and the sidebar`, () => {
      const inBoth = mark.test(BAR()) && mark.test(SIDE());
      expect(inBoth, `${job} is drawn twice, in one frame`).toBe(false);
    });
  }

  /*
   * And the third piece, which is the one that was wrong. The header's five
   * are decided by `headerRow`, so this asks the rule rather than the markup
   * — the markup asking the rule is `header.test.ts`'s business.
   */
  const AT_ROOT = { atRoot: true, phone: false, counting: false };

  it('leaves the header nothing the bar already carries', () => {
    const row = headerRow({ ...AT_ROOT, desk: true, sidebar: false });
    // The bar draws its field at every width, and its four tools beside it.
    expect(row.search, 'the bar has a search field').toBe(false);
    expect(row.apps, 'the bar has the nine dots').toBe(false);
    expect(row.alerts, 'the bar has the bell').toBe(false);
    expect(row.avatar, 'the bar has the avatar').toBe(false);
  });

  it('leaves the header nothing the sidebar already carries', () => {
    expect(headerRow({ ...AT_ROOT, desk: true, sidebar: true }).add, 'the sidebar has New').toBe(
      false,
    );
  });

  /*
   * Nothing becomes unreachable, which is the other half of every cut above.
   *
   * The sidebar is `desk && wide`, so the narrow workspace has no column —
   * and there the header's `+` is the only pointing route to the capture box
   * and has to stay. This is the case a rule written as `!desk` would have
   * got wrong, and the reason `headerRow` takes both facts.
   */
  it('keeps the one control the narrow workspace has nowhere else', () => {
    const narrow = chromeFor('workspace', 'notifs', false);
    expect(narrow.sidebar, 'a narrow workspace draws no sidebar').toBe(false);
    expect(headerRow({ ...AT_ROOT, desk: true, sidebar: narrow.sidebar }).add).toBe(true);
    expect(SIDE(), 'and the column it is standing in for is where New lives').toMatch(
      /type: 'quickAdd', open: true/,
    );
  });
});

/**
 * One name, one place.
 *
 * Distinct from the census above, and the reason it is separate: these two
 * controls are *not* duplicates — the bar's nine dots open the launcher and
 * the sidebar's row opens the directory screen — but for a while they were
 * both called "All apps", in one frame, going to two different places. A
 * screen reader read them out identically. That is worse than a duplicate,
 * because pressing one is the only way to find out which you had.
 */
describe('two controls in one frame never share a name', () => {
  it('keeps the launcher and the directory separately named', () => {
    expect(BAR(), 'the nine dots are the launcher').toContain('aria-label="All apps"');
    expect(SIDE(), 'so the row that opens the directory must not be').not.toContain("'All apps'");
    expect(SIDE()).toContain("'App directory'");
  });
});
