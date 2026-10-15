/**
 * The copy-level claims register (§8 of the brand and marketing strategy) is the
 * list of actual sentences marketing may use. A sentence with no claim behind it,
 * no owner, or no review date is how an unapproved claim ships, so this holds the
 * table to its own rules.
 *
 * It reads the markdown the way `growthplan.test.ts` reads its numbers. Moving the
 * register into `ops/claims` data, as the strategy proposes, would replace this;
 * until then this is what stops the table drifting.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../../..');
const doc = readFileSync(join(root, 'docs/gtm/BRAND-AND-MARKETING-STRATEGY.md'), 'utf8');
const topics = readFileSync(join(root, 'PUBLIC-CLAIMS-APPROVAL-REGISTER.md'), 'utf8');

/** Review-by date for each risk, set in §8.1 from the 2026-10-03 evidence base. */
const REVIEW_BY: Record<string, string> = { High: '2026-11-03', Med: '2026-12-03', Low: '2027-01-03' };
const RISKS = ['High', 'Med', 'Low', 'Prohibited'];
const STATUS = /^(In preparation|Planned|Limited beta|Built|Decided|✋|PROHIBITED|—)/;

interface Row {
  id: string;
  words: string;
  status: string;
  evidence: string;
  owner: string;
  review: string;
  risk: string;
  qualifier: string;
}

function rows(): Row[] {
  const section = doc.split(/^### 8\.2 Register/m)[1]?.split(/^### 8\.3 /m)[0] ?? '';
  const out: Row[] = [];
  for (const line of section.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const id = /^(M-\d+b?)\b/.exec(cells[0] ?? '');
    if (!id) continue;
    expect(cells.length, `${cells[0]} has eight cells`).toBe(8);
    const [, words, status, evidence, owner, review, risk, qualifier] = cells;
    out.push({ id: id[1], words, status: status.replace(/\*\*/g, ''), evidence, owner, review, risk, qualifier });
  }
  return out;
}

const all = rows();
const prohibited = (r: Row) => /PROHIBITED/.test(r.status);

describe('the copy-level claims register', () => {
  it('has rows, with no id written twice', () => {
    expect(all.length).toBeGreaterThan(30);
    const ids = all.map((r) => r.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('gives every row a status word from the ladder and never says Available', () => {
    for (const r of all) {
      expect(r.status, `${r.id} status`).toMatch(STATUS);
      expect(r.status, `${r.id} must not claim Available`).not.toMatch(/Available/i);
    }
  });

  it('puts every sentence a team may use behind evidence, an owner and a review date', () => {
    for (const r of all.filter((x) => !prohibited(x))) {
      expect(r.evidence, `${r.id} evidence`).not.toBe('');
      expect(r.owner, `${r.id} owner`).not.toMatch(/^—?$/);
      expect(RISKS, `${r.id} risk`).toContain(r.risk);
      expect(r.risk, `${r.id} is not a prohibited-class risk`).not.toBe('Prohibited');
      expect(r.review, `${r.id} review-by follows its risk`).toBe(REVIEW_BY[r.risk]);
    }
  });

  it('keeps prohibited rows prohibited all the way across', () => {
    for (const r of all.filter(prohibited)) {
      expect(r.risk, `${r.id} risk`).toBe('Prohibited');
      expect(r.owner, `${r.id} owner`).toBe('—');
      expect(r.review, `${r.id} review`).toBe('—');
    }
  });

  it('cites only claim ids the topic register holds', () => {
    const cited = new Set(all.flatMap((r) => r.evidence.match(/CLM-\d{3}/g) ?? []));
    expect(cited.size).toBeGreaterThan(0);
    for (const id of cited) expect(topics, `${id} is in the topic register`).toContain(`| ${id} |`);
  });
});
