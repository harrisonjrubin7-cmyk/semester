import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAGS, evaluateFlag } from '../flags';
import { DATA_CLASSES, DESTINATIONS, PLATFORM_ROUTES, routeAllowed, type DataClass, type Destination } from '../integration/classification';
import { DAY, KEYS, T0, context, draw } from '../verify/flagdraw';
import { assertProperty, bool, int, oneOf, record, runProperty, subset, type Gen } from '../verify/property';
import {
  contractDecision, contractProblems, contractViolations, evaluateUnderContract, inTerm, readContract,
  type Ask, type LiveConfiguration, type TenantContract,
} from './tenantcontract';

/**
 * The tenant contract, for every contract and every request.
 *
 * The rules that matter are about direction: the contract must only ever take
 * access away, a school with no contract must behave exactly as before, and
 * what the drift report calls a violation must be what the decision function
 * would refuse. Each is checked over generated contracts, and then against the
 * one defect it exists to catch. There is no screen and no network here, so
 * there is nothing for an offline or accessibility case to cover; the module
 * is pure and its failure mode is a wrong answer, which is what is tested.
 */

const REGIONS = ['us-east', 'us-west', 'eu'] as const;
const PROVIDERS = ['Anthropic', 'OpenAI', 'Other'] as const;
const ROUTE_SETS: Record<string, TenantContract['dataRoutes']> = {
  none: undefined,
  closeAi: { T1: { approved_ai: false }, T2: { approved_ai: false } },
  closeMore: { T0: { consumer_ai: false }, T2: { community: false }, T3: { semester: false } },
  // A contract that tries to open a route the floor keeps shut: only the platform decides that.
  tryOpen: { T4: { semester: true }, T3: { community: true } },
};

interface Shape {
  modules: string[];
  prohibited: string[];
  providers: string[];
  sources: 'institution_only' | 'any_authorized';
  budget: number | null;
  regions: string[];
  retention: 'none' | 'short' | 'long';
  mfa: boolean;
  from: number;
  length: number | null;
  routes: string;
}

const shape: Gen<Shape> = record({
  modules: subset(KEYS),
  prohibited: subset(KEYS),
  providers: subset(PROVIDERS),
  sources: oneOf(['institution_only', 'any_authorized'] as const),
  budget: oneOf<number | null>([null, 0, 100, 1000]),
  regions: subset(REGIONS),
  retention: oneOf(['none', 'short', 'long'] as const),
  mfa: bool,
  from: int(-200, 100),
  length: oneOf<number | null>([null, 30, 120, 400]),
  routes: oneOf(Object.keys(ROUTE_SETS)),
});

const iso = (days: number) => new Date(T0 + days * DAY).toISOString();

const build = (s: Shape): TenantContract => ({
  tenantId: 't1',
  effectiveFrom: iso(s.from),
  effectiveTo: s.length === null ? null : iso(s.from + s.length),
  modules: s.modules,
  prohibited: s.prohibited,
  ai: { providers: s.providers, sources: s.sources, annualTokenBudget: s.budget },
  dataRoutes: ROUTE_SETS[s.routes],
  regions: s.regions,
  retention: s.retention === 'none' ? null : s.retention === 'short' ? { minDays: 30, maxDays: 90 } : { minDays: 365, maxDays: 2555 },
  adminMfa: s.mfa,
  support: { tier: 'standard', escalation: null },
});

interface AskShape {
  kind: number;
  key: string;
  provider: string;
  source: 'institution' | 'other';
  used: number;
  asking: number;
  cls: DataClass;
  dest: Destination;
  region: string;
  mfa: boolean;
}

const askShape: Gen<AskShape> = record({
  kind: int(0, 4),
  key: oneOf(KEYS),
  provider: oneOf(PROVIDERS),
  source: oneOf(['institution', 'other'] as const),
  used: int(0, 1200),
  asking: int(0, 500),
  cls: oneOf(DATA_CLASSES),
  dest: oneOf(DESTINATIONS),
  region: oneOf(REGIONS),
  mfa: bool,
});

const askOf = (a: AskShape): Ask => {
  switch (a.kind) {
    case 0: return { kind: 'module', key: a.key };
    case 1: return { kind: 'ai', provider: a.provider, source: a.source };
    case 2: return { kind: 'ai_tokens', usedThisYear: a.used, asking: a.asking };
    case 3: return { kind: 'data', cls: a.cls, dest: a.dest, region: a.region };
    default: return { kind: 'admin_action', mfa: a.mfa };
  }
};

const world = record({ c: shape, ask: askShape, flag: draw, now: int(-300, 400) });
type World = { c: Shape; ask: AskShape; flag: ReturnType<typeof draw.gen>; now: number };
const at = (w: World) => new Date(T0 + w.now * DAY);

type Decide = typeof contractDecision;
type Under = typeof evaluateUnderContract;

/** One step stricter, for each way a contract can be tightened. */
const tighter = (c: TenantContract): TenantContract[] => [
  { ...c, modules: c.modules.slice(1) },
  { ...c, prohibited: [...c.prohibited, ...c.modules.slice(0, 1)] },
  { ...c, modules: [] },
  { ...c, ai: { ...c.ai, providers: c.ai.providers.slice(1) } },
  { ...c, ai: { ...c.ai, sources: 'institution_only' } },
  { ...c, ai: { ...c.ai, annualTokenBudget: c.ai.annualTokenBudget === null ? 50 : Math.floor(c.ai.annualTokenBudget / 2) } },
  { ...c, regions: c.regions.slice(1) },
  { ...c, adminMfa: true },
  { ...c, dataRoutes: { ...c.dataRoutes, T1: { ...c.dataRoutes?.T1, semester: false }, T0: { ...c.dataRoutes?.T0, approved_ai: false } } },
];

const rules = (decide: Decide, under: Under) => ({
  neverWidens: (w: World) => {
    const c = build(w.c);
    const ctx = context(w.flag);
    return !under(w.flag.key, ctx, c, at(w)).allowed || evaluateFlag(w.flag.key, ctx).allowed;
  },
  contractDenialDenies: (w: World) => {
    const c = build(w.c);
    const ctx = context(w.flag);
    return decide(c, { kind: 'module', key: w.flag.key }, at(w)).allowed || !under(w.flag.key, ctx, c, at(w)).allowed;
  },
  noContractIsNeutral: (w: World) => {
    const ctx = context(w.flag);
    const a = under(w.flag.key, ctx, null, at(w));
    const b = evaluateFlag(w.flag.key, ctx);
    return a.allowed === b.allowed && a.step === b.step && decide(null, askOf(w.ask), at(w)).applies === false;
  },
  dataNeverOpensTheFloor: (w: World) => {
    const c = build(w.c);
    const a = askOf({ ...w.ask, kind: 3 });
    const d = decide(c, a, at(w));
    return !d.allowed || (a.kind === 'data' && routeAllowed(a.cls, a.dest));
  },
  outsideTheTermEverythingIsRefused: (w: World) => {
    const c = build(w.c);
    return inTerm(c, at(w)) || !decide(c, askOf(w.ask), at(w)).allowed;
  },
  /** The specification, written out independently: allowed means every clause that applies was met. */
  allowedMeansTheClauseWasMet: (w: World) => {
    const c = build(w.c);
    const a = askOf(w.ask);
    if (!decide(c, a, at(w)).allowed) return true;
    if (!inTerm(c, at(w))) return false;
    switch (a.kind) {
      case 'module': return c.modules.includes(a.key) && !c.prohibited.includes(a.key);
      case 'ai': return c.ai.providers.includes(a.provider) && (c.ai.sources !== 'institution_only' || a.source === 'institution');
      case 'ai_tokens': return c.ai.annualTokenBudget === null || a.usedThisYear + a.asking <= c.ai.annualTokenBudget;
      case 'data': return c.regions.includes(a.region) && routeAllowed(a.cls, a.dest, c.dataRoutes);
      case 'admin_action': return !c.adminMfa || a.mfa;
    }
  },
  tighteningOnlyRemovesAccess: (w: World) => {
    const c = build(w.c);
    const a = askOf(w.ask);
    if (decide(c, a, at(w)).allowed) return true;
    return tighter(c).every((t) => !decide(t, a, at(w)).allowed);
  },
});

const real = rules(contractDecision, evaluateUnderContract);
const DEEP = { runs: 2500 };

describe('the contract, for every contract and request', () => {
  it('never allows what the flag evaluator refuses', () => assertProperty('never widens', world, real.neverWidens, DEEP));
  it('refuses, in the flag path, whatever the contract refuses for that module', () => assertProperty('contract denial denies', world, real.contractDenialDenies, DEEP));
  it('is invisible to a school with no contract', () => assertProperty('no contract is neutral', world, real.noContractIsNeutral, DEEP));
  it('cannot open a data route the platform floor keeps shut', () => assertProperty('the floor', world, real.dataNeverOpensTheFloor, DEEP));
  it('refuses every request outside its term', () => assertProperty('term', world, real.outsideTheTermEverythingIsRefused, DEEP));
  it('allows a request only when the clause that governs it was met', () => assertProperty('the clause was met', world, real.allowedMeansTheClauseWasMet, DEEP));
  it('only ever removes access when it is tightened', () => assertProperty('tightening', world, real.tighteningOnlyRemovesAccess, DEEP));

  it('reaches both answers for every kind of request, so the rules above are not vacuous', () => {
    const seen = new Map<string, { yes: number; no: number }>();
    runProperty(world, (w) => {
      const a = askOf(w.ask);
      const d = contractDecision(build(w.c), a, at(w));
      const s = seen.get(a.kind) ?? { yes: 0, no: 0 };
      if (d.allowed) s.yes++; else s.no++;
      seen.set(a.kind, s);
    }, { runs: 4000 });
    expect([...seen.keys()].sort()).toEqual(['admin_action', 'ai', 'ai_tokens', 'data', 'module']);
    for (const [k, v] of seen) { expect(v.yes, `${k} never allowed`).toBeGreaterThan(0); expect(v.no, `${k} never refused`).toBeGreaterThan(0); }
  });
});

describe('the contract term', () => {
  const c = build({ ...({} as Shape), modules: [], prohibited: [], providers: [], sources: 'any_authorized', budget: null, regions: ['us-east'], retention: 'none', mfa: false, from: 0, length: 30, routes: 'none' });

  it('is in force from its first instant to just before its last', () => {
    expect(inTerm(c, new Date(T0 - 1))).toBe(false);
    expect(inTerm(c, new Date(T0))).toBe(true);
    expect(inTerm(c, new Date(T0 + 30 * DAY - 1))).toBe(true);
    expect(inTerm(c, new Date(T0 + 30 * DAY))).toBe(false);
  });

  it('is open-ended when it has no end', () => {
    expect(inTerm({ ...c, effectiveTo: null }, new Date(T0 + 10_000 * DAY))).toBe(true);
  });

  it('renewing it restores access that lapsing removed', () => {
    const key = FLAGS[0]!.key;
    const lapsed = contractDecision({ ...c, modules: [key] }, { kind: 'module', key }, new Date(T0 + 31 * DAY));
    const renewed = contractDecision({ ...c, modules: [key], effectiveTo: iso(400) }, { kind: 'module', key }, new Date(T0 + 31 * DAY));
    expect(lapsed).toMatchObject({ allowed: false, clause: 'term' });
    expect(renewed).toMatchObject({ allowed: true, clause: 'modules' });
  });
});

describe('what each clause says', () => {
  const key = FLAGS[0]!.key;
  const base = build({ modules: [key], prohibited: [], providers: ['Anthropic'], sources: 'institution_only', budget: 100, regions: ['eu'], retention: 'short', mfa: true, from: -10, length: null, routes: 'closeAi' });
  const now = new Date(T0);

  it('refuses a prohibited module even when it is also included', () => {
    expect(contractDecision({ ...base, prohibited: [key] }, { kind: 'module', key }, now)).toMatchObject({ allowed: false, clause: 'prohibited' });
  });

  it('allows AI only for a named provider and, when asked to, only with the school’s own sources', () => {
    expect(contractDecision(base, { kind: 'ai', provider: 'OpenAI', source: 'institution' }, now)).toMatchObject({ allowed: false, clause: 'ai.providers' });
    expect(contractDecision(base, { kind: 'ai', provider: 'Anthropic', source: 'other' }, now)).toMatchObject({ allowed: false, clause: 'ai.sources' });
    expect(contractDecision(base, { kind: 'ai', provider: 'Anthropic', source: 'institution' }, now).allowed).toBe(true);
  });

  it('meters tokens against the annual budget, to the token', () => {
    expect(contractDecision(base, { kind: 'ai_tokens', usedThisYear: 60, asking: 40 }, now).allowed).toBe(true);
    expect(contractDecision(base, { kind: 'ai_tokens', usedThisYear: 60, asking: 41 }, now).allowed).toBe(false);
    expect(contractDecision({ ...base, ai: { ...base.ai, annualTokenBudget: null } }, { kind: 'ai_tokens', usedThisYear: 1e9, asking: 1e9 }, now).allowed).toBe(true);
  });

  it('keeps data inside its regions and closes the routes it names', () => {
    expect(contractDecision(base, { kind: 'data', cls: 'T1', dest: 'semester', region: 'us-east' }, now)).toMatchObject({ allowed: false, clause: 'residency' });
    expect(contractDecision(base, { kind: 'data', cls: 'T1', dest: 'approved_ai', region: 'eu' }, now).allowed).toBe(false);
    expect(contractDecision(base, { kind: 'data', cls: 'T1', dest: 'semester', region: 'eu' }, now).allowed).toBe(true);
  });

  it('requires multi-factor authentication for administrator actions when it says so', () => {
    expect(contractDecision(base, { kind: 'admin_action', mfa: false }, now)).toMatchObject({ allowed: false, clause: 'admin.mfa' });
    expect(contractDecision(base, { kind: 'admin_action', mfa: true }, now).allowed).toBe(true);
  });

  it('says in words that no contract means no constraint from this layer', () => {
    const d = contractDecision(null, { kind: 'module', key }, now);
    expect(d).toMatchObject({ applies: false, allowed: true });
    expect(d.reason).toMatch(/other gates still apply/);
  });
});

describe('drift, for every contract and configuration', () => {
  const live = record({ c: shape, on: subset(KEYS), providers: subset(PROVIDERS), sources: oneOf(['institution_only', 'any_authorized'] as const), used: int(0, 1500), regions: subset(REGIONS), days: oneOf<number | null>([null, 10, 60, 400]), mfa: bool, now: int(-100, 100) });
  type Live = { c: Shape; on: string[]; providers: string[]; sources: 'institution_only' | 'any_authorized'; used: number; regions: string[]; days: number | null; mfa: boolean; now: number };
  const liveOf = (l: Live): LiveConfiguration => ({ modulesOn: l.on, aiProviders: l.providers, aiSources: l.sources, aiTokensUsedThisYear: l.used, regions: l.regions, retentionDays: l.days, adminMfaRequired: l.mfa });

  /** A configuration that does exactly what the contract permits. */
  const compliant = (c: TenantContract): LiveConfiguration => ({
    modulesOn: c.modules.filter((m) => !c.prohibited.includes(m)),
    aiProviders: c.ai.providers,
    aiSources: c.ai.sources,
    aiTokensUsedThisYear: c.ai.annualTokenBudget ?? 0,
    regions: c.regions,
    retentionDays: c.retention ? c.retention.minDays : null,
    adminMfaRequired: c.adminMfa,
  });

  const agrees = (detect: typeof contractViolations, decide: Decide) => (l: Live) => {
    const c = build(l.c);
    const now = new Date(T0 + l.now * DAY);
    if (!inTerm(c, now)) return true;
    const moduleViolations = detect(c, liveOf(l), now).filter((v) => v.clause === 'modules' || v.clause === 'prohibited').length;
    const refused = l.on.filter((m) => !decide(c, { kind: 'module', key: m }, now).allowed).length;
    return moduleViolations === refused;
  };

  it('reports a module as a violation exactly when the decision would refuse it', () => assertProperty('drift agrees with the decision', live, agrees(contractViolations, contractDecision), DEEP));

  it('reports nothing for a configuration that does what the contract permits', () => {
    assertProperty('compliant is clean', shape, (s) => {
      const c = build({ ...s, from: -5, length: null });
      return contractViolations(c, compliant(c), new Date(T0)).length === 0;
    }, DEEP);
  });

  it('names each way a configuration drifts', () => {
    const c = build({ modules: [KEYS[0]!], prohibited: [KEYS[1]!], providers: ['Anthropic'], sources: 'institution_only', budget: 100, regions: ['eu'], retention: 'short', mfa: true, from: -1, length: null, routes: 'none' });
    const v = contractViolations(c, {
      modulesOn: [KEYS[1]!, KEYS[2]!], aiProviders: ['OpenAI'], aiSources: 'any_authorized', aiTokensUsedThisYear: 101,
      regions: ['us-east'], retentionDays: 7, adminMfaRequired: false,
    }, new Date(T0));
    expect(v.map((x) => x.clause).sort()).toEqual(['admin.mfa', 'ai.budget', 'ai.providers', 'ai.sources', 'modules', 'prohibited', 'residency', 'retention']);
    expect(contractViolations(c, { ...compliant(c), retentionDays: null }, new Date(T0)).map((x) => x.clause)).toEqual(['retention']);
  });
});

describe('the contract as written', () => {
  const good = build({ modules: [KEYS[0]!], prohibited: [], providers: ['Anthropic'], sources: 'institution_only', budget: 100, regions: ['eu'], retention: 'short', mfa: true, from: -1, length: 365, routes: 'closeAi' });

  it('accepts a sound contract', () => expect(contractProblems(good)).toEqual([]));

  it.each([
    ['an unknown module', { ...good, modules: ['module.nope'] }, /not a registered flag/],
    ['a module both included and prohibited', { ...good, prohibited: [KEYS[0]!] }, /both included and prohibited/],
    ['an end before its start', { ...good, effectiveTo: iso(-50) }, /not after/],
    ['no region', { ...good, regions: [] }, /No region/],
    ['a repeated region', { ...good, regions: ['eu', 'eu'] }, /listed twice/],
    ['a negative token budget', { ...good, ai: { ...good.ai, annualTokenBudget: -1 } }, /non-negative/],
    ['a retention window that runs backwards', { ...good, retention: { minDays: 90, maxDays: 30 } }, /1 ≤ min ≤ max/],
    ['a named tier with no escalation path', { ...good, support: { tier: 'named' as const, escalation: null } }, /named escalation/],
    ['a route opened that the floor keeps shut', { ...good, dataRoutes: { T4: { semester: true } } }, /may only close routes/],
  ])('refuses %s', (_name, bad, message) => {
    expect(contractProblems(bad as TenantContract).join(' ')).toMatch(message);
  });

  it('agrees with the floor about what "opening" means', () => {
    for (const cls of DATA_CLASSES) for (const dest of DESTINATIONS) {
      const opens = contractProblems({ ...good, dataRoutes: { [cls]: { [dest]: true } } }).length > 0;
      expect(opens, `${cls} ${dest}`).toBe(!PLATFORM_ROUTES[cls][dest]);
    }
  });

  it('reads a stored contract back, and refuses each way a row can be wrong, without repairing it', () => {
    expect(readContract(JSON.parse(JSON.stringify(good)))).toEqual({ contract: good });
    for (const raw of [null, 7, [], {}, { ...good, tenantId: 4 }, { ...good, modules: 'all' }, { ...good, ai: null }, { ...good, ai: { ...good.ai, sources: 'whatever' } },
      { ...good, adminMfa: 'yes' }, { ...good, support: { tier: 'gold', escalation: null } }, { ...good, modules: ['module.nope'] }]) {
      expect(readContract(raw), JSON.stringify(raw)?.slice(0, 60)).toHaveProperty('error');
    }
  });

  it('refuses any generated contract that has a problem, and reads every one that has none', () => {
    assertProperty('read agrees with problems', shape, (s) => {
      const c = build(s);
      const r = readContract(JSON.parse(JSON.stringify(c)));
      return contractProblems(c).length === 0 ? 'contract' in r : 'error' in r;
    }, DEEP);
  });
});

describe('each rule finds the defect it exists to catch', () => {
  const found = (out: { ok: boolean }) => expect(out.ok, 'the property did not notice the planted defect').toBe(false);

  it('a contract that lets the flag path allow what the platform refuses', () => {
    const widens: Under = (key, ctx, c, now) => (contractDecision(c, { kind: 'module', key }, now).allowed ? { allowed: true, step: 'allowed', reason: '', clause: 'modules' } : evaluateUnderContract(key, ctx, c, now));
    found(runProperty(world, rules(contractDecision, widens).neverWidens, DEEP));
  });

  it('a contract refusal that the flag path does not honour', () => {
    const ignores: Under = (key, ctx, c) => ({ ...evaluateFlag(key, ctx), clause: c ? 'modules' : 'none' });
    found(runProperty(world, rules(contractDecision, ignores).contractDenialDenies, DEEP));
  });

  it('a missing contract that blocks, or a school with none that the layer still changes', () => {
    const blocks: Decide = (c, a, n) => (c === null ? { applies: true, allowed: false, clause: 'none', reason: '' } : contractDecision(c, a, n));
    found(runProperty(world, rules(blocks, evaluateUnderContract).noContractIsNeutral, DEEP));
  });

  it('a data route that the contract can open above the floor', () => {
    const opens: Decide = (c, a, n) => {
      if (c && a.kind === 'data' && c.dataRoutes?.[a.cls]?.[a.dest] === true && c.regions.includes(a.region)) return { applies: true, allowed: true, clause: 'data', reason: '' };
      return contractDecision(c, a, n);
    };
    found(runProperty(world, rules(opens, evaluateUnderContract).dataNeverOpensTheFloor, DEEP));
  });

  it('an administrator action that is let through without the authentication the contract requires', () => {
    const lax: Decide = (c, a, n) => (a.kind === 'admin_action' && c && inTerm(c, n) ? { applies: true, allowed: true, clause: 'admin.mfa', reason: '' } : contractDecision(c, a, n));
    found(runProperty(world, rules(lax, evaluateUnderContract).allowedMeansTheClauseWasMet, DEEP));
  });

  it('a term that is not checked for AI requests', () => {
    const lax: Decide = (c, a, n) => (c && a.kind === 'ai' ? contractDecision({ ...c, effectiveFrom: '1970-01-01T00:00:00Z', effectiveTo: null }, a, n) : contractDecision(c, a, n));
    found(runProperty(world, rules(lax, evaluateUnderContract).outsideTheTermEverythingIsRefused, DEEP));
  });

  it('an empty module list that means "everything", so tightening to nothing opens it up', () => {
    const emptyMeansAll: Decide = (c, a, n) => (c && a.kind === 'module' && c.modules.length === 0 && !c.prohibited.includes(a.key) && inTerm(c, n) ? { applies: true, allowed: true, clause: 'modules', reason: '' } : contractDecision(c, a, n));
    found(runProperty(world, rules(emptyMeansAll, evaluateUnderContract).tighteningOnlyRemovesAccess, DEEP));
  });

  it('a drift report that forgets the prohibited list', () => {
    const live = record({ c: shape, on: subset(KEYS), now: int(-100, 100) });
    const forgetful: typeof contractViolations = (c, l, n) => contractViolations({ ...c, prohibited: [] }, l, n);
    found(runProperty(live, (l) => {
      const c = build(l.c);
      const now = new Date(T0 + l.now * DAY);
      if (!inTerm(c, now)) return true;
      const config: LiveConfiguration = { modulesOn: l.on, aiProviders: [], aiSources: 'institution_only', aiTokensUsedThisYear: 0, regions: [], retentionDays: null, adminMfaRequired: true };
      const n = forgetful(c, config, now).filter((v) => v.clause === 'modules' || v.clause === 'prohibited').length;
      return n === l.on.filter((m) => !contractDecision(c, { kind: 'module', key: m }, now).allowed).length;
    }, DEEP));
  });
});

describe('the document', () => {
  const doc = readFileSync(join(import.meta.dirname, '../../../../docs/TENANT-CONTRACT.md'), 'utf8');

  it('describes every clause a decision or a violation can name', () => {
    const named = new Set<string>();
    runProperty(world, (w) => { named.add(contractDecision(build(w.c), askOf(w.ask), at(w)).clause); }, { runs: 3000 });
    for (const clause of [...named].filter((c) => c !== 'none')) expect(doc, clause).toContain(`\`${clause}\``);
    expect(doc).toContain('`retention`');
  });

  it('says it is not wired, stores nothing, and records no contract', () => {
    expect(doc).toMatch(/Not wired to any screen/);
    // Where a contract lives, and that none is recorded, are decided (D-1019): a file per tenant, empty today.
    expect(doc).toMatch(/contracts\/<tenant id>\.json/);
    expect(doc).toMatch(/no\s+school\s+has\s+a\s+contract\s+recorded/);
  });
});
