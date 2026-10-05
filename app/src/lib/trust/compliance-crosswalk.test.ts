import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROLS as MATURITY } from '../governance/maturity';
import { COUNCIL } from '../launchreadiness';
import { REGISTER } from '../masterregister';
import { cell, controlLine, link, renderedFrom, table } from '../ops/render';
import {
  AI_OVERLAY, CEILING_WITHOUT_EVIDENCE, DECISION_STATES, DOMAINS, EDUCAUSE, EVIDENCE_DIR, FIT, INTAKE_RULE, LAUNCH_GATES, MASTER_LEVEL, MATURITY_LEVEL,
  NOT_TRIGGERED, REASSESSMENT, REGISTER_LEVEL, REQUIRED_EVIDENCE, RUBRIC_ITEMS, RUBRIC_TITLE, SCALE, SELF_TIER, SELF_TRIGGERS, SOURCES, TIERS, allRests, dashboard,
  registerOf, score,
  type Level, type Register, type Rubric, type Standing,
} from './compliance-crosswalk';

/**
 * Holds the crosswalk to the four registers it rests on: every id it names is
 * a row of the register its shape says, every score is computed from those
 * rows' statuses and never typed, the ceiling follows `docs/evidence/`, every
 * cited file exists, and the supplied PDFs are never evidence.
 *
 * `docs/trust/COMPLIANCE-CROSSWALK.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/trust/COMPLIANCE-CROSSWALK.md';
const HECVAT = 'docs/market-readiness/HECVAT_READINESS.md';
const FERPA = 'docs/FERPA-COPPA-1EDTECH-READINESS.md';

const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /\.check\.sql$/.test(p) || /^\.github\/workflows\//.test(p);

/** The `| ID | Area | Control | Status | Evidence | Moves |` rows of a readiness register. */
function registerRows(path: string): Map<string, { status: string; evidence: string[] }> {
  const out = new Map<string, { status: string; evidence: string[] }>();
  for (const line of read(path).split('\n')) {
    if (!/^\| [A-Z0-9]+-\d+ \|/.test(line)) continue;
    const [id, , , status, evidence] = line.split('|').slice(1, -1).map((c) => c.trim());
    out.set(id, { status: status.replace(/`/g, ''), evidence: [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1]) });
  }
  return out;
}

/** Every row of every register the crosswalk may name, on the 0–4 scale. */
function standings(): Map<string, Standing> {
  const out = new Map<string, Standing>();
  for (const r of REGISTER) {
    out.set(r.id, { id: r.id, register: 'master', level: MASTER_LEVEL[r.status], tested: MASTER_LEVEL[r.status] >= 2 && r.evidence.some((e) => isTest(e.path)), severity: r.severity });
  }
  for (const [path, register] of [[HECVAT, 'hecvat'], [FERPA, 'ferpa']] as const) {
    for (const [id, row] of registerRows(path)) {
      out.set(id, { id, register, level: REGISTER_LEVEL[row.status], tested: REGISTER_LEVEL[row.status] >= 2 && row.evidence.some(isTest) });
    }
  }
  for (const c of MATURITY) {
    out.set(c.id, { id: c.id, register: 'maturity', level: MATURITY_LEVEL[c.status], tested: c.evidence !== null && isTest(c.evidence) });
  }
  return out;
}

const ceiling = (): Level => (existsSync(join(root, EVIDENCE_DIR)) ? 4 : CEILING_WITHOUT_EVIDENCE);

describe('the compliance crosswalk', () => {
  const all = standings();
  const standing = (id: string): Standing => {
    const s = all.get(id);
    if (!s) throw new Error(`no row ${id}`);
    return s;
  };

  it('keeps the five supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(5);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const a of REQUIRED_EVIDENCE) if (a.path) expect(supplied.has(a.path), `${a.key} cites a supplied PDF`).toBe(false);
  });

  it('reads every register it rests on, and each says what it should', () => {
    expect(registerRows(HECVAT).get('SDLC-1')?.status).toBe('READY');
    expect(registerRows(FERPA).get('EDT-7')?.status).toBe('NOT_STARTED');
    expect(standing('IAM-008').register).toBe('master');
    // RM-03 is the fixture for an owed maturity row; RM-02 was until legal holds landed.
    expect(standing('RM-03').register).toBe('maturity');
    expect(standing('RM-03').level).toBe(0);
    expect(standing('RM-02').level).toBe(1);
    expect(all.size).toBeGreaterThan(300);
  });

  it('tells the four registers apart by the shape of an id', () => {
    const cases: [string, Register][] = [['AI-001', 'master'], ['AI-1', 'hecvat'], ['A11Y-001', 'master'], ['A11Y-1', 'hecvat'], ['IT-01', 'maturity'], ['TS-1', 'hecvat'], ['FERPA-10', 'ferpa'], ['EDT-7', 'ferpa'], ['LEGAL-2', 'hecvat']];
    for (const [id, register] of cases) expect(registerOf(id), id).toBe(register);
    for (const id of allRests()) expect(standing(id).register, `${id} is owned by ${standing(id).register}, not ${registerOf(id)}`).toBe(registerOf(id));
  });

  it('names only rows that exist, and no domain names one twice', () => {
    for (const id of allRests()) expect(all.has(id), `${id} is in no register`).toBe(true);
    for (const d of DOMAINS) expect(new Set(d.rests).size, d.id).toBe(d.rests.length);
    expect(all.has('SEC-999')).toBe(false); // the control: an invented row is noticed
  });

  it('has each domain once, with every field, on a rubric and a priority it knows', () => {
    expect(DOMAINS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(DOMAINS.map((d) => d.id)).size).toBe(DOMAINS.length);
    for (const d of DOMAINS) {
      expect(d.rests.length, d.id).toBeGreaterThanOrEqual(3);
      expect(RUBRIC_TITLE[d.rubric], d.id).toBeTruthy();
      expect(EDUCAUSE[d.educause], d.id).toBeTruthy();
      for (const f of [d.hecvat, d.trusted, d.gap, d.objective, d.evidence]) expect(f.trim().length, d.id).toBeGreaterThan(20);
    }
  });

  it('scores by the lower median, and never above the ceiling', () => {
    expect(score([])).toBe(0);
    expect(score([0, 0, 2])).toBe(0);
    expect(score([0, 2, 2])).toBe(2);
    expect(score([1, 2])).toBe(1);
    expect(score([2, 2, 2, 2], 1)).toBe(1);
    expect(score([4, 4, 4])).toBe(4);
  });

  it('holds the ceiling to the evidence directory, and a 3 to an artifact filed there', () => {
    // The AI drills of 29 September were the directory's first files, and the
    // ceiling lifted by itself. It still binds: no domain above it, and no row
    // above CEILING_WITHOUT_EVIDENCE unless it cites a file under the directory.
    expect(existsSync(join(root, EVIDENCE_DIR))).toBe(true);
    expect(ceiling()).toBe(4);
    for (const d of DOMAINS) expect(score(d.rests.map((id) => standing(id).level), ceiling()), d.id).toBeLessThanOrEqual(ceiling());
    for (const s of all.values()) {
      if (s.level <= CEILING_WITHOUT_EVIDENCE) continue;
      const row = REGISTER.find((r) => r.id === s.id);
      const filed = row?.evidence.filter((e) => e.path.startsWith(`${EVIDENCE_DIR}/`)) ?? [];
      expect(filed.length, `${s.id} is at ${s.level} and cites nothing under ${EVIDENCE_DIR}`).toBeGreaterThan(0);
      for (const e of filed) expect(existsSync(join(root, e.path)), `${s.id} cites ${e.path}`).toBe(true);
    }
  });

  it('carries every rubric item on rows that exist, and the four rubrics each have items', () => {
    for (const rubric of ['privacy', 'security', 'accessibility', 'genai'] as Rubric[]) expect(RUBRIC_ITEMS.some((i) => i.rubric === rubric), rubric).toBe(true);
    for (const i of RUBRIC_ITEMS) {
      expect(i.rests.length, i.item).toBeGreaterThan(0);
      expect(new Set(i.rests).size, i.item).toBe(i.rests.length);
    }
    expect(AI_OVERLAY).toHaveLength(12);
    for (const o of AI_OVERLAY) expect(o.rests.length, o.domain).toBeGreaterThan(0);
  });

  it('puts Semester at the highest tier any trigger reaches, and names the critical triggers that are absent', () => {
    expect(TIERS.map((t) => t.tier)).toEqual(['low', 'moderate', 'high', 'critical']);
    const order = TIERS.map((t) => t.tier);
    const highest = SELF_TRIGGERS.map((t) => t.tier).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
    expect(SELF_TIER).toBe(highest); // the tier is the highest trigger present, never a softer reading
    expect(SELF_TIER).toBe('critical');
    expect(SELF_TRIGGERS.filter((t) => t.tier === 'critical').length).toBeGreaterThan(0);
    expect(SELF_TRIGGERS.length).toBeGreaterThanOrEqual(4);
    expect(NOT_TRIGGERED.length).toBeGreaterThanOrEqual(4);
    for (const t of [...SELF_TRIGGERS, ...NOT_TRIGGERED]) expect(t.rows.length, t.trigger).toBeGreaterThan(0);
    // The critical tier owes more than the high tier: the package carries its four additions.
    for (const key of ['dpia_or_pia', 'threat_model', 'legal_review', 'executive_risk_acceptance']) expect(REQUIRED_EVIDENCE.some((a) => a.key === key), key).toBe(true);
  });

  it('cites a file for every artifact it says it has or has drafted, and none for one it lacks', () => {
    expect(REQUIRED_EVIDENCE.length).toBeGreaterThanOrEqual(18);
    for (const a of REQUIRED_EVIDENCE) {
      expect(/^[a-z0-9_]+$/.test(a.key), a.key).toBe(true);
      if (a.have === 'none') expect(a.path, a.key).toBeNull();
      else {
        expect(a.path, a.key).not.toBeNull();
        expect(existsSync(join(root, a.path!)), `${a.key} cites ${a.path}`).toBe(true);
      }
      expect(a.note.trim().length, a.key).toBeGreaterThan(20);
    }
    expect(REQUIRED_EVIDENCE.some((a) => a.have === 'none')).toBe(true);
    // Nothing that only a third party can produce may be marked `have`.
    for (const a of REQUIRED_EVIDENCE.filter((a) => /penetration|ACR|VPAT|TrustEd|HECVAT|legal review|risk acceptance|DPIA/i.test(a.artifact))) expect(a.have, a.key).not.toBe('have');
    // The security-contact note says the security seat is vacant; it must go when the seat is filled.
    const contact = REQUIRED_EVIDENCE.find((a) => a.key === 'security_contact')!;
    expect(contact.note).toMatch(/security seat is vacant/);
    expect(COUNCIL.find((c) => c.seat === 'security')?.holder, 'the security seat is held; security_contact must say so').toBeNull();
  });

  it('states the intake rule, the five decision states and the reassessment triggers', () => {
    expect(INTAKE_RULE).toMatch(/never marked approved merely/);
    expect(DECISION_STATES.map((d) => d.state)).toEqual(['Approved', 'Approved with conditions', 'Pilot only', 'Deferred', 'Not approved']);
    expect(REASSESSMENT).toHaveLength(5);
    expect(FIT).toHaveLength(6);
    expect(LAUNCH_GATES).toHaveLength(11);
  });

  it('computes four dashboard values and refuses to fold them into one', () => {
    const rows = allRests().map(standing);
    const d = dashboard(rows);
    expect(d.rows).toBe(rows.length);
    expect(d.evidence).toBe(rows.filter((r) => r.level >= 3).length); // a row at 3 cites a filed artifact (above)
    expect(d.implementation).toBeGreaterThan(0);
    expect(d.effectiveness).toBeLessThanOrEqual(d.implementation);
    expect(d.risk).toBeGreaterThan(0);
    expect(Object.keys(d).sort()).toEqual(['effectiveness', 'evidence', 'implementation', 'risk', 'rows']);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render(all);
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const REGISTER_PATH: Record<Register, string> = {
  master: 'docs/MASTER-LAUNCH-READINESS-REGISTER.md',
  hecvat: HECVAT,
  ferpa: FERPA,
  maturity: 'docs/operating-model/OPERATIONAL-MATURITY.md',
};

function render(all: Map<string, Standing>): string {
  const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
  const s = (id: string) => all.get(id)!;
  const cap = ceiling();
  const domainScore = (rests: readonly string[]) => score(rests.map((id) => s(id).level), cap);
  const withLevel = (ids: readonly string[]) => ids.map((id) => `${id} (${s(id).level})`).join(', ');
  const carried = (ids: readonly string[]) => {
    const best = Math.max(...ids.map((id) => s(id).level));
    return best >= 2 ? 'carried' : best === 1 ? 'partly' : 'not carried';
  };
  const byRegister = (register: Register) => allRests().map(s).filter((x) => x.register === register);
  const pct = (n: number, of: number) => (of === 0 ? '—' : `${n} of ${of}`);
  const dash = (rows: readonly Standing[]) => {
    const d = dashboard(rows);
    return [String(d.rows), pct(d.implementation, d.rows), pct(d.evidence, d.rows), pct(d.effectiveness, d.rows), String(d.risk)];
  };
  const scores = DOMAINS.map((d) => domainScore(d.rests));
  const count = (l: Level) => scores.filter((x) => x === l).length;
  const overlapTitle = { high: 'High', 'medium-high': 'Medium-high', medium: 'Medium' };
  const haveTitle = { have: 'Have', draft: 'Draft', none: 'None' };
  const gateLevel = (rests: readonly string[]) => domainScore(rests);

  const out: string[] = [
    '# Compliance crosswalk: HECVAT 4, 1EdTech TrustEd Apps and EDUCAUSE 2026',
    '',
    renderedFrom('app/src/lib/trust/compliance-crosswalk.ts', 'compliance-crosswalk.test.ts'),
    '',
    controlLine(DOC),
    '',
    '**HECVAT is a questionnaire and the TrustEd Apps rubrics are self-assessments;',
    'neither is a certification, and Semester has completed neither.** This page',
    'is one control library with three views, the way five documents of',
    '28 September 2026 ask for it, and every score on it is computed by the test',
    'from the four registers the repository already keeps. A score cannot be typed',
    'here. The documents are kept under `docs/expansion/` as supplied; none is',
    'cited as evidence of anything.',
    '',
    ...table(['Supplied document', 'What it holds'], SOURCES.map((x) => [`[${cell(x.title)}](${link(DOC, x.path)})`, cell(x.what)])),
    '',
    '## The scale, and the ceiling',
    '',
    ...table(['Score', 'Meaning'], (Object.keys(SCALE) as unknown as Level[]).map((l) => [String(l), SCALE[l]])),
    '',
    `A 3 needs an artifact somebody produced by operating the control. The master`,
    `register keeps those under \`${EVIDENCE_DIR}/\`, ${cap === 4 ? 'which holds the AI drills of 29 September,' : 'and the directory does not exist,'}`,
    `so **the ceiling today is ${cap}** for every domain, held by the test to the`,
    `directory rather than to this sentence. A domain's score is the lower median of`,
    `its rows' levels: the level the middle row reaches, so one tested row cannot`,
    `carry a domain and one owed row cannot sink it. Rows read on the scale as:`,
    '',
    ...table(
      ['Register', 'Its statuses, on the 0–4 scale'],
      [
        [ref(REGISTER_PATH.master), Object.entries(MASTER_LEVEL).map(([k, v]) => `${k} → ${v}`).join(', ')],
        [`${ref(REGISTER_PATH.hecvat)} and ${ref(REGISTER_PATH.ferpa)}`, Object.entries(REGISTER_LEVEL).map(([k, v]) => `${k} → ${v}`).join(', ')],
        [ref(REGISTER_PATH.maturity), Object.entries(MATURITY_LEVEL).map(([k, v]) => `${k} → ${v}`).join(', ')],
      ],
    ),
    '',
    '`tested` and `READY` are 2, not 3: a test that runs on every change proves the',
    'control is implemented, and says nothing about whether anybody operates it.',
    '',
    '## The scorecard',
    '',
    `Statuses were read at main commit 7476aca on 28 September 2026. ${DOMAINS.length} domains:`,
    `${count(0)} at 0, ${count(1)} at 1, ${count(2)} at 2, none above the ceiling.`,
    '',
    ...table(
      ['Domain', 'Score', 'Overlap', 'TrustEd rubric', 'EDUCAUSE 2026', 'Rests on (level)'],
      DOMAINS.map((d) => [`**${d.title}**`, String(domainScore(d.rests)), overlapTitle[d.overlap], RUBRIC_TITLE[d.rubric], EDUCAUSE[d.educause], withLevel(d.rests)]),
      ['left', 'right'],
    ),
    '',
    '## The crosswalk',
    '',
    'What each instrument asks of the domain, where the two overlap, the coverage',
    'gap to manage between them, and the objective and evidence the domain is held to.',
    '',
    ...table(
      ['Domain', 'HECVAT 4', '1EdTech TrustEd Apps', 'Gap to manage', 'Semester objective', 'Evidence required'],
      DOMAINS.map((d) => [`**${d.title}**`, cell(d.hecvat), cell(d.trusted), cell(d.gap), cell(d.objective), cell(d.evidence)]),
    ),
    '',
    '## Three views, four values',
    '',
    'The documents’ rule: a dashboard shows four values and never one “compliance',
    'percentage”. Implementation is rows at 2 or above; evidence is rows at 3 or',
    'above; effectiveness is rows an automated test runs on every change; risk is',
    'master rows at P0 not yet tested. Per register, over every row this page names:',
    '',
    ...table(
      ['View', 'Rows', 'Implementation', 'Evidence', 'Effectiveness', 'Risk (open P0)'],
      [
        ...(['hecvat', 'ferpa', 'master', 'maturity'] as Register[]).map((reg) => [ref(REGISTER_PATH[reg]), ...dash(byRegister(reg))]),
        ['**All**', ...dash(allRests().map(s))],
      ],
      ['left', 'right', 'right', 'right', 'right', 'right'],
    ),
    '',
    '## The TrustEd Apps rubrics, item by item',
    '',
    '**Carried** when a row it rests on is at 2; **partly** when the best row is at',
    '1; **not carried** otherwise. The exact rubric version is confirmed with',
    '1EdTech before any submission; this is the internal read.',
    '',
  ];

  for (const rubric of ['privacy', 'security', 'accessibility', 'genai'] as Rubric[]) {
    const items = RUBRIC_ITEMS.filter((i) => i.rubric === rubric);
    const n = (k: string) => items.filter((i) => carried(i.rests) === k).length;
    out.push(
      `### ${RUBRIC_TITLE[rubric]}`,
      '',
      `${items.length} items: ${n('carried')} carried, ${n('partly')} partly, ${n('not carried')} not carried.`,
      '',
      ...table(['Section', 'Item', 'Rests on (level)', 'Standing'], items.map((i) => [i.section, cell(i.item), withLevel(i.rests), carried(i.rests)])),
      '',
    );
  }

  out.push(
    '## The AI governance overlay',
    '',
    'An internal overlay across HECVAT’s AI section, the Generative AI Data Rubric',
    'and Semester’s own controls. The NIST AI RMF matrix behind it is',
    `${ref('docs/operating-model/AI-ASSURANCE.md')}.`,
    '',
    ...table(
      ['AI domain', 'HECVAT-oriented control', 'TrustEd-oriented control', 'Semester requirement', 'Rests on (level)', 'Standing'],
      AI_OVERLAY.map((o) => [`**${o.domain}**`, cell(o.hecvat), cell(o.trusted), cell(o.semester), withLevel(o.rests), carried(o.rests)]),
    ),
    '',
    '## Semester, through a university’s own intake',
    '',
    'The intake policy among the sources is written for a campus to apply to any',
    'vendor. Applied to Semester:',
    '',
    ...table(['Tier', 'Trigger', 'Review'], TIERS.map((t) => [`**${t.tier}**`, cell(t.trigger), cell(t.review)])),
    '',
    `**Semester is a \`${SELF_TIER}\`-tier vendor.** A tier is the highest trigger present, and these are present:`,
    '',
    ...SELF_TRIGGERS.map((t) => `- **${t.trigger}** (${t.tier}). ${t.because} (${withLevel(t.rows)})`),
    '',
    'The other critical triggers are absent, for reasons that are each a row and are re-read when the row changes:',
    '',
    ...NOT_TRIGGERED.map((t) => `- **${t.trigger}.** ${t.why} (${withLevel(t.rows)})`),
    '',
    `### The evidence package a ${SELF_TIER}-tier vendor owes`,
    '',
    `${REQUIRED_EVIDENCE.filter((a) => a.have === 'have').length} have, ${REQUIRED_EVIDENCE.filter((a) => a.have === 'draft').length} drafted,`,
    `${REQUIRED_EVIDENCE.filter((a) => a.have === 'none').length} none, of ${REQUIRED_EVIDENCE.length}. Nothing a third party produces is`,
    'marked *have*, by test. The last four are what the critical tier adds to the',
    'high tier’s package: an impact assessment, a threat model, legal review and',
    'executive risk acceptance with periodic re-review.',
    '',
    ...table(
      ['Artifact', 'Key', 'Standing', 'Where', 'Note'],
      REQUIRED_EVIDENCE.map((a) => [cell(a.artifact), `\`${a.key}\``, haveTitle[a.have], a.path ? ref(a.path) : '—', cell(a.note)]),
    ),
    '',
    '### The launch gates',
    '',
    'What a high- or critical-tier service must have before it goes live, each',
    'resting on rows and scored the same way as a domain.',
    '',
    ...table(['Gate', 'Rests on (level)', 'Score'], LAUNCH_GATES.map((g) => [cell(g.gate), withLevel(g.rests), String(gateLevel(g.rests))]), ['left', 'left', 'right']),
    '',
    '### Decision states, and the rule',
    '',
    ...table(['Outcome', 'Meaning'], DECISION_STATES.map((d) => [`**${d.state}**`, cell(d.meaning)])),
    '',
    `> ${INTAKE_RULE}`,
    '',
    'Reassessment is owed:',
    '',
    ...REASSESSMENT.map((x) => `- ${x}`),
    '',
    `The quarterly proofs that would carry it are on ${ref('docs/PROOF-CALENDAR.md')}.`,
    '',
    '### Which instrument fits which situation',
    '',
    ...table(['Situation', 'HECVAT Full', 'HECVAT Lite', '1EdTech TrustEd Apps', 'Recommended decision'], FIT.map((f) => [cell(f.situation), cell(f.full), cell(f.lite), cell(f.trusted), cell(f.decision)])),
    '',
    '## What would move the scores',
    '',
    cap === 4
      ? `- **${EVIDENCE_DIR}/.** The AI drills of 29 September lifted the ceiling to 4; a row reaches 3 by citing an artifact filed there, and the proof calendar names the next twelve.`
      : `- **${EVIDENCE_DIR}/.** The first artifact filed there lifts the ceiling from ${cap} to 4 and makes a 3 possible; the proof calendar names the first twelve.`,
    `- **A domain at 0** has its middle row at *not started* or *owed*: ${DOMAINS.filter((d) => domainScore(d.rests) === 0).map((d) => d.title.toLowerCase()).join('; ') || 'none today'}.`,
    '- **A domain at 1** has a middle row *in progress* or *designed*: the rows',
    '  above name which, and the register that owns the row names what moves it.',
    `- **The evidence package.** Four artifacts only a third party can produce (an`,
    '  ACR, a penetration test, a signed DPA, a TrustEd review) and two the company',
    '  writes in an afternoon (a security contact, an accessibility statement).',
    '',
    'This page names rows and never changes them. To move a score, move the row in',
    'the register that owns it, with the evidence the register demands.',
    '',
  );
  return out.join('\n');
}
