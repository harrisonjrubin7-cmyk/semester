import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cell, controlLine, link, renderedFrom, table } from '../ops/render';
import { AUDIT_SOURCES, AUDIT_STATUSES, CAN_FAIL, PROPOSALS, builtHere, counts, type AuditSource, type AuditStatus } from './roadmap-audit';

/**
 * The roadmap audit is only worth having if a row cannot claim more than the
 * tree shows:
 *
 *   - every cited path exists;
 *   - a `landed` row cites something that can fail (a test, a database check, a
 *     script, a workflow) — a document alone never makes a row landed;
 *   - an `absent` row cites nothing, and a `partial` or `landed` row cites something;
 *   - ids are unique, sources are known, and every row says what is missing;
 *   - the counts are stated here, so a change in either direction is a line in a diff.
 *
 * `docs/ROADMAP-AUDIT.md` is rendered from the data; run `npm run registers`
 * from app/ to rewrite it. The last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/ROADMAP-AUDIT.md';
const SOURCES = Object.keys(AUDIT_SOURCES) as AuditSource[];
const WORD: Record<AuditStatus, string> = { landed: 'Landed', partial: 'Partial', absent: 'Absent', operational: 'Operational' };

describe('the roadmap audit', () => {
  it('can tell a missing file from a present one', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('docs/no-such-proposal.md')).toBe(false);
  });

  it('names each proposal once, in a known source, with a title and a gap', () => {
    const ids = PROPOSALS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of PROPOSALS) {
      expect(SOURCES, x.id).toContain(x.source);
      expect(x.id.startsWith(x.source), x.id).toBe(true);
      expect(AUDIT_STATUSES, x.id).toContain(x.status);
      expect(x.title.trim().length, x.id).toBeGreaterThan(5);
      // A landed row may honestly say "None."; every other row must say what is missing.
      expect(x.gap.trim().length, `${x.id} says nothing about what is missing`).toBeGreaterThan(x.status === 'landed' ? 3 : 12);
    }
    for (const s of SOURCES) expect(PROPOSALS.some((x) => x.source === s), s).toBe(true);
  });

  it('cites evidence that exists', () => {
    for (const x of PROPOSALS) for (const e of x.evidence) expect(exists(e), `${x.id} cites ${e}, which is missing`).toBe(true);
  });

  it('cites nothing for what is absent, and something for what is not', () => {
    for (const x of PROPOSALS) {
      if (x.status === 'absent') expect(x.evidence, `${x.id} is absent and cites ${x.evidence}`).toEqual([]);
      if (x.status === 'landed' || x.status === 'partial') expect(x.evidence.length, `${x.id} is ${x.status} and cites nothing`).toBeGreaterThan(0);
    }
  });

  it('calls a row landed only when its evidence can fail', () => {
    for (const x of PROPOSALS.filter((r) => r.status === 'landed')) {
      expect(x.evidence.some((e) => CAN_FAIL.test(e)), `${x.id} is landed but cites only ${x.evidence.join(', ')}`).toBe(true);
    }
    // The control: the pattern refuses a document and accepts a test.
    expect(CAN_FAIL.test('docs/SOMETHING.md')).toBe(false);
    expect(CAN_FAIL.test('app/src/lib/x.ts')).toBe(false);
    expect(CAN_FAIL.test('app/src/lib/x.test.ts')).toBe(true);
    expect(CAN_FAIL.test('supabase/x.check.sql')).toBe(true);
  });

  it('marks the rows this branch moved, and each is at least partial', () => {
    expect(builtHere().length).toBeGreaterThan(0);
    for (const x of builtHere()) expect(['landed', 'partial'], x.id).toContain(x.status);
  });

  it('states its counts', () => {
    const c = counts();
    expect(c.landed + c.partial + c.absent + c.operational).toBe(PROPOSALS.length);
    expect(c).toEqual(EXPECTED);
  });

  it(`is what ${DOC} says`, () => {
    const c = counts();
    const lines = [
      renderedFrom('app/src/lib/governance/roadmap-audit.ts', 'roadmap-audit.test.ts'),
      '',
      '# Roadmap audit',
      '',
      controlLine(DOC),
      '',
      `${PROPOSALS.length} proposals from eight strategy documents, read against this repository. **${c.landed} landed** (code and something that can fail), **${c.partial} partial**, **${c.absent} absent** (could be code; is not), **${c.operational} operational** (needs a person, a vendor or production access — a document would be claiming it).`,
      '',
      'A status is a claim from a reading of headers, registers and migration text, not a line-by-line audit. The test proves a cited path exists and that a *landed* row cites something that can fail; it does not prove the status.',
      '',
      ...SOURCES.flatMap((s) => {
        const rows = PROPOSALS.filter((x) => x.source === s);
        return [
          `## ${s} — ${AUDIT_SOURCES[s]}`,
          '',
          ...table(
            ['Id', 'Proposal', 'Status', 'Evidence', 'What is missing'],
            rows.map((x) => [
              x.id,
              cell(x.title),
              WORD[x.status] + (x.builtHere ? ' (moved on this branch)' : ''),
              x.evidence.length ? x.evidence.map((e) => `[\`${e}\`](${link(DOC, e)})`).join('<br>') : '—',
              cell(x.gap),
            ]),
          ),
          '',
        ];
      }),
    ];
    const rendered = lines.join('\n').replace(/\n+$/, '\n');
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

const EXPECTED = { landed: 20, partial: 100, absent: 15, operational: 14 };
