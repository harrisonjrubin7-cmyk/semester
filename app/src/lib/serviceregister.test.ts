import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS } from './expansionregister';
import { REGISTER } from './masterregister';
import {
  CAREER_OS, DELIVERY_ORDER, EMPLOYER_NEVER, EVALUATION, EVIDENCE_LADDER, GROUPS, MODULES, PRINCIPLE, SEQUENCE, SOURCES, STATUSES, moduleOf, present,
  type Group,
} from './serviceregister';

/**
 * Holds the service expansion register to the same rule as the strategic one:
 * every cited file exists, each status cites the kind of file it claims,
 * every master row and expansion area it names is real, and every capability
 * marked present sits in a module with evidence. The supplied PDFs are never
 * evidence.
 *
 * `docs/SERVICE-EXPANSION-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/SERVICE-EXPANSION-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the service expansion register', () => {
  it('has the twenty-six modules, in the six groups, ids once', () => {
    expect(MODULES).toHaveLength(26);
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(26);
    for (const g of Object.keys(GROUPS) as Group[]) expect(MODULES.filter((m) => m.group === g).length, g).toBeGreaterThan(2);
    for (const m of MODULES) {
      expect(m.capabilities.length, m.id).toBeGreaterThan(5);
      expect(m.boundary.trim().length, m.id).toBeGreaterThan(20);
      expect(m.why.trim().length, m.id).toBeGreaterThan(20);
    }
  });

  it('keeps the two supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(2);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const m of MODULES) for (const e of m.evidence) expect(supplied.has(e.path), `${m.id} cites a supplied PDF`).toBe(false);
  });

  it('names only master rows and expansion areas that exist', () => {
    const rows = new Set(REGISTER.map((r) => r.id));
    const areas = new Set(AREAS.map((a) => a.id));
    for (const m of MODULES) {
      for (const id of m.master) expect(rows.has(id), `${m.id} names master ${id}`).toBe(true);
      for (const id of m.areas) expect(areas.has(id), `${m.id} names area ${id}`).toBe(true);
    }
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-service-evidence.md'))).toBe(false);
  });

  it('cites only files that exist', () => {
    for (const m of MODULES) for (const e of m.evidence) expect(existsSync(join(root, e.path)), `${m.id} cites ${e.path}`).toBe(true);
  });

  it('holds each status to the kind of file it claims, and names a gap', () => {
    for (const m of MODULES) {
      const paths = m.evidence.map((e) => e.path);
      expect(STATUSES, m.id).toContain(m.status);
      if (m.status === 'designed') expect(paths.some(isDoc), `${m.id} is designed and cites no document`).toBe(true);
      if (m.status === 'building') expect(paths.some(isCode), `${m.id} is building and cites no code`).toBe(true);
      if (m.status === 'tested') expect(paths.some(isTest), `${m.id} is tested and cites no test`).toBe(true);
      if (m.status === 'not-started') expect(paths.every(isDoc), `${m.id} is not started yet cites code`).toBe(true);
      expect(m.gap.trim().length, m.id).toBeGreaterThan(20);
    }
  });

  it('marks a capability present only where the module has code or a test, and never marks all of them', () => {
    for (const m of MODULES) {
      const hasCode = m.evidence.some((e) => isCode(e.path));
      if (present(m) > 0) expect(hasCode, `${m.id} marks capabilities present with no code cited`).toBe(true);
      expect(present(m), `${m.id} claims every capability`).toBeLessThan(m.capabilities.length);
      if (m.status === 'not-started') expect(present(m), m.id).toBe(0);
    }
  });

  it('sequences every rank once, over modules that exist, and keeps the twelve questions', () => {
    expect(SEQUENCE.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const s of SEQUENCE) for (const id of s.modules) expect(moduleOf(id), `${s.what} → ${id}`).toBeTruthy();
    expect(EVALUATION).toHaveLength(12);
    expect(DELIVERY_ORDER).toHaveLength(6);
    expect(CAREER_OS).toHaveLength(8);
    expect(EVIDENCE_LADDER).toHaveLength(6);
    expect(EMPLOYER_NEVER).toHaveLength(8);
    expect(PRINCIPLE).toMatch(/friction/);
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
  const count = (s: string) => MODULES.filter((m) => m.status === s).length;
  const caps = MODULES.reduce((n, m) => n + m.capabilities.length, 0);
  const have = MODULES.reduce((n, m) => n + present(m), 0);
  const out: string[] = [
    '# Service Expansion Register',
    '',
    '<!-- Rendered from app/src/lib/serviceregister.ts by serviceregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'The twenty-six service layers a document of 28 September 2026 proposes beyond',
    'coursework — student-life, academic, career, institutional, platform-and-trust',
    'and commercial — and where the repository stands on each. The',
    '[strategic expansion register](STRATEGIC-EXPANSION-REGISTER.md) is the',
    'governance that makes Semester durable; this is what a student or an office',
    'would use. Where a module overlaps an area there, or a row of the',
    '[master register](MASTER-LAUNCH-READINESS-REGISTER.md), it names them.',
    '',
    `**${PRINCIPLE}**`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## Where it stands',
    '',
    'A status is a claim about the *best* piece of a module — `tested` cites a test',
    'that runs on every change, `building` code, `designed` a document — so nearly',
    'every module is `tested`: the app already has a checklist, a directory entry or',
    'a screen for part of it. What the status cannot say, the capability marks do:',
    'each capability the document asks for is marked present or absent, and the',
    'table counts them. A module that is `tested` at 3 of 12 is mostly not there.',
    `Across the register, ${have} of ${caps} capabilities have something in the tree.`,
    'Assessed against `origin/main` `92952f0` on 28 September 2026; the supplied',
    'PDFs are never cited as evidence.',
    '',
    '| ID | Module | Group | Status | Present | Overlaps |',
    '| --- | --- | --- | --- | ---: | --- |',
  ];
  for (const m of MODULES) {
    const overlaps = [...m.master.map((x) => `\`${x}\``), ...m.areas.map((x) => `[${x}](STRATEGIC-EXPANSION-REGISTER.md#${x.toLowerCase()})`)].join(', ') || '—';
    out.push(`| [${m.id}](#${m.id.toLowerCase()}) | ${cell(m.title)} | ${GROUPS[m.group]} | ${m.status} | ${present(m)} / ${m.capabilities.length} | ${overlaps} |`);
  }
  out.push(`| **total** | | | ${STATUSES.map((s) => `${s} ${count(s)}`).join(', ')} | **${have} / ${caps}** | |`, '');

  out.push('## The strategic sequence', '', 'The highest-leverage next additions, in the document’s order.', '', '| # | What | Why | Modules |', '| ---: | --- | --- | --- |');
  for (const s of SEQUENCE) out.push(`| ${s.rank} | ${cell(s.what)} | ${cell(s.why)} | ${s.modules.map((id) => `[${id}](#${id.toLowerCase()})`).join(', ')} |`);
  out.push('', 'The second document orders its own four modules and their governance:', '', ...DELIVERY_ORDER.map((d, i) => `${i + 1}. ${d}`), '');

  out.push('## The register', '');
  for (const g of Object.keys(GROUPS) as Group[]) {
    out.push(`### ${GROUPS[g]}`, '');
    for (const m of MODULES.filter((x) => x.group === g)) {
      out.push(`#### ${m.id}`, '', `**${m.title}.** ${m.why}`, '', `*Boundary.* ${m.boundary}`, '', `*Status.* ${m.status}, ${present(m)} of ${m.capabilities.length} capabilities present.`, '');
      for (const c of m.capabilities) out.push(`- [${c.have ? 'x' : ' '}] ${c.what}`);
      out.push('', '| Evidence | Shows |', '| --- | --- |');
      for (const e of m.evidence) out.push(`| \`${e.path}\` | ${cell(e.shows)} |`);
      out.push('', `*Gap.* ${m.gap}`, '');
    }
  }

  out.push(
    '## Career OS: what Semester does, and does not',
    '',
    '| Capability | What Semester does | What Semester does not do |',
    '| --- | --- | --- |',
    ...CAREER_OS.map((c) => `| ${cell(c.capability)} | ${cell(c.does)} | ${cell(c.doesNot)} |`),
    '',
    `A skills record distinguishes, in order: ${EVIDENCE_LADDER.map((e) => e.toLowerCase()).join(' → ')}. That prevents a common credibility failure: treating attendance or a self-description as an independently validated skill.`,
    '',
    'Employers may pay for legitimate services — verified postings, office hours,',
    'events, portfolio review. They never receive:',
    '',
    ...EMPLOYER_NEVER.map((n) => `- ${n}`),
    '',
    'Students opt in to any employer-facing profile, select individual artifacts,',
    'set expiry dates, and revoke sharing where technically possible.',
    '',
    '## What to evaluate next',
    '',
    'Score every proposed service against these before adding it. The scope rule and',
    'its nine questions in the pull-request template apply first; these are the',
    'service-specific ones.',
    '',
    '| Question | Why it matters |',
    '| --- | --- |',
    ...EVALUATION.map((e) => `| ${cell(e.question)} | ${cell(e.why)} |`),
    '',
    'The ultimate benchmark is a platform that helps a student move from “I do not',
    'know where to start” to “I know what matters, what I can do, who can help, and',
    'what is officially true” — while giving institutions the governance and evidence',
    'to support that experience.',
    '',
  );
  return out.join('\n');
}
