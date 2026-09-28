import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_LABELS, SOURCE_TEXT } from './source';
import { COUNCIL, HOME, LABELS, MATERIALS, MVP, PROMISE, SOURCES, STATUSES, STUDENT_MAY_WRITE, TIMELINE, WORKFLOWS } from './transferhub';

/**
 * Holds the transfer hub to the tree: every label names a real source label
 * or says none does, every workflow cites the kind of file its status claims,
 * every cited path exists, and the boundary the document asks for — no
 * unofficial credit decision — is the constraint the migration already
 * enforces on what a student may write.
 *
 * `docs/TRANSFER-TRANSITION-HUB.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/TRANSFER-TRANSITION-HUB.md';
const MIGRATION = 'supabase/migrations/20260926150000_expansion_roles_and_features.sql';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the transfer transition hub', () => {
  it('keeps the supplied document where it says, and never cites it as evidence', () => {
    expect(SOURCES).toHaveLength(1);
    expect(existsSync(join(root, SOURCES[0].path))).toBe(true);
    for (const w of WORKFLOWS) for (const e of w.evidence) expect(e.path, `${w.id} cites the supplied PDF`).not.toBe(SOURCES[0].path);
  });

  it('has the eleven home sections, eight workflows, five windows and the council', () => {
    expect(HOME).toHaveLength(11);
    expect(WORKFLOWS).toHaveLength(8);
    expect(new Set(WORKFLOWS.map((w) => w.id)).size).toBe(8);
    expect(TIMELINE).toHaveLength(5);
    expect(COUNCIL).toHaveLength(10);
    expect(MVP).toHaveLength(6);
    expect(MATERIALS.student).toHaveLength(7);
    expect(MATERIALS.institution).toHaveLength(6);
    expect(MATERIALS.output).toHaveLength(6);
    expect(PROMISE).toMatch(/what is official/);
  });

  it('names only source labels that exist, and says where none does', () => {
    for (const l of LABELS) {
      if (l.carriedBy) {
        expect(SOURCE_LABELS, `${l.label} → ${l.carriedBy}`).toContain(l.carriedBy);
        expect(l.note.trim().length).toBeGreaterThan(3);
      } else expect(l.note, l.label).toMatch(/./);
    }
    expect(LABELS.filter((l) => l.carriedBy).map((l) => l.carriedBy)).toContain('needs_review');
    expect(SOURCE_TEXT.institution_verified).toBe(LABELS[0].label);
  });

  it('holds the boundary to the constraint: a student writes only estimated or submitted', () => {
    const sql = read(MIGRATION);
    const block = sql.slice(sql.indexOf('create table if not exists public.transfer_evaluations'));
    expect(block).toMatch(/A student may only ever write estimated or submitted/);
    expect(block).toMatch(/check \(status in \('estimated', 'submitted', 'institution_verified', 'denied'\)\)/);
    expect(STUDENT_MAY_WRITE).toEqual(['estimated', 'submitted']);
    expect(WORKFLOWS[1].evidence.some((e) => e.path === MIGRATION)).toBe(true);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-transfer-evidence.md'))).toBe(false);
  });

  it('cites only files that exist, and holds each status to the kind of file it claims', () => {
    for (const w of WORKFLOWS) {
      const paths = w.evidence.map((e) => e.path);
      for (const p of paths) expect(existsSync(join(root, p)), `${w.id} cites ${p}`).toBe(true);
      expect(STATUSES, w.id).toContain(w.status);
      if (w.status === 'designed') expect(paths.some(isDoc), `${w.id} is designed and cites no document`).toBe(true);
      if (w.status === 'building') expect(paths.some(isCode), `${w.id} is building and cites no code`).toBe(true);
      if (w.status === 'tested') expect(paths.some(isTest), `${w.id} is tested and cites no test`).toBe(true);
      if (w.status === 'not-started') expect(paths.every(isDoc), `${w.id} is not started yet cites code`).toBe(true);
      expect(w.gap.trim().length, w.id).toBeGreaterThan(12);
      expect(w.boundary.trim().length, w.id).toBeGreaterThan(8);
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
  const count = (s: string) => WORKFLOWS.filter((w) => w.status === s).length;
  return [
    '# Transfer Transition Hub',
    '',
    '<!-- Rendered from app/src/lib/transferhub.ts by transferhub.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Transfer success research points to cross-campus collaboration, streamlined',
    'procedures, dependable communication, peer support and a central one-stop',
    'model. Semester’s origin story is the fragmentation transfer students face, so',
    'this is its natural wedge. The hub supports a student from the moment they',
    'consider transferring through their first successful term and onward to',
    'completion planning — and makes **no official transfer-credit or degree-',
    'completion decision**. It organizes evidence, identifies questions, surfaces',
    'authoritative information and prepares the student for the official evaluation.',
    '',
    `**Product promise.** “${PROMISE}”`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## The home',
    '',
    ...HOME.map((h, i) => `${i + 1}. ${h}`),
    '',
    '## Core workflows',
    '',
    'Each workflow, its flow, its critical boundary, and where the tree stands.',
    'Statuses were read at `origin/main` `92952f0` on 28 September 2026, under the',
    'expansion register’s rule: `designed` cites a document, `building` code,',
    '`tested` a test. Today the transfer pieces are checklist steps spread across the',
    'launchpad, the pathways and the advisor agenda; the `transfer_evaluations` and',
    '`articulation_rules` tables exist and no screen uses them.',
    '',
    `| ${STATUSES.join(' | ')} |`,
    `| ${STATUSES.map(() => '---:').join(' | ')} |`,
    `| ${STATUSES.map(count).join(' | ')} |`,
    '',
    '| ID | Workflow | Student flow | Critical boundary | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...WORKFLOWS.map((w) => `| ${w.id} | ${cell(w.workflow)} | ${cell(w.flow)} | ${cell(w.boundary)} | ${w.status} | ${w.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>')} | ${cell(w.gap)} |`),
    '',
    '## Transfer credit preparation',
    '',
    'An evidence and questions workspace, not an automated credit-decision engine.',
    `The migration already refuses a student any status but ${STUDENT_MAY_WRITE.map((s) => `\`${s}\``).join(' or ')} on a transfer evaluation; the institution’s decision arrives through the service role, and the test reads that constraint.`,
    '',
    '| Student-provided | Institution-provided | Semester output |',
    '| --- | --- | --- |',
    ...Array.from({ length: 7 }, (_, i) => `| ${MATERIALS.student[i] ?? ''} | ${MATERIALS.institution[i] ?? ''} | ${MATERIALS.output[i] ?? ''} |`),
    '',
    '### Labels',
    '',
    'Use explicit labels. Each names the source label in `lib/source.ts` — the five',
    'the database enforces — that already carries it, or says none does.',
    '',
    '| Label | Carried by | Note |',
    '| --- | --- | --- |',
    ...LABELS.map((l) => `| ${l.label} | ${l.carriedBy ? `\`${l.carriedBy}\`` : '**none**'} | ${cell(l.note)} |`),
    '',
    '## Transfer onboarding timeline',
    '',
    '| Window | What happens |',
    '| --- | --- |',
    ...TIMELINE.map((t) => `| ${t.window} | ${cell(t.does)} |`),
    '',
    '## Who owns it',
    '',
    `A formal transfer hub is owned by a cross-functional council: ${COUNCIL.map((c) => c.toLowerCase()).join(', ')}. Cross-campus collaboration and streamlined, coordinated procedures are what transfer-support guidance emphasizes.`,
    '',
    '## The MVP',
    '',
    ...MVP.map((m, i) => `${i + 1}. ${m}`),
    '',
    'Who may see what a transfer student holds is [`MODULE-PRIVACY-MODEL.md`](MODULE-PRIVACY-MODEL.md);',
    'the hub’s place among the twenty-six services is',
    '[`SERVICE-EXPANSION-REGISTER.md`](SERVICE-EXPANSION-REGISTER.md#s02); the',
    '`transfer_student` role is `modeled` in [`ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md).',
    '',
  ].join('\n');
}
