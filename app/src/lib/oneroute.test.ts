import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';
import { DESTINATIONS } from './nav';

/**
 * One route per home, as a test rather than as a conclusion somebody reached.
 *
 * `lib/onehome.test.ts` guards the screen — no destination may be rendered as
 * another screen's tab. This guards the door: **no screen offers the same
 * destination twice.** They are different faults. A second tab is a second
 * *place* the room can be entered; this is the same place offering the same
 * door twice, and the skill names both under "one route per home".
 *
 * It exists because the answer was expensive and was then left holding
 * nothing. The seventeenth pass read three destinations by hand. The
 * nineteenth read the remaining fifty-five, closed the row, and recorded the
 * verdict in `SIMPLIFY-AUDIT.md` — where it has sat as prose ever since. One
 * `dispatch({ type: 'go' })` added tomorrow reopens all of it silently, and
 * the only way to find out would be to read fifty-five screens again.
 *
 * ## The rule is per rendered unit, and that is the whole lesson
 *
 * Four passes in a row over-reported here, each by measuring the wrong thing,
 * and the nineteenth stated the rule that survives: **group by rendered unit,
 * not by path.** A component boundary, a `mode` guard and an early return are
 * screen boundaries; a filename is not.
 *
 * Encoded rather than recorded, which is the difference between a lesson and a
 * paragraph. Splitting each file at its top-level components clears both of
 * the nineteenth pass's false positives on its own:
 *
 * - `components/Applying.tsx` offers `applying` at two lines, in `ApplyingSoon`
 *   and in `ApplyingOn` — two cards, one door each.
 * - `screens/Guide.tsx` offers `deck` at two lines, in `Decks()` and in
 *   `Documents()`, which render at `mode === 'slides'` and `=== 'doc'` and are
 *   never on screen together.
 *
 * A per-file check calls both duplicates. A per-component check does not, and
 * does not need either of them written down as an exception.
 *
 * ## Two screens linking to a third is a cross-reference
 *
 * Also the nineteenth pass's, and the reason this counts within a unit rather
 * than across the app. `maps` is offered from `Walks` and from `Housing`;
 * `registrar` from `Meals` and from `Today`; `edit` from seven places. In every
 * case it is one offer, from one screen, in that screen's own context — which
 * is what a cross-reference is, and what an app without them would be worse
 * for. The fault is a student being given the same door twice *in the place
 * they are already standing*.
 *
 * ## What is exempt, and why
 *
 * The surfaces that list everything by design, which the skill excludes from
 * "pathways" by name: the registry itself, the directory, the palette and the
 * chrome that draws whichever navigation is switched on. A directory offering
 * every destination once is a directory working.
 */

const SRC = join(process.cwd(), 'src');

/**
 * The indexes and the chrome.
 *
 * `Me.tsx` is the directory, `Command.tsx` the palette, `App.tsx` the router,
 * `nav.ts` the registry, and `components/desk/` and `components/nav/` draw the
 * workspace strip, the shelves and the springboard. Each offers destinations by
 * the armful on purpose.
 */
const INDEX = [
  'lib/nav.ts',
  'App.tsx',
  'screens/Me.tsx',
  'components/Command.tsx',
  'components/desk/',
  'components/nav/',
];

/** `src/…` with the prefix off, so a failure names the file the way a person would. */
const named = (path: string) => path.slice(path.indexOf(`${SRC}/`) + SRC.length + 1);

const isIndex = (path: string) => INDEX.some((i) => named(path).startsWith(i) || named(path).endsWith(`/${i}`));

/**
 * Where each top-level component in a file begins.
 *
 * Both forms the app uses: `function Name(` at column zero, exported or not,
 * and the one arrow component (`components/PushSwitch.tsx`). Anything before
 * the first boundary belongs to the module rather than to a component, and is
 * counted as its own unit so a stray dispatch in module scope is not hidden.
 */
function unitsOf(text: string): { name: string; at: number }[] {
  const found = [...text.matchAll(/^(?:export\s+)?(?:function\s+([A-Z]\w*)|const\s+([A-Z]\w*)\s*[=:])/gm)];
  const units = found.map((m) => ({ name: m[1] ?? m[2], at: m.index }));
  return [{ name: '(module)', at: 0 }, ...units];
}

/** Which unit a character offset falls in — the last boundary at or before it. */
function unitAt(units: { name: string; at: number }[], offset: number): string {
  let held = units[0].name;
  for (const u of units) if (u.at <= offset) held = u.name;
  return held;
}

// `Set<string>` rather than `Set<Screen>`: what is probed against it is a
// capture out of the source text, which is a string until this set says it is
// a destination. Widening here rather than casting at the call site keeps the
// narrowing in one place.
const SCREENS: ReadonlySet<string> = new Set<string>(DESTINATIONS.map((d) => d.screen));

/** Every `go` a component makes, as `file · component · destination` with its lines. */
function offers(): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const file of sources(SRC, { ext: ['.ts', '.tsx'], tests: false })) {
    if (isIndex(file.path)) continue;
    // Comments are blanked rather than removed, so offsets and line numbers
    // still point at the real source.
    const text = withoutComments(file.text);
    const units = unitsOf(text);
    for (const m of text.matchAll(/type: 'go', screen: '([a-z]+)'/g)) {
      const screen = m[1];
      if (!SCREENS.has(screen)) continue;
      const key = `${named(file.path)} · ${unitAt(units, m.index)} · ${screen}`;
      const line = text.slice(0, m.index).split('\n').length;
      out.set(key, [...(out.get(key) ?? []), line]);
    }
  }
  return out;
}

/**
 * Pairs that are real and are staying, each with the argument for it.
 *
 * **Empty, and it was not when this file was written.** It held one entry:
 * `screens/Profile.tsx` offered `account` from an `ActionButton` and from a
 * `NavRow`, both on screen at once. Four passes of `SIMPLIFY-AUDIT.md` left it
 * standing as a taste call about two affordances; the owner settled it by
 * removing the button, and `Profile.tsx` carries the reasoning at the site.
 *
 * The emptying is worth more than the entry was. The second case below asserts
 * that everything named here still *exists*, so this array could not be left
 * pointing at a duplicate somebody had already deleted — and when the button
 * went, that case is what said so rather than a reader noticing months later.
 *
 * Anything added here later is a claim that a screen should offer one door
 * twice, and wants the argument written beside it.
 */
const ARGUED: string[] = [];

describe('no screen offers the same destination twice', () => {
  it('finds no screen offering one destination twice', () => {
    const twice = [...offers()]
      .filter(([, lines]) => lines.length > 1)
      .map(([key, lines]) => `${key} (lines ${lines.join(', ')})`);
    // Named, not counted: a failure has to say which component grew the second
    // door, or somebody reads fifty-five screens again to find out.
    const unexpected = twice.filter((t) => !ARGUED.some((a) => t.startsWith(a)));
    expect(unexpected).toEqual([]);
  });

  it('still has every argued pair, so the list cannot rot quietly', () => {
    // The other direction: if `Profile` is settled and this array is not
    // updated, the exemption outlives the thing it excused and the next reader
    // believes a duplicate is still there.
    const keys = [...offers()]
      .filter(([, lines]) => lines.length > 1)
      .map(([key]) => key);
    for (const argued of ARGUED) expect(keys).toContain(argued);
  });

  it('reads the registry rather than a list of its own', () => {
    // `sweepscreens.test.ts` exists because two instruments grew separate
    // lists and measured different apps. This one takes `DESTINATIONS`.
    expect(SCREENS.size).toBeGreaterThan(40);
    expect(SCREENS.has('home')).toBe(true);
  });
});

/**
 * The rule catching what it exists to catch, against strings.
 *
 * `onehome.test.ts` makes the same argument for doing this: a guard checked
 * only against a clean tree is a guard that passes because the code is tidy,
 * and would go on passing if the rule underneath it were broken.
 */
describe('what it catches', () => {
  const TWO_IN_ONE = [
    'export function Profile() {',
    "  const a = () => dispatch({ type: 'go', screen: 'account' });",
    "  const b = () => dispatch({ type: 'go', screen: 'account' });",
    '}',
  ].join('\n');

  const TWO_COMPONENTS = [
    'export function ApplyingSoon() {',
    "  onOpen={() => dispatch({ type: 'go', screen: 'applying' })}",
    '}',
    'export function ApplyingOn({ day }: { day: Date }) {',
    "  onOpen={() => dispatch({ type: 'go', screen: 'applying' })}",
    '}',
  ].join('\n');

  const count = (text: string) => {
    const units = unitsOf(text);
    const seen = new Map<string, number>();
    for (const m of text.matchAll(/type: 'go', screen: '([a-z]+)'/g)) {
      const key = `${unitAt(units, m.index)} · ${m[1]}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([key]) => key);
  };

  it('catches one component offering one destination twice', () => {
    expect(count(TWO_IN_ONE)).toEqual(['Profile · account']);
  });

  it('clears two components each offering it once — the nineteenth pass’s rule', () => {
    expect(count(TWO_COMPONENTS)).toEqual([]);
  });

  it('puts a module-scope dispatch in its own unit rather than in the first component', () => {
    const text = ["const go = () => dispatch({ type: 'go', screen: 'home' });", 'export function Thing() {}'].join('\n');
    expect(unitAt(unitsOf(text), text.indexOf('dispatch'))).toBe('(module)');
  });

  it('treats the index files as indexes', () => {
    expect(isIndex(`${SRC}/screens/Me.tsx`)).toBe(true);
    expect(isIndex(`${SRC}/components/desk/AppsPanel.tsx`)).toBe(true);
    expect(isIndex(`${SRC}/screens/Housing.tsx`)).toBe(false);
  });
});
