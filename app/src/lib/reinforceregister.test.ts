import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS, ASSESSED_AT, BRIEFS, CHECKLIST, CONFLICTS, FULLY_BUILT_GATE, ITEMS, P0, SCORING, STATUSES, areaOf, mayClaimFullyBuilt } from './reinforceregister';
import { COUNCIL, SEATS } from './launchreadiness';
import { ALL as ONEOS } from './oneos';
import { ITEMS as LEADERSHIP } from './ops/leadership';
import { ITEMS as CONNECT } from './connectregister';
import { OWNER_LABEL, OWNER_ROLES, PRODUCT_AREAS, vacantOwnerships } from './ops/operatingmodel';

/**
 * Holds the reinforcement register to the communities register's rule: every
 * cited file exists, each status cites the kind of file it claims, every
 * overlap names an item that exists in the register it names, every ask names
 * a brief that is kept, and the rendered document is what the data says.
 *
 * `docs/REINFORCEMENT-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const exists = (path: string) => existsSync(join(root, path));
const DOC = 'docs/REINFORCEMENT-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

const REGISTERS: Record<string, ReadonlySet<string>> = {
  oneos: new Set(ONEOS.map((r) => r.id)),
  lead: new Set(LEADERSHIP.map((r) => r.id)),
  connect: new Set(CONNECT.map((r) => r.id)),
};

describe('the reinforcement register', () => {
  it('keeps every brief it reads, as supplied', () => {
    expect(BRIEFS).toHaveLength(7);
    expect(new Set(BRIEFS.map((b) => b.key)).size).toBe(BRIEFS.length);
    for (const b of BRIEFS) expect(exists(b.path), b.path).toBe(true);
  });

  it('gives every area a reason and more than one item, and every item a unique id', () => {
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    for (const a of AREAS) {
      expect(ITEMS.filter((i) => areaOf(i.id) === a).length, a.id).toBeGreaterThan(1);
      expect(a.why.length, a.id).toBeGreaterThan(40);
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  it('can tell a missing file from a present one', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('docs/no-such-reinforcement-evidence.md')).toBe(false);
  });

  it('cites only files that exist, and never a brief as its own evidence', () => {
    const briefs = new Set(BRIEFS.map((b) => b.path));
    for (const i of ITEMS) for (const e of i.evidence) {
      expect(exists(e.path), `${i.id} cites ${e.path}`).toBe(true);
      expect(briefs.has(e.path), `${i.id} cites a brief`).toBe(false);
    }
  });

  it('holds each status to the kind of file it claims', () => {
    for (const i of ITEMS) {
      const paths = i.evidence.map((e) => e.path);
      expect(STATUSES, i.id).toContain(i.status);
      if (i.status === 'designed') expect(paths.some(isDoc), `${i.id} is designed and cites no document`).toBe(true);
      if (i.status === 'building') expect(paths.some(isCode), `${i.id} is building and cites no code`).toBe(true);
      if (i.status === 'tested') expect(paths.some(isTest), `${i.id} is tested and cites no test`).toBe(true);
      if (i.status === 'not-started') expect(paths.some(isCode), `${i.id} is not started and cites code`).toBe(false);
    }
  });

  it('cites asks only from briefs it keeps, and every item is asked for', () => {
    const keys = new Set(BRIEFS.map((b) => b.key));
    for (const i of ITEMS) {
      expect(i.asks.length, i.id).toBeGreaterThan(0);
      for (const a of i.asks) expect(keys.has(a[0]) && /^[A-Z]\d*$/.test(a), `${i.id} asks ${a}`).toBe(true);
      expect(i.gap.trim().length, i.id).toBeGreaterThanOrEqual(5);
    }
    // Every brief is read by at least one row.
    for (const b of BRIEFS) expect(ITEMS.some((i) => i.asks.some((a) => a[0] === b.key)), b.key).toBe(true);
  });

  it('overlaps only items that exist in the register it names', () => {
    for (const i of ITEMS) for (const o of i.overlaps) {
      const [reg, id] = o.split(':');
      expect(REGISTERS[reg], `${i.id}: no register ${reg}`).toBeDefined();
      expect(REGISTERS[reg].has(id), `${i.id} overlaps ${o}`).toBe(true);
    }
    expect(ITEMS.some((i) => i.overlaps.length > 0)).toBe(true);
  });

  it('names a seat to decide every conflict, and cites what the tree holds', () => {
    for (const c of CONFLICTS) {
      expect(SEATS).toContain(c.decides);
      expect(exists(c.cites), c.cites).toBe(true);
    }
  });

  it('owns every P0 blocker by a seat, and cites what holds it', () => {
    expect(P0.length).toBeGreaterThan(30);
    expect(new Set(P0.map((p) => p.id)).size).toBe(P0.length);
    for (const p of P0) {
      expect(SEATS, p.id).toContain(p.owner);
      expect(STATUSES, p.id).toContain(p.status);
      if (p.status === 'not-started') expect(p.evidence, p.id).toBeNull();
      else {
        expect(exists(p.evidence!), `${p.id} cites ${p.evidence}`).toBe(true);
        if (p.status === 'tested') expect(isTest(p.evidence!), `${p.id} is tested and cites no test`).toBe(true);
      }
    }
  });

  it('scores a module 0–5 on ten criteria and refuses “fully built” below 4 on any of the five', () => {
    expect(SCORING).toHaveLength(10);
    const ids = new Set(SCORING.map((s) => s.id));
    for (const g of FULLY_BUILT_GATE) expect(ids.has(g), g).toBe(true);
    const all4 = Object.fromEntries(FULLY_BUILT_GATE.map((g) => [g, 4]));
    expect(mayClaimFullyBuilt(all4)).toEqual({ may: true, short: [] });
    expect(mayClaimFullyBuilt({ ...all4, privacy: 3 }).may).toBe(false);
    expect(mayClaimFullyBuilt({}).short).toHaveLength(FULLY_BUILT_GATE.length); // unscored is not a pass
    expect(mayClaimFullyBuilt({ ...all4, depth: 6 }).may).toBe(false);
    expect(mayClaimFullyBuilt({ ...all4, student: 1 }).may).toBe(true); // only the five gate it
  });

  it('answers each final question in a set that exists, or says none does', () => {
    for (const c of CHECKLIST) if (c.answeredIn) expect(exists(c.answeredIn), c.answeredIn).toBe(true);
    expect(CHECKLIST.some((c) => c.answeredIn === null)).toBe(true);
    expect(new Set(CHECKLIST.map((c) => c.question)).size).toBe(CHECKLIST.length);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const holder = (seat: string) => COUNCIL.find((c) => c.seat === seat)?.holder ?? null;
const seat = (s: string) => `\`${s}\`${holder(s) ? '' : ' (vacant)'}`;
const ref = (p: string) => `[\`${p}\`](../${p})`;

function render(): string {
  const count = (s: string, rows = ITEMS) => rows.filter((i) => i.status === s).length;
  const vacant = vacantOwnerships((s) => holder(s) !== null);
  const out: string[] = [
    '# Reinforcement Register',
    '',
    '<!-- Rendered from app/src/lib/reinforceregister.ts and app/src/lib/ops/operatingmodel.ts by reinforceregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Seven briefs of 29 September 2026 ask what else would make Semester the',
    'leader and the benchmark of its market. They repeat each other, so a row',
    'here is one thing the tree would have to hold, citing every brief item that',
    'asks for it; where another register already reads the same thing, the row',
    'names it rather than restating it. Nothing here says Semester is the',
    'benchmark: the counts below are the finding.',
    '',
    '| Key | Brief |',
    '| --- | --- |',
    ...BRIEFS.map((b) => `| ${b.key} | [${cell(b.title)}](../${b.path}) |`),
    '',
    `Statuses were assessed against \`origin/main\` at \`${ASSESSED_AT}\`; a test holds each`,
    'to the kind of file it cites. Nothing is above `tested`, because nothing has',
    'an artifact under `docs/evidence/`.',
    '',
    '## Where it stands',
    '',
    `| Area | Items | ${STATUSES.join(' | ')} |`,
    `| --- | ---: | ${STATUSES.map(() => '---:').join(' | ')} |`,
  ];
  for (const a of AREAS) {
    const rows = ITEMS.filter((i) => areaOf(i.id) === a);
    out.push(`| [${a.id}](#${a.id.toLowerCase()}) ${a.title} | ${rows.length} | ${STATUSES.map((s) => count(s, rows)).join(' | ')} |`);
  }
  out.push(`| **total** | **${ITEMS.length}** | ${STATUSES.map((s) => `**${count(s)}**`).join(' | ')} |`, '');

  out.push(
    '## Where a brief and the tree disagree',
    '',
    'Nothing here changes a recorded decision. Each is put to the seat that owns it.',
    '',
    ...(CONFLICTS.length
      ? [
          '| The brief asks | The tree holds | Decides | Cites |',
          '| --- | --- | --- | --- |',
          ...CONFLICTS.map((c) => `| ${cell(c.asks)} | ${cell(c.tree)} | ${seat(c.decides)} | ${ref(c.cites)} |`),
        ]
      : ['None is open. The four this register found — the Plus price, the pilot length, the statement’s “payments” and the first-year document’s name — the owner settled (D-134).']),
    '',
  );

  out.push('## The register', '');
  for (const a of AREAS) {
    out.push(`### ${a.id}`, '', `**${a.title}.** ${a.why}`, '');
    out.push('| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const i of ITEMS.filter((x) => areaOf(x.id) === a)) {
      const ev = i.evidence.length ? i.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>') : '—';
      const ov = i.overlaps.length ? i.overlaps.map((o) => `\`${o}\``).join(', ') : '—';
      out.push(`| ${i.id} | ${cell(i.item)} | ${i.status} | ${ev} | ${cell(i.gap)} | ${i.asks.join(', ')} | ${ov} |`);
    }
    out.push('');
  }

  out.push(
    '## The operating model',
    '',
    'The ten product areas the first brief names, each with the fields it asks every area to define. Every owner is a council seat; a seat nobody holds is marked vacant rather than given a name.',
    '',
    `Of ${PRODUCT_AREAS.length * OWNER_ROLES.length} ownerships, **${vacant.length} rest on a vacant seat**.`,
    '',
    `| Area | Primary user | Problem | ${OWNER_ROLES.map((r) => OWNER_LABEL[r]).join(' | ')} | Success metric | Depends on | Integrations | Fallback | Maturity | Next |`,
    `| --- | --- | --- | ${OWNER_ROLES.map(() => '---').join(' | ')} | --- | --- | --- | --- | --- | --- |`,
    ...PRODUCT_AREAS.map((a) =>
      [
        `| ${a.area}`,
        cell(a.primaryUser),
        cell(a.problem),
        ...OWNER_ROLES.map((r) => seat(a.owners[r])),
        cell(a.successMetric),
        a.dependsOn.length ? a.dependsOn.join(', ') : '—',
        a.integrations.length ? cell(a.integrations.join('; ')) : 'None: the student’s own data',
        cell(a.fallback),
        a.maturity,
        `${cell(a.next)} |`,
      ].join(' | '),
    ),
    '',
  );

  out.push(
    '## The playbook’s P0 blockers',
    '',
    'Every row the compliance playbook marks P0 — a blocker before institutional data, a public claim or formal vetting — with a seat as owner and the tree’s reading in place of the playbook’s, which predates much of what has landed.',
    '',
    '| ID | Control | Owner | Status | Evidence | Next |',
    '| --- | --- | --- | --- | --- | --- |',
    ...P0.map((p) => `| ${p.id} | ${cell(p.control)} | ${seat(p.owner)} | ${p.status} | ${p.evidence ? `\`${p.evidence}\`` : '—'} | ${cell(p.next) || '—'} |`),
    '',
    `${P0.filter((p) => holder(p.owner) === null).length} of ${P0.length} are owned by a vacant seat.`,
    '',
  );

  out.push(
    '## The module scorecard',
    '',
    `Score a module 0–5 on each criterion. A module may not be called fully built until it scores at least 4 on ${FULLY_BUILT_GATE.map((g) => `\`${g}\``).join(', ')}; an unscored criterion fails. No module has been scored by a reviewer, so none may be called fully built.`,
    '',
    '| Criterion | 0 | 3 | 5 | Gates “fully built” |',
    '| --- | --- | --- | --- | --- |',
    ...SCORING.map((s) => `| ${s.criterion} | ${s.zero} | ${s.three} | ${cell(s.five)} | ${(FULLY_BUILT_GATE as readonly string[]).includes(s.id) ? 'yes' : '—'} |`),
    '',
  );

  out.push(
    '## The final checklists',
    '',
    'The questions the briefs end on, merged where they ask the same thing, each pointed at the question set the tree already answers it in rather than answered again here.',
    '',
    '| Question | Asked by | Answered in |',
    '| --- | --- | --- |',
    ...CHECKLIST.map((c) => `| ${cell(c.question)} | ${c.asks.join(', ')} | ${c.answeredIn ? ref(c.answeredIn) : '**No set asks it**'} |`),
    '',
  );
  return out.join('\n');
}
