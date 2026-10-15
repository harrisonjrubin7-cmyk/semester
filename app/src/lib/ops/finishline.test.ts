import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The finish-line control system, held to its own rule.
 *
 * `docs/finish-line/SEMESTER_RELEASE_READINESS_REGISTER.md` is a set of tables
 * of capabilities, each with a Class and a Release. The rule this file holds is
 * the one the completion definition states: a row may not sit at `pilot-ready`,
 * `production-ready` or `authoritative` unless its Evidence cell cites
 * something. Nothing promotes a row because a screen exists.
 *
 * What this does not check: that the cited file exists, that it is current, or
 * that the row's other fields (tenant scope, accessibility, rollback…) are
 * filled in. The evidence register (`evidence.test.ts`) holds dated artifacts;
 * extending this guard to the full release-evidence field list is a recorded
 * follow-up in the 90-day plan.
 *
 * The checker is a pure function over markdown, so the tests below can hand it
 * a row that must be refused and a row that must pass. A guard that has never
 * been shown to fail is not known to be a guard.
 */

const root = join(import.meta.dirname, '../../../..');
const DIR = 'docs/finish-line';
const REGISTER = `${DIR}/SEMESTER_RELEASE_READINESS_REGISTER.md`;

const FILES = [
  'SEMESTER_FINISH_LINE_MASTER_PLAN',
  'SEMESTER_COMPLETION_DEFINITION',
  'SEMESTER_RELEASE_READINESS_REGISTER',
  'SEMESTER_DOMAIN_AUTHORITY_GATES',
  'SEMESTER_PRODUCT_COHERENCE_AUDIT',
  'SEMESTER_SECURITY_FINISH_LINE',
  'SEMESTER_ACCESSIBILITY_FINISH_LINE',
  'SEMESTER_AI_ASSURANCE_PROGRAM',
  'SEMESTER_MIGRATION_FACTORY',
  'SEMESTER_PILOT_DELIVERY_FACTORY',
  'SEMESTER_SUPPORT_AND_INCIDENT_READINESS',
  'SEMESTER_COMMERCIAL_READINESS',
  'SEMESTER_COMPANY_OPERATING_CADENCE',
  'SEMESTER_EVIDENCE_REGISTER',
  'SEMESTER_RISK_BURN_DOWN',
  'SEMESTER_90_DAY_FINISH_LINE_PLAN',
  'SEMESTER_MASTER_RELEASE_CHECKLIST',
].map((n) => `${DIR}/${n}.md`);

/** The vocabulary in SEMESTER_COMPLETION_DEFINITION.md. */
const CLASSES = new Set([
  'verified', 'untested', 'unsafe', 'inaccessible', 'not-tenant-safe', 'unsupported', 'integrated-only', 'mock',
  'documented', 'designed', 'planned', 'duplicate', 'stale', 'blocked', 'deprecated', 'decision', 'migration',
  'customer-evidence', 'ready-pilot', 'ready-production', 'ready-authoritative',
]);
const RELEASES = new Set(['not-released', 'flag-off', 'preview', 'pilot-ready', 'production-ready', 'authoritative']);
/** Release values that need evidence. */
const NEEDS_EVIDENCE = new Set(['pilot-ready', 'production-ready', 'authoritative']);

type Row = { id: string; cls: string; release: string; evidence: string };

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const bare = (c: string) => c.replace(/`/g, '').trim();

/** Every capability row in every table whose header has ID, Class, Release and Evidence columns. */
function parse(md: string): { rows: Row[]; problems: string[] } {
  const rows: Row[] = [];
  const problems: string[] = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i]!;
    if (!head.startsWith('|')) continue;
    const names = cells(head).map(bare);
    const at = (n: string) => names.indexOf(n);
    const [iId, iCls, iRel, iEv] = [at('ID'), at('Class'), at('Release'), at('Evidence')];
    if (iId < 0 || iCls < 0 || iRel < 0 || iEv < 0) continue;
    for (let j = i + 2; j < lines.length && lines[j]!.startsWith('|'); j++) {
      const c = cells(lines[j]!);
      if (c.length !== names.length) {
        problems.push(`line ${j + 1}: ${c.length} cells, header has ${names.length}`);
        continue;
      }
      const row = { id: bare(c[iId]!), cls: bare(c[iCls]!), release: bare(c[iRel]!), evidence: c[iEv]!.trim() };
      rows.push(row);
      if (!CLASSES.has(row.cls) && !CLASSES.has(`ready-${row.cls}`)) problems.push(`${row.id}: unknown class "${row.cls}"`);
      if (!RELEASES.has(row.release)) problems.push(`${row.id}: unknown release "${row.release}"`);
      if (NEEDS_EVIDENCE.has(row.release) && (row.evidence === '' || row.evidence === '—' || row.evidence === '-')) {
        problems.push(`${row.id}: release "${row.release}" cites no evidence`);
      }
    }
  }
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) problems.push(`${r.id}: row id used twice`);
    seen.add(r.id);
  }
  return { rows, problems };
}

const table = (...rows: string[]) =>
  ['| ID | Capability | Class | Release | Evidence |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');

describe('finish-line control system', () => {
  it('has all seventeen documents', () => {
    const missing = FILES.filter((f) => !existsSync(join(root, f)));
    expect(missing).toEqual([]);
  });

  it('holds the readiness register to its own rule', () => {
    const { rows, problems } = parse(readFileSync(join(root, REGISTER), 'utf8'));
    expect(rows.length).toBeGreaterThan(40);
    expect(problems).toEqual([]);
  });

  it('keeps every row at or below preview today (no row has cited evidence for more)', () => {
    const { rows } = parse(readFileSync(join(root, REGISTER), 'utf8'));
    const promoted = rows.filter((r) => NEEDS_EVIDENCE.has(r.release));
    expect(promoted.map((r) => r.id)).toEqual([]);
  });

  describe('the checker, shown to fail (controls)', () => {
    it('refuses a promoted row with no evidence', () => {
      for (const release of ['pilot-ready', 'production-ready', 'authoritative']) {
        for (const evidence of ['', '—', '-']) {
          const { problems } = parse(table(`| X1 | thing | verified | ${release} | ${evidence} |`));
          expect(problems, `${release} / "${evidence}"`).toEqual([`X1: release "${release}" cites no evidence`]);
        }
      }
    });

    it('accepts a promoted row that cites evidence, and an unpromoted row with none', () => {
      expect(parse(table('| X1 | thing | verified | production-ready | `docs/evidence/x.md` |')).problems).toEqual([]);
      expect(parse(table('| X2 | thing | designed | not-released | — |')).problems).toEqual([]);
    });

    it('refuses an unknown class, an unknown release, a short row and a repeated id', () => {
      const { problems } = parse(
        table(
          '| A | t | complete | preview | — |',
          '| B | t | verified | shipped | — |',
          '| C | t | verified | preview |',
          '| D | t | verified | preview | — |',
          '| D | t | verified | preview | — |',
        ),
      );
      expect(problems).toEqual([
        'A: unknown class "complete"',
        'B: unknown release "shipped"',
        'line 5: 4 cells, header has 5',
        'D: row id used twice',
      ]);
    });

    it('ignores tables that are not capability tables', () => {
      expect(parse('| Gate | State |\n| --- | --- |\n| x | production-ready |').rows).toEqual([]);
    });
  });
});
