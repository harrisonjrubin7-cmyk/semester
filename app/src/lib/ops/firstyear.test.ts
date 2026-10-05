import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUPS, GROUP_TITLE, MEASURES, type Measure } from './firstyear';
import { cell, controlLine, link, renderedFrom, table } from './render';
import { written } from './decisionlog';

/**
 * The company’s first-year measures, held to what can actually be read.
 *
 * A measure that says it is `measured` cites a query or document that
 * returns the number; one that says `instrumented` cites code; one that is
 * only `defined` may cite the place its reading would come from, or nothing.
 * No target may be set without a decision in the log, and today none is.
 *
 * `docs/COMPANY-FIRST-YEAR-MEASURES.md` is rendered from the data; `npm run registers`
 * from app/ rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'docs/COMPANY-FIRST-YEAR-MEASURES.md';

/** The brief's list, in its order. */
const BRIEF: Record<(typeof GROUPS)[number], string[]> = {
  students: ['Active users', 'Meaningful actions completed', 'Path clarity score', 'Return rate', 'Trust/source comprehension', 'Accessibility task success'],
  institutions: ['Signed departments/institutions', 'Implementation time', 'Pilot-to-annual conversion', 'Renewal rate', 'Expansion rate', 'Security-review cycle time'],
  platform: ['Critical journey SLO', 'P0/P1 incidents', 'Restore success', 'Integration freshness', 'Accessibility blocker rate'],
  business: ['ARR/MRR', 'Gross retention', 'Net retention', 'Gross margin', 'CAC payback', 'Runway'],
};

const isCode = (p: string) => /\.(ts|tsx|mjs|sql)$/.test(p);

describe('the company’s first-year measures', () => {
  it('are the brief’s measures, in its groups and order', () => {
    for (const g of GROUPS) expect(MEASURES.filter((m) => m.group === g).map((m) => m.name), g).toEqual(BRIEF[g]);
    expect(MEASURES.map((m) => m.group)).toEqual(GROUPS.flatMap((g) => BRIEF[g].map(() => g)));
    expect(new Set(MEASURES.map((m) => m.id)).size).toBe(MEASURES.length);
  });

  it('define each one precisely enough to be counted twice the same way', () => {
    for (const m of MEASURES) {
      expect(m.definition.length, m.id).toBeGreaterThan(40);
      expect(m.note.length, m.id).toBeGreaterThan(20);
    }
  });

  it('cite only sources that exist', () => {
    expect(existsSync(at('supabase/no-such-query.sql'))).toBe(false);
    for (const m of MEASURES) if (m.source) expect(existsSync(at(m.source)), `${m.id} cites ${m.source}`).toBe(true);
  });

  it('hold each state to the kind of source it claims', () => {
    for (const m of MEASURES) {
      if (m.state === 'measured') expect(m.source, `${m.id} is measured and cites nothing`).not.toBeNull();
      if (m.state === 'instrumented') expect(m.source !== null && isCode(m.source), `${m.id} is instrumented and cites no code`).toBe(true);
    }
  });

  it('set no target without a decision, and today set none', () => {
    for (const m of MEASURES) {
      if (m.target) expect(written(root, m.target.decision), `${m.id}: target ${m.target.value} cites ${m.target.decision}, which is not in the log`).toBe(true);
    }
    expect(MEASURES.filter((m) => m.target)).toEqual([]);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ──────────────────────────────────────────────────────────────

function render(): string {
  const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
  const count = (s: Measure['state']) => MEASURES.filter((m) => m.state === s).length;
  const out: string[] = [
    '# Company first-year measures',
    '',
    renderedFrom('app/src/lib/ops/firstyear.ts', 'firstyear.test.ts'),
    '',
    controlLine(DOC),
    '',
    'What success means in the first twelve months, as measures. "Be the',
    'leader" is directionally useful and cannot be checked; this is the first',
    'version of it that can. Four groups, each measure defined, and for each the',
    'place its number comes from today — or the statement that no such place',
    'exists yet.',
    '',
    '## Where it stands',
    '',
    ...table(
      ['State', 'Meaning', 'Measures'],
      [
        ['measured', 'A query or document in the repository returns the number today', String(count('measured'))],
        ['instrumented', 'The definition and its shape exist in code; no reading has been taken', String(count('instrumented'))],
        ['defined', 'Defined here only; the reading needs work that has not been decided', String(count('defined'))],
        ['**total**', '', `**${MEASURES.length}**`],
      ],
      ['left', 'left', 'right'],
    ),
    '',
    `**No target is set.** A target is the founder’s decision, recorded in`,
    `${ref('docs/DECISION-LOG.md')}; a number written here by anyone else is a`,
    'number nobody decided. The test refuses a target with no decision behind it.',
    'The measures are defined so that the decision, when it comes, is about a',
    'number and not about what the number means.',
    '',
    `**No collection is implied.** ${ref('ANALYTICS.md')} holds three marks and`,
    'nothing else, and D-005 says a fourth lands with its question and its',
    'migration in the same pull request. A `defined` measure is a definition. It',
    'counts nothing.',
    '',
  ];
  for (const g of GROUPS) {
    out.push(`## ${GROUP_TITLE[g]}`, '');
    out.push(
      ...table(
        ['Measure', 'Definition', 'State', 'Source', 'Target', 'Note'],
        MEASURES.filter((m) => m.group === g).map((m) => [
          `**${cell(m.name)}**`,
          cell(m.definition),
          m.state,
          m.source ? ref(m.source) : '—',
          m.target ? `${m.target.value} (\`${m.target.decision}\`)` : '*[DECIDE]*',
          cell(m.note),
        ]),
      ),
      '',
    );
  }
  out.push(
    '## Setting a target',
    '',
    '1. Record the decision as `docs/decisions/D-<n>.md`, `n` being its pull',
    '   request\'s number, with the number, the date it is judged on, and what',
    '   would change it.',
    '2. Set `target: { value, decision }` on the measure in',
    '   `app/src/lib/ops/firstyear.ts`.',
    '3. Run `npm run registers` from `app/` to rewrite this page.',
    '',
    'A measure whose reading needs a new mark goes through D-005 first, and',
    'lands with its question in `ANALYTICS.md` and its migration in the same',
    'pull request.',
    '',
    '## How this page is held',
    '',
    `${ref('app/src/lib/ops/firstyear.test.ts')} fails when a measure is missing`,
    'or out of the brief’s order, when a source does not exist, when a measured',
    'or instrumented state cites nothing that would return the number, when a',
    'target has no decision, or when this page is stale.',
    '',
  );
  return out.join('\n');
}
