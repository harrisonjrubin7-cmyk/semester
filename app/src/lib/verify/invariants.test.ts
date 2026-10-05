import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shareState as realShareState } from '../advisor-shares';
import { evaluateFlag, flagDefinition, type FlagContext } from '../flags';
import { suppress as realSuppress, MIN_COHORT, type Cell, type SuppressedCell } from '../institution-ops';
import { DAY, KEYS, SWITCHES, T0, context, draw, scopeKeys, type Draw } from './flagdraw';
import { arrayOf, assertProperty, int, oneOf, record, runProperty } from './property';

/**
 * The rules that must always be true, searched for a counterexample.
 *
 * Each is a statement the privacy and access model depends on, written as
 * "for every input" and run against the real function, not a copy of it.
 * `docs/VERIFICATION.md` lists them and says what this does and does not
 * establish. The short version: ten thousand generated cases is evidence, not
 * proof, and a property that has never failed is not known to be one — so the
 * last block of this file plants the defect each property exists to catch and
 * requires the property to find it.
 */

type Evaluate = (key: string, ctx: FlagContext) => { allowed: boolean; step: string };

const policyOn = (d: Draw, key: string) => {
  const row = d.policy[key];
  return !!row && row.state !== 'off' && (d.env !== 'production' || row.state === 'production');
};

/** The flag properties, each a function of the evaluator, so a broken one can be handed to them. */
const flagProperties = (evaluate: Evaluate) => {
  const decide = (d: Draw) => evaluate(d.key, context(d));
  return {
    kill: (d: Draw) => {
      const def = flagDefinition(d.key)!;
      const applies = d.kills.some((k) => k.engaged && (k.tenant === null || k.tenant === d.tenant) && def.killSwitches.includes(k.key as never));
      if (!applies) return true;
      const out = decide(d);
      return !out.allowed && out.step === 'kill_switch';
    },
    tenant: (d: Draw) => !decide({ ...d, tenant: null }).allowed,
    absent: (d: Draw) => {
      if (!decide(d).allowed) return true;
      const def = flagDefinition(d.key)!;
      return policyOn(d, d.key) && (!def.module || policyOn(d, def.module));
    },
    expiry: (d: Draw) => {
      const def = flagDefinition(d.key)!;
      if (!def.expiresAt) return true;
      return !decide({ ...d, days: Math.ceil((Date.parse(def.expiresAt) - T0) / DAY) + 1 }).allowed;
    },
    scope: (d: Draw) => {
      const def = flagDefinition(d.key)!;
      if (!decide(d).allowed) return true;
      const ctx = context(d);
      return (def.needsScopes ?? []).every((want) => {
        const s = ctx.scopes?.find((g) => g.key === want);
        return !!s && s.approved && !(s.expiresAt && ctx.now >= new Date(s.expiresAt));
      });
    },
    /** Allowed means every restriction the context states was met: nothing is waved through. */
    gates: (d: Draw) => {
      if (!decide(d).allowed) return true;
      const def = flagDefinition(d.key)!;
      const row = d.policy[d.key]!;
      return d.eligible !== false
        && d.course !== false
        && (!def.capability || d.caps.includes(def.capability))
        && (!def.needsConnection || d.connection === 'approved')
        && (row.permittedRoles.length === 0 || (d.role !== null && row.permittedRoles.includes(d.role)))
        && (row.permittedCohorts.length === 0 || d.cohort);
    },
    monotone: (d: Draw) => {
      if (decide(d).allowed) return true;
      const tightened: Draw[] = [
        { ...d, eligible: false },
        { ...d, course: false },
        { ...d, cohort: false },
        { ...d, caps: [] },
        { ...d, kills: [...d.kills, { key: SWITCHES[0]!, tenant: null, engaged: true }] },
      ];
      return tightened.every((t) => !decide(t).allowed);
    },
  };
};

const real = flagProperties(evaluateFlag);
const DEEP = { runs: 2500 };

describe('flag evaluation, for every context', () => {
  it('a kill switch that applies beats every other setting', () => assertProperty('kill switch dominance', draw, real.kill, DEEP));
  it('nothing is allowed without a verified school', () => assertProperty('no tenant, no flag', draw, real.tenant, DEEP));
  it('an absent or off policy row is off: allowed implies the flag and its module were switched on', () => assertProperty('absent means off', draw, real.absent, DEEP));
  it('a temporary flag past its expiry is off, whatever else is true', () => assertProperty('expiry', draw, real.expiry, DEEP));
  it('an expired or unapproved scope never authorises', () => assertProperty('scope', draw, real.scope, DEEP));
  it('allowed means eligibility, course rule, capability, connection, role and cohort were all met', () => assertProperty('every gate', draw, real.gates, DEEP));
  it('narrowing only ever removes access: a denial survives each extra restriction', () => assertProperty('denial is monotone', draw, real.monotone, DEEP));

  it('an unregistered flag is refused', () => {
    assertProperty('unknown flag', draw, (d) => !evaluateFlag(`${d.key}.nope`, context(d)).allowed, { runs: 200 });
  });

  it('finds allowed and denied contexts, so the properties above are not vacuous', () => {
    let allowed = 0; let killed = 0; let n = 0;
    const out = runProperty(draw, (d) => { n++; const o = evaluateFlag(d.key, context(d)); if (o.allowed) allowed++; if (o.step === 'kill_switch') killed++; }, { runs: 4000 });
    expect(out.ok).toBe(true);
    expect(n).toBe(4000);
    expect(allowed, 'no generated context was ever allowed').toBeGreaterThan(0);
    expect(killed, 'no generated context was ever killed').toBeGreaterThan(0);
  });

  it('reaches the scope step with a scope that has expired, and is allowed when it has not', () => {
    let expiredRefused = 0; let scopedAllowed = 0;
    runProperty(draw, (d) => {
      const def = flagDefinition(d.key)!;
      if (!def.needsScopes?.length) return;
      const o = evaluateFlag(d.key, context(d));
      if (o.step === 'scope' && (def.needsScopes).some((w) => d.scopes[w] === 'expired')) expiredRefused++;
      if (o.allowed) scopedAllowed++;
    }, { runs: 4000 });
    expect(expiredRefused, 'the scope step was never refused for an expired scope').toBeGreaterThan(0);
    expect(scopedAllowed, 'a flag that needs scopes was never allowed').toBeGreaterThan(0);
  });
});

// ── Advisor shares ────────────────────────────────────────────────────────

type ShareState = (row: { expires_at: string; revoked_at: string | null }, now: number) => string;

const shareRow = record({ expiresIn: int(-30, 130), revokedAt: oneOf<number | null>([null, -20, -1, 0, 5, 60]), at: int(-40, 200) });
const rowOf = (s: { expiresIn: number; revokedAt: number | null }) => ({
  expires_at: new Date(T0 + s.expiresIn * DAY).toISOString(),
  revoked_at: s.revokedAt === null ? null : new Date(T0 + s.revokedAt * DAY).toISOString(),
});
const laterShare = record({ s: shareRow, later: int(0, 400) });

const shareProperties = (shareState: ShareState) => ({
  revoked: (s: { expiresIn: number; revokedAt: number | null; at: number }) =>
    s.revokedAt === null || shareState(rowOf(s), T0 + s.at * DAY) === 'revoked',
  noResurrection: ({ s, later }: { s: { expiresIn: number; revokedAt: number | null; at: number }; later: number }) => {
    const row = rowOf({ expiresIn: s.expiresIn, revokedAt: null });
    return shareState(row, T0 + s.at * DAY) !== 'expired' || shareState(row, T0 + (s.at + later) * DAY) === 'expired';
  },
  activeIsLive: (s: { expiresIn: number; revokedAt: number | null; at: number }) => {
    const row = rowOf(s);
    const at = T0 + s.at * DAY;
    const live = row.revoked_at === null && Date.parse(row.expires_at) > at;
    return (shareState(row, at) === 'active') === live;
  },
});
const shares = shareProperties(realShareState);

describe('share state, for every row and every moment', () => {
  it('a revoked share is never active, at any time', () => assertProperty('revoked is terminal', shareRow, shares.revoked, { runs: 1000 }));
  it('time only moves a share toward expired: it never becomes active again', () => assertProperty('no resurrection', laterShare, shares.noResurrection, { runs: 1000 }));
  it('active means unrevoked and unexpired, and nothing else does', () => assertProperty('active is exactly live', shareRow, shares.activeIsLive, { runs: 1000 }));
});

// ── Small-cell suppression ────────────────────────────────────────────────

type Suppress = (cells: readonly Cell[], min?: number) => SuppressedCell[];

const cells = arrayOf(record({ key: oneOf(['a', 'b', 'c', 'd', 'e']), group: oneOf(['g1', 'g2', 'g3']), n: int(0, 40) }), 10);
/** Keys are unique within a table, as a table's are. */
const uniq = (cs: Cell[]) => cs.filter((c, i) => cs.findIndex((x) => x.key === c.key && x.group === c.group) === i);

const suppressProperties = (suppress: Suppress) => ({
  floor: (cs: Cell[]) => suppress(uniq(cs)).every((c) => (c.n < MIN_COHORT ? c.shown === null : c.shown === null || c.shown === c.n)),
  noComplementLeak: (cs: Cell[]) => {
    const out = suppress(uniq(cs));
    return [...new Set(out.map((c) => c.group))].every((g) => {
      const inGroup = out.filter((c) => c.group === g);
      return inGroup.length < 2 || inGroup.filter((c) => c.shown === null).length !== 1;
    });
  },
});
const cohorts = suppressProperties(realSuppress);

describe('small-cell suppression, for every table', () => {
  it('no cell under the floor is ever shown, and nothing shown is altered', () => assertProperty('floor', cells, cohorts.floor, { runs: 1500 }));
  it('a group is never left with exactly one withheld cell, which subtraction would give back', () => assertProperty('no complement leak', cells, cohorts.noComplementLeak, { runs: 1500 }));
});

// ── Planted defects ───────────────────────────────────────────────────────

/**
 * Each property above, handed a version of the rule with the one defect it
 * exists to catch. If any of these passed, the property would be decoration.
 * The mutants wrap the real function, so they stay current with it; the same
 * defects were also planted in the source itself once, by hand, and each of
 * the properties above went red (see D-1019).
 */
describe('each property finds the defect it exists to catch', () => {
  const found = (out: { ok: boolean }) => expect(out.ok, 'the property did not notice the planted defect').toBe(false);
  const flags = (mutant: Evaluate) => flagProperties(mutant);

  it('a kill switch that is ignored', () => {
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, { ...c, killSwitches: [] })).kill, DEEP));
  });

  it('an absent policy row that is read as on', () => {
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, {
      ...c,
      tenantPolicy: Object.fromEntries(KEYS.map((key) => [key, c.tenantPolicy[key] ?? { state: 'production', permittedRoles: [], permittedCohorts: [] }])),
    })).absent, DEEP));
  });

  it('a missing school that is read as a school', () => {
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, { ...c, tenantId: c.tenantId ?? 't1' })).tenant, DEEP));
  });

  it('an expiry that is never reached', () => {
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, { ...c, now: new Date(T0 - 1000 * DAY) })).expiry, DEEP));
  });

  it('a scope that never expires or needs approval', () => {
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, { ...c, scopes: scopeKeys.map((key) => ({ key, approved: true, expiresAt: null })) })).scope, DEEP));
  });

  it('an eligibility, course rule, role or cohort check that is skipped', () => {
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, { ...c, userEligible: undefined })).gates, DEEP));
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, { ...c, courseRule: null })).gates, DEEP));
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, { ...c, cohorts: ['pilot'] })).gates, DEEP));
    found(runProperty(draw, flags((k, c) => evaluateFlag(k, { ...c, roles: ['admin'] })).gates, DEEP));
  });

  it('a restriction that widens access', () => {
    // Treats a named-but-empty eligibility as a pass: a denial that an extra restriction lifts.
    found(runProperty(draw, flags((k, c) => (c.userEligible === false ? evaluateFlag(k, { ...c, userEligible: undefined, courseRule: null }) : evaluateFlag(k, c))).monotone, DEEP));
  });

  it('a revoked share that reads as active once its expiry is ahead', () => {
    const leaky: ShareState = (row, now) => (Date.parse(row.expires_at) > now ? 'active' : realShareState(row, now));
    found(runProperty(shareRow, shareProperties(leaky).revoked, { runs: 1000 }));
    found(runProperty(shareRow, shareProperties(leaky).activeIsLive, { runs: 1000 }));
  });

  it('a share that comes back to life after expiring', () => {
    const revives: ShareState = (row, now) => (now - Date.parse(row.expires_at) > 200 * DAY ? 'active' : realShareState(row, now));
    found(runProperty(laterShare, shareProperties(revives).noResurrection, { runs: 1500 }));
  });

  it('a floor that lets a small cell through, and a group that leaks by subtraction', () => {
    const lowFloor: Suppress = (cs) => realSuppress(cs, 3);
    found(runProperty(cells, suppressProperties(lowFloor).floor, { runs: 1500 }));
    const primaryOnly: Suppress = (cs, min = MIN_COHORT) => cs.map((c) => (c.n < min ? { ...c, shown: null, why: 'small' as const } : { ...c, shown: c.n }));
    found(runProperty(cells, suppressProperties(primaryOnly).noComplementLeak, { runs: 1500 }));
  });
});

describe('the document', () => {
  const doc = readFileSync(join(import.meta.dirname, '../../../../docs/VERIFICATION.md'), 'utf8');

  it('says it is not a proof, and does not call anything formally verified', () => {
    expect(doc).toMatch(/\*\*not a proof\.\*\*/);
    expect(doc).toMatch(/Nothing in this repository is "formally verified"/);
  });

  it('lists the billing webhook among the rules it holds, and the async runner that drives it', () => {
    expect(doc).toContain('Billing webhook');
    expect(doc).toContain('runMachineAsync');
  });

  it('names the environment variables that search deeper and replay a failure', () => {
    expect(doc).toContain('VERIFY_RUNS');
    expect(doc).toContain('VERIFY_SEED');
  });
});
