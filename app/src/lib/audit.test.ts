import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROLS, OVERRIDES, PILLARS, QUADRANT_ACTION, SCORE_MEANING, STAGES, band, byPillar, histogram, leaks, priority, quadrant, type Pillar, type Score } from './audit';
import { isTest } from './ops/claims';
import { cell, controlLine, link, renderedFrom, table } from './ops/render';

/**
 * The audit is only worth having if a score cannot claim more than the tree
 * shows: a 3 or 4 cites a path that exists, a 4 cites a test or check, the
 * ids are the workbook's, and the totals are stated so a change is a diff.
 * `docs/operating-model/FOUR-PILLAR-AUDIT.md` is written under
 * `REGISTERS=write`; run `npm run registers` from app/.
 */
const root = join(import.meta.dirname, '../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/operating-model/FOUR-PILLAR-AUDIT.md';
const PREFIX: Record<Pillar, string> = { website: 'WEB', app: 'APP', operations: 'OPE', funnels: 'FUN' };

describe('the four-pillar audit', () => {
  it('carries the workbook’s 45 controls under their own ids', () => {
    expect(CONTROLS).toHaveLength(45);
    expect(new Set(CONTROLS.map((x) => x.id)).size).toBe(45);
    for (const x of CONTROLS) expect(x.id, x.id).toMatch(new RegExp(`^${PREFIX[x.pillar]}-\\d{3}$`));
    expect(byPillar().map((p) => p.controls)).toEqual([11, 11, 11, 12]);
  });

  it('cites a path that exists at 3 or 4, a test or check at 4, and a gap on every row', () => {
    for (const x of CONTROLS) {
      expect(x.gap.length, x.id).toBeGreaterThan(30);
      if (x.score >= 3) {
        expect(x.evidence, `${x.id} scores ${x.score} and cites nothing`).not.toBeNull();
        expect(exists(x.evidence!), `${x.id} cites ${x.evidence}`).toBe(true);
      }
      if (x.score === 4) expect(isTest(x.evidence!), `${x.id} scores 4 without a test or check`).toBe(true);
      if (x.evidence) expect(exists(x.evidence), `${x.id} cites ${x.evidence}`).toBe(true);
    }
  });

  it('states the finding: the totals by pillar and the histogram', () => {
    expect(byPillar().map((p) => [p.pillar, p.total, p.max])).toEqual([
      ['website', 28, 44],
      ['app', 34, 44],
      ['operations', 23, 44],
      ['funnels', 18, 48],
    ]);
    expect(histogram()).toEqual({ 0: 1, 1: 10, 2: 14, 3: 15, 4: 5 });
    expect(byPillar().find((p) => p.pillar === 'funnels')!.weak).toContain('FUN-003');
  });

  it('prioritises with the workbook’s formula, bands and override', () => {
    const f = { harm: 3, revenue: 4, frequency: 3, strategic: 4, confidence: 3, effort: 2 };
    expect(priority(f)).toBe(12);
    expect(band(f)).toBe('P1');
    expect(band({ ...f, effort: 3 })).toBe('P2');
    expect(band({ ...f, effort: 5 })).toBe('P3');
    expect(band({ ...f, effort: 5, override: 'privacy' })).toBe('P0');
    expect(() => priority({ ...f, harm: 0 })).toThrow(/harm/);
    expect(() => priority({ ...f, effort: 6 })).toThrow(/effort/);
  });

  it('reads the impact-versus-effort quadrant the way the matrix does', () => {
    expect(quadrant({ harm: 5, revenue: 2, frequency: 3, strategic: 3, confidence: 3, effort: 1 })).toBe('quick-win');
    expect(quadrant({ harm: 5, revenue: 2, frequency: 3, strategic: 3, confidence: 3, effort: 4 })).toBe('strategic-bet');
    expect(quadrant({ harm: 2, revenue: 3, frequency: 3, strategic: 3, confidence: 3, effort: 2 })).toBe('fill-in');
    expect(quadrant({ harm: 2, revenue: 3, frequency: 3, strategic: 3, confidence: 3, effort: 3 })).toBe('defer');
    expect(quadrant({ harm: 1, revenue: 1, frequency: 1, strategic: 1, confidence: 1, effort: 5, override: 'data-loss' })).toBe('P0');
    for (const q of Object.keys(QUADRANT_ACTION)) expect(QUADRANT_ACTION[q as keyof typeof QUADRANT_ACTION].length).toBeGreaterThan(20);
    expect(Object.keys(OVERRIDES)).toHaveLength(6);
  });

  it('finds the leak: step conversion, drop-off, and a flag under target', () => {
    const rows = leaks([
      { stage: 'Landing page viewed', n: 1000 },
      { stage: 'CTA clicked', n: 100, target: 0.15 },
      { stage: 'Form started', n: 60, target: 0.5 },
      { stage: 'Form submitted', n: 0 },
      { stage: 'Meeting booked', n: 0 },
    ]);
    expect(rows[0]).toMatchObject({ prior: null, conversion: null, dropOff: null, investigate: false });
    expect(rows[1]).toMatchObject({ prior: 1000, conversion: 0.1, investigate: true });
    expect(rows[1].dropOff).toBeCloseTo(0.9);
    expect(rows[2]).toMatchObject({ conversion: 0.6, investigate: false });
    expect(rows[4]).toMatchObject({ prior: 0, conversion: null, investigate: false });
    expect(STAGES).toHaveLength(15);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

function render(): string {
  const h = histogram();
  const out: string[] = [
    '# The four-pillar audit',
    '',
    renderedFrom('app/src/lib/audit.ts', 'audit.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Website, application and console, operations, and funnels: the 45 controls of',
    'the audit workbook, each scored 0–4 against the tree, with what holds it and',
    'the gap. A score of 3 or 4 cites a path that exists; a 4 cites a test or',
    'check that runs on every change. The workbook is filled from this page, so',
    'the two cannot disagree.',
    '',
    `**Scores: ${h[4]} at 4, ${h[3]} at 3, ${h[2]} at 2, ${h[1]} at 1, ${h[0]} at 0.**`,
    'Funnels is the weakest pillar because there is no traffic, no lead and no',
    'customer to measure; every control there says what the measurement will be.',
    '',
    '## The scale',
    '',
    ...table(['Score', 'Means', 'Required action'], ([0, 1, 2, 3, 4] as Score[]).map((s) => [String(s), SCORE_MEANING[s].means, SCORE_MEANING[s].action])),
    '',
    '## The pillars',
    '',
    ...table(
      ['Pillar', 'Primary question', 'Primary failure mode', 'Benchmark outcome', 'Score', 'At 0 or 1'],
      byPillar().map((p) => [PILLARS[p.pillar].title, PILLARS[p.pillar].question, PILLARS[p.pillar].failure, PILLARS[p.pillar].outcome, `${p.total} / ${p.max}`, p.weak.join(', ') || '—']),
    ),
    '',
  ];
  for (const p of Object.keys(PILLARS) as Pillar[]) {
    out.push(`## ${PILLARS[p].title}`, '', `> ${PILLARS[p].question}`, '');
    out.push(
      ...table(
        ['ID', 'Domain', 'Control', 'Score', 'Evidence', 'Gap, or what is measured'],
        CONTROLS.filter((x) => x.pillar === p).map((x) => [x.id, x.domain, cell(x.control), String(x.score), x.evidence ? `[\`${x.evidence}\`](${link(DOC, x.evidence)})` : '—', cell(x.gap)]),
        ['left', 'left', 'left', 'right'],
      ),
      '',
    );
  }
  out.push(
    '## Prioritising a finding',
    '',
    'priority = (2 × user harm + 2 × revenue impact + frequency + strategic value + confidence) ÷ effort, each 1–5.',
    'Bands: P1 ≥ 12; P2 8–11.99; P3 < 8. Any finding involving one of the following is P0 whatever the formula says:',
    '',
    ...Object.values(OVERRIDES).map((o) => `- ${o}`),
    '',
    ...table(['Quadrant', 'Default action'], Object.entries(QUADRANT_ACTION).map(([q, a]) => [q, a])),
    '',
    '## The conversion-leak detector',
    '',
    'For each funnel — student self-serve sign-up, institutional demo request, enterprise technical evaluation, pilot-to-paid, onboarding, activation, renewal — enter the count at each stage; `leaks()` gives step conversion, drop-off and an investigate flag under target. The stages, in order:',
    '',
    ...STAGES.map((s, i) => `${i + 1}. ${s}`),
    '',
  );
  return out.join('\n');
}
