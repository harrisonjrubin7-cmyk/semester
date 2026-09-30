import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADVANCED, AI_MODES, AREAS, BENCHMARK, GRADE_WRITE_RULE, GROUPS, OBJECTS, PHASE5_RULE, PHASES, PRIORITIES, RECORD_FIELDS, RELEASE_CRITERIA, SERVICES, SOURCES,
  STANDARDS, STATUSES, STUDENT_VIEW, TOOLS, areaOf, present, type Group,
} from './learningregister';
import { REGISTER } from './masterregister';
import { MODES } from './socratic';

/**
 * Holds the learning, assessment and gradebook register to the tree: every
 * cited file exists, each status cites the kind of file it claims, every
 * capability marked present sits in an area with code, every master row it
 * names is real, every AI mode it maps names a mode the tutor has, every tool
 * or feature marked present names a file that exists, and the supplied PDFs
 * are never evidence.
 *
 * `docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md` is rendered from the data;
 * run `npm run registers` from app/ to rewrite it. The last test fails while
 * stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the learning, assessment and gradebook register', () => {
  it('has the fourteen areas, in the three groups, ids once, each in a phase', () => {
    expect(AREAS).toHaveLength(14);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(14);
    for (const g of Object.keys(GROUPS) as Group[]) expect(AREAS.filter((a) => a.group === g).length, g).toBeGreaterThan(2);
    for (const a of AREAS) {
      expect(a.capabilities.length, a.id).toBeGreaterThan(6);
      expect(a.why.trim().length, a.id).toBeGreaterThan(20);
      expect(PHASES.map((p) => p.n), a.id).toContain(a.phase);
    }
    expect(areaOf('L10').title).toBe('Gradebook');
    expect(BENCHMARK).toMatch(/what should I do next/);
  });

  it('keeps the two supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(2);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const a of AREAS) for (const e of a.evidence) expect(supplied.has(e.path), `${a.id} cites a supplied PDF`).toBe(false);
  });

  it('names only master rows that exist', () => {
    const rows = new Set(REGISTER.map((r) => r.id));
    expect(rows.has('LMS-011')).toBe(true);
    expect(rows.has('LMS-099'), 'the control').toBe(false);
    for (const a of AREAS) {
      expect(a.master.length, a.id).toBeGreaterThan(0);
      for (const id of a.master) expect(rows.has(id), `${a.id} names master ${id}`).toBe(true);
    }
  });

  it('maps the eight AI modes onto the tutor’s own, or says none carries them', () => {
    expect(AI_MODES).toHaveLength(8);
    for (const m of AI_MODES) if (m.carriedBy) expect(MODES, `${m.mode} → ${m.carriedBy}`).toContain(m.carriedBy);
    expect(AI_MODES.filter((m) => m.carriedBy).map((m) => m.carriedBy)).toEqual(['explain', 'hint', 'review', 'draft']);
    expect(MODES).toContain('practice');
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-learning-evidence.md'))).toBe(false);
  });

  it('cites only files that exist, in areas, tools and features', () => {
    for (const a of AREAS) for (const e of a.evidence) expect(existsSync(join(root, e.path)), `${a.id} cites ${e.path}`).toBe(true);
    for (const t of TOOLS) if (t.have) expect(existsSync(join(root, t.have)), `${t.tool} → ${t.have}`).toBe(true);
    for (const f of ADVANCED) if (f.have) expect(existsSync(join(root, f.have)), `${f.feature} → ${f.have}`).toBe(true);
  });

  it('holds each status to the kind of file it claims, and names a gap', () => {
    for (const a of AREAS) {
      const paths = a.evidence.map((e) => e.path);
      expect(STATUSES, a.id).toContain(a.status);
      if (a.status === 'designed') expect(paths.some(isDoc), `${a.id} is designed and cites no document`).toBe(true);
      if (a.status === 'building') expect(paths.some(isCode), `${a.id} is building and cites no code`).toBe(true);
      if (a.status === 'tested') expect(paths.some(isTest), `${a.id} is tested and cites no test`).toBe(true);
      if (a.status === 'not-started') expect(paths.every(isDoc), `${a.id} is not started yet cites code`).toBe(true);
      expect(a.gap.trim().length, a.id).toBeGreaterThan(20);
    }
  });

  it('marks a capability present only where the area has code, and never marks all of them', () => {
    for (const a of AREAS) {
      const hasCode = a.evidence.some((e) => isCode(e.path));
      if (present(a) > 0) expect(hasCode, `${a.id} marks capabilities present with no code cited`).toBe(true);
      expect(present(a), `${a.id} claims every capability`).toBeLessThan(a.capabilities.length);
      if (a.status === 'not-started') expect(present(a), a.id).toBe(0);
    }
    const faculty = ['L09', 'L10', 'L11'].map(areaOf);
    for (const a of faculty) {
      if (a.evidence.some((e) => e.path === 'app/server/institution/sandbox.ts')) {
        expect(a.gap, `${a.id} cites the sandbox and does not say so`).toMatch(/sandbox/i);
      }
    }
  });

  it('keeps the tools, the features, the standards, the model and the phases whole', () => {
    expect(TOOLS).toHaveLength(18);
    expect(TOOLS.filter((t) => t.have).length).toBe(14);
    expect(ADVANCED).toHaveLength(8);
    expect(ADVANCED.filter((f) => f.have).length).toBe(4);
    expect(STANDARDS).toHaveLength(10);
    expect(GRADE_WRITE_RULE).toMatch(/never a silent background sync/);
    expect(SERVICES).toHaveLength(17);
    expect(OBJECTS).toHaveLength(19);
    expect(RECORD_FIELDS).toHaveLength(11);
    expect(STUDENT_VIEW.map((s) => s.line)).toEqual(['Current standing', 'Included', 'Not included', 'What changes this', 'Next action']);
    expect(STUDENT_VIEW[0].example).toMatch(/^Estimated/);
    expect(PHASES.map((p) => p.n)).toEqual([1, 2, 3, 4, 5]);
    expect(PHASE5_RULE).toMatch(/Only launch these after/);
    expect(RELEASE_CRITERIA).toHaveLength(12);
    expect(PRIORITIES).toHaveLength(6);
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
  const count = (s: string) => AREAS.filter((a) => a.status === s).length;
  const caps = AREAS.reduce((n, a) => n + a.capabilities.length, 0);
  const have = AREAS.reduce((n, a) => n + present(a), 0);
  const tools = TOOLS.filter((t) => t.have).length;
  const advanced = ADVANCED.filter((f) => f.have).length;
  const out: string[] = [
    '# Learning, Assessment and Gradebook Register',
    '',
    '<!-- Rendered from app/src/lib/learningregister.ts by learningregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'The fourteen areas a document of 28 September 2026 asks a native, source-aware',
    'learning environment to have, and where the repository stands on each; with',
    'the second document’s eighteen study tools and eight advanced features marked',
    'the same way. The [LMS and learning roadmap](LMS-LEARNING-ROADMAP.md) checked',
    'three earlier documents item by item; this register covers the faculty side',
    'the roadmap called the largest piece, and it is data, so a test holds every',
    'claim. Where an area overlaps a row of the',
    '[master register](MASTER-LAUNCH-READINESS-REGISTER.md), it names it.',
    '',
    `**The benchmark.** ${BENCHMARK}`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## Where it stands',
    '',
    'A status is a claim about the *best* piece of an area — `tested` cites a test',
    'that runs on every change, `building` code, `designed` a document — so nearly',
    'every area is `tested`: the app has a great deal of the student side. What the',
    'status cannot say, the capability marks do: each capability the document asks',
    'for is marked present or absent, and the table counts them. The whole faculty',
    'side — the builder, the rubric engine, the gradebook, the grading workflow —',
    'is present only as the labelled sandbox in `app/server/institution/sandbox.ts`,',
    'which loads only when asked for, and every mark that rests on it says so.',
    `Across the register, ${have} of ${caps} capabilities have something in the tree.`,
    'Assessed against `origin/main` `ff52ba4` on 28 September 2026; the supplied',
    'PDFs are never cited as evidence.',
    '',
    '| ID | Area | Group | Phase | Status | Present | Master rows |',
    '| --- | --- | --- | ---: | --- | ---: | --- |',
  ];
  for (const a of AREAS) out.push(`| [${a.id}](#${a.id.toLowerCase()}) | ${cell(a.title)} | ${GROUPS[a.group]} | ${a.phase} | ${a.status} | ${present(a)} / ${a.capabilities.length} | ${a.master.map((x) => `\`${x}\``).join(', ')} |`);
  out.push(`| **total** | | | | ${STATUSES.map((s) => `${s} ${count(s)}`).join(', ')} | **${have} / ${caps}** | |`, '');

  out.push('## The register', '');
  for (const g of Object.keys(GROUPS) as Group[]) {
    out.push(`### ${GROUPS[g]}`, '');
    for (const a of AREAS.filter((x) => x.group === g)) {
      out.push(`#### ${a.id}`, '', `**${a.title}.** ${a.why}`, '', `*Status.* ${a.status}, ${present(a)} of ${a.capabilities.length} capabilities present; phase ${a.phase}.`, '');
      for (const c of a.capabilities) out.push(`- [${c.have ? 'x' : ' '}] ${c.what}`);
      out.push('', '| Evidence | Shows |', '| --- | --- |');
      for (const e of a.evidence) out.push(`| \`${e.path}\` | ${cell(e.shows)} |`);
      out.push('', `*Gap.* ${a.gap}`, '');
    }
  }

  out.push(
    '## The student grade view',
    '',
    'What the student always sees, so a speculative number is never presented as',
    'an official final grade. The app’s what-if screen says the same in its own',
    'words: nothing here is saved or counted anywhere.',
    '',
    '| Line | Example |',
    '| --- | --- |',
    ...STUDENT_VIEW.map((s) => `| ${s.line} | ${cell(s.example)} |`),
    '',
    '## AI modes: the document’s eight against the tutor’s five',
    '',
    `The tutor has ${MODES.map((m) => `\`${m}\``).join(', ')}. Each mode the document asks for names the one that carries it, or says none does; the test holds the names to the tutor’s list.`,
    '',
    '| Mode | Carried by | Note |',
    '| --- | --- | --- |',
    ...AI_MODES.map((m) => `| ${m.mode} | ${m.carriedBy ? `\`${m.carriedBy}\`` : '—'} | ${cell(m.note)} |`),
    '',
    '## The study and AI learning tools',
    '',
    `The second document’s eighteen tools, each with its source and safety control; ${tools} have something in the tree, and each names the file.`,
    '',
    '| Tool | What it does | Source and safety control | Have | Note |',
    '| --- | --- | --- | --- | --- |',
    ...TOOLS.map((t) => `| ${cell(t.tool)} | ${cell(t.does)} | ${cell(t.control)} | ${t.have ? `\`${t.have}\`` : '—'} | ${cell(t.note)} |`),
    '',
    `### Advanced learning features (${advanced} of ${ADVANCED.length})`,
    '',
    '| Feature | What | Have | Note |',
    '| --- | --- | --- | --- |',
    ...ADVANCED.map((f) => `| ${cell(f.feature)} | ${cell(f.what)} | ${f.have ? `\`${f.have}\`` : '—'} | ${cell(f.note)} |`),
    '',
    '## Standards and integrations',
    '',
    '| Need | Recommended approach |',
    '| --- | --- |',
    ...STANDARDS.map((s) => `| ${cell(s.need)} | ${cell(s.approach)} |`),
    '',
    `**${GRADE_WRITE_RULE}** The [LMS interoperability matrix](LMS-INTEROPERABILITY-MATRIX.md) holds the grade write, preview to audit, at what the AGS post has today.`,
    '',
    '## Backend services and the gradebook data model',
    '',
    `The critical services: ${SERVICES.map((s) => s.toLowerCase()).join('; ')}.`,
    '',
    `The objects: ${OBJECTS.join(', ')}.`,
    '',
    'Every grade-related record includes:',
    '',
    ...list(RECORD_FIELDS),
    '',
    '## What to build, in order',
    '',
    ...PHASES.flatMap((p) => [`### Phase ${p.n}: ${p.name}`, '', ...list(p.items), '']),
    PHASE5_RULE,
    '',
    'The second document orders its own six priorities:',
    '',
    ...numbered(PRIORITIES),
    '',
    '## Release criteria for consequential grading',
    '',
    ...RELEASE_CRITERIA.map((c) => `- [ ] ${c}`),
    '',
    'The strongest learning platform is not the one with the most quizzes. It is',
    'one where students understand what they are learning, can complete work',
    'accessibly, receive useful feedback, recover from mistakes, and trust that',
    'every grade has a clear, reviewable human and system trail.',
    '',
  );
  return out.join('\n');
}
