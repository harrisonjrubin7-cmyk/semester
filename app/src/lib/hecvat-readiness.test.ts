import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `docs/market-readiness/HECVAT_READINESS.md` is a list of claims a university
 * security reviewer will read, and this is what keeps each one tied to the tree.
 *
 * The failure it exists for is the one this repository's scorecard has
 * already had six times, in both directions: a status that says more than the
 * code can show, or a cited file that has since moved. Worst of all would be
 * an ACR, a penetration test or a signed DPA marked present because somebody
 * wrote the row optimistically — those are documents a third party produces,
 * and the only honest place for them is a real file under `docs/evidence/`.
 */

const ROOT = join(process.cwd(), '..');
const DOC = join(ROOT, 'docs', 'market-readiness', 'HECVAT_READINESS.md');

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'TESTING', 'READY'] as const;
type Status = (typeof STATUSES)[number];

/** Controls whose evidence can only be produced outside this repository. */
const EXTERNAL = /penetration test|\bACR\b|VPAT|SOC 2|\bDPA\b|insurance/i;

interface Row {
  id: string;
  control: string;
  status: string;
  evidence: string[];
  moves: string;
}

function rows(text = readFileSync(DOC, 'utf8')): Row[] {
  return text
    .split('\n')
    .filter((line) => /^\| [A-Z0-9]+-\d+ \|/.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const [id, , control, status, evidence, moves] = cells;
      return {
        id,
        control,
        status: status.replace(/`/g, ''),
        evidence: [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1]),
        moves,
      };
    });
}

const above = (s: string, floor: Status) =>
  STATUSES.indexOf(s as Status) > STATUSES.indexOf(floor);

describe('the HECVAT readiness register', () => {
  const all = rows();

  it('parses the whole register — the probe sees rows, and the rows it expects', () => {
    // An empty parse would pass every assertion below.
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    expect(all.map((r) => r.id)).toEqual(expect.arrayContaining(['IAM-1', 'A11Y-2', 'VULN-2']));
  });

  it('uses only the five statuses', () => {
    for (const r of all) expect(STATUSES, r.id).toContain(r.status);
  });

  it('cites only files that exist', () => {
    for (const r of all) {
      for (const path of r.evidence) expect(existsSync(join(ROOT, path)), `${r.id}: ${path}`).toBe(true);
    }
  });

  it('never marks a control ready or testing without evidence', () => {
    for (const r of all.filter((x) => x.status === 'READY' || x.status === 'TESTING')) {
      expect(r.evidence.length, r.id).toBeGreaterThan(0);
    }
  });

  it('says what would move every control that has not started or is blocked', () => {
    for (const r of all.filter((x) => x.status === 'NOT_STARTED' || x.status === 'BLOCKED')) {
      expect(r.moves.replace(/—/g, '').trim().length, r.id).toBeGreaterThan(20);
    }
  });

  it('holds third-party evidence below in-progress until a real document is filed', () => {
    const external = all.filter((r) => EXTERNAL.test(r.control));
    // The probe, pointed at what it should see: pen test, ACR, DPA, SOC 2, insurance.
    expect(external.map((r) => r.id).sort()).toEqual(['A11Y-2', 'LEGAL-1', 'LEGAL-2', 'PRIV-4', 'VULN-2']);
    for (const r of external) {
      if (above(r.status, 'IN_PROGRESS')) {
        expect(r.evidence.some((p) => p.startsWith('docs/evidence/')), `${r.id} needs a filed document`).toBe(true);
      }
    }
  });

  it('refuses an optimistic row — the rules above, pointed at a fabricated one', () => {
    const fake = rows(
      '| A11Y-9 | Accessibility | Current ACR on the VPAT 2.x template | `READY` | `app/src/a11y` | — |',
    )[0];
    expect(EXTERNAL.test(fake.control)).toBe(true);
    expect(above(fake.status, 'IN_PROGRESS')).toBe(true);
    expect(fake.evidence.some((p) => p.startsWith('docs/evidence/'))).toBe(false);
  });
});
