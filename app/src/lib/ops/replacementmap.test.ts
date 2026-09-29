import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTER } from '../masterregister';
import { CLAIMS, RANK, FLOOR } from './claims';
import { CORE_MODULES, companySiteBlock, coreStatus } from './replacementmap';

const SITE = join(import.meta.dirname, '../../../../company-site/index.html');
const SUMS = join(import.meta.dirname, '../../../../company-site/SHA256SUMS');
const START = '<!-- core-map:start -->';
const END = '<!-- core-map:end -->';

describe('the replacement map', () => {
  it('names every module once, each resting only on rows the master register has', () => {
    const ids = CORE_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of CORE_MODULES) for (const r of m.rows) expect(REGISTER.some((x) => x.id === r), `${m.id}: ${r}`).toBe(true);
  });

  it('covers the whole stack, K-12 and fundraising included', () => {
    for (const id of ['lms-content', 'lms-gradebook', 'registration', 'degree-audit', 'records', 'admissions', 'student-accounts', 'financial-aid', 'scheduling', 'k12', 'advancement']) {
      expect(CORE_MODULES.some((m) => m.id === id), id).toBe(true);
    }
  });

  it('never says more than the weakest row supports', () => {
    for (const m of CORE_MODULES) {
      const s = coreStatus(m);
      for (const r of m.rows) {
        const row = REGISTER.find((x) => x.id === r)!;
        expect(RANK[row.status], `${m.id} is ${s} on ${r} (${row.status})`).toBeGreaterThanOrEqual(RANK[FLOOR[s]]);
      }
      if (m.rows.length === 0 && !m.availableClaim) expect(s, m.id).toBe('planned');
    }
  });

  it('says available only through an available claim, and never from rows alone', () => {
    const tested = { id: 'x', area: 'X', takesOver: 'X', connect: 'X', rows: ['R'] };
    expect(coreStatus(tested, () => 'launch-approved')).toBe('built-tested');
    expect(coreStatus(tested, () => 'building')).toBe('in-preparation');
    expect(coreStatus(tested, () => 'designed')).toBe('planned');
    expect(coreStatus({ ...tested, availableClaim: 'missing' }, () => 'tested')).toBe('built-tested');
    const live = CLAIMS.find((c) => c.status === 'available')!;
    expect(coreStatus({ ...tested, availableClaim: live.id }, () => 'designed')).toBe('available');
    for (const m of CORE_MODULES) expect(coreStatus(m), m.id).not.toBe('available');
  });

  it('is what the company site prints on its home page', () => {
    const html = readFileSync(SITE, 'utf8');
    const a = html.indexOf(START);
    const b = html.indexOf(END);
    expect(a, 'the start marker').toBeGreaterThan(-1);
    expect(b, 'the end marker').toBeGreaterThan(a);
    const want = `${START}\n${companySiteBlock()}\n${END}`;
    if (process.env.REGISTERS === 'write') {
      const next = html.slice(0, a) + want + html.slice(b + END.length);
      writeFileSync(SITE, next);
      writeFileSync(SUMS, `${createHash('sha256').update(next).digest('hex')}  index.html\n`);
      return;
    }
    expect(html.slice(a, b + END.length)).toBe(want);
    expect(html).not.toMatch(/does not replace your SIS/i);
    const sums = readFileSync(SUMS, 'utf8').split(/\s+/)[0];
    expect(sums, 'company-site/SHA256SUMS').toBe(createHash('sha256').update(html).digest('hex'));
  });
});
