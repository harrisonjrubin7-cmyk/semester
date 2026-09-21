import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two requirement documents number §350–§408 for different things.
 *
 * The master specification issued that range twice. `EXPERIENCE_REQUIREMENTS`
 * §350 is the UI/UX master standard; `PLATFORM_REQUIREMENTS` §350 is
 * university plan configuration. §378 is low-stimulation mode in one and push
 * permission UX in the other.
 *
 * Renumbering either would silently break every reference already written
 * against it, so neither was renumbered — and that decision only survives if
 * something checks it. A later session reading one document alone would have
 * no way to know the other exists, and "tidying" the overlap is exactly the
 * kind of helpful change that destroys a cross-reference nobody can then
 * reconstruct.
 *
 * So this holds three things: both documents still say the collision exists,
 * the platform document's numbering is continuous, and neither numbers a
 * section twice.
 */

const DOCS = join(process.cwd(), '..', 'docs');
const PLATFORM = readFileSync(join(DOCS, 'PLATFORM_REQUIREMENTS.md'), 'utf8');
const EXPERIENCE = readFileSync(join(DOCS, 'EXPERIENCE_REQUIREMENTS.md'), 'utf8');

/** Every `# N.` heading, in order. */
function sections(doc: string): number[] {
  return [...doc.matchAll(/^# (\d+)\./gm)].map((m) => Number(m[1]));
}

/**
 * Every requirement number the document covers, including the three headings
 * that group a contiguous run — `# 1127–1135. The modules`, and two others.
 *
 * Grouping is legitimate where the source itself lists nine module names with
 * no distinct requirement between them, and inventing nine headings to
 * satisfy a counter would be padding. So the guard counts what is covered
 * rather than what is headed, and the test below pins the number of groups so
 * the technique cannot quietly spread until the document is a table of
 * contents.
 */
function covered(doc: string): Set<number> {
  const out = new Set(sections(doc));
  for (const [, a, b] of doc.matchAll(/^# (\d+)–(\d+)\./gm)) {
    for (let n = Number(a); n <= Number(b); n++) out.add(n);
  }
  return out;
}

describe('the platform requirements', () => {
  const ns = sections(PLATFORM);

  /*
   * The control. A regex that stopped matching returns an empty list, and an
   * empty list satisfies "continuous" and "no duplicates" vacuously — both
   * assertions below would pass against a document that had been deleted.
   */
  it('parses, which everything below depends on', () => {
    expect(ns.length, 'no sections parsed out of PLATFORM_REQUIREMENTS.md').toBeGreaterThan(300);
  });

  it('covers 301 to 1217 with nothing missing', () => {
    const have = covered(PLATFORM);
    const missing = [];
    for (let n = 301; n <= 1217; n++) if (!have.has(n)) missing.push(n);
    expect(missing, 'a section was dropped').toEqual([]);
  });

  /*
   * The control on the control. "Nothing missing" is satisfiable by one
   * heading reading `# 301–1217.`, which would cover every number and say
   * nothing. Three groups is what the source's own shape justifies; a fourth
   * is a decision somebody should have to make on purpose.
   */
  it('groups only the three runs the source itself groups', () => {
    const groups = [...PLATFORM.matchAll(/^# (\d+)–(\d+)\./gm)];
    expect(groups.length, 'a new grouped heading appeared').toBe(3);
    const biggest = Math.max(...groups.map(([, a, b]) => Number(b) - Number(a) + 1));
    expect(biggest, 'a group swallowed too much').toBeLessThanOrEqual(9);
  });

  it('numbers nothing twice', () => {
    const twice = [...new Set(ns)].filter((n) => ns.filter((x) => x === n).length > 1);
    expect(twice, 'a section number was reused').toEqual([]);
  });

  it('is in ascending order, so a section was not appended in the wrong place', () => {
    expect(ns).toEqual([...ns].sort((a, b) => a - b));
  });
});

describe('the experience requirements', () => {
  const ns = sections(EXPERIENCE);

  it('parses', () => {
    expect(ns.length).toBeGreaterThan(50);
  });

  it('runs from 350 to 408 with nothing missing', () => {
    const missing = [];
    for (let n = 350; n <= 408; n++) if (!ns.includes(n)) missing.push(n);
    expect(missing).toEqual([]);
  });
});

describe('the collision, which is the thing worth guarding', () => {
  /*
   * Both documents have to say it. One of them saying it is a note somebody
   * deletes; both saying it is a convention.
   */
  it('is recorded in both documents', () => {
    for (const [name, doc] of [['platform', PLATFORM], ['experience', EXPERIENCE]] as const) {
      expect(doc, `${name} no longer explains the two numbering schemes`).toContain(
        'Two numbering schemes',
      );
      expect(doc, `${name} no longer names the other document`).toMatch(
        name === 'platform' ? /EXPERIENCE_REQUIREMENTS/ : /PLATFORM_REQUIREMENTS/,
      );
    }
  });

  /*
   * The overlap itself, asserted rather than described — if a future edit
   * renumbers one document out of the collision, this goes green only because
   * the collision genuinely ended, and the note above can then be removed on
   * purpose rather than by accident.
   */
  it('really is an overlap, and both really do use the range', () => {
    const platform = sections(PLATFORM);
    const experience = sections(EXPERIENCE);
    const shared = platform.filter((n) => experience.includes(n));
    expect(shared.length, 'the two documents no longer overlap').toBeGreaterThan(0);
    expect(Math.min(...shared)).toBe(350);
    expect(Math.max(...shared)).toBe(408);
  });
});
