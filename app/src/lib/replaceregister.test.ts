import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FRESHNESS_TEXT } from './integration/freshness';
import {
  ALL, BEST_NEXT, BOUNDED, CONFIDENCE, DOMAINS, END_STATE, EXPANSION, FINAL_AREAS, HOLD_CATEGORIES, HOW_A_DOMAIN_RUNS, LEADERSHIP_STANDARD, PHASES, PRINCIPLE,
  REQUIREMENTS, SHARED, SOURCES, SOURCE_STATES, STATUSES, STATUS_MEANING, STRATEGY, blockers, counts, replaceable, row, weakest, type Held,
} from './replaceregister';
import { SOURCE_LABELS, SOURCE_TEXT } from './source';

/**
 * Holds the domain-replacement page to the tree: every row's status to the
 * kind of file it cites, every cited path to existing, the supplied PDFs to
 * never being evidence, the seven source states to the two vocabularies that
 * carry them, the replaceability gate to the requirements it is computed
 * from, and the architecture page to carrying D-143's reading of the
 * destination.
 *
 * `docs/DOMAIN-REPLACEMENT-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/DOMAIN-REPLACEMENT-REGISTER.md';
const ARCHITECTURE = 'docs/UNIVERSITY-OS-ARCHITECTURE.md';

const isDoc = (p: string) => /\.(md|pdf|json|yml)$/.test(p) && !/\.github\/workflows\//.test(p);
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

/** The rule every register here uses: a status may not claim more than the kind of file it cites. */
function faults(h: Held): string[] {
  const out: string[] = [];
  const paths = h.evidence.map((e) => e.path);
  if (paths.length === 0) out.push(`${h.id} cites nothing`);
  for (const p of paths) if (!existsSync(join(root, p))) out.push(`${h.id} cites ${p}, which does not exist`);
  if (h.status === 'designed' && !paths.some(isDoc)) out.push(`${h.id} is designed and cites no document`);
  if (h.status === 'building' && !paths.some(isCode)) out.push(`${h.id} is building and cites no code`);
  if (h.status === 'tested' && !paths.some(isTest)) out.push(`${h.id} is tested and cites no test`);
  if (h.status === 'not-started' && !paths.every(isDoc)) out.push(`${h.id} is not started yet cites code`);
  if (h.gap.trim().length < 12) out.push(`${h.id} has no gap`);
  return out;
}

describe('the domain replacement register', () => {
  it('keeps the four supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(4);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const h of ALL) for (const e of h.evidence) expect(supplied.has(e.path), `${h.id} cites a supplied PDF`).toBe(false);
    expect(STRATEGY).toBe('Connect first. Replace by domain. Operate as one system.');
    expect(END_STATE).toMatch(/eventually the system of record for the domains an institution chooses to migrate/);
    expect(LEADERSHIP_STANDARD).toMatch(/continuity\.$/);
    expect(HOW_A_DOMAIN_RUNS).toHaveLength(4);
  });

  it('has the fourteen domains, fifteen requirements, six phases and the rows the briefs list', () => {
    expect(DOMAINS).toHaveLength(14);
    expect(REQUIREMENTS).toHaveLength(15);
    expect(PHASES.map((p) => p.phase)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(PRINCIPLE).toHaveLength(13);
    expect(EXPANSION).toHaveLength(17);
    expect(CONFIDENCE).toHaveLength(22);
    expect(SHARED).toHaveLength(13);
    expect(BOUNDED).toHaveLength(8);
    expect(HOLD_CATEGORIES).toHaveLength(8);
    expect(new Set(ALL.map((h) => h.id)).size, 'ids are unique').toBe(ALL.length);
    const domains = new Set(DOMAINS.map((d) => d.id));
    for (const p of PHASES) for (const d of p.covers) expect(domains.has(d), `phase ${p.phase} → ${d}`).toBe(true);
    // Every domain is in some phase.
    for (const d of domains) expect(PHASES.some((p) => p.covers.includes(d)), d).toBe(true);
  });

  it('can tell a missing file and an over-claimed status from good ones', () => {
    const good: Held = { id: 'x', what: 'x', status: 'tested', evidence: [{ path: 'app/src/lib/source.test.ts', shows: 'x' }], gap: 'a gap that is long enough' };
    expect(faults(good)).toEqual([]);
    expect(faults({ ...good, evidence: [{ path: 'docs/no-such-replacement-evidence.md', shows: 'x' }] }).length).toBeGreaterThan(0);
    expect(faults({ ...good, evidence: [{ path: 'README.md', shows: 'x' }] }), 'tested on a document').toContain('x is tested and cites no test');
    expect(faults({ ...good, status: 'not-started' }), 'not started with a test').toContain('x is not started yet cites code');
  });

  it('cites only files that exist, and holds each status to the kind of file it claims', () => {
    expect(ALL.flatMap(faults)).toEqual([]);
    for (const h of ALL) expect(STATUSES, h.id).toContain(h.status);
  });

  it('holds the seven source states to the labels the database enforces and to the freshness vocabulary', () => {
    expect(SOURCE_STATES).toHaveLength(7);
    const labelled = SOURCE_STATES.filter((s) => s.label);
    expect(labelled.map((s) => s.label)).toEqual([...SOURCE_LABELS]);
    for (const s of labelled) expect(SOURCE_TEXT[s.label!], s.state).toBe(s.state);
    for (const s of SOURCE_STATES.filter((x) => !x.label)) {
      expect(s.freshness, s.state).not.toBeNull();
      expect(FRESHNESS_TEXT[s.freshness!], s.state).toBeTruthy();
    }
    expect(SOURCE_STATES.every((s) => (s.label === null) !== (s.freshness === null)), 'each state is carried by exactly one vocabulary').toBe(true);
  });

  it('computes replaceability from the requirements, and no domain is replaceable while any requirement is short of tested', () => {
    const short = REQUIREMENTS.filter((r) => r.status !== 'tested');
    for (const d of DOMAINS) {
      expect(replaceable(d), d.id).toBe(d.replace.status === 'tested' && short.length === 0);
      const b = blockers(d);
      for (const r of short) expect(b, `${d.id} is stopped by ${r.id}`).toContain(r);
      if (d.replace.status !== 'tested') expect(b[0], d.id).toBe(d.replace);
    }
    // The gate is not decorative: if every requirement were tested, a tested native row would pass.
    const tested = DOMAINS.find((d) => d.replace.status === 'tested');
    if (tested && short.length === 0) expect(replaceable(tested)).toBe(true);
    expect(DOMAINS.filter(replaceable).map((d) => d.id)).toEqual([]);
  });

  it('keeps health and emergency response bounded, and financial aid unclaimed', () => {
    expect(BOUNDED.find((b) => b.domain === 'Health')?.nonNegotiable).toMatch(/Never a clinical record system/);
    expect(BOUNDED.find((b) => b.domain === 'Emergency response')?.nonNegotiable).toMatch(/no ordinary admin access/);
    expect(DOMAINS.some((d) => /health|emergency/i.test(d.domain)), 'neither is a domain to replace').toBe(false);
    expect(row('aid-native').status).toBe('not-started');
  });

  it('names only rows that exist in the best next modules and the final areas', () => {
    expect(BEST_NEXT).toHaveLength(10);
    for (const id of BEST_NEXT) expect(() => row(id), id).not.toThrow();
    expect(FINAL_AREAS).toHaveLength(12);
    for (const a of FINAL_AREAS) for (const id of a.rows) expect(() => row(id), `${a.area} → ${id}`).not.toThrow();
  });

  it('keeps the architecture page’s destination in step with D-143', () => {
    const arch = read(ARCHITECTURE);
    expect(arch).toMatch(/D-143/);
    expect(arch).toMatch(/Connect first, replace by domain/);
    expect(arch).toContain('docs/DOMAIN-REPLACEMENT-REGISTER.md'.replace(/^docs\//, ''));
    // The old absolute is gone; the list survives as today's boundary.
    expect(arch).not.toMatch(/It is never\s+the system of record/);
    expect(arch).toMatch(/\*\*Today Semester does not replace:\*\*/);
    expect(read('docs/DECISION-LOG.md')).toMatch(/^## D-143 · /m);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const evidence = (h: Held) => h.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>');
const tally = (rows: readonly Held[]) => {
  const c = counts(rows);
  return [`| ${STATUSES.join(' | ')} |`, `| ${STATUSES.map(() => '---:').join(' | ')} |`, `| ${STATUSES.map((s) => c[s]).join(' | ')} |`, ''];
};
const table = (rows: readonly Held[], head = 'Capability') => [
  `| ID | ${head} | Status | Evidence | Gap |`,
  '| --- | --- | --- | --- | --- |',
  ...rows.map((h) => `| ${h.id} | ${cell(h.what)} | ${h.status} | ${evidence(h)} | ${cell(h.gap)} |`),
  '',
];

function render(): string {
  const all = counts();
  const short = REQUIREMENTS.filter((r) => r.status !== 'tested');
  return [
    '# Domain replacement register',
    '',
    '<!-- Rendered from app/src/lib/replaceregister.ts by replaceregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    `**${STRATEGY}**`,
    '',
    'Semester is meant to replace the fragmented university stack, not sit beside',
    'it as another portal. It connects to the SIS, ERP, LMS, registrar, aid,',
    'accounts, housing, dining and campus tools first, to migrate data, validate',
    'workflows and earn trust; then replaces each domain with a native, governed',
    'module when that domain is mature enough to run through Semester. D-143',
    'records this as the destination. Until a domain clears the bar below, the',
    'boundary in [`UNIVERSITY-OS-ARCHITECTURE.md`](UNIVERSITY-OS-ARCHITECTURE.md)',
    'still holds for it.',
    '',
    `> ${END_STATE}`,
    '',
    'Behind the scenes, each domain is run one of four ways:',
    '',
    ...HOW_A_DOMAIN_RUNS.map((h, i) => `${i + 1}. ${h}`),
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    `${ALL.length} rows. Statuses were read on 29 September 2026 under the rule every register here uses: \`designed\` cites a document, \`building\` code, \`tested\` a test, and every cited path exists. A supplied PDF is never evidence.`,
    '',
    '| Status | Means |',
    '| --- | --- |',
    ...STATUSES.map((s) => `| ${s} | ${STATUS_MEANING[s]} |`),
    '',
    ...tally(ALL),
    '## Can any domain be retired into Semester yet?',
    '',
    `A domain is replaceable only when its native row and all ${REQUIREMENTS.length} replaceability requirements are held by a test. That is computed, not asserted. **Today: ${DOMAINS.filter(replaceable).length} of ${DOMAINS.length}.** ${short.length} requirement${short.length === 1 ? '' : 's'} stop${short.length === 1 ? 's' : ''} every domain: ${short.map((r) => `\`${r.id}\` (${r.status})`).join(', ')}.`,
    '',
    '| Domain | Connect first | Native replacement | Stopped by |',
    '| --- | --- | --- | --- |',
    ...DOMAINS.map((d) => `| ${d.domain} | ${d.connect.status} | ${d.replace.status} | ${blockers(d).map((b) => `\`${b.id}\``).join(', ')} |`),
    '',
    '## The domain ladder',
    '',
    'Replace by domain maturity, not all at once. Each domain has the role Semester plays at first and the native state it grows into.',
    '',
    '| Domain | Initial role | Status | Evidence | Gap | Native replacement | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...DOMAINS.map((d) => `| ${d.domain} | ${cell(d.initial)} | ${d.connect.status} | ${evidence(d.connect)} | ${cell(d.connect.gap)} | ${cell(d.native)} | ${d.replace.status} | ${evidence(d.replace)} | ${cell(d.replace.gap)} |`),
    '',
    ...tally(DOMAINS.flatMap((d) => [d.connect, d.replace])),
    '## What replacement requires',
    '',
    'Semester cannot claim to replace a system because it reproduces a screen. Product workflow + authoritative data model + approvals + permissions + audit + reporting + migration + integrations + support + continuity + legal and compliance evidence = a replaceable institutional system.',
    '',
    ...table(REQUIREMENTS, 'Requirement'),
    ...tally(REQUIREMENTS),
    '## The six phases',
    '',
    '| Phase | Name | Domains | Weakest native row |',
    '| ---: | --- | --- | --- |',
    ...PHASES.map((p) => `| ${p.phase} | ${p.name} | ${p.covers.join(', ')} | ${weakest(p.covers.map((c) => `${c}-native`))} |`),
    '',
    '## The non-negotiable architecture',
    '',
    'One modular platform, not disconnected applications. Every module shares:',
    '',
    ...SHARED.map((s) => `- ${s}.`),
    '',
    '### What stays bounded',
    '',
    '| Domain | Semester can eventually support | Non-negotiable |',
    '| --- | --- | --- |',
    ...BOUNDED.map((b) => `| ${b.domain} | ${cell(b.eventually)} | ${cell(b.nonNegotiable)} |`),
    '',
    '## The architecture principle for today',
    '',
    'Until a domain is migrated, its official system stays authoritative; Semester receives only approved, minimum fields and shows where every fact came from.',
    '',
    ...table(PRINCIPLE, 'Principle'),
    ...tally(PRINCIPLE),
    '### The seven source states',
    '',
    'Five are the labels the database enforces (`lib/source.ts`); two are freshness states (`lib/integration/freshness.ts`). The test holds each to exactly one.',
    '',
    '| State | Meaning | Carried by |',
    '| --- | --- | --- |',
    ...SOURCE_STATES.map((s) => `| ${s.state} | ${cell(s.meaning)} | ${s.label ? `source label \`${s.label}\`` : `freshness \`${s.freshness}\``} |`),
    '',
    '### Hold categories',
    '',
    'A hold is a source-controlled administrative state, not a generic item. Neutral language, source and time always shown, never a promise it will lift, and never marked resolved until the official source says so.',
    '',
    '| Category | Semester supports | Official system keeps |',
    '| --- | --- | --- |',
    ...HOLD_CATEGORIES.map((h) => `| ${h.category} | ${cell(h.semester)} | ${cell(h.official)} |`),
    '',
    '## Registration, LMS and services expansion',
    '',
    ...table(EXPANSION),
    ...tally(EXPANSION),
    '### The ten best next modules',
    '',
    ...BEST_NEXT.map((id, i) => `${i + 1}. \`${id}\` — ${row(id).what} (${row(id).status})`),
    '',
    '## What an institution needs to retire a system',
    '',
    'The question is no longer what more Semester can do, but what must exist so an institution can confidently retire another system and run that domain through Semester.',
    '',
    ...table(CONFIDENCE, 'Capability'),
    ...tally(CONFIDENCE),
    '### The twelve final areas',
    '',
    '| Area | Rows | Weakest |',
    '| --- | --- | --- |',
    ...FINAL_AREAS.map((a) => `| ${a.area} | ${a.rows.map((r) => `\`${r}\``).join(', ')} | ${weakest(a.rows)} |`),
    '',
    '## The standard',
    '',
    `> ${LEADERSHIP_STANDARD}`,
    '',
    'The last requirement is not another feature. It is institutional confidence.',
    `Of ${all.tested + all.building + all.designed + all['not-started']} rows here, ${all.tested} are held by a test, ${all.building} are being built, ${all.designed} are designed and ${all['not-started']} are not started.`,
    '',
  ].join('\n');
}
