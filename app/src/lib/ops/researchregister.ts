/**
 * The research register's rules, as code.
 *
 * `docs/research/01-EVIDENCE-MODEL.md` says an opinion is evidence about the
 * person who holds it and not about the product. A sentence like that is
 * held by nothing until a file can fail because of it. This is the file.
 *
 * It does three things and nothing else:
 *
 * 1. **Computes the highest confidence an insight's sources can support**
 *    (`ceilingFor`) and refuses a declared level above it. Seven people
 *    saying the same thing in interviews is still C2; it takes an observed or
 *    committed source, a disconfirmation search and a second round to reach C3.
 * 2. **Refuses a decision that outruns its evidence.** A decision marked
 *    `decided` needs every assumption it rests on at the minimum level for its
 *    class, or a bet that names the gap, the kill criterion, an owner and a
 *    review date that has not passed.
 * 3. **Keeps people out of the repository.** The register holds coarse tags
 *    only, so any email, phone-shaped number or long free text is an error.
 *
 * It takes plain objects, not the file, so a test can hand it a register built
 * to be wrong and watch the right rule fire. A rule that has never failed is
 * not known to be a rule.
 */

export const LEVELS = ['C0', 'C1', 'C2', 'C3', 'C4'] as const;
export type Level = (typeof LEVELS)[number];

export const SOURCE_CLASSES = [
  'measured-outcome',
  'observed-use',
  'commitment',
  'self-report',
  'artifact',
  'opinion',
  'desk',
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

const WEAK: readonly SourceClass[] = ['opinion', 'desk'];
const BEHAVIOURAL: readonly SourceClass[] = ['observed-use', 'commitment'];

export const DECISION_CLASSES = ['internal-reversible', 'user-reversible', 'hard-to-reverse', 'claim'] as const;
export type DecisionClass = (typeof DECISION_CLASSES)[number];

/** Minimum level per class. `claim` is C3 for need or adoption and C4 for an outcome. */
export const MINIMUM: Record<DecisionClass, Level> = {
  'internal-reversible': 'C1',
  'user-reversible': 'C2',
  'hard-to-reverse': 'C3',
  claim: 'C3',
};

export const rank = (l: Level): number => LEVELS.indexOf(l);

export interface Source {
  id: string;
  cls: SourceClass;
  route: 'warm' | 'cold' | 'institutional' | 'inbound';
  /** Sources sharing an origin (one champion, one list, one session) count once. */
  origin: string;
  /** Distinct participants behind the source. */
  n: number;
  /** A study round or cohort, so replication can be told from repetition. */
  round: string;
  /** Required for `measured-outcome`. */
  method?: string;
  denominator?: string;
}

export interface Insight {
  id: string;
  statement: string;
  type: string;
  stakeholder: string;
  scope: string;
  moment?: string;
  confidence: Level;
  sources: Source[];
  disconfirmationSearched: boolean;
  reviewBy?: string;
  supports: string[];
}

export interface Assumption {
  id: string;
  statement: string;
  origin: { cls: SourceClass; where: string };
  stakeholder: string;
  type: string;
  scope: string;
  moment?: string;
  confidence: Level;
  insights: string[];
  test: { methods: string[]; study: string };
  kill: string;
}

export interface Bet {
  gap: string;
  kill: string;
  owner: string;
  reviewBy: string;
}

export interface Decision {
  id: string;
  title: string;
  cls: DecisionClass;
  status: 'open' | 'decided';
  assumptions: string[];
  bet?: Bet;
  /** Required once a hard-to-reverse or claim decision is `decided`: `docs/decisions/D-<n>.md`. */
  record?: string;
}

export interface Vocabulary {
  stakeholders: string[];
  insightTypes: string[];
  moments: string[];
  routes: string[];
  auditSurfaces: string[];
  extraScopes: string[];
  methods: string[];
}

export interface Register {
  schemaVersion: number;
  asOf: string;
  vocabulary: Vocabulary;
  assumptions: Assumption[];
  insights: Insight[];
  decisions: Decision[];
}

export interface Context {
  capabilityIds: readonly string[];
  fileExists: (repoPath: string) => boolean;
}

/**
 * The highest level these sources can support. Pure, so the doc's table and
 * this function can be argued about in one place.
 */
export function ceilingFor(i: Pick<Insight, 'sources' | 'disconfirmationSearched'>): Level {
  const strong = i.sources.filter((s) => !WEAK.includes(s.cls));
  const weakOrigins = new Set(i.sources.filter((s) => WEAK.includes(s.cls)).map((s) => s.origin));

  if (strong.length === 0) return weakOrigins.size >= 2 ? 'C1' : 'C0';

  const outcome = strong.some(
    (s) => s.cls === 'measured-outcome' && Boolean(s.method?.trim()) && Boolean(s.denominator?.trim()),
  );
  if (outcome) return 'C4';

  const origins = new Set(strong.map((s) => s.origin));
  const people = strong.reduce((n, s) => n + s.n, 0);
  if (origins.size < 2 || people < 5) return 'C1';

  const sayDo = strong.some((s) => BEHAVIOURAL.includes(s.cls));
  const rounds = new Set(strong.map((s) => s.round));
  const warmOnly = strong.every((s) => s.route === 'warm');
  if (sayDo && i.disconfirmationSearched && rounds.size >= 2 && !warmOnly) return 'C3';
  return 'C2';
}

const EMAIL = /@/;
const PHONE = /(?:\+?\d[\s().-]*){10,}/;
const MAX_TEXT = 400;

function* strings(v: unknown, path: string): Generator<[string, string]> {
  if (typeof v === 'string') yield [path, v];
  else if (Array.isArray(v)) for (const [k, x] of v.entries()) yield* strings(x, `${path}[${k}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* strings(x, `${path}.${k}`);
}

/** Every rule failure, each prefixed with a stable code. An empty list is a valid register. */
export function validateRegister(reg: Register, ctx: Context): string[] {
  const errors: string[] = [];
  const err = (code: string, msg: string) => errors.push(`${code}: ${msg}`);
  const v = reg.vocabulary;
  const scopes = new Set([...ctx.capabilityIds, ...v.auditSurfaces, ...v.extraScopes]);

  const ids = [...reg.assumptions, ...reg.insights, ...reg.decisions].map((x) => x.id);
  for (const id of new Set(ids.filter((x, k) => ids.indexOf(x) !== k))) err('ID-DUPLICATE', id);

  const idShape: [string, RegExp, { id: string }[]][] = [
    ['ASM', /^ASM-\d{3}$/, reg.assumptions],
    ['INS', /^INS-\d{3}$/, reg.insights],
    ['DEC', /^DEC-\d{3}$/, reg.decisions],
  ];
  for (const [kind, re, rows] of idShape) for (const r of rows) if (!re.test(r.id)) err('ID-SHAPE', `${kind} ${r.id}`);

  const insightById = new Map(reg.insights.map((i) => [i.id, i]));
  const assumptionById = new Map(reg.assumptions.map((a) => [a.id, a]));

  const tagged = (r: { id: string; stakeholder: string; type: string; scope: string; moment?: string }) => {
    if (!v.stakeholders.includes(r.stakeholder)) err('TAG-STAKEHOLDER', `${r.id}: ${r.stakeholder}`);
    if (!v.insightTypes.includes(r.type)) err('TAG-TYPE', `${r.id}: ${r.type}`);
    if (!scopes.has(r.scope)) err('TAG-SCOPE', `${r.id}: ${r.scope}`);
    if (r.moment && !v.moments.includes(r.moment)) err('TAG-MOMENT', `${r.id}: ${r.moment}`);
  };

  for (const i of reg.insights) {
    tagged(i);
    const ceiling = ceilingFor(i);
    if (rank(i.confidence) > rank(ceiling)) {
      err('INSIGHT-OVERCLAIMS', `${i.id} declares ${i.confidence}, its sources support at most ${ceiling}`);
    }
    for (const s of i.sources) {
      if (!v.routes.includes(s.route)) err('TAG-ROUTE', `${i.id}/${s.id}: ${s.route}`);
      if (!SOURCE_CLASSES.includes(s.cls)) err('TAG-CLASS', `${i.id}/${s.id}: ${s.cls}`);
    }
    if (rank(i.confidence) >= rank('C2')) {
      if (!i.reviewBy) err('INSIGHT-NO-EXPIRY', `${i.id} is ${i.confidence} with no reviewBy`);
      else if (i.reviewBy < reg.asOf) err('INSIGHT-EXPIRED', `${i.id} reviewBy ${i.reviewBy} is before ${reg.asOf}`);
    }
    for (const a of i.supports) if (!assumptionById.has(a)) err('LINK-BROKEN', `${i.id} supports unknown ${a}`);
  }

  for (const a of reg.assumptions) {
    tagged(a);
    if (!SOURCE_CLASSES.includes(a.origin.cls)) err('TAG-CLASS', `${a.id} origin: ${a.origin.cls}`);
    if (!a.kill.trim()) err('ASSUMPTION-NO-KILL', a.id);
    for (const m of a.test.methods) if (!v.methods.includes(m)) err('TAG-METHOD', `${a.id}: ${m}`);
    if (a.test.methods.length === 0) err('ASSUMPTION-NO-TEST', a.id);
    const linked = a.insights.map((id) => insightById.get(id));
    for (const [k, l] of linked.entries()) if (!l) err('LINK-BROKEN', `${a.id} cites unknown ${a.insights[k]}`);
    const best = linked.reduce<Level>((m, l) => (l && rank(l.confidence) > rank(m) ? l.confidence : m), 'C0');
    if (rank(a.confidence) > rank(best)) {
      err('ASSUMPTION-OVERCLAIMS', `${a.id} declares ${a.confidence}; its best linked insight is ${best}`);
    }
  }

  for (const d of reg.decisions) {
    if (!DECISION_CLASSES.includes(d.cls)) err('TAG-DECISION-CLASS', `${d.id}: ${d.cls}`);
    if (d.assumptions.length === 0) err('DECISION-NO-BASIS', d.id);
    const rows = d.assumptions.map((id) => assumptionById.get(id));
    for (const [k, r] of rows.entries()) if (!r) err('LINK-BROKEN', `${d.id} cites unknown ${d.assumptions[k]}`);
    if (d.status !== 'decided') continue;

    const need = (r: Assumption): Level => (d.cls === 'claim' && r.type === 'outcome' ? 'C4' : MINIMUM[d.cls]);
    const short = rows.filter((r): r is Assumption => !!r && rank(r.confidence) < rank(need(r)));
    if (short.length > 0) {
      const b = d.bet;
      const complete = b && b.gap.trim() && b.kill.trim() && b.owner.trim() && b.reviewBy;
      if (!complete) err('DECISION-OUTRUNS-EVIDENCE', `${d.id} (${d.cls}) rests on ${short.map((s) => `${s.id}=${s.confidence}`).join(', ')} with no complete bet`);
      else if (b.reviewBy < reg.asOf) err('BET-EXPIRED', `${d.id} bet review date ${b.reviewBy} has passed`);
    }
    if ((d.cls === 'hard-to-reverse' || d.cls === 'claim') && !(d.record && ctx.fileExists(d.record))) {
      err('DECISION-NO-RECORD', `${d.id} is decided with no existing decision file`);
    }
  }

  for (const s of v.stakeholders) {
    if (!reg.assumptions.some((a) => a.stakeholder === s)) err('COVERAGE-STAKEHOLDER', s);
  }
  for (const s of v.auditSurfaces) {
    if (!reg.assumptions.some((a) => a.scope === s)) err('COVERAGE-SURFACE', s);
  }

  for (const [path, text] of strings({ a: reg.assumptions, i: reg.insights, d: reg.decisions }, '')) {
    if (EMAIL.test(text)) err('PII-EMAIL', path);
    if (PHONE.test(text)) err('PII-PHONE', path);
    if (text.length > MAX_TEXT) err('PII-LONG-TEXT', `${path} (${text.length} chars)`);
  }

  return errors;
}
