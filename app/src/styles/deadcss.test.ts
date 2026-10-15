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
const SHEETS = ['app.css', 'features.css', 'unity.css'];

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
  ['docpaper-h2', 'screens/write/Paper.tsx — `docpaper-h docpaper-h${block.level}`'],
  ['docpaper-h3', 'screens/write/Paper.tsx — `docpaper-h docpaper-h${block.level}`'],
  ['docpaper-toc2', 'screens/write/Paper.tsx — `docpaper-toc-line docpaper-toc${h.level}`'],
  ['docpaper-toc3', 'screens/write/Paper.tsx — `docpaper-toc-line docpaper-toc${h.level}`'],
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

/**
 * Find all class names without rescanning the source for each selector.
 *
 * The earlier cache removed duplicate selectors, but each of the thousand
 * distinct classes still searched the entire 27 MB source string. Every
 * class extracted below contains only word characters and hyphens, so a
 * match cannot cross a different character. Search each distinct run once
 * with a trie and fallback links, including overlapping matches. Membership
 * remains precisely `source.includes(name)`: a name mentioned in a comment
 * or inside a longer word still counts, just as it did before.
 */
function referenced(source: string, names: Set<string>): Set<string> {
  type Node = { next: Map<string, number>; fallback: number; matches: string[] };
  const node = (): Node => ({ next: new Map(), fallback: 0, matches: [] });
  const nodes: Node[] = [node()];
  for (const name of names) {
    let at = 0;
    for (const letter of name) {
      let next = nodes[at].next.get(letter);
      if (next === undefined) {
        next = nodes.push(node()) - 1;
        nodes[at].next.set(letter, next);
      }
      at = next;
    }
    nodes[at].matches.push(name);
  }

  const queue = [...nodes[0].next.values()];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    for (const [letter, next] of nodes[at].next) {
      let fallback = nodes[at].fallback;
      while (fallback && !nodes[fallback].next.has(letter)) fallback = nodes[fallback].fallback;
      nodes[next].fallback = nodes[fallback].next.get(letter) ?? 0;
      nodes[next].matches.push(...nodes[nodes[next].fallback].matches);
      queue.push(next);
    }
  }

  const found = new Set(nodes[0].matches);
  const tokens = new Set(source.match(/[\w-]+/g));
  for (const token of tokens) {
    if (found.size === names.size) break;
    let at = 0;
    for (let i = 0; i < token.length; i++) {
      const letter = token[i];
      while (at && !nodes[at].next.has(letter)) at = nodes[at].fallback;
      at = nodes[at].next.get(letter) ?? 0;
      for (const name of nodes[at].matches) found.add(name);
    }
  }
  return found;
}

describe('the stylesheets', () => {
  it('style nothing that nothing wears', () => {
    const hay = haystack();
    const classes = new Map(SHEETS.map(sheet => {
      const css = readFileSync(join(STYLES, sheet), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      return [sheet, [...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(match => match[1])];
    }));
    const names = new Set([...classes.values()].flat().filter(name => !FOREIGN.test(name) && !COMPOSED.has(name)));
    const worn = referenced(hay, names);
    const dead = new Set<string>();
    for (const sheet of SHEETS) {
      for (const name of classes.get(sheet)!) {
        if (FOREIGN.test(name) || COMPOSED.has(name) || worn.has(name)) continue;
        dead.add(`${sheet}: .${name}`);
      }
    }
    // Named rather than counted: a failure should say which rule to look at,
    // and whether it is dead or merely composed somewhere this cannot see.
    expect([...dead]).toEqual([]);
  // This scans the complete source tree and its runtime-composed class names.
  // The repository now exceeds the original 10-second budget on an otherwise
  // idle worker, so keep the assertion exact while allowing the census to
  // finish on the full application.
  }, 30_000);

  it('keeps substring membership, overlapping names and missing-name controls exact', () => {
    const source = 'nav-row-expanded foobar _item ababa prefix-aa-suffix /* mentioned-here */';
    const names = new Set(['nav', 'nav-row', 'row', 'nav-row-expanded', 'foo', 'oo', '_item', 'aba', 'ba', 'aa', 'mentioned-here', 'absent-name', 'ROW']);
    expect([...referenced(source, names)].sort()).toEqual([...names].filter(name => source.includes(name)).sort());
    expect(referenced('', names)).toEqual(new Set());
    expect(referenced(source, new Set())).toEqual(new Set());
  });

  it('matches the previous lookup across fallback chains and repeated prefixes', () => {
    const alphabet = ['a', 'b', '-', '_'];
    const names = new Set(alphabet.flatMap(a => alphabet.flatMap(b => alphabet.map(c => `${a}${b}${c}`))));
    for (const source of ['aaaaa', 'abababab', 'a-b_a--b', '__a_b-_', 'a'.repeat(40) + 'b', 'unrelated']) {
      expect([...referenced(source, names)].sort(), source).toEqual([...names].filter(name => source.includes(name)).sort());
    }
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
