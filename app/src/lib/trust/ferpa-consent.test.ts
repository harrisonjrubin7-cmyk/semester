import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROLS, DATA_MODEL, DECISION_GATE, FLOW, GENERAL_RULE, SCREEN, SOURCES, STATUSES, TABLES } from './ferpa-consent';

/**
 * Holds the FERPA consent workflow to the schema and to the tree: every column
 * the data model names is a column of that table in the migrations, every
 * cited file exists, and each control's status cites the kind of file it
 * claims — `designed` a document, `building` code, `tested` a test.
 *
 * `docs/trust/FERPA-CONSENT-WORKFLOW.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/trust/FERPA-CONSENT-WORKFLOW.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

/** The body of `create table if not exists public.<table> (…)` across every migration, or null. */
function tableBody(table: string): string | null {
  const dir = join(root, 'supabase/migrations');
  for (const f of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8');
    const m = sql.match(new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`));
    if (m) return m[1];
  }
  return null;
}

const hasColumn = (body: string, column: string) => new RegExp(`^\\s*${column}\\s`, 'm').test(body);

describe('the FERPA consent workflow', () => {
  it('keeps the two supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(2);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const c of CONTROLS) for (const e of c.evidence) expect(supplied.has(e.path), `${c.id} cites a supplied PDF`).toBe(false);
  });

  it('states the rule, the five-step gate, the nine-step flow and the seven screen lines', () => {
    expect(GENERAL_RULE).toMatch(/signed and dated/);
    expect(DECISION_GATE).toHaveLength(5);
    expect(FLOW).toHaveLength(9);
    expect(SCREEN.map((s) => s.line)).toEqual(['Recipient', 'Purpose', 'Records you are sharing', 'Not included', 'Access', 'Duration', 'Your choices']);
  });

  it('can read a table body from the migrations, and tell a missing column from a present one', () => {
    const body = tableBody('advisor_shares');
    expect(body).not.toBeNull();
    expect(hasColumn(body!, 'expires_at')).toBe(true);
    expect(hasColumn(body!, 'signature_method')).toBe(false);
    expect(tableBody('no_such_table')).toBeNull();
  });

  it('names every table it relies on, and each exists', () => {
    for (const t of TABLES) expect(tableBody(t), t).not.toBeNull();
    for (const f of DATA_MODEL) if (f.column) expect(TABLES, `${f.field} names ${f.column.table}, which is not in TABLES`).toContain(f.column.table);
  });

  it('points each field at a column the migrations really create, or says none does', () => {
    expect(DATA_MODEL).toHaveLength(20);
    expect(new Set(DATA_MODEL.map((f) => f.field)).size).toBe(20);
    for (const f of DATA_MODEL) {
      expect(f.note.trim().length, f.field).toBeGreaterThan(8);
      if (!f.column) continue;
      const body = tableBody(f.column.table)!;
      expect(hasColumn(body, f.column.column), `${f.field} → ${f.column.table}.${f.column.column}`).toBe(true);
    }
    expect(DATA_MODEL.filter((f) => f.column === null).length).toBeGreaterThan(0);
  });

  it('cites only files that exist', () => {
    for (const c of CONTROLS) for (const e of c.evidence) expect(existsSync(join(root, e.path)), `${c.id} cites ${e.path}`).toBe(true);
  });

  it('holds each of the fifteen controls to the kind of file it claims, with a gap', () => {
    expect(CONTROLS).toHaveLength(15);
    for (const c of CONTROLS) {
      const paths = c.evidence.map((e) => e.path);
      expect(STATUSES, c.id).toContain(c.status);
      if (c.status === 'designed') expect(paths.some(isDoc), `${c.id} is designed and cites no document`).toBe(true);
      if (c.status === 'building') expect(paths.some(isCode), `${c.id} is building and cites no code`).toBe(true);
      if (c.status === 'tested') expect(paths.some(isTest), `${c.id} is tested and cites no test`).toBe(true);
      if (c.status === 'not-started') expect(paths.every(isDoc), `${c.id} is not started yet cites code`).toBe(true);
      expect(c.gap.trim().length, c.id).toBeGreaterThan(8);
    }
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const count = (s: string) => CONTROLS.filter((c) => c.status === s).length;
  return [
    '# FERPA consent workflow',
    '',
    '<!-- Rendered from app/src/lib/trust/ferpa-consent.ts by ferpa-consent.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    '**A product and governance blueprint, not legal advice.** Counsel validates it',
    'per institution, jurisdiction, contract and data flow; the institution — not a',
    'product setting — determines and documents which FERPA exception applies and on',
    'what conditions.',
    '',
    '[The consent-sharing design](../CONSENT-SHARING-DESIGN.md) (D-037) settled the',
    'pattern: one consent rule, three narrow tables, every share ending within a',
    'term, revocable, read only through a function that logs the read. This page',
    'asks what FERPA needs on top of that, and holds each answer to the schema: every',
    'column the data model names is read out of the migrations by the test, and every',
    'control cites the kind of file its status claims.',
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](../${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## When consent is needed',
    '',
    GENERAL_RULE,
    '',
    'Use a decision gate before any disclosure outside the student’s private workspace:',
    '',
    ...DECISION_GATE.map((g, i) => `${i + 1}. ${g}`),
    '',
    '## The flow',
    '',
    ...FLOW.map((f, i) => `${i + 1}. ${f}`),
    '',
    '## The consent screen',
    '',
    'Before the student signs, in this order:',
    '',
    '| Line | Says |',
    '| --- | --- |',
    ...SCREEN.map((s) => `| ${s.line} | ${cell(s.says)} |`),
    '',
    'Today the athlete share (`app/src/components/AthleteShare.tsx`) and the advisor share',
    '(`app/src/components/AdvisorMeeting.tsx`) show the records, the recipient, the end date and what is',
    'never shared, and send nothing until the preview is confirmed. Neither shows a',
    'purpose or an access level, and neither is signed.',
    '',
    '## The consent data model, against the schema',
    '',
    'Each field the model asks for, and the column that already carries it — read',
    'out of `supabase/migrations/` by the test — or none.',
    '',
    '| Field | Column | Note |',
    '| --- | --- | --- |',
    ...DATA_MODEL.map((f) => `| \`${f.field}\` | ${f.column ? `\`${f.column.table}.${f.column.column}\`` : '**none**'} | ${cell(f.note)} |`),
    '',
    `${DATA_MODEL.filter((f) => f.column).length} of ${DATA_MODEL.length} fields have a column somewhere; the rest are named so the gap is visible.`,
    '',
    '## The fifteen workflow controls',
    '',
    'Statuses were read at main commit 92952f0 on 28 September 2026.',
    '',
    `| ${STATUSES.join(' | ')} |`,
    `| ${STATUSES.map(() => '---:').join(' | ')} |`,
    `| ${STATUSES.map(count).join(' | ')} |`,
    '',
    '| ID | Control | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- |',
    ...CONTROLS.map((c) => `| ${c.id} | ${cell(c.control)} | ${c.status} | ${c.evidence.length ? c.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>') : '—'} | ${cell(c.gap)} |`),
    '',
    '## What would close the gaps',
    '',
    '- A `purpose` and an `access` column on each share table, shown on the preview',
    '  and stored with the row.',
    '- A consent version and a signature method on the share, written at',
    '  confirmation, so a share is a signed and dated consent and not only an',
    '  authenticated action.',
    '- Fields and purpose on every read event, not only reader and time.',
    '- A revoked share that cannot be deleted while any read event references it.',
    '- An exception record, for the day an institution asserts a school-official or',
    '  emergency basis instead of consent (FERPA-1 in',
    '  [the FERPA, COPPA and 1EdTech readiness register](../FERPA-COPPA-1EDTECH-READINESS.md)).',
    '- A way to place a legal hold on a share, and a screen or runbook that places one (operational maturity RM-02; the `legal_holds` object exists).',
    '',
  ].join('\n');
}
