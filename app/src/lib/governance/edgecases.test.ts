import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDGE_CASES, EDGE_DOMAINS, coverage, type EdgeDomain } from './edgecases';

/**
 * The catalog is only worth having if a row cannot claim a guard that does
 * not exist or is not a test. So:
 *
 *   - every guard exists, with a control that a missing one reads missing;
 *   - every guard is a test that runs on every change, and the classifier
 *     itself is checked so a runbook cannot be smuggled in as a guard;
 *   - the count of owed cases is stated directly, so the commit that adds a
 *     guard has to say so here.
 *
 * `docs/EDGE-CASE-CATALOG.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/EDGE-CASE-CATALOG.md';

const isTest = (p: string) =>
  /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p) || /^app\/scripts\/.*smoke.*\.mjs$/.test(p) || p === 'supabase/restore.sh';

describe('the edge-case catalog', () => {
  it('can tell a missing file from a present one, and a test from a runbook', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('app/src/lib/governance/no-such-guard.test.ts')).toBe(false);
    expect(isTest('app/src/lib/offline.test.ts')).toBe(true);
    expect(isTest('supabase/tenancy.check.sql')).toBe(true);
    expect(isTest('RESTORE.md')).toBe(false);
    expect(isTest('app/src/lib/offline.ts')).toBe(false);
  });

  it('names each case once, in a known domain, with a note', () => {
    const ids = EDGE_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of EDGE_CASES) {
      expect(Object.keys(EDGE_DOMAINS), c.id).toContain(c.domain);
      expect(c.case.trim().length, c.id).toBeGreaterThan(10);
      expect(c.note.trim().length, `${c.id} has no note`).toBeGreaterThan(20);
    }
    for (const d of Object.keys(EDGE_DOMAINS) as EdgeDomain[]) expect(EDGE_CASES.some((c) => c.domain === d), d).toBe(true);
  });

  it('cites only guards that exist and are tests', () => {
    for (const c of EDGE_CASES) {
      if (!c.guard) continue;
      expect(exists(c.guard), `${c.id} cites ${c.guard}, which is missing`).toBe(true);
      expect(isTest(c.guard), `${c.id} cites ${c.guard}, which is not a test`).toBe(true);
    }
  });

  it('holds the plan\'s fourteen especially important cases', () => {
    expect(EDGE_CASES.filter((c) => c.critical)).toHaveLength(14);
  });

  it('states the finding: how many are guarded, how many owed', () => {
    const c = coverage();
    expect(c.guarded + c.owed).toBe(EDGE_CASES.length);
    // Said directly, so a change in either direction has to be explained here.
    expect(c).toEqual({
      guarded: 37,
      owed: 44,
      owedCritical: ['EC-DQ-01', 'EC-LMS-02', 'EC-LMS-04', 'EC-LMS-07', 'EC-AI-01', 'EC-GOV-02'],
    });
    expect(coverage([{ id: 'x', domain: 'ai', case: 'a case', guard: null, note: 'a note long enough to pass' }])).toEqual({ guarded: 0, owed: 1, owedCritical: [] });
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const c = coverage();
  const out: string[] = [
    '# Edge-case catalog',
    '',
    '<!-- Rendered from app/src/lib/governance/edgecases.ts by edgecases.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    'The cases the launch plan says still have to be tested, each with the',
    'automated guard that already exercises it, or none. A guard is a test that',
    'runs on every change; a runbook or a design does not count, and every guard',
    'cited must exist. Most guards were written for a narrower question than the',
    'case asks, and the note says what each proves and what it does not.',
    '',
    `**${c.guarded} of ${EDGE_CASES.length} cases have a guard; ${c.owed} are owed.** Of the plan's fourteen`,
    `especially important cases, ${c.owedCritical.length} have nothing: ${c.owedCritical.join(', ')}.`,
    'Most owed cases wait on something that does not exist yet (an assessment',
    'engine, billing, a live SIS), and the note says which.',
    '',
  ];
  for (const d of Object.keys(EDGE_DOMAINS) as EdgeDomain[]) {
    const rows = EDGE_CASES.filter((r) => r.domain === d);
    out.push(`## ${EDGE_DOMAINS[d]}`, '', `${rows.filter((r) => r.guard).length} of ${rows.length} guarded.`, '', '| ID | Case | Guard | What it proves, and what it does not |', '| --- | --- | --- | --- |');
    for (const r of rows) out.push(`| ${r.id} | ${cell(r.case)}${r.critical ? ' **(important)**' : ''} | ${r.guard ? `\`${r.guard}\`` : 'owed'} | ${cell(r.note)} |`);
    out.push('');
  }
  return out.join('\n');
}
