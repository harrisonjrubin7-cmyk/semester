import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RETIRED } from '../content/terms';
import { DEFAULT_SITE } from '../site/config';
import { ROUTES, renderPage } from '../site/render';
import { DESTINATIONS } from './nav';
import { STATUS_LABEL } from './ops/claims';
import {
  ACTION_CENTER, ALL, APP_ADDITIONS, AREAS, COMPANY, COMPARISON, CONSOLE_ADDITIONS, CONTEXT, CONTEXT_EXAMPLE, CONTEXT_FOLLOWS, DESIGN_SURFACES, DESTINATIONS_FLAG, DESTINATIONS_MAP,
  DETAIL, EVENTS, EVENT_RULE, EXPAND, FINAL_STANDARD, FINAL_TEST, HEADLINE, HOME_ROLES, INSTITUTION_CONSOLE, INTELLIGENCE, JOURNEYS, JOURNEY_RULE, MESSAGES, OBJECT_EXAMPLE,
  PALETTE_COMMANDS, PALETTE_RULE, POINT_SOLUTIONS, PRINCIPLES, SEARCH_ASKS, SEARCH_UNIFIES, SECONDARY, SHARED_OBJECTS, SHELL, SITE_ADDITIONS, SOURCES, STATEMENT, STATUSES,
  STATUS_MEANING, STATUS_WORD, TOP_TEN, VOCABULARY, counts, row, weakest, weakestRow, type Status,
} from './oneos';
import { FIVE_DESTINATIONS, FIVE_LABELS } from './tabbar';

/**
 * Holds the one-operating-system page to the tree: the five destinations to
 * `FIVE_LABELS`, every shared object and every vocabulary word to the module
 * that carries it, every retired word to `RETIRED`, every palette command to
 * a destination the app registers, every site page to a route, every area
 * and comparison to rows that exist, every row's status to the kind of file
 * it cites, and the supplied PDFs to never being evidence.
 *
 * `docs/ONE-OPERATING-SYSTEM.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/ONE-OPERATING-SYSTEM.md';

const isDoc = (p: string) => /\.(md|pdf|json|yml)$/.test(p) && !/\.github\/workflows\//.test(p);
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const page = (path: string) => {
  const r = ROUTES.find((x) => x.path === path);
  if (!r) throw new Error(`no route ${path}`);
  return renderPage(r, DEFAULT_SITE);
};

describe('one operating system', () => {
  it('keeps the two supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(2);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const h of ALL) for (const e of h.evidence) expect(supplied.has(e.path), `${h.id} cites a supplied PDF`).toBe(false);
    expect(HEADLINE).toBe('One Operating System for University Life.');
    expect(STATEMENT).toMatch(/^Semester is the unified operating system/);
    // Semester runs none of these; naming one as a part of the platform claims to replace it (D-134).
    expect(STATEMENT, 'the statement names a system of record Semester does not run').not.toMatch(/\b(payments?|billing|financial aid|housing|health records|registration execution)\b/i);
    expect(MESSAGES.map((m) => m.audience)).toEqual(['Supporting paragraph', 'Student-facing', 'Institution-facing']);
    expect(MESSAGES[0].text, 'the supporting paragraph says designed as, not is').toMatch(/designed as one connected/);
    expect(POINT_SOLUTIONS).toHaveLength(9);
  });

  it('holds the five destinations to FIVE_LABELS, name for name and screen for screen', () => {
    expect(DESTINATIONS_MAP.map((d) => d.screen)).toEqual(FIVE_DESTINATIONS);
    for (const d of DESTINATIONS_MAP) expect(FIVE_LABELS[d.screen], d.label).toBe(d.label);
    expect(DESTINATIONS_FLAG).toBe('journeyNavigation');
    expect(read('app/src/lib/tabbar.ts')).toMatch(/Behind `journeyNavigation`/);
  });

  it('holds every shared object, secondary action and vocabulary word to the module that carries it', () => {
    expect(SHARED_OBJECTS).toHaveLength(11);
    for (const o of SHARED_OBJECTS) if (o.carriedBy) expect(existsSync(join(root, o.carriedBy)), `${o.object} → ${o.carriedBy}`).toBe(true);
    expect(SHARED_OBJECTS.filter((o) => !o.carriedBy).map((o) => o.object)).toEqual(['Goal']);
    expect(OBJECT_EXAMPLE).toMatch(/BIO 201/);
    expect(SECONDARY).toHaveLength(6);
    for (const s of SECONDARY) expect(existsSync(join(root, s.carriedBy)), `${s.action} → ${s.carriedBy}`).toBe(true);
    expect(VOCABULARY).toHaveLength(9);
    const retired = new Set(RETIRED.map((r) => r.id));
    for (const w of VOCABULARY) {
      expect(w.avoid.length, w.use).toBeGreaterThan(2);
      for (const r of w.retired) expect(retired.has(r), `${w.use}: ${r} is not a retired word`).toBe(true);
      if (w.carriedBy) expect(existsSync(join(root, w.carriedBy)), `${w.use} → ${w.carriedBy}`).toBe(true);
    }
    expect(VOCABULARY.flatMap((w) => w.retired).sort()).toEqual(['roadmap', 'task', 'task', 'to-do', 'unverified']);
  });

  it('holds every palette command to a destination the app registers, and keeps the no-verbs decision', () => {
    expect(PALETTE_COMMANDS).toHaveLength(13);
    const screens = new Set([...DESTINATIONS.map((d) => d.screen), ...FIVE_DESTINATIONS]);
    for (const c of PALETTE_COMMANDS) if (c.carriedBy) expect(screens.has(c.carriedBy), `${c.command} → ${c.carriedBy}`).toBe(true);
    expect(PALETTE_COMMANDS.filter((c) => !c.carriedBy).map((c) => c.command)).toEqual(['Prepare for advising', 'Find scholarships']);
    expect(read('app/src/components/Command.tsx')).toMatch(/## No commands/);
    expect(PALETTE_RULE).toMatch(/one wrong Enter is unrecoverable/);
  });

  it('holds the context example and where the course follows', () => {
    expect(CONTEXT_EXAMPLE).toBe('Fall 2026  /  Biology B.S.  /  BIO 201  /  Week 6');
    expect(CONTEXT_FOLLOWS).toHaveLength(5);
    const screens = new Set(DESTINATIONS.map((d) => d.screen));
    for (const f of CONTEXT_FOLLOWS) expect(screens.has(f.screen), `${f.where} → ${f.screen}`).toBe(true);
    expect(read('app/src/components/unity/ContextBar.tsx')).not.toMatch(/Week \d/);
  });

  it('holds every site page to a route, and the two new pages print the positioning and the register’s word', () => {
    expect(SITE_ADDITIONS).toHaveLength(7);
    const routes = new Set(ROUTES.map((r) => r.path));
    for (const p of SITE_ADDITIONS) if (p.route) expect(routes.has(p.route), `${p.id} → ${p.route}`).toBe(true);
    expect(SITE_ADDITIONS.filter((p) => !p.route).map((p) => p.id)).toEqual(['trust-center']);
    // The word beside each area and each row is the computed one, in that
    // area's own summary and that row's own cell — not merely somewhere on the
    // page, which a hand-written word would also satisfy.
    const badge = (s: Status) => `<span data-oneos="${s}" class="site-badge site-oneos site-oneos-${s}">${escape(STATUS_WORD[s])}</span>`;
    const arch = page('/platform/one-operating-system/');
    expect(arch).toContain(HEADLINE);
    for (const a of AREAS) {
      const s = weakest(a.rests);
      expect(arch, a.name).toContain(`<span class="site-area-name">${escape(a.name)}</span> ${badge(s)}</summary>`);
      expect(arch, a.name).toContain(`<dd>${badge(s)} — the weakest of ${a.rests.length} rows`);
      // The gap of every row it rests on is on the page, beside that row's own word.
      for (const id of a.rests) expect(arch, `${a.name} rests on ${id}`).toContain(`<li>${badge(row(id).status)} ${escape(row(id).what)}. <span class="site-small">${escape(row(id).gap)}</span></li>`);
    }
    const rests = AREAS.flatMap((a) => a.rests.map(row));
    for (const s of STATUSES) expect(arch.split(badge(s)).length - 1, s).toBe(AREAS.filter((a) => weakest(a.rests) === s).length * 2 + rests.filter((r) => r.status === s).length + PRINCIPLES.filter((p) => p.status === s).length + FINAL_TEST.filter((t) => t.status === s).length + 1);
    expect(arch).not.toMatch(/fully built/i);
    const why = page('/platform/why-not-another-tool/');
    for (const c of COMPARISON) {
      const w = weakestRow(c.rests);
      expect(why, c.id).toContain(`<th scope="row">${escape(c.traditional)}</th><td>${escape(c.semester)}</td><td>${badge(w.status)}</td><td>${escape(w.gap)}</td>`);
    }
    // These four words are this register's. Neither page prints one of the
    // claims register's six, so a buyer cannot read one vocabulary as the other,
    // and every badge on the site carries data-oneos so nothing hand-written hides among them.
    for (const label of Object.values(STATUS_LABEL)) {
      expect(arch, label).not.toContain(label);
      expect(why, label).not.toContain(label);
    }
    for (const r of ROUTES) {
      const html = renderPage(r, DEFAULT_SITE);
      const badges = html.match(/<span data-oneos="([a-z-]+)" class="site-badge site-oneos site-oneos-\1">([^<]*)<\/span>/g) ?? [];
      expect(html.split('site-oneos-').length - 1, `${r.path}: every oneos badge is the component's`).toBe(badges.length);
      if (!['/platform/one-operating-system/', '/platform/why-not-another-tool/'].includes(r.path)) expect(badges, r.path).toEqual([]);
      for (const b of badges) {
        const [, s, word] = b.match(/data-oneos="([a-z-]+)"[^>]*>([^<]*)</)!;
        expect(STATUS_WORD[s as Status], `${r.path}: ${b}`).toBe(word);
      }
    }
    for (const w of Object.values(STATUS_WORD)) expect(why).toContain(w);
    expect(why).not.toMatch(/fully built/i);
  });

  it('rests every area and comparison on rows that exist, and rates each at its weakest row', () => {
    expect(AREAS).toHaveLength(9);
    expect(AREAS.map((a) => a.name)).toEqual(['Academic Path', 'Courses and Learning', 'Schedule and Planning', 'Advising and Support', 'Campus Life', 'Career and Portfolio', 'Money and Important Dates', 'Community and Opportunities', 'Institution Operations']);
    expect(COMPARISON).toHaveLength(8);
    const ids = new Set(ALL.map((h) => h.id));
    for (const a of AREAS) {
      expect(a.rests.length, a.name).toBeGreaterThan(1);
      for (const r of a.rests) expect(ids.has(r), `${a.name} rests on ${r}`).toBe(true);
      expect(a.backTo.length, a.name).toBeGreaterThan(0);
    }
    for (const c of COMPARISON) for (const r of c.rests) expect(ids.has(r), `${c.id} rests on ${r}`).toBe(true);
    expect(weakest(['test-what', 'test-changes'])).toBe('not-started');
    expect(weakest(['test-what', 'test-connects'])).toBe('building');
    expect(weakest(['test-what', 'test-source'])).toBe('tested');
    expect(weakestRow(['test-what', 'test-changes']).id).toBe('test-changes');
    expect(() => weakest(['no-such-row'])).toThrow(/No row/);
    expect(() => weakestRow([])).toThrow(/No rows/);
    expect(row('home').id).toBe('home');
    expect(TOP_TEN).toHaveLength(10);
    for (const id of TOP_TEN) expect(ids.has(id), `top ten names ${id}`).toBe(true);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-one-os-evidence.md'))).toBe(false);
  });

  it('has the sections whole, ids once', () => {
    expect(PRINCIPLES).toHaveLength(5);
    expect(ACTION_CENTER).toHaveLength(8);
    expect(SEARCH_ASKS).toHaveLength(10);
    expect(SEARCH_UNIFIES).toHaveLength(7);
    expect(INTELLIGENCE).toHaveLength(8);
    expect(SHELL).toHaveLength(8);
    expect(CONTEXT).toHaveLength(2);
    expect(DETAIL).toHaveLength(8);
    expect(JOURNEYS).toHaveLength(5);
    for (const j of JOURNEYS) expect(j.steps.length, j.id).toBeGreaterThan(5);
    expect(JOURNEY_RULE).toMatch(/official handoff/);
    expect(EVENTS).toHaveLength(9);
    for (const e of EVENTS) expect(e.updates.length, e.id).toBeGreaterThan(3);
    expect(EVENT_RULE).toMatch(/source precedence/);
    expect(DESIGN_SURFACES).toHaveLength(9);
    expect(HOME_ROLES).toHaveLength(6);
    expect(EXPAND).toHaveLength(3);
    expect(INSTITUTION_CONSOLE).toHaveLength(12);
    expect(FINAL_TEST).toHaveLength(8);
    expect(APP_ADDITIONS).toHaveLength(8);
    expect(CONSOLE_ADDITIONS).toHaveLength(7);
    expect(COMPANY).toHaveLength(37);
    expect(new Set(COMPANY.map((c) => c.group)).size).toBe(4);
    expect(FINAL_STANDARD).toMatch(/isolated screen/);
    expect(Object.keys(STATUS_WORD).sort()).toEqual([...STATUSES].sort());
    expect(Object.keys(STATUS_MEANING).sort()).toEqual([...STATUSES].sort());
    const ids = ALL.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    const c = counts();
    expect(c.tested + c.building + c.designed + c['not-started']).toBe(ALL.length);
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

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function table(rows: readonly (typeof ALL)[number][], label = 'What'): string[] {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const out = [`| ID | ${label} | Status | Evidence | Gap |`, '| --- | --- | --- | --- | --- |'];
  for (const r of rows) out.push(`| ${r.id} | ${cell(r.what)} | ${r.status} | ${r.evidence.map((e) => `\`${e.path}\`: ${cell(e.shows)}`).join('<br>')} | ${cell(r.gap)} |`);
  out.push(`| **total** | | ${STATUSES.map((s) => `${s} ${count(s)}`).join(', ')} | | |`, '');
  return out;
}

function render(): string {
  const c = counts();
  const out: string[] = [
    '# One operating system',
    '',
    '<!-- Rendered from app/src/lib/oneos.ts by oneos.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'What the two briefs of 29 September 2026 say makes Semester different —',
    'everything from the start, one central school operating system, every',
    'capability feeling like one system rather than a collection of screens —',
    'held to what the tree already has for each: the positioning, the five',
    'principles, the shared objects, the Action Center, search, the intelligence',
    'layer, the shell, the context bar, the detail panel, five journeys, the event',
    'layer, the design system, the vocabulary, the role homes, the command',
    'palette, the graph, the timeline, the workspace, the institution console and',
    'the final test; then what else to add to the app, the site and the console,',
    'the company behind them, and the ten that matter most. The earlier',
    '[one-system grammar](ONE-SYSTEM-PLATFORM-GRAMMAR.md) holds the object',
    'envelope, the trust pattern, the action model and the release gates; this',
    'page does not repeat them.',
    '',
    `**The briefs’ claim is that Semester has everything from the start and is fully built. The tree does not say that, and this page does not say it for the tree.** Most of what the briefs name exists as a part — a component, a module, a table — and the join is what is missing. Of ${ALL.length} rows, ${c.tested} are held by a test, ${c.building} are being built, ${c.designed} are designed and ${c['not-started']} are not started. The two public pages print the positioning as the briefs wrote it and, under it, this register’s word for every area, so the site cannot say “fully built” where the tree says “building”.`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    'A status is a claim about the best piece of a row: `tested` cites a test that',
    'runs on every change, `building` code, `designed` a document, `not-started` at',
    'most a document naming the gap. The supplied PDFs are never evidence.',
    '',
    '## The positioning',
    '',
    `**${HEADLINE}**`,
    '',
    STATEMENT,
    '',
    ...MESSAGES.flatMap((m) => [`*${m.audience}.* ${m.text}`, '']),
    'Most edtech products solve one isolated problem:',
    '',
    ...POINT_SOLUTIONS.map((p) => `- ${p}`),
    '',
    'Semester is designed as the system that connects those moments. Whether it does, area by area, is the rest of this page.',
    '',
    '## The five destinations',
    '',
    `Held to \`FIVE_LABELS\` in \`lib/tabbar.ts\`, behind \`${DESTINATIONS_FLAG}\` (D-003), off in a normal build. Everything else opens within these as a contextual mode, not as a twenty-first tab.`,
    '',
    '| Destination | Screen | Holds |',
    '| --- | --- | --- |',
    ...DESTINATIONS_MAP.map((d) => `| ${d.label} | \`${d.screen}\` | ${cell(d.note)} |`),
    '',
    '## The five one-system principles',
    '',
    ...table(PRINCIPLES, 'Principle'),
    '## The shared objects',
    '',
    `Every part of Semester should use the same core objects. Each at the module that carries it, or none. ${OBJECT_EXAMPLE}`,
    '',
    '| Object | Used across | Carried by | Note |',
    '| --- | --- | --- | --- |',
    ...SHARED_OBJECTS.map((o) => `| ${o.object} | ${cell(o.usedAcross)} | ${o.carriedBy ? `\`${o.carriedBy}\`` : '—'} | ${cell(o.note)} |`),
    '',
    '## One Action Center',
    '',
    'The heartbeat: every module may create an action; the student sees one prioritized, explainable list.',
    '',
    ...table(ACTION_CENTER, 'Shows'),
    '## One global search',
    '',
    'A student should be able to type:',
    '',
    ...SEARCH_ASKS.map((q) => `- “${q}”`),
    '',
    'The result is an answer with its source, its context and an action, not a link. What it unifies, at what the tree has:',
    '',
    ...table(SEARCH_UNIFIES, 'Unifies'),
    '## One intelligence layer',
    '',
    'Not a separate AI app: the assistant understands the current context, course, term, plan, sources, accessibility preferences, goals and permissions, and it explains, generates and prepares rather than operating invisibly or making official decisions.',
    '',
    ...table(INTELLIGENCE, 'In context'),
    '## The shell',
    '',
    'Every authenticated screen on the same foundation.',
    '',
    ...table(SHELL, 'Element'),
    '## The context bar',
    '',
    `The current context, shown the same way at the top of relevant screens: \`${CONTEXT_EXAMPLE}\`. A student changes it without losing their place, and the system updates what depends on it.`,
    '',
    ...table(CONTEXT),
    'Where BIO 201 follows the student, in the briefs’ example, and the screen that carries each:',
    '',
    '| Where | Shows | Screen |',
    '| --- | --- | --- |',
    ...CONTEXT_FOLLOWS.map((f) => `| ${f.where} | ${cell(f.shows)} | \`${f.screen}\` |`),
    '',
    '## The detail panel',
    '',
    'When a student opens any important item — course, action, deadline, person, scholarship, event, requirement, assignment or service — the same pattern opens.',
    '',
    ...table(DETAIL, 'Element'),
    'The secondary actions, each at the one place it exists today:',
    '',
    '| Action | Carried by | Note |',
    '| --- | --- | --- |',
    ...SECONDARY.map((s) => `| ${s.action} | \`${s.carriedBy}\` | ${cell(s.note)} |`),
    '',
    '## Connected journeys',
    '',
    `${JOURNEY_RULE} Each journey’s steps as the briefs wrote them, and the whole at what the tree has.`,
    '',
    ...JOURNEYS.flatMap((j) => [`**${j.what}.** ${j.steps.join(' → ')}`, '']),
    ...table(JOURNEYS, 'Journey'),
    '## The event layer',
    '',
    `${EVENT_RULE} Each event and what it should update, at what the tree has.`,
    '',
    '| Event | Updates |',
    '| --- | --- |',
    ...EVENTS.map((e) => `| ${cell(e.what)} | ${e.updates.join(', ')} |`),
    '',
    ...table(EVENTS, 'Event'),
    '## One design system, every surface',
    '',
    'Dark, refined, premium, connected, architectural and intentional — inside the application, not only on the marketing assets. One documented system used by:',
    '',
    ...table(DESIGN_SURFACES, 'Surface'),
    '## Consistent language',
    '',
    'Decided once and reused everywhere. Each word at the module that carries it; each avoided word that the retired-word rule (`content/terms.ts`) already refuses, named.',
    '',
    '| Use this | Avoid this | Retired by the rule | Carried by | Note |',
    '| --- | --- | --- | --- | --- |',
    ...VOCABULARY.map((w) => `| ${w.use} | ${w.avoid.join(', ')} | ${w.retired.length ? w.retired.map((r) => `\`${r}\``).join(', ') : '—'} | ${w.carriedBy ? `\`${w.carriedBy}\`` : '—'} | ${cell(w.note)} |`),
    '',
    '## Semester Home, by role',
    '',
    'One Today, adaptive by role: different views, one shell, one design system, one permissions model.',
    '',
    ...table(HOME_ROLES, 'Role'),
    '## The command palette',
    '',
    `${PALETTE_RULE}`,
    '',
    '| Command | Destination | Note |',
    '| --- | --- | --- |',
    ...PALETTE_COMMANDS.map((p) => `| ${p.command} | ${p.carriedBy ? `\`${p.carriedBy}\`` : '—'} | ${cell(p.note)} |`),
    '',
    '## The graph, the timeline and the workspace',
    '',
    ...table(EXPAND),
    '## The institution console',
    '',
    'Not a pile of settings pages: the governance layer for the whole ecosystem, governing the same platform students use.',
    '',
    ...table(INSTITUTION_CONSOLE, 'Governs'),
    '## The final test',
    '',
    'Semester feels like one system when a student can begin anywhere — an assignment, a deadline, a course, a campus resource, an advising appointment, a financial reminder, a career opportunity — and immediately see:',
    '',
    ...table(FINAL_TEST, 'Question'),
    '## Add to the app',
    '',
    ...table(APP_ADDITIONS, 'Addition'),
    '## Add to the company site',
    '',
    'Each page at its route in `site/render.tsx`, or none.',
    '',
    '| ID | Route |',
    '| --- | --- |',
    ...SITE_ADDITIONS.map((p) => `| ${p.id} | ${p.route ? `\`${p.route}\`` : '—'} |`),
    '',
    ...table(SITE_ADDITIONS, 'Page'),
    '## Add to the institution console',
    '',
    ...table(CONSOLE_ADDITIONS, 'Feature'),
    '## The company behind it',
    '',
    ...(['Commercial readiness', 'Support readiness', 'Security readiness', 'Company credibility'] as const).flatMap((g) => [`### ${g}`, '', ...table(COMPANY.filter((c) => c.group === g))]),
    '## The nine areas the architecture page draws',
    '',
    '`/platform/one-operating-system/` puts the student at the centre and these nine areas around them. Each area’s word is the weakest of the rows it rests on.',
    '',
    '| Area | Rests on | Word |',
    '| --- | --- | --- |',
    ...AREAS.map((a) => `| ${a.name} | ${a.rests.join(', ')} | ${STATUS_WORD[weakest(a.rests)]} |`),
    '',
    '## Why not another tool',
    '',
    '`/platform/why-not-another-tool/` prints the briefs’ comparison with the same word beside each row.',
    '',
    '| Traditional approach | Semester approach | Rests on | Word |',
    '| --- | --- | --- | --- |',
    ...COMPARISON.map((r) => `| ${r.traditional} | ${r.semester} | ${r.rests.join(', ')} | ${STATUS_WORD[weakest(r.rests)]} |`),
    '',
    '## The ten highest-impact additions',
    '',
    ...TOP_TEN.map((id, i) => {
      const row = ALL.find((h) => h.id === id)!;
      return `${i + 1}. **${id}** — ${cell(row.what)} (${row.status})`;
    }),
    '',
    '## The final standard',
    '',
    FINAL_STANDARD,
    '',
  ];
  return out.join('\n');
}
