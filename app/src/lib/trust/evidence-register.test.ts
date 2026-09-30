import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROLS as MATURITY } from '../governance/maturity';
import { COUNCIL, SEATS } from '../launchreadiness';
import { REGISTER } from '../masterregister';
import { cell, controlLine, link, renderedFrom, table } from '../ops/render';
import { MASTER_LEVEL, MATURITY_LEVEL, REGISTER_LEVEL, registerOf, type Level } from './compliance-crosswalk';
import {
  AUDIT_TO_SPRINT, BACKLOG, BLOCKERS, CLOUD, DELETION_STEPS, EVIDENCE, EVIDENCE_DIR, FEATURES, GUARDRAILS, LEADS, PRIORITY_MEANING, RETENTION_CLASSES,
  RETENTION_PRINCIPLES, SCHEMA, SOURCES, SPRINTS, VISIBILITY_MEANING, WHERE_MEANING, allRests,
  type Priority, type Where,
} from './evidence-register';

/**
 * Holds the evidence register to the tree: every owner is a council seat,
 * every register row it rests on exists, every cited path exists, each status
 * cites the kind of file it claims — and `produced` is refused unless the row
 * cites a file under `docs/evidence/`, because that is where produced evidence
 * lives and nowhere else. Every retention class names things RETENTION.md
 * really says. The supplied PDFs are never evidence.
 *
 * `docs/trust/EVIDENCE-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/trust/EVIDENCE-REGISTER.md';
const HECVAT = 'docs/market-readiness/HECVAT_READINESS.md';
const FERPA = 'docs/FERPA-COPPA-1EDTECH-READINESS.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /\.check\.sql$/.test(p) || /^\.github\/workflows\//.test(p);
const isCode = (p: string) => !isDoc(p);

function registerLevels(path: string): Map<string, Level> {
  const out = new Map<string, Level>();
  for (const line of read(path).split('\n')) {
    if (!/^\| [A-Z0-9]+-\d+ \|/.test(line)) continue;
    const [id, , , status] = line.split('|').slice(1, -1).map((c) => c.trim());
    out.set(id, REGISTER_LEVEL[status.replace(/`/g, '')]);
  }
  return out;
}

/** Every row of every register, on the 0–4 scale, the same way the crosswalk reads them. */
function levels(): Map<string, Level> {
  const out = new Map<string, Level>();
  for (const r of REGISTER) out.set(r.id, MASTER_LEVEL[r.status]);
  for (const [id, l] of registerLevels(HECVAT)) out.set(id, l);
  for (const [id, l] of registerLevels(FERPA)) out.set(id, l);
  for (const c of MATURITY) out.set(c.id, MATURITY_LEVEL[c.status]);
  return out;
}

describe('the evidence register', () => {
  const all = levels();

  it('keeps the four supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(4);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const e of EVIDENCE) for (const h of e.holds) expect(supplied.has(h.path), `${e.id} cites a supplied PDF`).toBe(false);
    for (const c of CLOUD) if (c.path) expect(supplied.has(c.path), `${c.area} cites a supplied PDF`).toBe(false);
  });

  it('gives every lead a council seat, and reads who holds it from the council', () => {
    expect(LEADS).toHaveLength(7);
    for (const l of LEADS) {
      expect(SEATS, l.lead).toContain(l.seat);
      const holder = COUNCIL.find((c) => c.seat === l.seat)?.holder ?? null;
      if (holder !== null) expect(holder, `${l.lead}: a holder is a role label, never an address`).not.toMatch(/@|\d{3}/);
    }
    for (const e of EVIDENCE) expect(SEATS, e.id).toContain(e.owner);
    expect(SCHEMA.length).toBeGreaterThanOrEqual(12);
  });

  it('names only register rows that exist, owned by the register their shape says', () => {
    for (const id of allRests()) {
      expect(all.has(id), `${id} is in no register`).toBe(true);
    }
    expect(all.has('SEC-999')).toBe(false);
    expect(registerOf('SEC-006')).toBe('master');
    for (const e of EVIDENCE) expect(e.rests.length, e.id).toBeGreaterThan(0);
    for (const f of FEATURES) for (const id of f.rows) expect(registerOf(id), `${f.feature}: ${id}`).toBe('master');
  });

  it('cites only files that exist', () => {
    for (const e of EVIDENCE) for (const h of e.holds) expect(existsSync(join(root, h.path)), `${e.id} cites ${h.path}`).toBe(true);
    for (const c of CLOUD) if (c.path) expect(existsSync(join(root, c.path)), `${c.area} cites ${c.path}`).toBe(true);
    for (const b of BLOCKERS) if (b.path) expect(existsSync(join(root, b.path)), `${b.condition} cites ${b.path}`).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-evidence.md'))).toBe(false);
  });

  it('refuses `produced` without an artifact under the evidence directory, and holds each status to the kind of file it cites', () => {
    expect(EVIDENCE.length).toBeGreaterThanOrEqual(18);
    expect(new Set(EVIDENCE.map((e) => e.id)).size).toBe(EVIDENCE.length);
    for (const e of EVIDENCE) {
      const paths = e.holds.map((h) => h.path);
      if (e.status === 'produced') {
        expect(existsSync(join(root, EVIDENCE_DIR)), `${e.id} is produced with no ${EVIDENCE_DIR}`).toBe(true);
        expect(paths.some((p) => p.startsWith(`${EVIDENCE_DIR}/`)), `${e.id} is produced and cites nothing under ${EVIDENCE_DIR}`).toBe(true);
      }
      if (e.status === 'defined') expect(paths.some(isCode), `${e.id} is defined and cites no code or test`).toBe(true);
      if (e.status === 'owed') expect(paths.every(isDoc), `${e.id} is owed yet cites code`).toBe(true);
      expect(e.produce.trim().length, e.id).toBeGreaterThan(30);
      expect(e.control, e.id).toMatch(/ — /); // the control, then the risk it addresses
      expect(Object.keys(VISIBILITY_MEANING), e.id).toContain(e.visibility);
    }
    expect(EVIDENCE.filter((e) => e.status === 'produced')).toHaveLength(0);
    expect(EVIDENCE.some((e) => e.status === 'owed')).toBe(true);
    expect(EVIDENCE.filter((e) => e.status === 'defined').every((e) => e.holds.some((h) => isTest(h.path))), 'a defined control cites at least one test').toBe(true);
  });

  it('maps every feature to master rows, and the cloud to the tree, a provider, or nobody', () => {
    expect(FEATURES).toHaveLength(12);
    expect(CLOUD).toHaveLength(20);
    for (const c of CLOUD) {
      expect(Object.keys(WHERE_MEANING), c.area).toContain(c.where);
      if (c.where === 'owed') expect(c.path, c.area).toBeNull();
      else expect(c.path, c.area).not.toBeNull();
    }
    expect(CLOUD.some((c) => c.where === 'owed')).toBe(true);
    expect(CLOUD.some((c) => c.where === 'provider')).toBe(true);
  });

  it('holds the release blockers to what exists, and says how', () => {
    expect(BLOCKERS).toHaveLength(7);
    for (const b of BLOCKERS) expect(b.how.trim().length, b.condition).toBeGreaterThan(40);
    expect(BLOCKERS.some((b) => b.path === null)).toBe(true);
  });

  it('names, in every retention class, tables or sweeps that RETENTION.md really names', () => {
    const retention = read('RETENTION.md');
    expect(RETENTION_CLASSES).toHaveLength(12);
    for (const c of RETENTION_CLASSES) {
      for (const n of c.names) expect(retention.includes(n), `${c.cls} names ${n}, which RETENTION.md does not`).toBe(true);
      expect(c.configurable, `${c.cls}: nothing is customer-configurable yet`).toBe(false);
      expect(c.today.trim().length, c.cls).toBeGreaterThan(20);
    }
    expect(retention.includes('no_such_table_anywhere')).toBe(false);
    expect(RETENTION_PRINCIPLES).toHaveLength(10);
    expect(DELETION_STEPS).toHaveLength(8);
  });

  it('has twelve sprints and a tiered backlog, each item on rows that exist', () => {
    expect(SPRINTS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const s of SPRINTS) expect(s.rows.length, `sprint ${s.n}`).toBeGreaterThan(0);
    for (const p of ['P0', 'P1', 'P2'] as Priority[]) {
      expect(BACKLOG.some((b) => b.priority === p), p).toBe(true);
      expect(PRIORITY_MEANING[p]).toBeTruthy();
    }
    expect(AUDIT_TO_SPRINT).toHaveLength(10);
    expect(GUARDRAILS).toHaveLength(4);
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
  const withLevel = (ids: readonly string[]) => ids.map((id) => `${id} (${all.get(id)})`).join(', ');
  const lowest = (ids: readonly string[]) => Math.min(...ids.map((id) => all.get(id)!));
  const count = (s: string) => EVIDENCE.filter((e) => e.status === s).length;
  const whereCount = (w: Where) => CLOUD.filter((c) => c.where === w).length;
  const holder = (seat: string) => COUNCIL.find((c) => c.seat === seat)?.holder ?? null;
  const heldLeads = LEADS.filter((l) => holder(l.seat) !== null);
  const backlogStanding = (rows: readonly string[]) => {
    const l = lowest(rows);
    return l >= 2 ? 'built' : l === 1 ? 'partly' : 'open';
  };

  const out: string[] = [
    '# Security and compliance evidence register',
    '',
    renderedFrom('app/src/lib/trust/evidence-register.ts', 'evidence-register.test.ts'),
    '',
    controlLine(DOC),
    '',
    '**No evidence has been produced.** This is the index the operating system',
    'listed as missing: for every control a university reviewer will ask about,',
    'the artifact that would prove it operates, who owns producing it, how often,',
    'who may see it, and what the tree holds today — which is the control and its',
    'test, never yet the proof that anybody ran it. The index closes the category',
    `by existing. Each artifact lives under \`${EVIDENCE_DIR}/\` once it exists, and the`,
    'word *produced* is refused by the test until a row cites one there. The',
    'directory holds the AI drills of 29 September; neither is the artifact any',
    'row here asks for, so none is produced.',
    '',
    ...table(['Supplied document', 'What it holds'], SOURCES.map((x) => [`[${cell(x.title)}](${link(DOC, x.path)})`, cell(x.what)])),
    '',
    `## The operating model: seven leads, ${heldLeads.length ? `${heldLeads.length} held and ${LEADS.length - heldLeads.length} vacant` : 'all vacant'}`,
    '',
    'The documents ask for named leads rather than a folder of policies. Each is a',
    `council seat from ${ref('docs/LAUNCH-READINESS-COUNCIL.md')}; a seat is held only once`,
    'somebody accepted it in writing, and the page reads the holder from the code.',
    '',
    ...table(['Lead', 'Seat', 'Held by', 'Owns'], LEADS.map((l) => [`**${l.lead}**`, `\`${l.seat}\``, holder(l.seat) ?? '*vacant*', cell(l.owns)])),
    '',
    '## The schema',
    '',
    'The fields the documents ask every row to carry, and where each is on this page.',
    '',
    ...table(['Field asked for', 'Here'], SCHEMA.map((s) => [cell(s.field), cell(s.here)])),
    '',
    '## The register',
    '',
    `${EVIDENCE.length} rows: ${count('produced')} produced, ${count('defined')} defined, ${count('owed')} owed.`,
    '*Defined* means the control and its test exist, so the artifact can be',
    'produced by running something the row names; *owed* means neither exists.',
    `Visibility: ${(Object.keys(VISIBILITY_MEANING) as (keyof typeof VISIBILITY_MEANING)[]).map((k) => `**${k}** — ${VISIBILITY_MEANING[k]}`).join('; ')}.`,
    'Levels in brackets are the rows’ standings on the crosswalk’s 0–4 scale.',
    '',
    ...table(
      ['ID', 'Control — risk addressed', 'Rests on (level)', 'Evidence', 'Frequency', 'Owner', 'Visibility', 'Status', 'What the tree holds', 'To produce it'],
      EVIDENCE.map((e) => [
        `**${e.id}**`, cell(e.control), withLevel(e.rests), cell(e.evidence), e.frequency, `\`${e.owner}\``, e.visibility, e.status,
        e.holds.map((h) => `${ref(h.path)} — ${cell(h.shows)}`).join('<br>'), cell(e.produce),
      ]),
    ),
    '',
    '## Features, mapped to HECVAT',
    '',
    'Each feature with the data it carries, the HECVAT themes a reviewer will open,',
    'the controls the feature needs and the master rows that carry it. The lowest',
    'row is the feature’s standing.',
    '',
    ...table(
      ['Feature', 'Primary data and risk', 'HECVAT themes', 'Required controls', 'Evidence', 'Master rows (level)', 'Lowest'],
      FEATURES.map((f) => [`**${f.feature}**`, cell(f.risk), cell(f.themes), cell(f.controls), cell(f.evidence), withLevel(f.rows), String(lowest(f.rows))]),
      ['left', 'left', 'left', 'left', 'left', 'left', 'right'],
    ),
    '',
    '## The cloud, area by area',
    '',
    `Semester runs on Supabase, Vercel and GitHub Pages (${ref('docs/SUBPROCESSORS.md')}). For each`,
    'of the documents’ twenty cloud areas: the objective, what Semester actually',
    'does, and where it is held. This is not the HECVAT 4 question set; a customer’s',
    'questionnaire maps each area to its own identifiers.',
    `${(Object.keys(WHERE_MEANING) as Where[]).map((w) => `**${w}** (${whereCount(w)}) — ${WHERE_MEANING[w]}`).join('; ')}.`,
    '',
    ...table(
      ['Area', 'Objective', 'Semester implementation', 'Where', 'Shown by', 'Cadence'],
      CLOUD.map((c) => [`**${c.area}**`, cell(c.objective), cell(c.implementation), c.where, c.path ? ref(c.path) : '—', c.cadence]),
    ),
    '',
    '## What blocks a release',
    '',
    'The documents’ automated release gate: a release is blocked while any of these',
    'is true. Nothing computes the gate yet; each line says what would hold it today.',
    '',
    ...table(['Condition', 'Held today by', 'How'], BLOCKERS.map((b) => [cell(b.condition), b.path ? ref(b.path) : '**nothing**', cell(b.how)])),
    '',
    '## Retention, by data class',
    '',
    `${ref('RETENTION.md')} is the retention schedule, and it is organised by table. The`,
    'documents’ draft policy is organised by data class and asks for customer',
    'configuration, backup lifecycle and a legal hold. This table reads the schedule',
    'into the classes: what the draft asks for, and what the schedule says today. The',
    'test checks every table or sweep a row names is one the schedule names.',
    '',
    '**Not legal advice, and not a duration commitment.** FERPA prescribes no',
    'general retention period; institutions have duties under other law, contracts',
    'and their own records schedules, and Semester will not claim a universal one.',
    'Durations are published only after counsel and a customer have approved a',
    'schedule; today nothing is customer-configurable and no legal hold exists.',
    '',
    ...table(
      ['Data class', 'Examples', 'The draft’s default approach', 'What the schedule says today', 'Named in the schedule', 'Customer-configurable'],
      RETENTION_CLASSES.map((c) => [`**${c.cls}**`, cell(c.examples), cell(c.approach), cell(c.today), c.names.length ? c.names.map((n) => `\`${n}\``).join(', ') : '—', c.configurable ? 'yes' : 'no']),
    ),
    '',
    `The draft’s principles: ${RETENTION_PRINCIPLES.join('; ').toLowerCase()}.`,
    '',
    'When deletion is requested or a period expires, the draft’s steps — the ones',
    'the account-deletion function performs today are the third, fourth and',
    'seventh; the second and sixth wait on a hold object and a stated backup lifecycle:',
    '',
    ...DELETION_STEPS.map((s, i) => `${i + 1}. ${s}`),
    '',
    '## The twelve sprints',
    '',
    'The documents’ engineering plan, each sprint pointed at the rows it would move.',
    'The lowest row is where the sprint stands; none is finished, because none of',
    'the rows is above 2 and most are at 1.',
    '',
    ...table(['Sprint', 'Objective', 'Evidence output', 'Customer value', 'Rows (level)', 'Lowest'], SPRINTS.map((s) => [String(s.n), cell(s.objective), cell(s.output), cell(s.value), withLevel(s.rows), String(lowest(s.rows))]), ['right', 'left', 'left', 'left', 'left', 'right']),
    '',
    '## The backlog, by priority',
    '',
    ...(['P0', 'P1', 'P2'] as Priority[]).map((p) => `- **${p}** — ${PRIORITY_MEANING[p]}.`),
    '',
    '**Built** when every row it rests on is at 2; **partly** when the lowest is 1; **open** otherwise.',
    '',
    ...table(['Priority', 'Capability', 'Rows (level)', 'Standing'], BACKLOG.map((b) => [b.priority, cell(b.capability), withLevel(b.rows), backlogStanding(b.rows)])),
    '',
    '## How this register is worked',
    '',
    'An audit finding becomes work, and work becomes a claim, in this order and no other:',
    '',
    ...AUDIT_TO_SPRINT.map((s, i) => `${i + 1}. ${s}`),
    '',
    'And four guardrails the documents insist on, held here as rules of the page:',
    '',
    ...GUARDRAILS.map((g) => `- ${g}`),
    '',
    `The scores the register rests on are on ${ref('docs/trust/COMPLIANCE-CROSSWALK.md')}; the`,
    `first artifacts are scheduled on ${ref('docs/PROOF-CALENDAR.md')}; the NDA room that`,
    `will carry the *nda* rows is ${ref('app/src/screens/TrustRoom.tsx')}.`,
    '',
  ];
  return out.join('\n');
}
