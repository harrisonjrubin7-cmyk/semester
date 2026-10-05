import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unsupportedClaims } from './gtm/rfp';

/**
 * `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` holds the answers that will
 * be copied into a university's HECVAT workbook. The readiness register next
 * to it says what the tree can show; this keeps the answers from saying more.
 * A Yes that rests on a control the register has not marked READY is the
 * failure this is for, because in a questionnaire it reads as a claim.
 */

const ROOT = join(process.cwd(), '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const ANSWERS = ['Yes', 'Partial', 'No', 'N/A', 'Company to supply'] as const;

interface Row { id: string; answer: string; explanation: string; basis: string }

function table(text: string, cols: number): string[][] {
  return text
    .split('\n')
    .filter((l) => /^\| [A-Z0-9]+-\d+ \|/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((c) => c.length === cols);
}

const register = new Map(
  table(read('docs', 'market-readiness', 'HECVAT_READINESS.md'), 6).map((c) => [c[0], c[3].replace(/`/g, '')]),
);

function draftRows(text: string): Row[] {
  return table(text, 6).map(([id, , , answer, explanation, basis]) => ({ id, answer, explanation, basis }));
}

const controls = (basis: string) => [...basis.matchAll(/HECVAT ([A-Z0-9]+-\d+)/g)].map((m) => m[1]);
const paths = (basis: string) => [...basis.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/** Every reason a row cannot stand, empty when it can. */
function problems(r: Row): string[] {
  const out: string[] = [];
  if (!(ANSWERS as readonly string[]).includes(r.answer)) out.push(`answer "${r.answer}"`);
  for (const p of paths(r.basis)) if (!existsSync(join(ROOT, p))) out.push(`missing path ${p}`);
  for (const c of controls(r.basis)) if (!register.has(c)) out.push(`no register row ${c}`);
  if (r.answer === 'Yes') {
    if (!paths(r.basis).length && !controls(r.basis).length) out.push('a Yes that cites nothing');
    for (const c of controls(r.basis)) {
      if (register.has(c) && register.get(c) !== 'READY') out.push(`a Yes on ${c}, which is ${register.get(c)}`);
    }
  }
  out.push(...unsupportedClaims(r.explanation).map((w) => `claim word "${w}"`));
  return out;
}

describe('the HECVAT draft response', () => {
  const rows = draftRows(read('docs', 'market-readiness', 'HECVAT_DRAFT_RESPONSE.md'));

  it('parses — the probe sees the rows, once each', () => {
    // An empty parse would pass everything below.
    expect(rows.length).toBeGreaterThanOrEqual(40);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(register.size).toBeGreaterThanOrEqual(30);
  });

  it('says nothing the tree and the register cannot back', () => {
    const bad = rows.map((r) => [r.id, problems(r)] as const).filter(([, p]) => p.length);
    expect(bad).toEqual([]);
  });

  it('refuses the rows it is meant to refuse', () => {
    const ok = { id: 'X-1', answer: 'Yes', explanation: 'Checked in CI.', basis: 'HECVAT SDLC-1' };
    expect(problems(ok)).toEqual([]);
    expect(problems({ ...ok, basis: 'HECVAT VULN-2' })).toEqual(['a Yes on VULN-2, which is NOT_STARTED']);
    expect(problems({ ...ok, basis: '—' })).toEqual(['a Yes that cites nothing']);
    expect(problems({ ...ok, basis: '`no/such/file.md`' })).toContain('missing path no/such/file.md');
    expect(problems({ ...ok, basis: 'HECVAT NOPE-9' })).toContain('no register row NOPE-9');
    expect(problems({ ...ok, answer: 'Mostly' })).toContain('answer "Mostly"');
    expect(problems({ ...ok, explanation: 'Semester is FERPA compliant.' }).some((p) => p.startsWith('claim word'))).toBe(true);
    // A No may rest on a control that is not ready; that is what a No is.
    expect(problems({ ...ok, answer: 'No', basis: 'HECVAT VULN-2' })).toEqual([]);
  });
});
