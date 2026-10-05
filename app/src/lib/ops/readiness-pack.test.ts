import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROLS as MATURITY } from '../governance/maturity';
import { COUNCIL, CURRENT, GATES, SEATS } from '../launchreadiness';
import { REGISTER } from '../masterregister';
import { MASTER_LEVEL, MATURITY_LEVEL, REGISTER_LEVEL, registerOf, score, type Level } from '../trust/compliance-crosswalk';
import {
  CADENCES, DECISION_DOMAINS, DEPENDENCIES, DRI_RULES, FINAL_STANDARD, GATE, INITIATIVES, PACKET, PILLARS, PLAN_FIELDS, RULE, RUNBOOKS, RUNBOOK_STEPS, SIGNOFFS,
  SOURCES, VERDICT_MEANING, WORKSTREAMS, allPaths, allRests, areaLevel, verdict,
  type Priority, type Required,
} from './readiness-pack';
import { cell, controlLine, link, renderedFrom, table } from './render';

/**
 * Holds the operational readiness pack to the tree: every seat is a council
 * seat, every register row and launch gate it rests on exists, every path
 * exists, a dependency's status is what the tree can show, no runbook claims
 * a tested date, and the launch verdict is computed from the gates' levels —
 * NO-GO today, and the test says so rather than letting the page decide.
 *
 * `docs/OPERATIONAL-READINESS-PACK.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/OPERATIONAL-READINESS-PACK.md';
const HECVAT = 'docs/market-readiness/HECVAT_READINESS.md';
const FERPA = 'docs/FERPA-COPPA-1EDTECH-READINESS.md';
const EVIDENCE_DIR = 'docs/evidence';

const GATE_LEVEL: Record<string, Level> = { unmet: 0, partial: 1, met: 2 };

function registerLevels(path: string): Map<string, Level> {
  const out = new Map<string, Level>();
  for (const line of read(path).split('\n')) {
    if (!/^\| [A-Z0-9]+-\d+ \|/.test(line)) continue;
    const [id, , , status] = line.split('|').slice(1, -1).map((c) => c.trim());
    out.set(id, REGISTER_LEVEL[status.replace(/`/g, '')]);
  }
  return out;
}

/** Every row of the four registers and every launch gate (as `gate:<id>`), on the 0–4 scale. */
function levels(): Map<string, Level> {
  const out = new Map<string, Level>();
  for (const r of REGISTER) out.set(r.id, MASTER_LEVEL[r.status]);
  for (const [id, l] of registerLevels(HECVAT)) out.set(id, l);
  for (const [id, l] of registerLevels(FERPA)) out.set(id, l);
  for (const c of MATURITY) out.set(c.id, MATURITY_LEVEL[c.status]);
  for (const g of GATES) out.set(`gate:${g.id}`, GATE_LEVEL[g.status]);
  return out;
}

const ceiling = (): Level => (existsSync(join(root, EVIDENCE_DIR)) ? 4 : 2);

describe('the operational readiness pack', () => {
  const all = levels();
  const level = (id: string): Level => {
    const l = all.get(id);
    if (l === undefined) throw new Error(`no row ${id}`);
    return l;
  };

  it('keeps the two supplied documents where it says, and never cites them', () => {
    expect(SOURCES).toHaveLength(2);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const p of allPaths()) expect(supplied.has(p), `${p} is a supplied PDF`).toBe(false);
    expect(RULE).toMatch(/not operational because it is deployed/);
  });

  it('gives every workstream, decision domain and sign-off a council seat, and reads who holds each from the council', () => {
    expect(WORKSTREAMS).toHaveLength(5);
    expect(DECISION_DOMAINS).toHaveLength(9);
    expect(SIGNOFFS).toHaveLength(10);
    const seats = [...WORKSTREAMS.map((w) => w.seat), ...DECISION_DOMAINS.flatMap((d) => [d.accountable, ...d.reviewers]), ...DEPENDENCIES.map((d) => d.owner), ...SIGNOFFS.map((s) => s.seat)];
    for (const s of seats) expect(SEATS).toContain(s);
    for (const c of COUNCIL) if (c.holder !== null) expect(c.holder, `${c.seat}: a holder is a role label, never an address`).not.toMatch(/@|\d{3}/);
    expect(CURRENT.signoffs, 'somebody signed; the sign-off record must show it').toEqual([]);
    for (const d of DECISION_DOMAINS) expect(d.reviewers, d.domain).not.toContain(d.accountable);
  });

  it('names only register rows and launch gates that exist', () => {
    for (const id of allRests()) {
      expect(all.has(id), `${id} is in no register and is no gate`).toBe(true);
      if (!id.startsWith('gate:')) expect(['master', 'hecvat', 'ferpa', 'maturity']).toContain(registerOf(id));
    }
    expect(all.has('gate:no-such-gate')).toBe(false);
    expect(all.has('SRE-999')).toBe(false);
    for (const pl of PILLARS) for (const i of pl.items) expect(i.rests.length, i.item).toBeGreaterThan(0);
  });

  it('cites only files that exist', () => {
    for (const p of allPaths()) expect(existsSync(join(root, p)), p).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-runbook.md'))).toBe(false);
  });

  it('has the seven pillars, each with a question, evidence and at least eight items', () => {
    expect(PILLARS).toHaveLength(7);
    expect(new Set(PILLARS.map((p) => p.id)).size).toBe(7);
    for (const pl of PILLARS) {
      expect(pl.items.length, pl.id).toBeGreaterThanOrEqual(8);
      expect(pl.question.trim().length, pl.id).toBeGreaterThan(30);
      expect(pl.evidence.trim().length, pl.id).toBeGreaterThan(30);
    }
  });

  it('marks a dependency healthy only with a path, tested by nothing, and never invents a backup owner', () => {
    expect(DEPENDENCIES).toHaveLength(15);
    expect(new Set(DEPENDENCIES.map((d) => d.id)).size).toBe(15);
    for (const d of DEPENDENCIES) {
      if (d.status !== 'unknown') expect(d.path, `${d.id} is ${d.status} and cites nothing`).not.toBeNull();
      expect(d.note.trim().length, d.id).toBeGreaterThan(20);
    }
    expect(DEPENDENCIES.filter((d) => d.status === 'healthy').length).toBeLessThanOrEqual(2);
    expect(DEPENDENCIES.some((d) => d.status === 'failed')).toBe(true);
    for (const r of DRI_RULES) expect(r.note.trim().length, r.rule).toBeGreaterThan(20);
    expect(DRI_RULES.filter((r) => r.path === null).length).toBeGreaterThan(0);
  });

  it('lists the eighteen minimum runbooks, each with what stands in for it or nothing, and no tested date', () => {
    expect(RUNBOOKS).toHaveLength(18);
    expect(RUNBOOK_STEPS.map((s) => s.step)).toEqual(['Detect', 'Triage', 'Contain', 'Communicate', 'Recover', 'Validate', 'Close']);
    expect(RUNBOOKS.filter((r) => r.path === null).length).toBeGreaterThan(0);
    for (const r of RUNBOOKS) expect(r.note.trim().length, r.runbook).toBeGreaterThan(10);
    // No runbook document carries a "last tested" date; the page must not print one.
    for (const r of RUNBOOKS) if (r.path) expect(/last[- ]tested:\s*\d{4}/i.test(read(r.path)), `${r.path} carries a tested date the page does not show`).toBe(false);
  });

  it('scores a gate area by its lowest row, so one unmet control fails the area', () => {
    expect(areaLevel([2, 2, 0])).toBe(0);
    expect(areaLevel([2, 1, 2])).toBe(1);
    expect(areaLevel([2, 2, 2])).toBe(2);
    expect(areaLevel([4, 4], 2)).toBe(2);
    expect(areaLevel([])).toBe(0);
    expect(score([2, 2, 0])).toBe(2); // the control: the median would have passed it
  });

  it('decides GO, GO WITH CONDITIONS or NO-GO from the gates, and decides NO-GO today', () => {
    expect(verdict([{ required: 'yes', level: 2 }, { required: 'if-ai', level: 0 }], { ai: false, integrations: false })).toBe('go');
    expect(verdict([{ required: 'yes', level: 2 }, { required: 'if-ai', level: 0 }])).toBe('no-go');
    expect(verdict([{ required: 'yes', level: 2 }, { required: 'yes', level: 1 }])).toBe('go-with-conditions');
    expect(verdict([{ required: 'yes', level: 2 }, { required: 'yes', level: 3 }])).toBe('go');
    expect(GATE).toHaveLength(13);
    const today = GATE.map((g) => ({ required: g.required, level: areaLevel(g.rests.map(level), ceiling()) }));
    expect(verdict(today)).toBe('no-go');
    // A required area with one row at 0 is 0 whatever the rest: the finding that made this a min.
    const data = GATE.find((g) => g.area === 'Data')!;
    expect(data.rests.map(level)).toContain(0);
    expect(areaLevel(data.rests.map(level), ceiling())).toBe(0);
    expect(Object.keys(VERDICT_MEANING)).toEqual(['go', 'go-with-conditions', 'no-go']);
    for (const r of ['yes', 'if-ai', 'if-integration'] as Required[]) expect(GATE.some((g) => g.required === r), r).toBe(true);
  });

  it('has the packet, the cadences, the twelve initiatives and the plan fields', () => {
    expect(PACKET).toHaveLength(12);
    expect(PACKET.some((x) => x.path === null)).toBe(true);
    expect(CADENCES.map((c) => c.cadence)).toEqual(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually']);
    expect(INITIATIVES.map((i) => i.id)).toEqual(Array.from({ length: 12 }, (_, i) => `INIT-OPS-${String(i + 1).padStart(3, '0')}`));
    const workstreams = new Set(WORKSTREAMS.map((w) => w.id));
    for (const i of INITIATIVES) {
      expect(workstreams.has(i.workstream), i.id).toBe(true);
      expect(['P0', 'P1', 'P2', 'P3'] as Priority[]).toContain(i.priority);
      expect(i.rests.length, i.id).toBeGreaterThan(0);
    }
    expect(PLAN_FIELDS).toHaveLength(20);
    expect(PLAN_FIELDS.some((f) => f.carried === null)).toBe(true);
    expect(FINAL_STANDARD).toHaveLength(10);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render(all);
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

function render(all: Map<string, Level>): string {
  const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
  const or = (p: string | null) => (p ? ref(p) : '**nothing**');
  const cap = ceiling();
  const lv = (id: string) => all.get(id)!;
  const withLevel = (ids: readonly string[]) => ids.map((id) => `${id} (${lv(id)})`).join(', ');
  const itemScore = (ids: readonly string[]) => score(ids.map(lv), cap);
  const holder = (seat: string) => COUNCIL.find((c) => c.seat === seat)?.holder ?? '*vacant*';
  const held = COUNCIL.filter((c) => c.holder !== null);
  const heldLine = held.length ? `${held.length} of ${COUNCIL.length} seats are held (${held.map((c) => `\`${c.seat}\` — ${c.holder}`).join(', ')}), the rest vacant` : 'No seat is held';
  const today = GATE.map((g) => ({ ...g, level: areaLevel(g.rests.map(lv), cap) }));
  const decision = verdict(today);
  const VERDICT_TITLE = { go: 'GO', 'go-with-conditions': 'GO WITH CONDITIONS', 'no-go': 'NO-GO' };
  const REQUIRED_TITLE: Record<Required, string> = { yes: 'Yes', 'if-ai': 'If AI is enabled (it is)', 'if-integration': 'If integrations are enabled (they are)' };
  const workstreamTitle = (id: string) => WORKSTREAMS.find((w) => w.id === id)!.workstream;
  const pillarCount = (l: Level) => PILLARS.flatMap((p) => p.items).filter((i) => itemScore(i.rests) === l).length;
  const items = PILLARS.reduce((n, p) => n + p.items.length, 0);
  const depCount = (s: string) => DEPENDENCIES.filter((d) => d.status === s).length;

  const out: string[] = [
    '# Operational readiness pack',
    '',
    renderedFrom('app/src/lib/ops/readiness-pack.ts', 'readiness-pack.test.ts'),
    '',
    controlLine(DOC),
    '',
    `> ${RULE}`,
    '',
    'Two documents of 28 September 2026 say when a release, a pilot, an',
    'integration or a module is operational, and this page is their structure',
    'with each item pointed at what the repository holds. Every checklist item',
    'rests on rows of the registers that already exist — the master, HECVAT,',
    'FERPA/1EdTech and maturity registers, and the twelve launch gates of',
    `${ref('docs/LAUNCH-READINESS-COUNCIL.md')} — and its level on the crosswalk’s 0–4 scale is`,
    `computed by the test, capped at ${cap}${cap === 4 ? ` now that \`${EVIDENCE_DIR}/\` holds the AI drills of 29 September` : ` while \`${EVIDENCE_DIR}/\` does not exist`}. The launch`,
    `verdict is computed the same way. **Today it is ${VERDICT_TITLE[decision]}**, and the test`,
    'asserts that rather than letting the page decide.',
    '',
    ...table(['Supplied document', 'What it holds'], SOURCES.map((x) => [`[${cell(x.title)}](${link(DOC, x.path)})`, cell(x.what)])),
    '',
    '## The five workstreams',
    '',
    'Each accountable lead is a council seat; a seat is held only once somebody',
    'accepted it in writing, and the holder is read from the code.',
    '',
    ...table(['Workstream', 'Mission', 'Seat', 'Held by', 'Cadence', 'Example initiatives'], WORKSTREAMS.map((w) => [`**${w.workstream}**`, cell(w.mission), `\`${w.seat}\``, holder(w.seat), w.cadence, cell(w.examples)])),
    '',
    '### Cross-functional decision owners',
    '',
    'Ordinary ownership apart from high-risk decision rights. A reviewer is never the accountable seat.',
    '',
    ...table(['Decision', 'Accountable', 'Required reviewers'], DECISION_DOMAINS.map((d) => [cell(d.domain), `\`${d.accountable}\``, d.reviewers.map((r) => `\`${r}\``).join(', ')])),
    '',
    '### The minimum DRI rules',
    '',
    ...table(['Rule', 'Held by', 'Today'], DRI_RULES.map((r) => [cell(r.rule), or(r.path), cell(r.note)])),
    '',
    '## The seven pillars of production safety',
    '',
    `${items} checklist items: ${pillarCount(0)} at 0, ${pillarCount(1)} at 1, ${pillarCount(2)} at 2, none above the ceiling. An item’s level is the`,
    'lower median of the rows it rests on; `gate:` rows are launch gates (unmet 0,',
    'partial 1, met 2).',
    '',
  ];

  for (const pl of PILLARS) {
    const n = (l: Level) => pl.items.filter((i) => itemScore(i.rests) === l).length;
    out.push(
      `### ${pl.pillar}`,
      '',
      `*${pl.question}* Required evidence: ${pl.evidence} — ${n(0)} at 0, ${n(1)} at 1, ${n(2)} at 2.`,
      '',
      ...table(['Item', 'Rests on (level)', 'Level'], pl.items.map((i) => [cell(i.item), withLevel(i.rests), String(itemScore(i.rests))]), ['left', 'left', 'right']),
      '',
    );
  }

  out.push(
    '## The dependency register',
    '',
    'A dependency is not only external: an unbuilt internal service, a policy, a',
    `person, a contract. ${depCount('healthy')} healthy, ${depCount('at-risk')} at risk, ${depCount('failed')} failed, ${depCount('unknown')} unknown of ${DEPENDENCIES.length}.`,
    '*Unknown* means never tested against a failure, which is every dependency',
    'that could fail. Nothing has a last-tested date, and the page prints none.',
    '',
    ...table(
      ['ID', 'Dependency', 'Type', 'Criticality', 'Owner', 'Used by', 'Failure mode', 'Detection', 'Fallback', 'Exit', 'Rests on', 'Status', 'Note'],
      DEPENDENCIES.map((d) => [`**${d.id}**`, cell(d.name), cell(d.type), d.criticality, `\`${d.owner}\``, cell(d.usedBy), cell(d.failure), d.detection ? ref(d.detection) : '**nothing**', cell(d.fallback), cell(d.exit), or(d.path), d.status, cell(d.note)]),
    ),
    '',
    '## Recovery runbooks',
    '',
    'Every material incident scenario follows seven steps:',
    '',
    ...RUNBOOK_STEPS.map((s, i) => `${i + 1}. **${s.step}** — ${s.means}`),
    '',
    `The pack’s eighteen minimum runbooks, and the document that stands in for each today: ${RUNBOOKS.filter((r) => r.path).length} have one, ${RUNBOOKS.filter((r) => !r.path).length} have none.`,
    `None has an owner, a last-tested date or an escalation path in the pack’s sense; the index of what exists is ${ref('docs/RUNBOOKS.md')}.`,
    '',
    ...table(['Runbook', 'Stands in today', 'Note'], RUNBOOKS.map((r) => [cell(r.runbook), or(r.path), cell(r.note)])),
    '',
    '## The launch readiness gate',
    '',
    ...table(['Outcome', 'Meaning'], (Object.keys(VERDICT_MEANING) as (keyof typeof VERDICT_MEANING)[]).map((k) => [`**${VERDICT_TITLE[k]}**`, cell(VERDICT_MEANING[k])])),
    '',
    `Thirteen areas, each resting on rows and launch gates. **An area’s level is its lowest row**, not a median: one unmet control fails the area, because the pack says an unresolved mandatory gate is NO-GO. A required area at 0 is a failed mandatory gate; at 1 it is a condition. **Today: ${VERDICT_TITLE[decision]}** — ${today.filter((g) => g.level === 0).length} areas at 0, ${today.filter((g) => g.level === 1).length} at 1, ${today.filter((g) => g.level >= 2).length} passing.`,
    '',
    ...table(['Area', 'Gate', 'Required for GO', 'Rests on (level)', 'Lowest'], today.map((g) => [`**${g.area}**`, cell(g.gate), REQUIRED_TITLE[g.required], withLevel(g.rests), String(g.level)]), ['left', 'left', 'left', 'left', 'right']),
    '',
    '### The review packet',
    '',
    `Twelve items, ${PACKET.filter((x) => x.path).length} with a document that would carry them today:`,
    '',
    ...table(['Item', 'Carried by'], PACKET.map((x) => [cell(x.item), or(x.path)])),
    '',
    '### The sign-off record',
    '',
    `Each line is a council seat. ${heldLine}. Nothing is signed: holding a seat is not`,
    `signing, and \`signoffs\` in ${ref('app/src/lib/launchreadiness.ts')} is empty; the`,
    `master register’s ten executive sign-offs (${ref('docs/MASTER-LAUNCH-READINESS-REGISTER.md')}) are the same people by another name.`,
    '',
    ...table(['Sign-off', 'Seat', 'Held by', 'Signed'], SIGNOFFS.map((s) => [s.signoff, `\`${s.seat}\``, holder(s.seat), CURRENT.signoffs.includes(s.seat) ? 'signed' : '—'])),
    '',
    '## Operating cadences',
    '',
    `The pack’s cadences beside the operating rhythm already kept (${ref('docs/operating-model/OPERATING-RHYTHM.md')}), which has no daily line.`,
    '',
    ...table(['Cadence', 'Required review'], CADENCES.map((c) => [`**${c.cadence}**`, cell(c.reviews)])),
    '',
    '## The first operating-plan initiatives',
    '',
    'The pack’s twelve initiatives, each on the rows it would move. The level is',
    'the lower median of those rows; none is above 2, because nothing is.',
    '',
    ...table(['ID', 'Initiative', 'Workstream', 'Priority', 'Mandatory evidence', 'Rests on (level)', 'Level'], INITIATIVES.map((i) => [`**${i.id}**`, cell(i.initiative), workstreamTitle(i.workstream), i.priority, cell(i.evidence), withLevel(i.rests), String(itemScore(i.rests))]), ['left', 'left', 'left', 'left', 'left', 'left', 'right']),
    '',
    '### The master operating plan, against the master register',
    '',
    `The pack asks for one master register with twenty fields per row. ${ref('docs/MASTER-LAUNCH-READINESS-REGISTER.md')} is that register; ${PLAN_FIELDS.filter((f) => f.carried).length} of the twenty fields have a column or a place, and the rest are named so the gap is visible. Rejected: a second register (D-108’s reason).`,
    '',
    ...table(['Field the pack asks for', 'Carried by'], PLAN_FIELDS.map((f) => [cell(f.field), f.carried ? cell(f.carried) : '**nothing**'])),
    '',
    '## The final standard',
    '',
    ...FINAL_STANDARD.map((s) => `- ${s}`),
    '',
    'Semester becomes operational when these are repeatable, evidenced routines',
    'rather than aspirations. This page names rows and never changes them; the',
    'registers that own the rows say what moves each.',
    '',
  );
  return out.join('\n');
}
