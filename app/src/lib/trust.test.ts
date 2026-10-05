import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `docs/trust/` is the package handed to a university's security and
 * procurement reviewers, so every sentence in it is a claim somebody will
 * check. This keeps the checkable ones tied to the tree.
 *
 * Two things are held. First, every path the package cites exists — a
 * procurement room that points at a moved file reads, to a reviewer, as a
 * control that was never there. Second, the SOC 2 gap assessment scores no
 * control above what its evidence can carry: "tested" needs a check that runs
 * on every change, and "audit-ready" needs a document under `docs/evidence/`,
 * which only an outside party or the passage of an audit period can produce.
 * The same rule `hecvat-readiness.test.ts` holds for the HECVAT register,
 * because the failure is the same one: a row written optimistically.
 */

const ROOT = join(process.cwd(), '..');
const TRUST = join(ROOT, 'docs', 'trust');
const SOC2 = join(TRUST, 'SOC2-READINESS.md');

/** A backticked token that names a file or directory in the repository. */
const PATHLIKE = /^(?:\.?[\w-]+\/)+[\w.*-]*$|^[\w.-]+\.(?:md|ts|tsx|sql|toml|yml|mjs|json|snapshot)$/;

function citedPaths(text: string): string[] {
  return [...text.matchAll(/`([^`\s]+)`/g)]
    .map((m) => m[1])
    .filter((p) => PATHLIKE.test(p) && !p.includes('*'));
}

interface Row {
  id: string;
  score: number;
  evidence: string[];
  moves: string;
}

function soc2Rows(text = readFileSync(SOC2, 'utf8')): Row[] {
  return text
    .split('\n')
    .filter((line) => /^\| (?:CC1|CC6|AV)-\d{2} \|/.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const [id, , , , , , score, evidence, moves] = cells;
      return {
        id,
        score: Number(score),
        evidence: [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1]),
        moves,
      };
    });
}

const AUTOMATED = /\.test\.tsx?$|\.check\.sql$|^\.github\/workflows\//;

describe('the SOC 2 gap assessment', () => {
  const rows = soc2Rows();

  it('parses every row it should — an empty parse would pass everything below', () => {
    const ids = rows.map((r) => r.id);
    const want = [
      ...Array.from({ length: 10 }, (_, i) => `CC1-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 14 }, (_, i) => `CC6-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 9 }, (_, i) => `AV-${String(i + 1).padStart(2, '0')}`),
    ];
    expect(ids).toEqual(want);
  });

  it('scores on the 0–4 scale', () => {
    for (const r of rows) expect([0, 1, 2, 3, 4], r.id).toContain(r.score);
  });

  it('cites only files that exist', () => {
    for (const r of rows) {
      for (const p of r.evidence) expect(existsSync(join(ROOT, p)), `${r.id}: ${p}`).toBe(true);
    }
  });

  it('cites evidence for anything above absent', () => {
    for (const r of rows.filter((x) => x.score >= 1)) expect(r.evidence.length, r.id).toBeGreaterThan(0);
  });

  it('calls a control tested only when a check runs it on every change', () => {
    for (const r of rows.filter((x) => x.score >= 3)) {
      expect(r.evidence.some((p) => AUTOMATED.test(p)), r.id).toBe(true);
    }
  });

  it('calls a control audit-ready only with a filed document', () => {
    for (const r of rows.filter((x) => x.score === 4)) {
      expect(r.evidence.some((p) => p.startsWith('docs/evidence/')), r.id).toBe(true);
    }
  });

  it('says what would move every control short of audit-ready', () => {
    for (const r of rows.filter((x) => x.score < 4)) {
      expect(r.moves.replace(/—/g, '').trim().length, r.id).toBeGreaterThan(20);
    }
  });

  it('refuses optimistic rows — the rules above, pointed at fabricated ones', () => {
    const [tested, audited] = soc2Rows(
      [
        '| CC6-99 | CC6.1 | x | x | x | x | 3 | `SECURITY.md` | x |',
        '| CC6-98 | CC6.1 | x | x | x | x | 4 | `supabase/tenancy.check.sql` | — |',
      ].join('\n'),
    );
    expect(tested.score).toBe(3);
    expect(tested.evidence.some((p) => AUTOMATED.test(p))).toBe(false);
    expect(audited.evidence.some((p) => p.startsWith('docs/evidence/'))).toBe(false);
  });
});

describe('the trust package', () => {
  const docs = readdirSync(TRUST).filter((f) => f.endsWith('.md'));

  it('is the set of documents the index promises', () => {
    const index = readFileSync(join(TRUST, 'README.md'), 'utf8');
    const linked = [...index.matchAll(/\]\(([A-Z0-9-]+\.md)\)/g)].map((m) => m[1]);
    for (const d of docs.filter((d) => d !== 'README.md')) {
      expect(linked, `${d} is in docs/trust/ and missing from its index`).toContain(d);
    }
    for (const l of linked) expect(docs, `the index links ${l}, which is absent`).toContain(l);
  });

  it('cites only paths that exist, in every document', () => {
    let seen = 0;
    for (const d of docs) {
      for (const p of citedPaths(readFileSync(join(TRUST, d), 'utf8'))) {
        // `docs/evidence/` is where filed documents will go; naming it is not citing one.
        if (p.startsWith('docs/evidence')) continue;
        seen++;
        // A bare file name is a sibling link, like [`SLA.md`](SLA.md).
        const where = p.includes('/') ? join(ROOT, p) : join(TRUST, p);
        expect(existsSync(where) || existsSync(join(ROOT, p)), `docs/trust/${d}: ${p}`).toBe(true);
      }
    }
    // The probe sees citations at all.
    expect(seen).toBeGreaterThan(100);
  });

  it('never claims a certification, audit or completed assessment it does not hold', () => {
    // An affirmative claim, as opposed to the many sentences denying one.
    const CLAIM =
      /\b(?:is|are|we are|semester is)\s+(?:now\s+)?(?:SOC 2|ISO 27001|HIPAA|FERPA|HECVAT|WCAG|PCI)[- ](?:certified|compliant|audited|attested)/i;
    for (const d of docs) {
      const text = readFileSync(join(TRUST, d), 'utf8');
      const hits = text.split('\n').filter((l) => CLAIM.test(l) && !/\bnot\b|\bno\b|n't|never/i.test(l));
      expect(hits, d).toEqual([]);
    }
    expect(CLAIM.test('Semester is SOC 2 certified.')).toBe(true);
  });
});
