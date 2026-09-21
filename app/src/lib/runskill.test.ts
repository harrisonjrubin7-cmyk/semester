import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NAVS, SHELLS, DEFAULT_NAV } from './look';
import { SCHEMA } from './migrate';
import { DEFAULT_PERSISTED } from '../state/shape';

/**
 * The run skill says what the app's settings are. This checks it is right.
 *
 * `.claude/skills/run/SKILL.md` is how an agent drives this app, and its §5
 * tables are a copy of `NAVS`, `SHELLS` and `SCHEMA` kept by hand. Every one
 * of them has been wrong, and the file says so itself:
 *
 *   > **Read `NAVS` and `SHELLS` rather than trusting the rows above.** Both
 *   > have moved without this file noticing, and in both directions.
 *
 * `NAVS` was four, then six, then seven, then six again; `SHELLS` was claimed
 * as six by folding two other axes into it; and the default navigation was
 * given as `workspace` for several releases after it became `tabs`. That last
 * one is the reason this exists rather than a third correction: the claim was
 * a true observation of a *different* fault — a seed written without
 * `schemaVersion` really does come up in the workspace, which the section
 * below it documents — recorded as a fact about the app. Measured, three
 * starts, reading the chrome off the page:
 *
 *     no storage at all                            tabs
 *     { schemaVersion: 6, seenOnboarding: true }   tabs
 *     { seenOnboarding: true }                     workspace
 *
 * So the file contradicted itself in two adjacent sections and stayed that
 * way, because nothing but a careful reader could notice. A wrong instruction
 * here is not a wrong document: it is an agent seeding a value it did not
 * need, or concluding its seed failed when it took, and this repository runs
 * several of those at once.
 *
 * ## What it does not check
 *
 * The prose. This asks only the questions with one right answer — do the
 * tables list what the unions list, and does the stated default match the
 * stored one. Everything else in that file is judgement, and a test that
 * graded it would be a test nobody could satisfy.
 */

const SKILL = new URL('../../../.claude/skills/run/SKILL.md', import.meta.url);

/** The four cells of one `| setting | source | values | labels |` row. */
function tableRow(doc: string, setting: string): { values: string[]; labels: string[] } {
  const line = new RegExp(`^\\| \`${setting}\` \\|([^\\n]*)$`, 'm').exec(doc);
  expect(line, `§5 no longer has a \`${setting}\` row; re-point this guard`).toBeTruthy();
  const cells = line![1].split('|').map((c) => c.trim());
  // source · values · labels · (trailing empty)
  const split = (cell: string) =>
    cell
      .split('·')
      .map((v) => v.trim().replace(/^`|`$/g, ''))
      .filter(Boolean);
  return { values: split(cells[1]), labels: split(cells[2]) };
}

describe('the run skill, against the app it describes', () => {
  const doc = readFileSync(SKILL, 'utf8');

  it('has the tables this guard can actually read', () => {
    // The probe, pointed at itself: a parser that returned nothing would make
    // every comparison below vacuously true.
    expect(tableRow(doc, 'nav').values.length).toBeGreaterThan(1);
    expect(tableRow(doc, 'shell').values.length).toBeGreaterThan(1);
    expect(doc).toContain('The default is');
  });

  it('lists exactly the navigations the app has', () => {
    const row = tableRow(doc, 'nav');
    expect(row.values).toEqual(NAVS.map((n) => n.id));
    expect(row.labels).toEqual(NAVS.map((n) => n.label));
  });

  it('lists exactly the shells the app has', () => {
    const row = tableRow(doc, 'shell');
    expect(row.values).toEqual(SHELLS.map((s) => s.id));
    expect(row.labels).toEqual(SHELLS.map((s) => s.label));
  });

  /*
   * The one that was wrong, and the one worth naming rather than counting.
   *
   * Asserted against the stored default and against `NAVS`'s own `deft` mark,
   * because those are the two places that could disagree — `look.test.ts`
   * holds them to each other, and this holds the document to both.
   */
  it('names the navigation the app actually opens in', () => {
    const claimed = /\*\*The default is ([^*]+)\*\*/.exec(doc);
    expect(claimed, 'the default-navigation sentence has moved; re-point this guard').toBeTruthy();

    const label = NAVS.find((n) => n.id === DEFAULT_PERSISTED.nav)?.label;
    expect(label, 'the stored default nav is not in NAVS').toBeTruthy();
    expect(DEFAULT_NAV).toBe(DEFAULT_PERSISTED.nav);
    // "the tab bar" against the label "Tab bar" — the sentence reads as prose.
    expect(claimed![1].toLowerCase()).toContain(label!.toLowerCase());
  });

  /*
   * The seed the file tells every script to write. `SCHEMA` moving without
   * this moving is the failure the file's own migrations section describes,
   * one level up: a version-less — or stale-version — seed is silently
   * rewritten, and the run comes up working and wrong.
   */
  it('seeds the schema version the migrations are at', () => {
    const seeded = [...doc.matchAll(/schemaVersion:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(seeded.length, 'no seed example left to check; re-point this guard').toBeGreaterThan(0);
    for (const v of seeded) expect(v).toBe(SCHEMA);
  });

  it('counts the pairings it claims', () => {
    const said = /\*\*(\w+) pairings\*\*/.exec(doc);
    expect(said, 'the pairings sentence has moved; re-point this guard').toBeTruthy();
    const words: Record<number, string> = { 12: 'twelve', 15: 'fifteen', 18: 'eighteen', 21: 'twenty-one', 24: 'twenty-four' };
    expect(said![1].toLowerCase()).toBe(words[NAVS.length * SHELLS.length]);
  });
});
