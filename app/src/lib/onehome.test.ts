import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';

/**
 * One home per screen, as a test rather than as a habit.
 *
 * `SIMPLIFY-AUDIT.md` sections 1 and 2 hunt duplicate screens by reading
 * `lib/nav.ts` and grepping `dispatch({ type: 'go' })`. Neither finds the
 * duplicate this guards: a screen rendered *inside another screen's tab*.
 * That adds no destination and no `go`, so both greps come back clean while
 * the app quietly has two doors onto one room.
 *
 * The app had two — Today's "Report" tab was the Reports screen and Courses'
 * "Grades" tab was the Grades screen — and Progress had a third before it, a
 * Settings tab that was the settings index. All three were built the same way,
 * and the way is what this catches.
 *
 * ## Why `bare` is the thing being banned
 *
 * A screen owns its frame: `<Page>` draws the padding, the header and the
 * space above the tab bar. Embedding one inside another means two frames on
 * one screen, so every attempt at this grew the same escape hatch — a `bare`
 * prop taking a second render path with the `<Page>` left off. The prop is not
 * incidental to the mistake, it is what the mistake needs in order to compile.
 *
 * So the rule is narrow on purpose. It does not try to detect "screen imports
 * screen", which has honest uses: `FirstRun` is rendered by fourteen screens
 * as an empty state, and `Reports` is composed from `report/Day`, `report/Week`
 * and `report/Term`. Those are components that happen to live under `screens/`.
 * A frameless second copy of a whole destination is not, and it is the only
 * thing failed here.
 */

const SCREENS = join(process.cwd(), 'src', 'screens');

/** `bare` in a prop position, not the `className="bare"` the app styles with. */
const DECLARES = /\bbare\s*[=?:]/;
const PASSES = /<[A-Z]\w*\s[^>]*(?<!["'\w-])bare(?![\w"'-])/;

describe('no screen is a tab of another screen', () => {
  it('declares no bare render path', () => {
    const offenders = sources(SCREENS)
      .filter((f) => DECLARES.test(withoutComments(f.text)))
      .map((f) => f.path.slice(f.path.indexOf('/screens/') + 1));
    // Named, not counted: a failure has to say which screen grew the second
    // path, or the next person greps for `bare` across 57 files by hand.
    expect(offenders).toEqual([]);
  });

  it('renders no other screen bare', () => {
    const offenders = sources(SCREENS)
      .filter((f) => PASSES.test(withoutComments(f.text)))
      .map((f) => f.path.slice(f.path.indexOf('/screens/') + 1));
    expect(offenders).toEqual([]);
  });
});

/**
 * The rule catching the thing it exists to catch.
 *
 * Written against strings, so the shape that used to be in `Today.tsx` is
 * still checked after it has been deleted from `Today.tsx` — otherwise this
 * is a test that passes because the code is gone rather than because the rule
 * works, and it would go on passing if the rule were quietly broken.
 */
describe('what it catches', () => {
  it('catches the declaration Reports and Grades both had', () => {
    expect(DECLARES.test('export function Reports({ bare = false }: { bare?: boolean } = {}) {')).toBe(true);
    expect(DECLARES.test('export function Grades({ bare = false }) {')).toBe(true);
  });

  it('catches the call Today and Courses both made', () => {
    expect(PASSES.test("{tab === 'brief' && <Reports bare />}")).toBe(true);
    expect(PASSES.test('<Grades bare />')).toBe(true);
    expect(PASSES.test('<Settings bare />')).toBe(true);
  });

  it('leaves the class name alone', () => {
    // `className="bare"` is on hundreds of buttons — it strips the browser's
    // default button chrome and has nothing to do with page frames. It appears
    // on capitalised components too, which is why the quote before it is what
    // the rule looks at rather than the case of the tag.
    expect(PASSES.test('<button type="button" className="bare tappable">')).toBe(false);
    expect(PASSES.test('<Blueprint className="bare tappable" onClick={go}>')).toBe(false);
    expect(DECLARES.test('<span className="bare">Go</span>')).toBe(false);
  });

  it('catches the prop however it is written', () => {
    expect(PASSES.test('<Reports bare={true} />')).toBe(true);
    expect(PASSES.test('<Grades key={id} bare />')).toBe(true);
  });

  it('leaves an ordinary screen-to-screen render alone', () => {
    // `FirstRun` is an empty state, not a destination with a second door.
    expect(PASSES.test('if (catalog.empty) return <FirstRun where="in your courses" />;')).toBe(false);
    expect(PASSES.test('<DayReport onGrain={(next) => setGrain(next)} />')).toBe(false);
  });
});
