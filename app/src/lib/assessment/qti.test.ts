import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_ITEM_CONTROLS, AI_ITEM_WORKFLOW, ALREADY, ANALYTICS_RULE, ASSESSMENT_OBJECT, AUTHORING_FLOW, CHECKLIST, DISPOSITIONS, ITEM_ANALYTICS, METADATA, NOT_YET,
  PATTERNS, PHASES, PRINCIPLES, QUESTION_MODEL, SOURCES, THRESHOLDS, TOOLCHAIN, WHAT_QTI_IS,
} from './qti';

/**
 * Holds the QTI 3 page to the tree: every interaction pattern that claims a
 * delivered question type names one the app defines, every metadata field
 * that claims a property names one the `Question` type has, every cited file
 * exists, and the supplied PDFs are never evidence.
 *
 * `docs/QTI-3-ASSESSMENT-AND-MIGRATION.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/QTI-3-ASSESSMENT-AND-MIGRATION.md';

/** The string members of `export type <name> = 'a' | 'b'` in a source file. */
function union(src: string, name: string): string[] {
  const m = src.match(new RegExp(`export type ${name} = ([^;]+);`));
  if (!m) throw new Error(`no type ${name}`);
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
}

/** The property names of `export interface <name> { … }`. */
function props(src: string, name: string): string[] {
  const start = src.indexOf(`export interface ${name} {`);
  if (start < 0) throw new Error(`no interface ${name}`);
  const block = src.slice(start, src.indexOf('\n}', start));
  return [...block.matchAll(/^\s+([a-zA-Z]+)\??:/gm)].map((x) => x[1]);
}

describe('QTI 3 as the assessment content model', () => {
  it('keeps the four supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(4);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const a of ALREADY) expect(supplied.has(a.path), `“${a.rule}” cites a supplied PDF`).toBe(false);
    expect(WHAT_QTI_IS).toMatch(/does not generate/);
  });

  it('holds every delivered pattern to a question kind the app defines', () => {
    const kinds = new Set([...union(read(QUESTION_MODEL.exam), 'Kind'), ...union(read(QUESTION_MODEL.quiz), 'QuizKind')]);
    expect([...kinds].sort()).toEqual(['choice', 'long', 'match', 'short', 'truefalse']);
    expect(PATTERNS).toHaveLength(16);
    expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(16);
    for (const p of PATTERNS) {
      if (p.deliveredAs) expect(kinds.has(p.deliveredAs), `${p.id} → ${p.deliveredAs}`).toBe(true);
      expect(p.accessible.trim().length, p.id).toBeGreaterThan(20);
      expect(p.note.trim().length, p.id).toBeGreaterThan(10);
    }
    expect(PATTERNS.filter((p) => p.deliveredAs).map((p) => p.deliveredAs).sort()).toEqual(['choice', 'long', 'match', 'short', 'truefalse']);
  });

  it('holds every carried metadata field to a property the Question type has', () => {
    const have = new Set(props(read(QUESTION_MODEL.exam), 'Question'));
    expect(have.has('why')).toBe(true);
    expect(have.has('difficulty'), 'the control: a property that does not exist').toBe(false);
    expect(METADATA).toHaveLength(15);
    for (const f of METADATA) {
      if (f.carriedBy) expect(have.has(f.carriedBy), `${f.field} → ${f.carriedBy}`).toBe(true);
      expect(f.note.trim().length, f.field).toBeGreaterThan(3);
    }
    expect(METADATA.filter((f) => f.carriedBy)).toHaveLength(2);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-qti-evidence.md'))).toBe(false);
  });

  it('cites only files that exist for what the tree already does', () => {
    expect(ALREADY.length).toBeGreaterThan(5);
    for (const a of ALREADY) expect(existsSync(join(root, a.path)), a.path).toBe(true);
    expect(NOT_YET).toHaveLength(5);
  });

  it('keeps the principles, the flows, the controls and the migration programme whole', () => {
    expect(ASSESSMENT_OBJECT).toHaveLength(7);
    expect(PRINCIPLES).toHaveLength(3);
    expect(AUTHORING_FLOW).toHaveLength(11);
    expect(ITEM_ANALYTICS).toHaveLength(10);
    expect(ANALYTICS_RULE).toMatch(/never|not/);
    expect(AI_ITEM_WORKFLOW).toHaveLength(10);
    expect(AI_ITEM_CONTROLS).toHaveLength(10);
    expect(AI_ITEM_CONTROLS[0]).toMatch(/cannot directly publish/);
    expect(PHASES.map((p) => p.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const p of PHASES) expect(p.exit.trim().length, p.name).toBeGreaterThan(10);
    expect(DISPOSITIONS).toHaveLength(6);
    expect(CHECKLIST.map((c) => c.group)).toEqual(['Source inventory', 'Semantic and scoring crosswalk', 'Accessibility conversion', 'Validation']);
    expect(TOOLCHAIN).toHaveLength(10);
    expect(THRESHOLDS).toHaveLength(8);
    for (const t of THRESHOLDS) expect(t.must, t.of).toMatch(/^(100%|0 )/);
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
  const delivered = PATTERNS.filter((p) => p.deliveredAs).length;
  const carried = METADATA.filter((f) => f.carriedBy).length;
  const out: string[] = [
    '# QTI 3: assessment content and migration',
    '',
    '<!-- Rendered from app/src/lib/assessment/qti.ts by qti.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'QTI 3 as the content model for accessible, reusable, versioned assessment',
    'objects: the design principles, the interaction library with an accessible',
    'equivalent for every pattern, the authoring flow, the item analytics and what',
    'they must never become, the AI item-generation workflow with its provenance',
    'and controls, and the legacy item-bank migration programme — from four',
    'documents of 28 September 2026, held to what the tree already has for a',
    'question. The [LMS and learning roadmap](LMS-LEARNING-ROADMAP.md) already',
    'records question banks and QTI import as missing; this page says what',
    '“present” would have to mean.',
    '',
    `**${WHAT_QTI_IS}**`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## Design principles',
    '',
    `One assessment object is ${ASSESSMENT_OBJECT.join(' + ')}.`,
    '',
    ...list(PRINCIPLES),
    '',
    '## The interaction library, against what the app delivers',
    '',
    `Five question kinds exist across the practice paper and the quiz; ${delivered} of ${PATTERNS.length} patterns have a renderer, and the test holds every named kind to the types \`${QUESTION_MODEL.exam}\` and \`${QUESTION_MODEL.quiz}\` export. Every non-text interaction must have an accessible equivalent; where the app has the interaction at all, it already does.`,
    '',
    '| Pattern | Learning purpose | Accessible equivalent | Delivered as | Note |',
    '| --- | --- | --- | --- | --- |',
    ...PATTERNS.map((p) => `| ${cell(p.pattern)} | ${cell(p.purpose)} | ${cell(p.accessible)} | ${p.deliveredAs ? `\`${p.deliveredAs}\`` : '—'} | ${cell(p.note)} |`),
    '',
    '### What the tree already does',
    '',
    '| Rule | Evidence | Shows |',
    '| --- | --- | --- |',
    ...ALREADY.map((a) => `| ${cell(a.rule)} | \`${a.path}\` | ${cell(a.shows)} |`),
    '',
    '### What it does not, yet',
    '',
    ...list(NOT_YET),
    '',
    '## The authoring flow',
    '',
    ...numbered(AUTHORING_FLOW),
    '',
    '## Item analytics',
    '',
    'Use analytics to improve questions, never to profile students.',
    '',
    ...list(ITEM_ANALYTICS),
    '',
    `**${ANALYTICS_RULE}**`,
    '',
    '## AI item generation',
    '',
    'QTI 3 encodes the reviewed, approved item; it does not draft one. The',
    'workflow, in order:',
    '',
    ...numbered(AI_ITEM_WORKFLOW),
    '',
    '### The metadata every AI-assisted item carries, against `Question`',
    '',
    `${carried} of ${METADATA.length} fields have a property on the practice paper’s question; the test reads the type and holds each named property to one that exists. The largest gap is provenance: no item records the model, the prompt template, the source set or an editor.`,
    '',
    '| Field | Property | Note |',
    '| --- | --- | --- |',
    ...METADATA.map((f) => `| ${cell(f.field)} | ${f.carriedBy ? `\`${f.carriedBy}\`` : '—'} | ${cell(f.note)} |`),
    '',
    '### Controls',
    '',
    ...AI_ITEM_CONTROLS.map((c) => `- [ ] ${c}`),
    '',
    '## Migration: a controlled content-conversion programme',
    '',
    'A valid XML package that changes scoring, accessibility, media or item intent',
    'is not a successful migration. Preserve the originals, build a semantic',
    'crosswalk, validate scoring and accessibility in the destination, and retain',
    'evidence for every exception.',
    '',
    '| Phase | Activities | Deliverables | Exit gate |',
    '| --- | --- | --- | --- |',
    ...PHASES.map((p) => `| ${p.n}. ${cell(p.name)} | ${cell(p.activities)} | ${cell(p.deliverables)} | ${cell(p.exit)} |`),
    '',
    `Every proprietary construct gets exactly one disposition: ${DISPOSITIONS.join(' / ')}.`,
    '',
    ...CHECKLIST.flatMap((c) => [`### ${c.group}`, '', ...c.items.map((i) => `- [ ] ${i}`), '']),
    '### The toolchain',
    '',
    'A toolchain, never a single black-box importer.',
    '',
    '| Tool | Purpose | Semester implementation |',
    '| --- | --- | --- |',
    ...TOOLCHAIN.map((t) => `| ${cell(t.category)} | ${cell(t.purpose)} | ${cell(t.implementation)} |`),
    '',
    '### Acceptance thresholds',
    '',
    'Set before conversion begins; every one is all or nothing.',
    '',
    '| Of | Must |',
    '| --- | --- |',
    ...THRESHOLDS.map((t) => `| ${cell(t.of)} | ${cell(t.must)} |`),
    '',
  ];
  return out.join('\n');
}
