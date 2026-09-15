import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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


/**
 * The same rule, without relying on the escape hatch being used.
 *
 * Everything above catches `bare`, on the reasoning that embedding a screen
 * inside a screen needs a frameless second render path in order to compile.
 * That reasoning was wrong in one direction, and `screens/Career.tsx` is how
 * it was found: it rendered `<Applying />` — the whole `applying` destination,
 * frame and all — as its Applications tab, and simply wore the doubled
 * padding. No `bare` anywhere, so every check above passed while the app had
 * two doors onto one room for five ports.
 *
 * `<Page>` already warns about this at runtime ("A screen has one frame"), but
 * only in DEV and only if somebody opens that tab with a console visible.
 *
 * So this asks the question directly rather than by proxy: **which components
 * are a destination's whole body, and does any screen render one it did not
 * define?** `App.tsx` is the authority on the first half — it is the file that
 * turns a `Screen` into a component — and `lib/nav.ts` on which of those
 * screens is a destination somebody can be sent to.
 *
 * Sub-screens are deliberately not included. `course`, `item`, `quiz` and the
 * other nested ones are reached *from* something and have no directory row, so
 * a screen rendering one is a flow rather than a second front door.
 */

/** `case 'x': … return <Component` — App.tsx's own screen-to-body mapping. */
function destinationBodies(): Map<string, string> {
  const app = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
  const registry = readFileSync(join(process.cwd(), 'src', 'screens.tsx'), 'utf8');
  const nav = readFileSync(join(process.cwd(), 'src', 'lib', 'nav.ts'), 'utf8');
  const listed = new Set([...nav.matchAll(/^ {4}screen: '([a-zA-Z]+)'/gm)].map((m) => m[1]));

  const bodies = new Map<string, string>();
  /*
   * The table in `screens.tsx`, which used to be eighty cases in `App.tsx`.
   *
   * The guard below is what noticed the move: it asserts this parse finds more
   * than fifty, and when the switch became a lookup it found none — which is
   * exactly the vacuous pass it was written to prevent. Worth saying plainly,
   * because a guard that fires once and is then deleted was never a guard.
   */
  for (const [, screen, component] of registry.matchAll(/^ {2}(\w+): (\w+),$/gm)) {
    if (listed.has(screen)) bodies.set(component, screen);
  }
  /*
   * And `home`, which is still a switch in `App.tsx` because which component
   * draws it depends on the navigation rather than on `state.screen`.
   */
  for (const chunk of withoutComments(app).split(/\n {4}case '/).slice(1)) {
    const screen = chunk.slice(0, chunk.indexOf("'"));
    const body = chunk.match(/return <([A-Z]\w*)/);
    if (body && listed.has(screen)) bodies.set(body[1], screen);
  }
  return bodies;
}

/**
 * A JSX element, not a type argument.
 *
 * `useState<Profile | null>` is not a render of the Profile screen, and the
 * first version of this rule said it was. So the match is the two shapes a
 * rendered *screen* actually takes — `<X />` and `<X prop…` — and not the bare
 * `<X>`, which `Array<Application>` is indistinguishable from.
 *
 * Dropping `<X>` costs nothing real: it is the with-children form, and a
 * destination takes no children. Every screen in `App.tsx` is rendered either
 * self-closing or with props.
 */
const renders = (component: string) => new RegExp(`<${component}(\\s*/>|\\s+[a-zA-Z-]+[=\\s])`);

describe('no destination is rendered inside another screen', () => {
  it('finds every destination body in App.tsx', () => {
    // A guard on the guard: if App.tsx is restructured so this parse returns
    // nothing, the rule below passes vacuously and nobody notices.
    expect(destinationBodies().size).toBeGreaterThan(50);
  });

  it('renders no destination it did not define', () => {
    const bodies = destinationBodies();
    const offenders: string[] = [];
    for (const file of sources(join(process.cwd(), 'src', 'screens'))) {
      if (file.path.includes('.test.')) continue;
      const text = withoutComments(file.text);
      for (const [component, screen] of bodies) {
        if (new RegExp(`export function ${component}\\b`).test(text)) continue;
        if (renders(component).test(text)) {
          offenders.push(`${file.path.slice(file.path.indexOf('/screens/') + 1)} renders <${component}/>, the '${screen}' screen`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('what the second rule catches', () => {
  it('catches the embed Career had, which declared no bare prop', () => {
    expect(renders('Applying').test("{tab === 'tracker' && <Applying />}")).toBe(true);
    expect(renders('Applying').test('<Applying/>')).toBe(true);
    expect(renders('Reports').test('<Reports grain={grain}>')).toBe(true);
  });

  it('leaves a type argument alone', () => {
    expect(renders('Profile').test('const [profile, setProfile] = useState<Profile | null>(null);')).toBe(false);
    expect(renders('Application').test('const rows: Array<Application> = [];')).toBe(false);
    expect(renders('Career').test('const shown: Record<Career, string> = {};')).toBe(false);
  });

  it('leaves a screen that is not a destination alone', () => {
    // `FirstRun` is an empty state and `Grades` is a view of Courses — neither
    // has a directory row, so neither can be a second front door. They are
    // absent from the map rather than excused by the regex.
    expect([...destinationBodies().keys()]).not.toContain('FirstRun');
    expect([...destinationBodies().keys()]).not.toContain('Grades');
  });
});
