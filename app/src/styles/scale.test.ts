import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALLOWED, BUDGET, check, counts, multipliers } from './rules';

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

  it('holds the budgets exactly, with no slack to spend', () => {
    const now = counts(src);
    for (const [name, cap] of Object.entries(BUDGET)) {
      expect(`${name} ${now[name as keyof typeof BUDGET]}`).toBe(`${name} ${cap}`);
    }
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
