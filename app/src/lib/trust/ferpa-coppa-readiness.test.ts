import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `docs/FERPA-COPPA-1EDTECH-READINESS.md` is read by an institution's privacy
 * office and counsel, and this keeps each row tied to the tree.
 *
 * The same rules as `hecvat-readiness.test.ts`, the register beside it, with
 * one tightening: a row short of `READY` must always say what would move it,
 * not only a row that has not started. And a different list of things only
 * the outside world can produce — a signed agreement, counsel's review, a
 * 1EdTech certificate, a TrustEd Apps review, a consent mechanism counsel
 * approved. The code cannot earn any of those.
 */

const ROOT = join(import.meta.dirname, '../../../..');
const DOC = join(ROOT, 'docs', 'FERPA-COPPA-1EDTECH-READINESS.md');

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'TESTING', 'READY'] as const;
type Status = (typeof STATUSES)[number];

/** Controls whose evidence can only be produced outside this repository. */
const EXTERNAL = /signed agreement|counsel's review|certification|TrustEd Apps|parental consent/i;

interface Row { id: string; area: string; control: string; status: string; evidence: string[]; moves: string }

function rows(text = readFileSync(DOC, 'utf8')): Row[] {
  return text
    .split('\n')
    .filter((line) => /^\| (FERPA|COPPA|EDT)-\d+ \|/.test(line))
    .map((line) => {
      const [id, area, control, status, evidence, moves] = line.split('|').slice(1, -1).map((c) => c.trim());
      return { id, area, control, status: status.replace(/`/g, ''), evidence: [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1]), moves };
    });
}

const above = (s: string, floor: Status) => STATUSES.indexOf(s as Status) > STATUSES.indexOf(floor);

describe('the FERPA, COPPA and 1EdTech readiness register', () => {
  const all = rows();

  it('parses the whole register, and the rows it must have', () => {
    expect(all.length).toBeGreaterThanOrEqual(20);
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    expect(all.map((r) => r.id)).toEqual(expect.arrayContaining(['FERPA-1', 'COPPA-1', 'EDT-5']));
    for (const area of ['FERPA', 'COPPA', '1EdTech']) expect(all.some((r) => r.area === area), area).toBe(true);
  });

  it('uses only the five statuses', () => {
    for (const r of all) expect(STATUSES, r.id).toContain(r.status);
  });

  it('cites only files that exist', () => {
    for (const r of all) for (const p of r.evidence) expect(existsSync(join(ROOT, p)), `${r.id}: ${p}`).toBe(true);
  });

  it('never marks a row ready or testing without evidence', () => {
    for (const r of all.filter((x) => x.status === 'READY' || x.status === 'TESTING')) {
      expect(r.evidence.length, r.id).toBeGreaterThan(0);
    }
  });

  it('says what would move every row short of ready', () => {
    for (const r of all.filter((x) => x.status !== 'READY')) {
      expect(r.moves.replace(/—/g, '').trim().length, r.id).toBeGreaterThan(20);
    }
  });

  it('holds outside-world evidence below in-progress until a real document is filed', () => {
    const external = all.filter((r) => EXTERNAL.test(r.control));
    // The probe, pointed at what it should see.
    expect(external.map((r) => r.id).sort()).toEqual(['COPPA-4', 'COPPA-5', 'EDT-5', 'EDT-7', 'FERPA-1']);
    for (const r of external) {
      if (above(r.status, 'IN_PROGRESS')) {
        expect(r.evidence.some((p) => p.startsWith('docs/evidence/')), `${r.id} needs a filed document`).toBe(true);
      }
    }
  });

  it('refuses an optimistic row — the rule above, pointed at a fabricated one', () => {
    const fake = rows('| EDT-9 | 1EdTech | 1EdTech LTI Advantage certification | `READY` | `supabase/lti.check.sql` | — |')[0];
    expect(EXTERNAL.test(fake.control)).toBe(true);
    expect(above(fake.status, 'IN_PROGRESS')).toBe(true);
    expect(fake.evidence.some((p) => p.startsWith('docs/evidence/'))).toBe(false);
  });

  it('makes no compliance claim in its own words', () => {
    const text = readFileSync(DOC, 'utf8');
    expect(text).toMatch(/Nothing here claims compliance/);
    expect(text).not.toMatch(/\b(is|are) (FERPA|COPPA)[- ]compliant\b/i);
  });
});
