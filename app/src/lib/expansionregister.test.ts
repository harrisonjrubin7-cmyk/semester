import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFERRED, FRAMEWORKS, GATE, PHASES, TIERS, DIMENSIONS, type Phase, type Tier } from './expansiongovernance';
import { AREAS, ITEMS, NEXT_ACTIONS, PHASE_EXITS, STATUSES, areaOf } from './expansionregister';
import { REGISTER } from './masterregister';

/**
 * Holds the strategic expansion register to the same rule as the master
 * register: every cited file exists, and each status cites the kind of file it
 * claims — `designed` a document, `building` code, `tested` a test.
 *
 * `docs/STRATEGIC-EXPANSION-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/STRATEGIC-EXPANSION-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the strategic expansion register', () => {
  it('has the twenty areas of the plans, each with items', () => {
    expect(AREAS).toHaveLength(20);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(20);
    for (const a of AREAS) {
      expect(ITEMS.filter((i) => areaOf(i.id) === a).length, a.id).toBeGreaterThan(4);
      expect(Object.keys(TIERS).map(Number)).toContain(a.tier);
      expect(Object.keys(PHASES).map(Number)).toContain(a.phase);
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  it('names only master-register rows that exist', () => {
    const ids = new Set(REGISTER.map((r) => r.id));
    for (const a of AREAS) for (const id of a.master) expect(ids.has(id), `${a.id} names ${id}`).toBe(true);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-expansion-evidence.md'))).toBe(false);
  });

  it('cites only files that exist', () => {
    for (const i of ITEMS) for (const e of i.evidence) expect(existsSync(join(root, e.path)), `${i.id} cites ${e.path}`).toBe(true);
    for (const f of FRAMEWORKS) for (const p of f.evidence) expect(existsSync(join(root, p)), `${f.name} → ${p}`).toBe(true);
  });

  it('holds each status to the kind of file it claims', () => {
    for (const i of ITEMS) {
      const paths = i.evidence.map((e) => e.path);
      expect(STATUSES, i.id).toContain(i.status);
      if (i.status === 'designed') expect(paths.some(isDoc), `${i.id} is designed and cites no document`).toBe(true);
      if (i.status === 'building') expect(paths.some(isCode), `${i.id} is building and cites no code`).toBe(true);
      if (i.status === 'tested') expect(paths.some(isTest), `${i.id} is tested and cites no test`).toBe(true);
    }
  });

  it('says what is missing for every item, since nothing here is evidenced', () => {
    for (const i of ITEMS) expect(i.gap.trim().length, i.id).toBeGreaterThanOrEqual(5);
  });

  it('maps every phase, and every exit points at an area or a register', () => {
    for (const p of Object.keys(PHASES).map(Number) as Phase[]) expect(PHASE_EXITS.some((x) => x.phase === p), `phase ${p}`).toBe(true);
    const areas = new Set(AREAS.map((a) => a.id));
    for (const x of PHASE_EXITS) {
      const named = x.tracked.split(/,\s*/).filter((t) => /^[A-Z]{3}$/.test(t));
      for (const id of named) expect(areas.has(id), `${x.capability} → ${id}`).toBe(true);
    }
  });

  it('agrees with the plan on where the wallet goes', () => {
    const crd = AREAS.find((a) => a.id === 'CRD')!;
    expect(crd.tier).toBe(2);
    expect(crd.phase).toBe(3);
  });

  it('is what docs/STRATEGIC-EXPANSION-REGISTER.md says', () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const count = (s: string, rows = ITEMS) => rows.filter((i) => i.status === s).length;
  const out: string[] = [
    '# Strategic Expansion Register',
    '',
    '<!-- Rendered from app/src/lib/expansionregister.ts and expansiongovernance.ts by expansionregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'The long-horizon capabilities that make Semester durable for a decade, not',
    'merely launchable: supply chain, credentials, research, continuity,',
    'architecture, the learner profile, data quality, content and service',
    'operations, analytics, releases, ethics, workforce, knowledge,',
    'interoperability, benchmark, evidence and councils. What must be true **at',
    'launch** is the [master register](MASTER-LAUNCH-READINESS-REGISTER.md); each',
    'area here names the master rows it overlaps rather than restating them.',
    '',
    '**The largest remaining value is in deepening quality, evidence, standards,',
    'continuity and trust around the product — not in adding modules.** So this',
    'register is mostly governance, and most of it is not started.',
    '',
    'Statuses were assessed against `origin/main` at `e89e2ce`; a test holds each',
    'to the kind of file it cites. Nothing is above `tested`, because nothing has',
    'an artifact under `docs/evidence/`.',
    '',
    '## Where it stands',
    '',
    `| Area | Tier | Phase | Items | ${STATUSES.join(' | ')} |`,
    `| --- | ---: | ---: | ---: | ${STATUSES.map(() => '---:').join(' | ')} |`,
  ];
  for (const a of AREAS) {
    const rows = ITEMS.filter((i) => areaOf(i.id) === a);
    out.push(`| [${a.id}](#${a.id.toLowerCase()}) ${a.title} | ${a.tier} | ${a.phase} | ${rows.length} | ${STATUSES.map((s) => count(s, rows)).join(' | ')} |`);
  }
  out.push(`| **total** | | | **${ITEMS.length}** | ${STATUSES.map((s) => `**${count(s)}**`).join(' | ')} |`, '');

  out.push('## Tiers', '', '| Tier | Meaning | Areas |', '| ---: | --- | --- |');
  for (const t of Object.keys(TIERS).map(Number) as Tier[])
    out.push(`| ${t} | ${TIERS[t]} | ${AREAS.filter((a) => a.tier === t).map((a) => a.id).join(', ') || '—'} |`);
  out.push('', 'Tier 4 is the deferred list below: only with strict governance and demonstrated need.', '');

  out.push('## Phases and their exits', '');
  for (const p of Object.keys(PHASES).map(Number) as Phase[]) {
    out.push(`### Phase ${p} — ${PHASES[p].name}`, '', PHASES[p].objective, '', '| Capability | Owner | Exit evidence | Tracked in |', '| --- | --- | --- | --- |');
    for (const x of PHASE_EXITS.filter((e) => e.phase === p)) out.push(`| ${cell(x.capability)} | ${cell(x.owner)} | ${cell(x.exit)} | ${cell(x.tracked)} |`);
    out.push('');
  }

  out.push('## The register', '');
  for (const a of AREAS) {
    out.push(`### ${a.id}`, '', `**${a.title}.** ${a.why} Tier ${a.tier}, phase ${a.phase}.${a.master.length ? ` Overlaps master rows ${a.master.map((m) => `\`${m}\``).join(', ')}.` : ''}`, '');
    out.push('| ID | Item | Status | Evidence | Gap |', '| --- | --- | --- | --- | --- |');
    for (const i of ITEMS.filter((x) => areaOf(x.id) === a)) {
      const ev = i.evidence.length ? i.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>') : '—';
      out.push(`| ${i.id} | ${cell(i.item)} | ${i.status} | ${ev} | ${cell(i.gap)} |`);
    }
    out.push('');
  }

  out.push(
    '## How a capability is ranked',
    '',
    'Each dimension is scored 1–5. A decision aid for the quarterly review, never a',
    'replacement for it; `priority()` in `expansiongovernance.ts` refuses an',
    'incomplete card rather than guessing.',
    '',
    '| Dimension | Weight | Question |',
    '| --- | ---: | --- |',
    ...Object.entries(DIMENSIONS).map(([d, v]) => `| ${d} | ${v.weight > 0 ? '+' : '−'}${Math.abs(v.weight)} | ${cell(v.question)} |`),
    '',
    'It ranks capabilities against each other. What *kind* of build one gets —',
    'core, module, pilot, partner or decline — is still the governance scorecard in',
    '[`operating-model/PORTFOLIO-GOVERNANCE.md`](operating-model/PORTFOLIO-GOVERNANCE.md).',
    '',
    '## The admission gate',
    '',
    'Before a long-horizon capability enters active delivery, `admit()` needs a',
    'written answer to each of these, a scorecard route of core, module or pilot,',
    'and — for Tier 4 or anything on the deferred list — a recorded governance review.',
    '',
    ...GATE.map((g) => `- [ ] ${g.ask}`),
    '',
    'If the answer is yes, it strengthens Semester. If not, it is scope that should wait.',
    '',
    '## What not to expand into early',
    '',
    'Semester is stronger if it becomes the platform students and institutions',
    'trust precisely because it refuses to cross these lines casually.',
    '',
    '| Capability | Why it waits |',
    '| --- | --- |',
    ...DEFERRED.map((d) => `| ${d.what} | ${cell(d.why)} |`),
    '',
    'Several are already refused in code — `governance/ai-lifecycle.ts` refuses',
    'health, disciplinary and financial-aid decisions; `institution-ops.ts` forbids',
    'risk and wellbeing scores and attention, location and reading-time measures;',
    '`server/institution/money.ts` never takes a card number. Three are close to',
    'things the app has, and are named so the line stays visible: the Community',
    'feed (finite, own communities only) is not a public social feed; class chat',
    'rooms with after-the-fact moderation are not unmoderated messaging; and',
    '`control-plane.ts` support signals (missed items and inactivity, shown to a',
    'supporter only with consent) are not behavioural risk scoring.',
    '',
    '## Frameworks',
    '',
    'A planning tool, not a certification claim.',
    '',
    '| Framework | Use | Adopt | Where it stands |',
    '| --- | --- | --- | --- |',
    ...FRAMEWORKS.map((f) => `| ${f.name} | ${cell(f.use)} | ${f.adopt} | ${cell(f.note)}${f.evidence.length ? ` (${f.evidence.map((p) => `\`${p}\``).join(', ')})` : ''} |`),
    '',
    '## Immediate next actions',
    '',
    '| Action | State | Where |',
    '| --- | --- | --- |',
    ...NEXT_ACTIONS.map((n) => `| ${cell(n.action)} | ${n.state} | ${cell(n.where)} |`),
    '',
  );
  return out.join('\n');
}
