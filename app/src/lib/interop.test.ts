import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREDENTIAL_LIFECYCLE, PRINCIPLES, STAGES, STANDARDS, standardById } from './interop';
import { CLAIMS, STATUS_LABEL, claim } from './ops/claims';
import { cell, controlLine, link, renderedFrom, table } from './ops/render';

/**
 * The roadmap is only worth publishing if every row's status is the claims
 * register's word, every document it cites exists, and the rendered page is
 * the data. `docs/INTEROPERABILITY-ROADMAP.md` is written by this test under
 * `REGISTERS=write`; run `npm run registers` from app/.
 */
const root = join(import.meta.dirname, '../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/INTEROPERABILITY-ROADMAP.md';

describe('the interoperability roadmap', () => {
  it('names each standard once, in the brief’s priority order, resting on a claim that exists', () => {
    const ids = STANDARDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const priorities = STANDARDS.map((s) => s.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
    for (const s of STANDARDS) {
      expect(CLAIMS.some((c) => c.id === s.claim), `${s.id} rests on claim ${s.claim}`).toBe(true);
      expect(exists(s.documentation), `${s.id} cites ${s.documentation}`).toBe(true);
      expect(claim(s.claim).pages, `${s.claim} must appear on the integration registry`).toContain('/platform/integrations/');
    }
    expect(standardById('lti').claim).toBe('lti');
    expect(() => standardById('nope')).toThrow();
  });

  it('claims no certification, anywhere', () => {
    const text = JSON.stringify({ STANDARDS, STAGES, PRINCIPLES });
    expect(text).not.toMatch(/certified|certification awarded|1EdTech certified/i);
    expect(STAGES.find((s) => s.n === 3)!.standing).toMatch(/no certification is claimed/);
  });

  it('keeps the brief’s principles and the credential lifecycle whole', () => {
    expect(PRINCIPLES.lti).toHaveLength(10);
    expect(PRINCIPLES.oneroster).toHaveLength(6);
    expect(PRINCIPLES.caliper).toHaveLength(7);
    expect(CREDENTIAL_LIFECYCLE).toHaveLength(8);
    expect(CREDENTIAL_LIFECYCLE[0]).toBe('Achievement definition');
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

function render(): string {
  const out: string[] = [
    '# Interoperability roadmap',
    '',
    renderedFrom('app/src/lib/interop.ts', 'interop.test.ts'),
    '',
    controlLine(DOC),
    '',
    'The standards Semester supports or intends to, in the order the brief sets,',
    'each with the status word the public claims register gives it — the same',
    'word `/platform/integrations/` prints — and the principles each is',
    'implemented under. Nothing here claims a certification; stage 3 says so.',
    '',
    '## The standards',
    '',
    ...table(
      ['Priority', 'Standard', 'Used for', 'Direction', 'Timing', 'Status', 'Rests on', 'Documentation'],
      STANDARDS.map((s) => {
        const c = claim(s.claim);
        return [String(s.priority), cell(s.standard), cell(s.use), cell(s.direction), s.timing, STATUS_LABEL[c.status], c.rows.map((r) => `\`${r}\``).join(', ') || '—', `[\`${s.documentation}\`](${link(DOC, s.documentation)})`];
      }),
      ['right'],
    ),
    '',
    '## Principles',
    '',
  ];
  for (const [k, title] of [['lti', 'LTI'], ['oneroster', 'OneRoster'], ['caliper', 'Caliper']] as const) {
    out.push(`### ${title}`, '', ...PRINCIPLES[k].map((p) => `- ${p}`), '');
  }
  out.push('## The credential lifecycle', '', ...CREDENTIAL_LIFECYCLE.map((s, i) => `${i + 1}. ${s}`), '', '## The 1EdTech plan', '');
  for (const st of STAGES) out.push(`### Stage ${st.n}: ${st.title}`, '', ...st.steps.map((x) => `- ${x}`), '', `**Where it stands:** ${st.standing}`, '');
  return out.join('\n');
}
