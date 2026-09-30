import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEEDS } from '../help-routes';
import { match } from '../nowrongdoor';
import { STANDARD as PUBLIC_STANDARD } from '../standard';
import { COUNCIL, SEATS } from '../launchreadiness';
import { TASKS } from '../launch/ninety-day';
import { DOMAINS as MASTER_DOMAINS, REGISTER } from '../masterregister';
import { BOUNDARIES } from './boundaries';
import { MEASURES } from './firstyear';
import {
  AI_CONTROL_CENTER, ASSETS, BEHAVIOURS, BENCHMARK, BUILT_HERE, CONFLICTS, DECISION_FILES, DELIVERABLES, DISRUPTION, ENDURING_BENCHMARK, FACULTY_MEASURES, FACULTY_PHASES,
  FACULTY_PROMISES, FACULTY_SEGMENTS, FRICTION, FRICTION_RULE, IMPLEMENTATION, INFLUENCE, ITEMS, KNOWLEDGE_FIELDS, KNOWLEDGE_SIGNALS, LAUNCH_SYSTEM, LAYERS, LINES,
  LIVE_STANDARD, MOMENTS, ONES, PARTNER_TYPES, PLAYS, PLAY_OWNER, POLICY_CARRIES, POLICY_FAMILIES, PORTABILITY, POSITION, REVENUE, ROADMAP, SCOPES, SHARED, SHARED_RULE,
  SOURCES, STAKEHOLDERS, STANDARD, STANDINGS, STANDING_MEANING, STUDENT_SAYS, TRUST_EVIDENCE, WORKFLOWS, allPaths, allRows, benchmark,
  type Item, type Standing,
} from './leadership';
import { cell, controlLine, link, renderedFrom, table } from './render';
import { written } from './decisionlog';

/**
 * Holds the market-leadership register to the tree: every master row, ninety-day
 * task, first-year measure, help-route need and boundary it names is real; every
 * path exists; each standing cites the kind of file it claims; a `held` item
 * cites a decision file; and the supplied PDFs are never evidence.
 *
 * `docs/MARKET-LEADERSHIP.md` is rendered from the data; run `npm run registers`
 * from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/MARKET-LEADERSHIP.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

/** The numbered rules of DO-NOT-BUILD.md. */
const doNotBuildRules = (): number[] => [...read('docs/DO-NOT-BUILD.md').matchAll(/^\| (\d+) \| \*\*/gm)].map((m) => Number(m[1]));
const decisionWritten = (d: string): boolean => written(root, d);

describe('the market leadership register', () => {
  const rows = new Set(REGISTER.map((r) => r.id));
  const tasks = new Set(TASKS.map((t) => t.id));
  const measures = new Set(MEASURES.map((m) => m.id));
  const needs = new Set<string>(NEEDS.map((n) => n.id));
  const boundaries = new Set(BOUNDARIES.map((b) => b.id));

  it('keeps the three supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(3);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const p of allPaths()) expect(supplied.has(p), `${p} is a supplied PDF`).toBe(false);
  });

  it('states the position, the five-line benchmark, and does not say all-in-one', () => {
    expect(POSITION).toMatch(/operating layer/);
    expect(ENDURING_BENCHMARK).toHaveLength(5);
    expect(POSITION.toLowerCase()).not.toContain('all-in-one');
  });

  it('has the thirteen ones, the fourteen plays and the six phases, ids once, each with a gap', () => {
    expect(ONES).toHaveLength(13);
    expect(PLAYS).toHaveLength(14);
    expect(FACULTY_PHASES).toHaveLength(6);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(STANDINGS, i.id).toContain(i.standing);
      expect(i.gap.trim().length, i.id).toBeGreaterThan(20);
      expect(i.asks.trim().length, i.id).toBeGreaterThan(20);
    }
    for (const p of PLAYS) expect(SEATS, p.id).toContain(PLAY_OWNER[p.id]);
  });

  it('names only master rows that exist', () => {
    for (const id of allRows()) expect(rows.has(id), `${id} is not a master row`).toBe(true);
    expect(rows.has('STU-999')).toBe(false);
    for (const l of LAYERS) for (const d of l.domains) expect(Object.keys(MASTER_DOMAINS), `${l.layer}: ${d}`).toContain(d);
  });

  it('cites only files that exist', () => {
    for (const p of allPaths()) expect(existsSync(join(root, p)), p).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-leadership-evidence.md'))).toBe(false);
  });

  it('holds each standing to the kind of file it cites', () => {
    const check = (i: Item) => {
      const paths = i.evidence.map((e) => e.path);
      expect(paths.length, i.id).toBeGreaterThan(0);
      if (i.standing === 'built') expect(paths.some(isTest), `${i.id} is built and cites no test`).toBe(true);
      if (i.standing === 'partial') expect(paths.some(isCode), `${i.id} is partial and cites no code`).toBe(true);
      if (i.standing === 'not-built') expect(paths.every(isDoc), `${i.id} is not built yet cites code`).toBe(true);
      if (i.standing === 'held') expect(paths.some((p) => DECISION_FILES.includes(p)), `${i.id} is held and cites no decision file`).toBe(true);
    };
    for (const i of ITEMS) check(i);
    // The control: a fabricated built item with no test is refused.
    expect(() => check({ id: 'X', item: 'x', asks: 'x'.repeat(30), rows: [], standing: 'built', evidence: [{ path: 'README.md', shows: 'nothing' }], gap: 'x'.repeat(30) })).toThrow();
  });

  it('never marks all thirteen ones built, and counts them', () => {
    const count = (s: Standing) => ONES.filter((o) => o.standing === s).length;
    expect(count('built')).toBeGreaterThan(0);
    expect(count('built')).toBeLessThan(ONES.length);
    expect(count('held')).toBe(1);
    expect(Object.keys(STANDING_MEANING)).toEqual([...STANDINGS]);
  });

  it('holds the shared-services rule to a test or a review, and names seven services', () => {
    expect(SHARED_RULE).toMatch(/No module may create its own/);
    expect(SHARED).toHaveLength(7);
    for (const s of SHARED) {
      expect(s.holders.length, s.service).toBeGreaterThan(0);
      if (s.held === 'mechanical') expect(s.holders.some((h) => isTest(h.path) || /rules\.ts$/.test(h.path)), `${s.service} is mechanical and names no test`).toBe(true);
    }
  });

  it('maps the friction index to first-year measures that exist, and says when none does', () => {
    expect(FRICTION).toHaveLength(9);
    expect(FRICTION_RULE).toMatch(/not the student/);
    for (const f of FRICTION) if (f.measure) expect(measures.has(f.measure), `${f.question}: ${f.measure}`).toBe(true);
    expect(FRICTION.some((f) => f.measure === null)).toBe(true);
  });

  it('routes each student situation to a help-route need that exists, or says it has none', () => {
    expect(STUDENT_SAYS).toHaveLength(8);
    for (const s of STUDENT_SAYS) if (s.need) expect(needs.has(s.need), `${s.says}: ${s.need}`).toBe(true);
    // The door is the router’s own answer, not this file’s opinion.
    for (const s of STUDENT_SAYS) expect(match(s.says), s.says).toBe(s.need);
    expect(match('I am overwhelmed by this class.')).toBe('wellbeing'); // the control: crisis wording before the class
    expect(STUDENT_SAYS.some((s) => s.need === null)).toBe(true);
    expect(BEHAVIOURS).toHaveLength(7);
    expect(BEHAVIOURS.some((b) => b.path === null)).toBe(true);
  });

  it('holds the launch system to ninety-day tasks that exist, in windows that do not run backwards', () => {
    expect(LAUNCH_SYSTEM).toHaveLength(4);
    const windowOf = (id: string) => TASKS.find((t) => t.id === id)!.window;
    let last = 0;
    for (const w of LAUNCH_SYSTEM) {
      for (const id of w.tasks) expect(tasks.has(id), `${w.window}: ${id}`).toBe(true);
      const min = Math.min(...w.tasks.map(windowOf));
      expect(min, w.window).toBeGreaterThanOrEqual(last);
      last = min;
    }
    expect(DELIVERABLES).toHaveLength(11);
  });

  it('holds every line not crossed to a boundary, a rule or a decision file, or says it is proposed', () => {
    expect(LINES).toHaveLength(15);
    const ruleNumbers = doNotBuildRules();
    expect(ruleNumbers.length).toBeGreaterThanOrEqual(12);
    for (const l of LINES) {
      if (l.held === 'proposed') continue;
      if ('boundary' in l.held) expect(boundaries.has(l.held.boundary), `${l.rule}: ${l.held.boundary}`).toBe(true);
      if ('rule' in l.held) expect(ruleNumbers, `${l.rule}: rule ${l.held.rule}`).toContain(l.held.rule);
      if ('path' in l.held) expect(DECISION_FILES.concat('SEMESTER-OPERATING-SYSTEM.md', 'app/src/site/pages.tsx'), `${l.rule}: ${l.held.path}`).toContain(l.held.path);
    }
    expect(LINES.filter((l) => l.held === 'proposed').length).toBeGreaterThan(0);
    expect(boundaries.has('no-such-boundary')).toBe(false);
  });

  it('cites, for every revenue line held, a decision that is written down', () => {
    expect(REVENUE).toHaveLength(11);
    for (const r of REVENUE) for (const d of r.decisions) expect(decisionWritten(d), `${r.line}: ${d}`).toBe(true);
    expect(decisionWritten('D-99999')).toBe(false);
    expect(REVENUE.filter((r) => r.standing === 'held').length).toBeGreaterThanOrEqual(2);
    expect(CONFLICTS.length).toBeGreaterThanOrEqual(4);
  });

  it('applies the benchmark, and scores what this change built', () => {
    expect(BENCHMARK).toHaveLength(9);
    expect(benchmark(BENCHMARK.map(() => true)).pass).toBe(true);
    const one = benchmark(BENCHMARK.map((_, i) => i !== 4));
    expect(one.pass).toBe(false);
    expect(one.failing).toEqual([BENCHMARK[4]]);
    expect(() => benchmark([true])).toThrow();
    for (const b of BUILT_HERE) {
      expect(b.answers, b.what).toHaveLength(BENCHMARK.length);
      expect(benchmark(b.answers).pass, `${b.what} claims to pass the benchmark`).toBe(false);
    }
  });

  it('states, in each play’s gap, the count its own table computes', () => {
    const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
    const have = (xs: readonly { path: string | null }[]) => xs.filter((x) => x.path).length;
    const claims: [string, number][] = [
      ['PL-03', FRICTION.filter((f) => f.measure).length],
      ['PL-04', STUDENT_SAYS.filter((s) => s.need).length],
      ['PL-07', KNOWLEDGE_FIELDS.filter((f) => f.carried).length],
      ['PL-09', have(PORTABILITY)],
      ['PL-10', have(TRUST_EVIDENCE)],
      ['PL-11', STANDARD.filter((x) => x.commitment).length],
      ['PL-14', have(IMPLEMENTATION)],
      ['FP-2', have(POLICY_FAMILIES)],
      ['FP-4', have(MOMENTS)],
    ];
    for (const [id, n] of claims) {
      const gap = ITEMS.find((i) => i.id === id)!.gap.toLowerCase();
      expect(gap.startsWith(`${WORDS[n]} `) || gap.includes(` ${WORDS[n]} of `) || gap.includes(`data exists for ${WORDS[n]} `), `${id}: the gap does not say ${WORDS[n]}`).toBe(true);
    }
  });

  it('points each line of the memo’s standard at a commitment of the public standard', () => {
    const ids = new Set(PUBLIC_STANDARD.map((c) => c.id));
    for (const s of STANDARD) if (s.commitment) expect(ids.has(s.commitment), `${s.line}: ${s.commitment}`).toBe(true);
    expect(STANDARD.filter((s) => s.commitment).length).toBe(STANDARD.length);
    expect(ids.has('no-such-commitment')).toBe(false);
  });

  it('has the rest of the lists at the documents’ lengths', () => {
    expect(STAKEHOLDERS).toHaveLength(8);
    expect(AI_CONTROL_CENTER).toHaveLength(11);
    expect(KNOWLEDGE_FIELDS).toHaveLength(13);
    expect(KNOWLEDGE_SIGNALS).toHaveLength(7);
    expect(PORTABILITY).toHaveLength(10);
    expect(TRUST_EVIDENCE).toHaveLength(11);
    expect(STANDARD).toHaveLength(10);
    expect(ASSETS).toHaveLength(8);
    expect(PARTNER_TYPES).toHaveLength(9);
    expect(INFLUENCE).toHaveLength(9);
    expect(IMPLEMENTATION).toHaveLength(12);
    expect(ROADMAP.map((r) => r.quarter)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(LIVE_STANDARD).toHaveLength(13);
    expect(SCOPES).toHaveLength(9);
    expect(WORKFLOWS).toHaveLength(5);
    expect(FACULTY_SEGMENTS).toHaveLength(9);
    expect(POLICY_FAMILIES).toHaveLength(6);
    expect(POLICY_CARRIES).toHaveLength(7);
    expect(MOMENTS).toHaveLength(7);
    expect(FACULTY_MEASURES).toHaveLength(11);
    expect(FACULTY_PROMISES).toHaveLength(6);
    expect(DISRUPTION).toHaveLength(13);
    expect(LAYERS).toHaveLength(5);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

function render(): string {
  const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
  const status = (id: string) => REGISTER.find((r) => r.id === id)?.status ?? '?';
  const withStatus = (ids: readonly string[]) => (ids.length ? ids.map((id) => `${id} (${status(id)})`).join(', ') : '—');
  const RANK: Record<string, number> = { 'not-started': 0, blocked: 0, designed: 1, building: 2, implemented: 3, tested: 4, evidenced: 5, operational: 6, 'launch-approved': 7 };
  const lowest = (ids: readonly string[]) => (ids.length ? ids.map(status).sort((a, b) => RANK[a] - RANK[b])[0] : '—');
  const count = (items: readonly Item[], s: Standing) => items.filter((i) => i.standing === s).length;
  const heldSeats = COUNCIL.filter((c) => c.holder !== null);
  const counts = (items: readonly Item[]) => STANDINGS.map((s) => `${count(items, s)} ${s}`).join(', ');
  const itemTable = (items: readonly Item[], owner?: (id: string) => string) =>
    table(
      ['ID', 'Item', 'Asks', 'Master rows (status)', 'Standing', 'Evidence', 'Gap', ...(owner ? ['Seat'] : [])],
      items.map((i) => [`**${i.id}**`, cell(i.item), cell(i.asks), withStatus(i.rows), i.standing, i.evidence.map((e) => `${ref(e.path)} — ${cell(e.shows)}`).join('<br>'), cell(i.gap), ...(owner ? [`\`${owner(i.id)}\``] : [])]),
    );
  const or = (p: string | null) => (p ? ref(p) : '**nothing**');
  const heldAs = (l: (typeof LINES)[number]) => (l.held === 'proposed' ? '*proposed*' : 'boundary' in l.held ? `boundary \`${l.held.boundary}\`` : 'rule' in l.held ? `DO-NOT-BUILD rule ${l.held.rule}` : ref(l.held.path));
  const have = (xs: readonly { path: string | null }[]) => xs.filter((x) => x.path).length;

  const out: string[] = [
    '# Market leadership: what would make universities want Semester, held to the tree',
    '',
    renderedFrom('app/src/lib/ops/leadership.ts', 'leadership.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Three documents of 28 September 2026 say what would make Semester the',
    'benchmark rather than another app: a memo of fourteen plays and a test to',
    'apply before anything is built or marketed; the whole-platform business',
    'model, with its promise that everything is *one* thing rather than a bundle;',
    'and the faculty change-management playbook. This page is their structure,',
    'with each item pointed at what the repository holds for it and a standing',
    'read off the tree. **Nothing here says Semester is a whole platform.** The',
    'memo’s own rule is not to say all-in-one without being precise, so the',
    'thirteen *one X* promises are counted one by one, and the count is the finding.',
    '',
    ...table(['Supplied document', 'What it holds'], SOURCES.map((x) => [`[${cell(x.title)}](${link(DOC, x.path)})`, cell(x.what)])),
    '',
    `Standings: ${STANDINGS.map((s) => `**${s}** — ${STANDING_MEANING[s]}`).join('; ')}. Statuses were read at main commit 7476aca on 28 September 2026.`,
    '',
    '## The position',
    '',
    `> ${POSITION}`,
    '',
    'And the enduring benchmark the whole-platform model ends on:',
    '',
    ...ENDURING_BENCHMARK.map((b) => `- ${b}`),
    '',
    '## One X: the promise, item by item',
    '',
    `The business model’s promise is thirteen *ones*. ${counts(ONES)}.`,
    '',
    ...itemTable(ONES),
    '',
    '### The crucial rule: shared services',
    '',
    `> ${SHARED_RULE}`,
    '',
    'Seven services, and how each is held: **mechanical** when a test fails the',
    'build, **review** when a person reads against a rule.',
    '',
    ...table(['Service', 'Held', 'By'], SHARED.map((s) => [`**${s.service}**`, s.held, s.holders.map((h) => `${ref(h.path)} — ${cell(h.shows)}`).join('<br>')])),
    '',
    '### The five layers',
    '',
    'The model’s architecture, with the master-register domains each layer draws on.',
    '',
    ...table(['Layer', 'Holds', 'Master domains'], LAYERS.map((l) => [`**${l.layer}**`, cell(l.holds), l.domains.map((d) => `${d} (${MASTER_DOMAINS[d as keyof typeof MASTER_DOMAINS]})`).join(', ')])),
    '',
    '### The disruption, row by row',
    '',
    'The reality the model says universities live in, the standard Semester sets',
    'against it, and the lowest master row behind the standard.',
    '',
    ...table(['Current university reality', 'Semester standard', 'Master rows (status)', 'Lowest'], DISRUPTION.map((d) => [cell(d.reality), cell(d.standard), withStatus(d.rows), lowest(d.rows)])),
    '',
    '## The fourteen plays',
    '',
    `${counts(PLAYS)}. The seat is who would own the gap; ${heldSeats.length ? `${heldSeats.length} of ${COUNCIL.length} seats are held (${heldSeats.map((c) => `\`${c.seat}\``).join(', ')}), the rest vacant` : 'every seat is vacant'}.`,
    '',
    ...itemTable(PLAYS, (id) => PLAY_OWNER[id]),
    '',
    '### Replace work, not just interfaces (PL-02)',
    '',
    'What each stakeholder should stop doing. No before/after workflow is written yet;',
    'this is the table the workflows would be written against.',
    '',
    ...table(['Stakeholder', 'What Semester should eliminate'], STAKEHOLDERS.map((s) => [`**${s.who}**`, cell(s.eliminate)])),
    '',
    '### The Academic Friction Index (PL-03)',
    '',
    `> ${FRICTION_RULE}`,
    '',
    `Nine questions, ${FRICTION.filter((f) => f.measure).length} with a first-year measure behind them. None has been read for an institution.`,
    '',
    ...table(['Question', 'First-year measure', 'Note'], FRICTION.map((f) => [cell(f.question), f.measure ? `\`${f.measure}\`` : '**none**', cell(f.note)])),
    '',
    '### No Wrong Door (PL-04)',
    '',
    `Eight things a student says, ${STUDENT_SAYS.filter((s) => s.need).length} of which reach a help route today.`,
    '',
    ...table(['The student says', 'Help-route need', 'Where it goes'], STUDENT_SAYS.map((s) => [`“${s.says}”`, s.need ? `\`${s.need}\`` : '**none**', cell(s.route)])),
    '',
    `And the seven things Semester does with it, ${have(BEHAVIOURS)} of them held by a file:`,
    '',
    ...table(['Behaviour', 'Held by', 'Note'], BEHAVIOURS.map((b) => [cell(b.behaviour), or(b.path), cell(b.note)])),
    '',
    '### The Launch System (PL-01)',
    '',
    `The memo’s four windows, each held to the ninety-day programme’s tasks (${ref('docs/90-DAY-LAUNCH-PROGRAM.md')}).`,
    '',
    ...table(['Window', 'Asks', 'Ninety-day tasks'], LAUNCH_SYSTEM.map((w) => [`**${w.window}**`, cell(w.asks), w.tasks.map((t) => `\`${t}\``).join(', ')])),
    '',
    `Eleven deliverables, ${have(DELIVERABLES)} with a file:`,
    '',
    ...table(['Deliverable', 'Where'], DELIVERABLES.map((d) => [cell(d.deliverable), or(d.path)])),
    '',
    '### The Campus AI Control Center (PL-06)',
    '',
    ...table(['Item', 'Master rows (status)', 'Lowest'], AI_CONTROL_CENTER.map((a) => [cell(a.item), withStatus(a.rows), lowest(a.rows)])),
    '',
    '### Knowledge Operations (PL-07)',
    '',
    `Thirteen fields every published resource would carry, ${KNOWLEDGE_FIELDS.filter((f) => f.carried).length} carried by something today; and seven signals to surface, none surfaced.`,
    '',
    ...table(['Field', 'Carried by'], KNOWLEDGE_FIELDS.map((f) => [cell(f.field), f.carried ? cell(f.carried) : '**nothing**'])),
    '',
    ...KNOWLEDGE_SIGNALS.map((s) => `- ${s} — not surfaced`),
    '',
    '### Portability (PL-09)',
    '',
    `Ten promises, ${have(PORTABILITY)} with a file behind them.`,
    '',
    ...table(['Promise', 'Held by', 'Note'], PORTABILITY.map((p) => [cell(p.promise), or(p.path), cell(p.note)])),
    '',
    '### Trust Evidence (PL-10)',
    '',
    `Eleven panels of a customer view; the data exists for ${have(TRUST_EVIDENCE)}, and the trust dashboard renders it under the institution’s control plane; no institution is connected for it to show.`,
    '',
    ...table(['Panel', 'Data today'], TRUST_EVIDENCE.map((t) => [cell(t.panel), or(t.path)])),
    '',
    '### The Semester Standard (PL-11)',
    '',
    `Ten lines, every one carried by a commitment of the public Semester Standard (${ref('app/src/lib/standard.ts')}, printed at /semester-standard/), which is the authoritative version and discloses each gap on the page. An annual scorecard has not been published.`,
    '',
    ...table(['Line', 'Public commitment', 'Held by', 'How'], STANDARD.map((s) => [cell(s.line), s.commitment ? `\`${s.commitment}\`` : '**none**', or(s.path), cell(s.how)])),
    '',
    '### Research assets, design partners, implementation (PL-12 to PL-14)',
    '',
    `The eight public assets, ${have(ASSETS)} with a public page or a document behind them:`,
    '',
    ...table(['Asset', 'Where', 'Note'], ASSETS.map((a) => [cell(a.asset), or(a.path), cell(a.note)])),
    '',
    `The nine kinds of design partner, none recruited: ${PARTNER_TYPES.join('; ')}. The structured influence a partner gets, ${have(INFLUENCE)} of nine held by a file:`,
    '',
    ...table(['Influence', 'Held by'], INFLUENCE.map((i) => [cell(i.item), or(i.path)])),
    '',
    `The twelve implementation elements, ${have(IMPLEMENTATION)} with a file:`,
    '',
    ...table(['Element', 'Held by'], IMPLEMENTATION.map((i) => [cell(i.item), or(i.path)])),
    '',
    '## The business model',
    '',
    'Eleven revenue lines. **Proposed**: a line the deal desk could price, with no',
    'price book yet. **Held**: a decision on main keeps it out for now.',
    '',
    ...table(['Revenue line', 'Buyer', 'What they buy', 'Why it compounds', 'Standing', 'Note'], REVENUE.map((r) => [`**${r.line}**`, cell(r.buyer), cell(r.purchase), cell(r.compounds), r.standing + (r.decisions.length ? ` (${r.decisions.join(', ')})` : ''), cell(r.note)])),
    '',
    '### The lines not crossed',
    '',
    'The model’s six business-model boundaries and the memo’s nine things not to do,',
    `each held to a boundary of ${ref('ops/strategic-boundaries/README.md')}, a rule of`,
    `${ref('docs/DO-NOT-BUILD.md')}, or a decision — or marked *proposed*, which means`,
    'nothing forbids it today and the line is recorded so the rule is a decision',
    'rather than a drift.',
    '',
    ...table(['Line', 'Held as', 'Note'], LINES.map((l) => [cell(l.rule), heldAs(l), cell(l.note)])),
    '',
    '## The twelve-month roadmap',
    '',
    ...table(['Quarter', 'Focus', 'Proof point', 'Master rows (status)', 'Lowest'], ROADMAP.map((r) => [`**${r.quarter}**`, cell(r.focus), cell(r.proof), withStatus(r.rows), lowest(r.rows)])),
    '',
    '## The benchmark test',
    '',
    'Before adding or marketing any feature, the memo asks nine questions, and',
    '`benchmark()` passes only when every answer is yes. What this change built,',
    'scored honestly — a *no* is a finding about the page, not a reason to drop it:',
    '',
    ...BENCHMARK.map((q, i) => `${i + 1}. ${q}`),
    '',
    ...table(['Built here', ...BENCHMARK.map((_, i) => String(i + 1)), 'Passes', 'Note'], BUILT_HERE.map((b) => [cell(b.what), ...b.answers.map((a) => (a ? 'yes' : 'no')), benchmark(b.answers).pass ? 'yes' : 'no', cell(b.note)])),
    '',
    '## The live-business standard, and the scopes',
    '',
    `A full launch is not “all features enabled”; it is every enabled module meeting thirteen requirements. ${have(LIVE_STANDARD)} of thirteen have a place that would carry them.`,
    '',
    ...table(['Requirement of every enabled module', 'Carried by'], LIVE_STANDARD.map((l) => [cell(l.requirement), or(l.path)])),
    '',
    `Modules are enabled at nine scopes; ${have(SCOPES)} exist.`,
    '',
    ...table(['Scope', 'Exists in', 'How'], SCOPES.map((s) => [`**${s.scope}**`, or(s.path), cell(s.how)])),
    '',
    `Five reusable workflows every domain would use, ${have(WORKFLOWS)} with a machine (${ref('docs/architecture/0009-workflow-state-machines.md')}):`,
    '',
    ...table(['Workflow', 'Machine', 'Note'], WORKFLOWS.map((w) => [cell(w.workflow), or(w.path), cell(w.note)])),
    '',
    '## The faculty playbook',
    '',
    `Faculty adoption is won through relevance, control, time savings and credible support. Six phases: ${counts(FACULTY_PHASES)}. The segments to listen to first: ${FACULTY_SEGMENTS.join(', ').toLowerCase()}.`,
    '',
    ...itemTable(FACULTY_PHASES),
    '',
    '### Give faculty control (FP-2)',
    '',
    `Six policy families a course sets. ${have(POLICY_FAMILIES)} have a setting today. Every policy should carry: ${POLICY_CARRIES.join('; ').toLowerCase()}. None carries a version history or a student preview.`,
    '',
    ...table(['Family', 'Options', 'Setting today', 'Note'], POLICY_FAMILIES.map((p) => [`**${p.family}**`, cell(p.options), or(p.path), cell(p.note)])),
    '',
    '### Enable through the work (FP-4)',
    '',
    ...table(['Moment', 'Faculty support', 'Material today'], MOMENTS.map((m) => [`**${m.moment}**`, cell(m.support), or(m.path)])),
    '',
    '### Measure and improve (FP-6)',
    '',
    `Measure faculty value, not logins: ${FACULTY_MEASURES.join('; ').toLowerCase()}. None is defined among the first-year measures.`,
    '',
    '### What faculty are told',
    '',
    ...FACULTY_PROMISES.map((p) => `- ${p}`),
    '',
    'Each is a promise the claims register would have to carry before the site says it; none is on the site.',
    '',
    '## Where the documents conflict with a decision on main',
    '',
    'The decision holds until the owner reopens it (the decision log’s rule).',
    '',
    ...table(['The documents ask', 'Decision on main', 'Held as'], CONFLICTS.map((c) => [cell(c.asks), cell(c.decision), cell(c.heldAs)])),
    '',
    'This page names rows and never changes them; the registers that own the rows say what moves each.',
    '',
  ];
  return out.join('\n');
}
