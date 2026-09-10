import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALLOWED, check, counts, countsByFile, multipliers, overBudget, render } from './rules';
import { BUDGET } from './budget';

/**
 * The style rule, from the test suite's side.
 *
 * The checking itself is `rules.ts`, and `npm run lint` runs the same
 * functions through `scripts/styles.mjs`. One implementation, two ways in — a
 * rule that could pass the suite and fail the linter, or the reverse, is a
 * rule people learn to run only one of.
 *
 * What this adds is the failure messages. A linter that says "3 problems" is a
 * linter somebody greps around; these check that a violation names the file,
 * the line and what to write instead, because that is the difference between a
 * rule that gets satisfied and one that gets an eslint-disable.
 */

const src = join(process.cwd(), 'src');

describe('the style rule', () => {
  it('passes on the app as it stands', () => {
    // Named, not counted: a failure has to say which file, or the next person
    // runs the grep this exists to replace.
    expect(check(src).map((p) => `${p.file}:${p.line} ${p.found}`)).toEqual([]);
  });

  it('keeps the multipliers on every token', () => {
    const css = readFileSync(join(src, 'styles', 'app.css'), 'utf8');
    expect(multipliers(css).map((p) => `${p.found} ${p.says}`)).toEqual([]);
  });

  it('holds every file to its own count, with no slack to spend', () => {
    // Named, not counted, and per file rather than four totals: a failure has
    // to say which screen grew, because "type 675" said only that somebody,
    // somewhere, had added one — and under a single total a file could grow by
    // five while another shrank by five and this never fired at all.
    expect(overBudget(src, BUDGET).map((p) => `${p.file} ${p.found}`)).toEqual([]);
  });

  it('keeps the generated ledger byte-for-byte what the tree measures', () => {
    // The ledger is generated, so the thing that can rot is the generator: a
    // hand-edit that happens to be arithmetically right would pass the check
    // above and still be a file nobody can regenerate without a diff.
    expect(render(countsByFile(src))).toBe(readFileSync(join(src, 'styles', 'budget.ts'), 'utf8'));
  });

  it('exempts nothing, and says so where an exemption would go', () => {
    expect(ALLOWED).toEqual([]);
  });
});

/**
 * The rule catching the things it exists to catch.
 *
 * Written against strings rather than against the repository, so each one is a
 * violation nobody has to introduce into a real file to see fail — and so the
 * message it produces is checked, not just the fact that it produced one.
 */
describe('what it catches', () => {
  const on = (text: string) => {
    // `check` reads from disk, so this exercises the same regexes through a
    // temporary file rather than duplicating them here — the alternative is a
    // second copy of the rule in its own test, which is how a rule and its
    // test stop agreeing.
    const dir = mkdtempSync(join(tmpdir(), 'rule-'));
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'Probe.tsx'), text);
    return check(join(dir, 'src'));
  };

  it('fails on a font size written as a bare number', () => {
    const [p] = on(`export const x = <div style={{ fontSize: 14 }} />;`);
    expect(p.found).toBe('fontSize: 14');
    expect(p.says).toContain('Text size setting');
  });

  it('fails on a raw px font size, which is the same bug in a string', () => {
    const [p] = on(`export const x = <div style={{ fontSize: '13px' }} />;`);
    expect(p.found).toBe("fontSize: '13px'");
  });

  it('allows a token, a calc against the scale, and inherit', () => {
    expect(
      on(`export const a = <i style={{ fontSize: 'var(--type-md)' }} />;
export const b = <i style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))' }} />;
export const c = <i style={{ fontSize: 'inherit' }} />;
export const d = <i style={{ fontSize: '0.92em' }} />;`),
    ).toEqual([]);
  });

  it('fails on a size written longhand that a token already names', () => {
    const [p] = on(`export const x = <i style={{ fontSize: 'calc(13px * var(--text-scale, 1))' }} />;`);
    expect(p.says).toContain('var(--type-base)');
  });

  it('fails on a gap that is a step, and says the step', () => {
    const [p] = on(`export const x = <i style={{ gap: 8 }} />;`);
    expect(p.says).toContain('var(--sp-4)');
    // And says why it is not only a naming preference.
    expect(p.says).toContain('density');
  });

  /*
   * Every spacing property the rule claims to watch, one case each.
   *
   * `margin: 8` was silently exempt for the life of this rule — the pattern
   * made `padding`'s suffix optional and `margin`'s mandatory — so an
   * off-scale bare margin was never reported and never counted. The old tests
   * covered `gap` alone, which is why nobody found it. Listing the properties
   * is what stops the next one being exempt for as long.
   */
  it.each(['gap', 'rowGap', 'columnGap', 'margin', 'marginTop', 'padding', 'paddingLeft'])(
    'catches an off-step %s',
    (prop) => {
      const [p] = on(`export const x = <i style={{ ${prop}: 8 }} />;`);
      expect(p?.found, `${prop}: 8 should be caught`).toBe(`${prop}: 8`);
      expect(p.says).toContain('var(--sp-4)');
    },
  );


  it('fails on a line height that is a step', () => {
    const [p] = on(`export const x = <i style={{ lineHeight: 1.45 }} />;`);
    expect(p.says).toContain('var(--leading-normal)');
  });

  it('does not fail on its own documentation', () => {
    // The note in `App.tsx` about why the setting exists contains the words
    // `fontSize: 14`. A rule that failed on the explanation of itself is a
    // rule people delete rather than satisfy.
    expect(on(`// this app writes fontSize: 14 inline, in px\n/* and gap: 8 too */\n`)).toEqual([]);
  });

  it('reports the line the problem is on, after blanking comments', () => {
    const [p] = on(`/* a\n   comment\n   here */\nexport const x = <i style={{ fontSize: 9 }} />;`);
    expect(p.line).toBe(4);
  });
});

/**
 * The ledger, doing the three things it is for.
 *
 * Written against a temporary tree rather than the app's, because every one of
 * these needs a file that is over, under or absent — and introducing any of
 * those into a real screen to watch the rule fire is how a test ends up
 * committed alongside the drift it was demonstrating.
 */
describe('the per-file ledger', () => {
  /** A one-file tree, and the ledger you claim describes it. */
  const tree = (text: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'Probe.tsx'), text);
    return join(dir, 'src');
  };

  // Two off-scale values, in the two axes, so a test can move one at a time.
  const DRIFT = `export const x = <i style={{ padding: 14, lineHeight: 1.35 }} />;`;

  it('passes a file that owes exactly what the ledger says', () => {
    expect(overBudget(tree(DRIFT), { 'Probe.tsx': { leading: 1, space: 1 } })).toEqual([]);
  });

  it('fails a file that grew, and says which axis and by how much', () => {
    const [p] = overBudget(tree(DRIFT), { 'Probe.tsx': { leading: 1 } });
    expect(p.file).toBe('Probe.tsx');
    expect(p.found).toBe('space 1, and 0 allowed');
    expect(p.says).toContain('1 more than this file is allowed');
  });

  /*
   * The case a single total could not see at all.
   *
   * Under four numbers for the whole app, a screen that gained two values and
   * another that lost two summed to no change and the rule stayed silent. This
   * is that exact shape — one file up two, one file down two — and it has to
   * produce two findings, not zero.
   */
  it('sees a file grow even where another shrank by the same amount', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'Grew.tsx'), `export const a = <i style={{ padding: 14, marginTop: 18 }} />;`);
    writeFileSync(join(dir, 'src', 'Shrank.tsx'), `export const b = <i style={{ padding: 14 }} />;`);
    const found = overBudget(join(dir, 'src'), { 'Grew.tsx': {}, 'Shrank.tsx': { space: 3 } });
    expect(found.map((p) => `${p.file} ${p.found}`)).toEqual([
      'Grew.tsx space 2, and 0 allowed',
      'Shrank.tsx space 1, and 3 allowed',
    ]);
  });

  it('fails a file that shrank, pointing at --fix rather than at the author', () => {
    const [p] = overBudget(tree(DRIFT), { 'Probe.tsx': { leading: 1, space: 4 } });
    expect(p.says).toContain('the good direction');
    expect(p.says).toContain('--fix');
  });

  it('fails an entry for a file that no longer owes anything', () => {
    const [p] = overBudget(tree(`export const x = <i style={{ gap: 'var(--sp-4)' }} />;`), {
      'Probe.tsx': { space: 1 },
    });
    expect(p.found).toBe('Probe.tsx');
    expect(p.says).toContain('tidied, renamed or deleted');
  });

  it('allows a file that is not on the ledger nothing at all', () => {
    // The rule for new code: a file nobody has written a debt for owes none.
    const [p] = overBudget(tree(DRIFT), {});
    expect(p.file).toBe('Probe.tsx');
    expect(p.says).toContain('more than this file is allowed');
  });

  it('counts an off-scale bare margin, which the ledger used to miss', () => {
    // The other half of the same bug as the property sweep above: the pattern
    // the ledger counts with was the pattern the rule checked with, so a bare
    // margin was absent from both.
    expect(countsByFile(tree(`export const x = <i style={{ margin: 14 }} />;`))).toEqual({
      'Probe.tsx': { space: 1 },
    });
  });

  it('still treats a zero margin as the absence of a choice, not as drift', () => {
    expect(countsByFile(tree(`export const x = <i style={{ margin: 0 }} />;`))).toEqual({});
  });

  it('leaves a clean file off the ledger rather than writing it as zeroes', () => {
    expect(countsByFile(tree(`export const x = <i style={{ gap: 'var(--sp-4)' }} />;`))).toEqual({});
  });

  it('counts text dimmed by hand, which the palette audit cannot see', () => {
    // `contrast.test.ts` checks `--app-dim` and `--app-faint` against every
    // panel of every ground. An opacity written into a component answers to
    // none of that — and two of them nest and multiply. See `lib/dim.ts`.
    expect(countsByFile(tree(`export const x = <i style={{ opacity: 0.55 }} />;`))).toEqual({
      'Probe.tsx': { dim: 1 },
    });
  });

  it('does not count the token, which is the way out of the ledger', () => {
    expect(
      countsByFile(tree(`export const x = <i style={{ color: 'var(--app-dim)' }} />;`)),
    ).toEqual({});
    expect(
      countsByFile(tree(`export const x = <i style={{ opacity: 'var(--app-row-dim)' }} />;`)),
    ).toEqual({});
  });

  it('does not count a fully opaque element as dimmed', () => {
    expect(countsByFile(tree(`export const x = <i style={{ opacity: 1 }} />;`))).toEqual({});
  });

  it('totals the same numbers it files per screen', () => {
    const dir = tree(DRIFT);
    expect(counts(dir)).toEqual({ type: 0, leading: 1, space: 1, shorthand: 0, dim: 0 });
  });

  it('renders a ledger that parses back to the counts it was made from', () => {
    const written = render({ 'a/B.tsx': { type: 2, shorthand: 1 }, 'A.tsx': { space: 3 } });
    // Sorted by path, so the line a branch changes is the file it touched.
    expect(written).toContain("  'A.tsx': { space: 3 },\n  'a/B.tsx': { type: 2, shorthand: 1 },");
    expect(written).toContain('do not edit');
  });
});
