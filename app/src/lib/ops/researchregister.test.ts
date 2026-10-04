import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DECISION_CLASSES,
  LEVELS,
  MINIMUM,
  SOURCE_CLASSES,
  ceilingFor,
  validateRegister,
  type Insight,
  type Level,
  type Register,
  type Source,
} from './researchregister';

/**
 * The research pack held to its own rules. `docs/research/` says an opinion is
 * not evidence; this is what makes a register that says otherwise fail.
 *
 * The second half builds registers that are wrong in one way each and asserts
 * the matching rule fires. That is the guard's own proof: a rule that has never
 * failed is not known to be a rule.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const DIR = at('docs/research');
const REGISTER = JSON.parse(readFileSync(join(DIR, 'repository/register.json'), 'utf8')) as Register;
const CAPS = (
  JSON.parse(readFileSync(at('docs/market-readiness/CAPABILITY-STATUS-REGISTRY.json'), 'utf8')) as {
    capabilities: { id: string }[];
  }
).capabilities.map((c) => c.id);
const ctx = { capabilityIds: CAPS, fileExists: (p: string) => existsSync(at(p)) };
const clone = (): Register => structuredClone(REGISTER);
const codes = (r: Register) => validateRegister(r, ctx).map((e) => e.split(':')[0]);

const src = (over: Partial<Source> & Pick<Source, 'cls'>): Source => ({
  id: 'SRC-1',
  route: 'cold',
  origin: 'o1',
  n: 1,
  round: 'r1',
  ...over,
});
const ins = (sources: Source[], disconfirmationSearched = false) => ({ sources, disconfirmationSearched });

describe('the seeded register', () => {
  it('is valid', () => {
    expect(validateRegister(REGISTER, ctx)).toEqual([]);
  });

  it('starts honestly: nothing is above C0 until an insight supports it', () => {
    for (const a of REGISTER.assumptions) {
      if (a.insights.length === 0) expect(a.confidence, a.id).toBe('C0');
    }
    for (const d of REGISTER.decisions) {
      if (d.status === 'open') continue;
      expect(d.bet || d.assumptions.every((id) => REGISTER.assumptions.find((a) => a.id === id)?.confidence !== 'C0'), d.id).toBeTruthy();
    }
  });

  it('covers every stakeholder group and every audit surface', () => {
    const v = REGISTER.vocabulary;
    expect(v.stakeholders).toHaveLength(12);
    for (const s of v.stakeholders) expect(REGISTER.assumptions.some((a) => a.stakeholder === s), s).toBe(true);
    for (const s of v.auditSurfaces) expect(REGISTER.assumptions.some((a) => a.scope === s), s).toBe(true);
  });

  it('uses only the moments the product already asks about', () => {
    const src = readFileSync(at('app/src/lib/momentfeedback.ts'), 'utf8');
    for (const m of REGISTER.vocabulary.moments) expect(src, m).toContain(`'${m}'`);
  });
});

describe('the ceiling an insight can reach', () => {
  const cases: [string, Level, ReturnType<typeof ins>][] = [
    ['one opinion', 'C0', ins([src({ cls: 'opinion' })])],
    ['forty opinions from one champion', 'C0', ins([src({ cls: 'opinion', n: 40 })])],
    ['opinion and desk from two origins', 'C1', ins([src({ cls: 'opinion', origin: 'a' }), src({ cls: 'desk', origin: 'b' })])],
    ['one interview', 'C1', ins([src({ cls: 'self-report' })])],
    ['two origins, four people', 'C1', ins([src({ cls: 'self-report', origin: 'a', n: 2 }), src({ cls: 'self-report', origin: 'b', n: 2 })])],
    ['two origins, five people, all said', 'C2', ins([src({ cls: 'self-report', origin: 'a', n: 3 }), src({ cls: 'self-report', origin: 'b', n: 2 })])],
    ['twenty interviews, never observed', 'C2', ins([src({ cls: 'self-report', origin: 'a', n: 10, round: 'r1' }), src({ cls: 'self-report', origin: 'b', n: 10, round: 'r2' })], true)],
    ['said and observed but one round', 'C2', ins([src({ cls: 'self-report', origin: 'a', n: 3 }), src({ cls: 'observed-use', origin: 'b', n: 3 })], true)],
    ['said and observed, no disconfirmation search', 'C2', ins([src({ cls: 'self-report', origin: 'a', n: 3, round: 'r1' }), src({ cls: 'observed-use', origin: 'b', n: 3, round: 'r2' })], false)],
    ['said and observed, all warm', 'C2', ins([src({ cls: 'self-report', origin: 'a', n: 3, round: 'r1', route: 'warm' }), src({ cls: 'observed-use', origin: 'b', n: 3, round: 'r2', route: 'warm' })], true)],
    ['said and observed, two rounds, searched', 'C3', ins([src({ cls: 'self-report', origin: 'a', n: 3, round: 'r1' }), src({ cls: 'observed-use', origin: 'b', n: 3, round: 'r2' })], true)],
    ['a commitment counts as the do', 'C3', ins([src({ cls: 'self-report', origin: 'a', n: 3, round: 'r1' }), src({ cls: 'commitment', origin: 'b', n: 3, round: 'r2' })], true)],
    ['outcome with no denominator', 'C1', ins([src({ cls: 'measured-outcome', method: 'pre-registered' })])],
    ['outcome with method and denominator', 'C4', ins([src({ cls: 'measured-outcome', method: 'pre-registered', denominator: 'panel of 10' })])],
  ];
  for (const [name, want, i] of cases) it(`${name} -> ${want}`, () => expect(ceilingFor(i)).toBe(want));
});

describe('each rule fires on a register built to break it', () => {
  const insight = (over: Partial<Insight> = {}): Insight => ({
    id: 'INS-001',
    statement: 'A claim about people.',
    type: 'need',
    stakeholder: 'student',
    scope: 'daily-planning',
    confidence: 'C1',
    sources: [src({ cls: 'self-report' })],
    disconfirmationSearched: false,
    supports: ['ASM-005'],
    ...over,
  });

  it('refuses an insight that claims more than its sources support', () => {
    const r = clone();
    r.insights.push(insight({ confidence: 'C3' }));
    expect(codes(r)).toContain('INSIGHT-OVERCLAIMS');
  });

  it('refuses an opinion promoted to C2 by repetition', () => {
    const r = clone();
    r.insights.push(insight({ confidence: 'C2', reviewBy: '2027-01-01', sources: [src({ cls: 'opinion', n: 40 })] }));
    expect(codes(r)).toContain('INSIGHT-OVERCLAIMS');
  });

  it('refuses C2 with no review date, and C2 past its review date', () => {
    const base = { confidence: 'C2' as const, sources: [src({ cls: 'self-report', origin: 'a', n: 3 }), src({ cls: 'self-report', origin: 'b', n: 2 })] };
    const none = clone();
    none.insights.push(insight(base));
    expect(codes(none)).toContain('INSIGHT-NO-EXPIRY');
    const old = clone();
    old.insights.push(insight({ ...base, reviewBy: '2026-01-01' }));
    expect(codes(old)).toContain('INSIGHT-EXPIRED');
  });

  it('refuses an assumption above its best linked insight', () => {
    const r = clone();
    r.assumptions[0]!.confidence = 'C2';
    expect(codes(r)).toContain('ASSUMPTION-OVERCLAIMS');
  });

  it('refuses an assumption with no kill criterion or no test', () => {
    const r = clone();
    r.assumptions[0]!.kill = ' ';
    r.assumptions[1]!.test.methods = [];
    expect(codes(r)).toEqual(expect.arrayContaining(['ASSUMPTION-NO-KILL', 'ASSUMPTION-NO-TEST']));
  });

  it('refuses a decided hard-to-reverse decision on C0 evidence with no bet', () => {
    const r = clone();
    const d = r.decisions.find((x) => x.cls === 'hard-to-reverse')!;
    d.status = 'decided';
    d.record = 'docs/decisions/D-1144.md';
    expect(codes(r)).toContain('DECISION-OUTRUNS-EVIDENCE');
  });

  it('allows the same decision as a complete bet, and refuses it when the bet is hollow or stale', () => {
    const decide = (bet: Register['decisions'][number]['bet']) => {
      const r = clone();
      const d = r.decisions.find((x) => x.cls === 'hard-to-reverse')!;
      d.status = 'decided';
      d.record = 'docs/decisions/D-1144.md';
      if (bet) d.bet = bet;
      return codes(r);
    };
    const full = { gap: 'C0, nothing observed', kill: 'Two of five decline', owner: 'product', reviewBy: '2026-12-01' };
    expect(decide(full)).not.toContain('DECISION-OUTRUNS-EVIDENCE');
    expect(decide({ ...full, kill: '' })).toContain('DECISION-OUTRUNS-EVIDENCE');
    expect(decide({ ...full, reviewBy: '2026-01-01' })).toContain('BET-EXPIRED');
  });

  it('refuses a decided hard-to-reverse decision with no decision file', () => {
    const r = clone();
    const d = r.decisions.find((x) => x.cls === 'hard-to-reverse')!;
    d.status = 'decided';
    d.bet = { gap: 'g', kill: 'k', owner: 'o', reviewBy: '2026-12-01' };
    expect(codes(r)).toContain('DECISION-NO-RECORD');
    d.record = 'docs/decisions/D-0.md';
    expect(codes(r)).toContain('DECISION-NO-RECORD');
  });

  it('asks C4 of an outcome assumption behind a claim, where a need would need C3', () => {
    const r = clone();
    const outcome = r.assumptions.find((a) => a.type === 'outcome')!;
    r.insights.push(
      insight({
        id: 'INS-009',
        confidence: 'C3',
        reviewBy: '2027-01-01',
        disconfirmationSearched: true,
        supports: [outcome.id],
        sources: [src({ cls: 'self-report', origin: 'a', n: 3, round: 'r1' }), src({ cls: 'observed-use', origin: 'b', n: 3, round: 'r2' })],
      }),
    );
    outcome.insights = ['INS-009'];
    outcome.confidence = 'C3';
    const d = r.decisions.find((x) => x.cls === 'claim')!;
    d.status = 'decided';
    d.record = 'docs/decisions/D-1144.md';
    expect(codes(r)).toContain('DECISION-OUTRUNS-EVIDENCE');
  });

  it('refuses unknown tags, unknown scopes and broken links', () => {
    const r = clone();
    r.assumptions[0]!.stakeholder = 'investor';
    r.assumptions[1]!.scope = 'not-a-capability';
    r.assumptions[2]!.insights = ['INS-404'];
    r.decisions[0]!.assumptions = ['ASM-404'];
    expect(codes(r)).toEqual(expect.arrayContaining(['TAG-STAKEHOLDER', 'TAG-SCOPE', 'LINK-BROKEN']));
  });

  it('refuses a duplicate id and a malformed one', () => {
    const r = clone();
    r.assumptions[1]!.id = r.assumptions[0]!.id;
    r.assumptions[2]!.id = 'A-3';
    expect(codes(r)).toEqual(expect.arrayContaining(['ID-DUPLICATE', 'ID-SHAPE']));
  });

  it('refuses a stakeholder or surface with nothing registered against it', () => {
    const r = clone();
    r.assumptions = r.assumptions.filter((a) => a.stakeholder !== 'alumni' && a.scope !== 'marketplace');
    r.decisions = [];
    expect(codes(r)).toEqual(expect.arrayContaining(['COVERAGE-STAKEHOLDER', 'COVERAGE-SURFACE']));
  });

  it('keeps people out: no email, no phone number, no long free text', () => {
    const r = clone();
    r.assumptions[0]!.statement = 'Said by someone@example.edu';
    r.assumptions[1]!.statement = 'Call 615 555 0100 for detail';
    r.assumptions[2]!.statement = 'x'.repeat(401);
    expect(codes(r)).toEqual(expect.arrayContaining(['PII-EMAIL', 'PII-PHONE', 'PII-LONG-TEXT']));
  });
});

describe('the pack and the vocabulary agree', () => {
  const read = (f: string) => readFileSync(join(DIR, f), 'utf8');
  const model = read('01-EVIDENCE-MODEL.md');

  it('names every level, source class, decision class, stakeholder and insight type', () => {
    for (const l of LEVELS) expect(model, l).toContain(`**${l}**`);
    for (const c of SOURCE_CLASSES) expect(model, c).toContain(`\`${c}\``);
    for (const c of DECISION_CLASSES) expect(model, c).toContain(`\`${c}\``);
    for (const s of REGISTER.vocabulary.stakeholders) expect(model, s).toContain(`\`${s}\``);
    for (const t of REGISTER.vocabulary.insightTypes) expect(model, t).toContain(`\`${t}\``);
  });

  it('states the minimum levels the code enforces', () => {
    const row = (c: string) => model.split('\n').find((l) => l.startsWith(`| \`${c}\``)) ?? '';
    expect(row('internal-reversible')).toContain(`**${MINIMUM['internal-reversible']}**`);
    expect(row('user-reversible')).toContain(`**${MINIMUM['user-reversible']}**`);
    expect(row('hard-to-reverse')).toContain(`**${MINIMUM['hard-to-reverse']}**`);
    expect(row('claim')).toContain(`**${MINIMUM.claim}**`);
    expect(row('claim')).toContain('**C4**');
  });

  it('links only to files that exist', () => {
    for (const name of readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
      for (const [, target] of read(name).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^https?:/.test(target!)) continue;
        expect(existsSync(resolve(DIR, target!)), `${name} -> ${target}`).toBe(true);
      }
    }
  });

  it('cites only register ids that exist', () => {
    const known = new Map(REGISTER.assumptions.map((a) => [a.id, a]));
    const decisions = new Set(REGISTER.decisions.map((d) => d.id));
    for (const name of readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
      const text = read(name);
      for (const [id] of text.matchAll(/ASM-\d{3}/g)) expect(known.has(id), `${name} cites ${id}`).toBe(true);
      for (const [id] of text.matchAll(/DEC-\d{3}/g)) expect(decisions.has(id), `${name} cites ${id}`).toBe(true);
    }
  });

  it('lists every audit surface in the audit-validation page', () => {
    const page = read('05-AUDIT-VALIDATION.md');
    for (const s of REGISTER.vocabulary.auditSurfaces) expect(page, s).toContain(`\`${s}\``);
  });
});
