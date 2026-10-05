import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOTS } from '../state/shape';
import { CONTROLS } from './mecontrols';
import {
  ACTION_MODEL, ALL, CONSOLE, CONSOLE_RULE, ENVELOPE, ENVELOPE_FIELDS, FOUND, FOUNDATIONS, GATES, HIERARCHY, ME_CENTRE, NAVIGATION, NOTIFICATIONS, OBJECTS, PALETTE,
  PRINCIPLE, ROOT_MAP, RULES, SEARCH, SOURCES, STATUSES, STATUS_MAP, TRUST, TRUST_EXAMPLE, UNMAPPED_ROOT,
} from './onesystem';
import { STATUS_WORDS } from './provenance';

/**
 * Holds the one-system page to the tree: every mapped root names a root the
 * app has (and the one it lacks is the one the documents lack), every status
 * word names one the provenance module has or says none does, every Me item
 * names a control row that exists, every foundation, gate and rule cites the
 * kind of file its status claims and only files that exist, and the supplied
 * PDFs are never evidence.
 *
 * `docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('one system', () => {
  it('keeps the two supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(2);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const h of ALL) for (const e of h.evidence) expect(supplied.has(e.path), `${h.id} cites a supplied PDF`).toBe(false);
    expect(PRINCIPLE).toMatch(/one platform with many domains/);
  });

  it('maps the nine areas onto roots the app has, and names the one root the documents do not', () => {
    expect(ROOT_MAP).toHaveLength(9);
    for (const r of ROOT_MAP) if (r.root) expect(ROOTS, `${r.area} → ${r.root}`).toContain(r.root);
    expect(ROOT_MAP.filter((r) => !r.root).map((r) => r.area)).toEqual(['Messages', 'Search']);
    expect(ROOTS).toContain(UNMAPPED_ROOT);
    expect(ROOT_MAP.map((r) => r.root)).not.toContain(UNMAPPED_ROOT);
    const covered = new Set(ROOT_MAP.map((r) => r.root));
    for (const r of ROOTS) if (r !== UNMAPPED_ROOT) expect(covered.has(r), `app root ${r} has no area`).toBe(true);
    expect(HIERARCHY).toMatch(/Institution → Term → Course/);
  });

  it('holds the status vocabulary to the provenance module, and says which word it lacks', () => {
    expect(STATUS_MAP).toHaveLength(9);
    for (const s of STATUS_MAP) if (s.carriedBy) expect(STATUS_WORDS, `${s.word} → ${s.carriedBy}`).toContain(s.carriedBy);
    expect(STATUS_MAP.filter((s) => !s.carriedBy).map((s) => s.word)).toEqual(['needs review']);
    expect(STATUS_WORDS).not.toContain('Needs review');
    expect(TRUST_EXAMPLE).toMatch(/"source"/);
    expect(OBJECTS).toHaveLength(21);
    expect(ENVELOPE_FIELDS).toHaveLength(34);
    expect(ENVELOPE_FIELDS).toContain('audit_correlation_id');
  });

  it('holds the Me centre to the control rows that exist', () => {
    const ids = new Set(CONTROLS.map((c) => c.id));
    expect(ids.has('security')).toBe(true);
    expect(ids.has('consent'), 'the control: a row that does not exist').toBe(false);
    expect(ME_CENTRE).toHaveLength(10);
    for (const m of ME_CENTRE) if (m.carriedBy) expect(ids.has(m.carriedBy), `${m.item} → ${m.carriedBy}`).toBe(true);
    expect(ME_CENTRE.filter((m) => !m.carriedBy)).toHaveLength(2);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-one-system-evidence.md'))).toBe(false);
  });

  it('has the sections whole, ids once', () => {
    expect(NAVIGATION).toHaveLength(2);
    expect(ENVELOPE).toHaveLength(10);
    expect(TRUST).toHaveLength(2);
    expect(ACTION_MODEL).toHaveLength(8);
    expect(NOTIFICATIONS).toHaveLength(10);
    expect(SEARCH).toHaveLength(3);
    expect(PALETTE).toHaveLength(11);
    expect(CONSOLE).toHaveLength(14);
    expect(CONSOLE_RULE).toMatch(/no separate admin tool/);
    expect(GATES).toHaveLength(12);
    expect(FOUNDATIONS).toHaveLength(11);
    expect(RULES).toHaveLength(7);
    expect(FOUND).toHaveLength(0);
    const ids = [...ENVELOPE, ...GATES, ...FOUNDATIONS, ...RULES, ...CONSOLE].map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cites only files that exist, and holds each status to the kind of file it claims', () => {
    for (const h of ALL) {
      const paths = h.evidence.map((e) => e.path);
      expect(paths.length, h.id).toBeGreaterThan(0);
      for (const p of paths) expect(existsSync(join(root, p)), `${h.id} cites ${p}`).toBe(true);
      expect(STATUSES, h.id).toContain(h.status);
      if (h.status === 'designed') expect(paths.some(isDoc), `${h.id} is designed and cites no document`).toBe(true);
      if (h.status === 'building') expect(paths.some(isCode), `${h.id} is building and cites no code`).toBe(true);
      if (h.status === 'tested') expect(paths.some(isTest), `${h.id} is tested and cites no test`).toBe(true);
      if (h.status === 'not-started') expect(paths.every(isDoc), `${h.id} is not started yet cites code`).toBe(true);
      expect(h.gap.trim().length, h.id).toBeGreaterThan(3);
    }
  });

  it('keeps the two faults found on 28 September fixed', () => {
    expect(read('app/src/lib/provenance.ts')).not.toMatch(/components\/SourceScopeStatus\.tsx/);
    expect(existsSync(join(root, 'app/src/lib/comms.test.ts')), 'comms.ts names comms.test.ts; it must exist').toBe(true);
    expect(read('app/src/lib/comms.ts')).toMatch(/comms\.test\.ts/);
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

function table(rows: readonly typeof ALL[number][], label = 'What'): string[] {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const out = [`| ID | ${label} | Status | Evidence | Gap |`, '| --- | --- | --- | --- | --- |'];
  for (const r of rows) out.push(`| ${r.id} | ${cell(r.what)} | ${r.status} | ${r.evidence.map((e) => `\`${e.path}\`: ${cell(e.shows)}`).join('<br>')} | ${cell(r.gap)} |`);
  out.push(`| **total** | | ${STATUSES.map((s) => `${s} ${count(s)}`).join(', ')} | | |`, '');
  return out;
}

function render(): string {
  const out: string[] = [
    '# One system: the platform grammar',
    '',
    '<!-- Rendered from app/src/lib/onesystem.ts by onesystem.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'What makes Semester feel like one coherent system rather than a bunch of',
    'different screens and tools: one information architecture, one object model,',
    'one design system, one trust pattern, one action model, one notification',
    'centre, one search, one data-agency centre, one operational control plane,',
    'twelve consistency release gates and seven cross-domain relationship rules —',
    'from two documents of 28 September 2026, held to what the tree already has',
    'for each. The [UI constitution](design/SEMESTER-UI-CONSTITUTION.md) is the',
    'design system’s own law; the [do-not-build page](DO-NOT-BUILD.md) holds the',
    'roots.',
    '',
    `**${PRINCIPLE}** The shared foundations mostly exist as parts. The gap is how they are joined: three navigation models where the documents want one, a trust vocabulary in three components, the pieces of an action model with no single pipeline, notification controls spread across files, and an operations console whose screen unifies seven views while five more stay data or University tabs. So this page is less a list of things to build than a list of things to converge, and each row says which.`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    'A status is a claim about the best piece of a row: `tested` cites a test that',
    'runs on every change, `building` code, `designed` a document, `not-started` at',
    'most a document naming the gap. The supplied PDFs are never evidence.',
    '',
    '## One information architecture',
    '',
    `The documents’ nine top-level areas, each at the app root that carries it. The app has ${ROOTS.length} roots; the test holds every name to that list. The one app root the documents have no area for is \`${UNMAPPED_ROOT}\`.`,
    '',
    '| Area | App root | Note |',
    '| --- | --- | --- |',
    ...ROOT_MAP.map((r) => `| ${r.area} | ${r.root ? `\`${r.root}\`` : '—'} | ${cell(r.note)} |`),
    '',
    `Then the same contextual navigation everywhere: ${HIERARCHY}. A student never needs to know which backend system owns an item in order to use it.`,
    '',
    ...table(NAVIGATION),
    '## One object model',
    '',
    `Every module uses the same shared objects: ${OBJECTS.join(', ')}. Every object carries the same envelope, at what the tree has:`,
    '',
    ...table(ENVELOPE, 'Field'),
    `The documents’ universal metadata envelope, in full: ${ENVELOPE_FIELDS.map((f) => `\`${f}\``).join(', ')}. No table carries it whole; the fields it names are spread across the source labels, the retention schedule, the events and the audit tables above.`,
    '',
    '## One trust pattern: Source, Scope, Status',
    '',
    'Where did this come from; who can see or act on it; is it official, estimated,',
    'draft, current, pending, stale, restricted, archived, or does it need review.',
    'The status words, held to `lib/provenance.ts`:',
    '',
    '| Documents’ word | App word |',
    '| --- | --- |',
    ...STATUS_MAP.map((s) => `| ${s.word} | ${s.carriedBy ? `\`${s.carriedBy}\`` : '— (the label exists in `lib/source.ts` as `needs_review`; the status list has no word for it)'} |`),
    '',
    ...table(TRUST),
    'The universal trust payload every user-facing object would expose:',
    '',
    '```json',
    TRUST_EXAMPLE,
    '```',
    '',
    '## One action model',
    '',
    'Preview → explain the impact → identify the target and the authority →',
    'confirm if consequential → execute → show the completion state → preserve an',
    'audit event → provide undo or recovery if possible → show the support route if',
    'not. Adding a deadline, sharing a portfolio, syncing a grade, joining a club',
    'and sending a referral all make scope, impact and recovery obvious.',
    '',
    ...table(ACTION_MODEL, 'Step'),
    '## One notification centre',
    '',
    ...table(NOTIFICATIONS),
    '## One search and command system',
    '',
    `The documents’ command palette: ${PALETTE.join(', ')}.`,
    '',
    ...table(SEARCH),
    '## One profile and data-agency centre',
    '',
    'A student should not need to hunt through course, community, career and',
    'support modules to understand who has access to their information. Each',
    'item at the `CONTROLS` row in `lib/mecontrols.ts` that carries it:',
    '',
    '| Item | Row | Note |',
    '| --- | --- | --- |',
    ...ME_CENTRE.map((m) => `| ${cell(m.item)} | ${m.carriedBy ? `\`${m.carriedBy}\`` : '—'} | ${cell(m.note)} |`),
    '',
    '## One operational control plane',
    '',
    `${CONSOLE_RULE} The console exists ([docs/OPERATIONS-CONSOLE-MAP.md](OPERATIONS-CONSOLE-MAP.md), from [ops/operations-console](../ops/operations-console/README.md)); the views it unifies and the ones still outside it, at what the tree has:`,
    '',
    ...table(CONSOLE, 'View'),
    '## Consistency release gates',
    '',
    'Before any new feature is released:',
    '',
    ...table(GATES, 'Gate'),
    '## The eleven foundations',
    '',
    ...table(FOUNDATIONS, 'Foundation'),
    '## Cross-domain relationship rules',
    '',
    ...table(RULES, 'Rule'),
    '## Found on the way',
    '',
    ...(FOUND.length ? list(FOUND) : ['Two faults found on 28 September — a trust component `provenance.ts` named that did not exist, and a test `comms.ts` named that did not exist — were fixed the same day, and the test holds them fixed. Nothing is open.']),
    '',
  ];
  return out.join('\n');
}
