import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODES_PROHIBITED } from './ai-assurance';
import { GATE_IDS, PROHIBITED_STARTING_SCOPE } from './ai-lifecycle';
import {
  AI_ROLES, COMPARISON, CONTROLS, DEPLOYMENT_PRECONDITIONS, FEEDBACK_FORMAT, GRADING_WORKFLOW, LEDGER, NEVER, NO_UNIVERSAL_RATE, PROCUREMENT_RULES, PRODUCTS,
  PRODUCT_NAME, SOURCES, STATUSES, TEST_DATASET, TEST_REPORTS, VENDOR_TEST,
} from './grading-ai';

/**
 * Holds the AI grading and integrity page to the tree: every AI role names a
 * lifecycle gate that exists, every control cites the kind of file its status
 * claims and only files that exist, the misconduct rule names the intake
 * refusal that holds it, the no-AI-grade rule is refused by nothing at
 * intake (and the page says so), every role ends in a human, and the supplied
 * PDFs are never evidence.
 *
 * `docs/operating-model/AI-GRADING-AND-INTEGRITY.md` is rendered from the
 * data; run `npm run registers` from app/ to rewrite it. The last test fails
 * while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/operating-model/AI-GRADING-AND-INTEGRITY.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('AI in grading and integrity', () => {
  it('keeps the four supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(4);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const c of CONTROLS) for (const e of c.evidence) expect(supplied.has(e.path), `${c.id} cites a supplied PDF`).toBe(false);
    expect(NO_UNIVERSAL_RATE).toMatch(/no single, universal false-positive rate/i);
  });

  it('compares the three products on eight criteria, every cell filled, and never a percentage', () => {
    expect(PRODUCTS).toEqual(['gradescope', 'turnitin', 'copyleaks']);
    expect(COMPARISON).toHaveLength(8);
    for (const row of COMPARISON) {
      for (const p of PRODUCTS) {
        expect(row.cells[p].trim().length, `${row.criterion} ${PRODUCT_NAME[p]}`).toBeGreaterThan(10);
        expect(row.cells[p], `${row.criterion} ${PRODUCT_NAME[p]} quotes a rate`).not.toMatch(/\d+(\.\d+)?\s?%/);
      }
      expect(row.semester.trim().length, row.criterion).toBeGreaterThan(10);
    }
  });

  it('keeps the evaluation, the dataset, the reports, the procurement rules and the preconditions', () => {
    expect(VENDOR_TEST).toHaveLength(9);
    expect(VENDOR_TEST[1].measure).toBe('Inter-rater reliability');
    expect(TEST_DATASET).toHaveLength(6);
    expect(TEST_REPORTS).toHaveLength(7);
    expect(PROCUREMENT_RULES).toHaveLength(6);
    for (const r of PROCUREMENT_RULES) expect(r).toMatch(/^No /);
    expect(DEPLOYMENT_PRECONDITIONS).toHaveLength(6);
    expect(GRADING_WORKFLOW).toHaveLength(10);
    expect(FEEDBACK_FORMAT).toHaveLength(6);
    expect(LEDGER).toHaveLength(10);
  });

  it('puts every AI role at a lifecycle gate that exists, and ends every one in a human', () => {
    expect(AI_ROLES).toHaveLength(9);
    expect(new Set(AI_ROLES.map((r) => r.id)).size).toBe(9);
    for (const r of AI_ROLES) {
      expect(GATE_IDS, `${r.id} → ${r.gate}`).toContain(r.gate);
      expect(r.control, r.id).toMatch(/instructor|faculty|human|student|grader|no official grade/i);
    }
    const final = AI_ROLES.find((r) => r.id === 'final')!;
    expect(final.permitted).toBe('Not AI-only');
    expect(final.gate).toBe('G4');
  });

  it('holds the misconduct rule to the intake refusal, and says nothing refuses an AI grade at intake', () => {
    const [misconduct, grade] = NEVER;
    expect(PROHIBITED_STARTING_SCOPE).toContain(misconduct.refusedBy);
    expect(misconduct.note).toMatch(/No grading workflow enforces it/);
    const mode = MODES_PROHIBITED.find((m) => /grading/i.test(m.mode))!;
    expect(mode, 'the prohibited-modes list no longer names automated grading').toBeTruthy();
    expect(mode.refusedBy, 'a refusal now exists; re-read the page').toBeNull();
    expect(grade.refusedBy).toBeNull();
    for (const n of NEVER) expect(existsSync(join(root, n.by)), n.by).toBe(true);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-grading-evidence.md'))).toBe(false);
  });

  it('has the twelve controls, ids once, each citing only files that exist and the kind of file its status claims', () => {
    expect(CONTROLS).toHaveLength(12);
    expect(new Set(CONTROLS.map((c) => c.id)).size).toBe(12);
    for (const c of CONTROLS) {
      const paths = c.evidence.map((e) => e.path);
      expect(paths.length, c.id).toBeGreaterThan(0);
      for (const p of paths) expect(existsSync(join(root, p)), `${c.id} cites ${p}`).toBe(true);
      expect(STATUSES, c.id).toContain(c.status);
      if (c.status === 'designed') expect(paths.some(isDoc), `${c.id} is designed and cites no document`).toBe(true);
      if (c.status === 'building') expect(paths.some(isCode), `${c.id} is building and cites no code`).toBe(true);
      if (c.status === 'tested') expect(paths.some(isTest), `${c.id} is tested and cites no test`).toBe(true);
      if (c.status === 'not-started') expect(paths.every(isDoc), `${c.id} is not started yet cites code`).toBe(true);
      expect(c.gap.trim().length, c.id).toBeGreaterThan(3);
    }
    expect(CONTROLS.filter((c) => c.status === 'not-started').length).toBeGreaterThan(4);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const list = (xs: readonly string[]) => xs.map((x) => `- ${x}`);
const numbered = (xs: readonly string[]) => xs.map((x, i) => `${i + 1}. ${x}`);

function render(): string {
  const count = (s: string) => CONTROLS.filter((c) => c.status === s).length;
  const out: string[] = [
    '# AI in grading and integrity',
    '',
    '<!-- Rendered from app/src/lib/governance/grading-ai.ts by grading-ai.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'What Gradescope, Turnitin and Copyleaks each are, why no single accuracy or',
    'false-positive number compares them, the institution-controlled evaluation',
    'that does, the procurement pass/fail rules, the roles AI may hold in',
    'assessment and the human control each requires, and the fairness controls a',
    'consequential grade needs — from four documents of 28 September 2026, held to',
    'what the tree already has. [GRADESCOPE-TURNITIN.md](../../GRADESCOPE-TURNITIN.md)',
    'settled that Semester cannot submit into Gradescope and that Turnitin’s API',
    'is a partnership; this page is about governance, not integration. The AI',
    'lifecycle gates are [AI-LIFECYCLE-GATES.md](AI-LIFECYCLE-GATES.md).',
    '',
    `**${NO_UNIVERSAL_RATE}**`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](../${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## The three products, and Semester',
    '',
    'They address different problems: Gradescope is a grading-workflow product;',
    'Turnitin and Copyleaks are integrity-signal products. The test refuses any',
    'cell that quotes a percentage.',
    '',
    `| Criterion | ${PRODUCTS.map((p) => PRODUCT_NAME[p]).join(' | ')} | Semester |`,
    `| --- | ${PRODUCTS.map(() => '---').join(' | ')} | --- |`,
    ...COMPARISON.map((r) => `| **${cell(r.criterion)}** | ${PRODUCTS.map((p) => cell(r.cells[p])).join(' | ')} | ${cell(r.semester)} |`),
    '',
    '## The evaluation that does compare them',
    '',
    'Require each vendor to support an institution-controlled evaluation on',
    'permissioned, representative samples with multiple trained human reviewers,',
    'and measure:',
    '',
    '| Measure | How |',
    '| --- | --- |',
    ...VENDOR_TEST.map((v) => `| ${cell(v.measure)} | ${cell(v.how)} |`),
    '',
    '**The dataset.**',
    '',
    ...list(TEST_DATASET),
    '',
    '**What is reported.**',
    '',
    ...list(TEST_REPORTS),
    '',
    '### Procurement pass/fail',
    '',
    'Any one fails the procurement.',
    '',
    ...list(PROCUREMENT_RULES),
    '',
    '### Before an integrity signal enters a consequential workflow',
    '',
    ...list(DEPLOYMENT_PRECONDITIONS),
    '',
    '## The roles AI may hold',
    '',
    'AI can assist, and it must never silently become the grader. Each role sits',
    'at the lifecycle gate that owns its function; every row ends in a human, or in no',
    '',
    '| Use case | Permitted role | Required control | Gate |',
    '| --- | --- | --- | --- |',
    ...AI_ROLES.map((r) => `| ${cell(r.useCase)} | ${cell(r.permitted)} | ${cell(r.control)} | ${r.gate} |`),
    '',
    '### The two rules, at the code',
    '',
    'A refusal here is an entry of the AI intake’s prohibited starting scope, the',
    'one gate every AI use case passes. No grading workflow holds either rule,',
    'because none exists.',
    '',
    '| Rule | Refused by | Note |',
    '| --- | --- | --- |',
    ...NEVER.map((n) => `| ${cell(n.rule)} | ${n.refusedBy ? `at intake: “${n.refusedBy}” in \`${n.by}\`` : `nothing at intake (\`${n.by}\`)`} | ${cell(n.note)} |`),
    '',
    '## The source-aware grading workflow',
    '',
    'A grader substantiates feedback without pretending the system can infer',
    'learning from a file alone.',
    '',
    ...numbered(GRADING_WORKFLOW),
    '',
    `Released feedback shows, criterion by criterion: ${FEEDBACK_FORMAT.map((f) => f.toLowerCase()).join('; ')}.`,
    '',
    `Every grade change records: ${LEDGER.map((l) => l.toLowerCase()).join(', ')}.`,
    '',
    '## The fairness controls, where the tree stands',
    '',
    'A status is a claim about the best piece of a control: `tested` cites a test',
    'that runs on every change, `building` code, `designed` a document,',
    '`not-started` at most a document naming the gap. The only submit → grade →',
    'release loop in the tree is the labelled sandbox in',
    '`app/server/institution/sandbox.ts`, which loads only when asked for; every',
    '`tested` row below is that sandbox, and its gap says so.',
    '',
    '| ID | Control | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- |',
    ...CONTROLS.map((c) => `| ${c.id} | ${cell(c.control)} | ${c.status} | ${c.evidence.map((e) => `\`${e.path}\`: ${cell(e.shows)}`).join('<br>')} | ${cell(c.gap)} |`),
    `| **total** | | ${STATUSES.map((s) => `${s} ${count(s)}`).join(', ')} | | |`,
    '',
  ];
  return out.join('\n');
}
