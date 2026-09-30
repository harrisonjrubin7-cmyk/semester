import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCKERS, ROWS, VERDICTS, VERDICT_MEANING } from './pdfgaps';
import { cell, controlLine, renderedFrom, table } from './render';

/**
 * The gap matrix held to the tree: every file a row cites exists, every letter
 * of the synthesis has a row, a row that claims something cites something, and
 * a row that is not done says whose it is. `docs/PDF-EVIDENCE-GAP-MATRIX.md`
 * is rendered from the data; `npm run registers` from app/ rewrites it.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const DOC = 'docs/PDF-EVIDENCE-GAP-MATRIX.md';

const LETTERS = 'abcdefghijklmn'.split('');
const ARTIFACTS = ['OA1', 'OA2', 'OA3', 'OA4', 'OA5'];

describe('the gap matrix', () => {
  it('has a row for every P0 letter, every operating artifact and the refusal, once', () => {
    const ids = ROWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...LETTERS, ...ARTIFACTS, 'X1']) expect(ids, id).toContain(id);
    expect(ids.length).toBe(LETTERS.length + ARTIFACTS.length + 1);
  });

  it('uses only known verdicts and blockers', () => {
    for (const r of ROWS) {
      expect(VERDICTS, r.id).toContain(r.verdict);
      expect(BLOCKERS, r.id).toContain(r.blocker);
    }
  });

  it('cites only files that exist', () => {
    for (const r of ROWS) for (const p of r.where) expect(existsSync(at(p)), `${r.id}: ${p}`).toBe(true);
  });

  it('claims nothing it does not cite', () => {
    for (const r of ROWS) {
      if (['covered', 'built-here', 'partial'].includes(r.verdict)) expect(r.where.length, r.id).toBeGreaterThan(0);
      expect(r.today.length, r.id).toBeGreaterThan(20);
      expect(r.remaining.length, r.id).toBeGreaterThan(5);
    }
  });

  it('never marks a not-done row as blocked by nothing', () => {
    for (const r of ROWS) {
      if (['open-design', 'blocked', 'security-workstream', 'not-to-build'].includes(r.verdict)) expect(r.blocker, r.id).not.toBe('none');
    }
  });

  it('keeps the refusal: no financial-aid, payroll, ledger or system-of-record claim', () => {
    const x = ROWS.find((r) => r.id === 'X1')!;
    expect(x.verdict).toBe('not-to-build');
    expect(x.blocker).toBe('specialist');
    // The rows that are done never use the words as a claim of readiness.
    for (const r of ROWS.filter((r) => r.verdict === 'built-here')) {
      expect(`${r.today} ${r.remaining}`).not.toMatch(/\b(payroll|general ledger|financial aid)\b/i);
    }
  });

  it('is what docs/PDF-EVIDENCE-GAP-MATRIX.md says', () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(readFileSync(at(DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

function render(): string {
  const counts = VERDICTS.map((v) => `${ROWS.filter((r) => r.verdict === v).length} ${v}`).join(', ');
  const out = [
    '# PDF-to-evidence gap matrix',
    '',
    renderedFrom('app/src/lib/ops/pdfgaps.ts', 'pdfgaps.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Source: the owner\'s source-grounded synthesis of six readiness PDFs, extracted with Adobe on 30 September 2026 — fourteen common P0s, lettered (a)–(n), and five operating artifacts. **The PDFs are not in the repository**, so a row cites the synthesis and its letter, not a page. The synthesis is **requirements evidence, not authority**: nothing here executes it, and a row saying "covered" is a statement about the tree, not about a launch.',
    '',
    `Reconciled against \`main\` and the open pull requests on 30 September 2026. ${ROWS.length} rows: ${counts}.`,
    '',
    '## Verdicts',
    '',
    ...table(['Verdict', 'Meaning'], VERDICTS.map((v) => [`\`${v}\``, cell(VERDICT_MEANING[v])])),
    '',
    '## Matrix',
    '',
  ];
  for (const r of ROWS) {
    out.push(
      `### ${r.id} — ${r.need}`,
      '',
      `**${r.verdict}** · blocked by: ${r.blocker}${r.coordinate ? ` · coordinate with: ${r.coordinate}` : ''}`,
      '',
      `**Today.** ${r.today}`,
      '',
      `**Remaining.** ${r.remaining}`,
      '',
      `**Evidence.** ${r.where.length ? r.where.map((p) => `[\`${p}\`](${require_link(p)})`).join(', ') : 'none'}`,
      '',
    );
  }
  out.push(
    '## What this pull request added, and what it left alone',
    '',
    '- Added (documents and one guard): `docs/DEGRADED-MODE-MAP.md`, `docs/DECISION-RIGHTS.md`, `docs/pilot/DISCOVERY-EVIDENCE-LOG.md`, this matrix and its test, and `authaccess.test.ts`.',
    '- Left alone on purpose: a purpose-coded FERPA decision (b) until counsel defines the purposes; a canonical identity model (c) until a real pilot school\'s identifiers exist; a policy engine (f) until #1011 and #1018 land; LTI and OneRoster (d, e) for the security workstream; and everything in X1.',
    '- Coordinate: #1011 and #1018 are open drafts that touch (c) and (f); #1012 (holds, overrides) has landed.',
    '',
  );
  return out.join('\n');
}

/** Both ends are repository-relative and DOC sits in docs/. */
function require_link(p: string): string {
  return p.startsWith('docs/') ? p.slice('docs/'.length) : `../${p}`;
}
