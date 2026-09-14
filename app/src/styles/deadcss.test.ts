import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every class the app's own sheets style is a class something wears.
 *
 * 131 lines of `app.css` and `features.css` styled nothing at all: the
 * spreadsheet's formula-bar name box, a `.tabstrip` superseded by
 * `components/Tabs.tsx`, a late-count colour that was never applied, and
 * seventeen selectors left over from the ported campus screens — whole
 * `@media` blocks of them. None of it was reachable and none of it could be
 * noticed, because dead CSS has no symptom: it does not throw, it does not
 * fail a type check, and it does not change a pixel.
 *
 * ## Why this is a list and not a heuristic
 *
 * The first version of the census called a class used if any dash-prefix of
 * its name appeared anywhere — so `.semester-primary-nav` counted as live
 * because the string "semester" is all over an app called Semester. That
 * rescued seventeen genuinely dead rules, and it would have kept rescuing
 * them.
 *
 * So the rule is exact-match, and the two things an exact match cannot see
 * are written out by name below rather than guessed at. Adding to either list
 * is then a decision somebody makes on purpose, which is the point:
 * a heuristic that quietly absolves is worse than a list that has to be
 * edited.
 */

const STYLES = join(process.cwd(), 'src', 'styles');

/*
 * `industry.css` is deliberately not audited.
 *
 * Its own first line calls it "the source of truth for the system's look" —
 * a design system, whose component classes are a published vocabulary. A
 * vocabulary is meant to be wider than today's usage, so an unused one there
 * is a design decision to make, not a cleanup to do, and a test that deleted
 * them would be this file overruling that file.
 */
const SHEETS = ['app.css', 'features.css'];

/**
 * Classes built at runtime rather than written down, with where each is made.
 *
 * An exact-match census cannot see these and never will. Named individually
 * rather than pattern-matched, so a new one is a line somebody adds here
 * while they are looking at the code that builds it.
 */
const COMPOSED = new Map([
  ['is-bottom', 'screens/Mail.tsx — `mb-main is-${pane}`'],
  ['is-right', 'screens/Mail.tsx — `mb-main is-${pane}`'],
]);

/**
 * Classes belonging to somebody else's DOM.
 *
 * Leaflet draws its own map furniture and the app restyles it. Nothing here
 * ever appears in a `className`, and that is correct rather than dead.
 */
const FOREIGN = /^leaflet-/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Every source file that could carry a class, minus the sheets being audited. */
function haystack(): string {
  const sheets = SHEETS.map((f) => join(STYLES, f));
  return walk(join(process.cwd(), 'src'))
    .filter((p) => !sheets.includes(p))
    .concat([join(process.cwd(), 'index.html')])
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');
}

describe('the stylesheets', () => {
  it('style nothing that nothing wears', () => {
    const hay = haystack();
    const dead: string[] = [];
    for (const sheet of SHEETS) {
      const css = readFileSync(join(STYLES, sheet), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
        const name = m[1];
        if (FOREIGN.test(name) || COMPOSED.has(name) || hay.includes(name)) continue;
        if (!dead.includes(`${sheet}: .${name}`)) dead.push(`${sheet}: .${name}`);
      }
    }
    // Named rather than counted: a failure should say which rule to look at,
    // and whether it is dead or merely composed somewhere this cannot see.
    expect(dead).toEqual([]);
  });

  it('leaves no empty block behind when a rule goes', () => {
    // How the first sweep went wrong: stripping the rules out of four
    // `@media` wrappers left the wrappers, which minify to nothing but read
    // as a breakpoint that does something.
    for (const sheet of SHEETS) {
      const css = readFileSync(join(STYLES, sheet), 'utf8');
      expect([...css.matchAll(/@media[^{]*\{\s*\}/g)].map((m) => m[0]), sheet).toEqual([]);
    }
  });
});
