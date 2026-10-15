import { describe, expect, it } from 'vitest';
import { evaluateFlag, type FlagContext, type FlagDecision } from '../flags';
import { ANA, AT, BEN, PROF, course } from './fixture';
import { enterScore, release } from './ledger';
import type { Decision, Gradebook } from './model';
import {
  MAX_ATTEMPTS,
  planPassback,
  reconcile,
  runPassback,
  type LmsAdapter,
  type PassbackLedger,
  type PassbackScore,
  type SendResult,
} from './passback';

const FLAG = 'writeback.lms_grade_passback';

/** A step that must work: a refused one would leave the book as it was and make a test vacuous. */
function step(o: { book: Gradebook; decision: Decision<unknown> }): Gradebook {
  if (!o.decision.ok) throw new Error(`${o.decision.refusal}: ${o.decision.reason}`);
  return o.book;
}

/** Every gate open: the module and flag on in production, an approved connection and scope. */
function ctx(over: Partial<FlagContext> = {}): FlagContext {
  return {
    environment: 'production',
    tenantId: 'gb-u',
    now: new Date(AT),
    killSwitches: [],
    tenantPolicy: { 'integration.lms_lti': { state: 'production', permittedRoles: [], permittedCohorts: [] }, [FLAG]: { state: 'production', permittedRoles: [], permittedCohorts: [] } },
    connection: { publicId: 'lms-1', approved: true, status: 'healthy' },
    scopes: [{ key: 'scope.lms.score_publish', approved: true }],
    capabilities: [],
    // Synthetic gate fixture, not a tenant activation or LMS authorization.
    activationReceipt: {
      decisionKey: 'activation:v1:test-passback', requestId: 'test-passback', tenantId: 'gb-u',
      capabilityId: 'CAP-020', operation: FLAG, policyVersion: 'test-policy', configurationVersion: 1,
      issuedAt: new Date(AT).toISOString(), expiresAt: new Date(Date.parse(AT) + 15 * 60_000).toISOString(),
    },
    ...over,
  };
}
const OPEN = evaluateFlag(FLAG, ctx());
const KILLED = evaluateFlag(FLAG, ctx({ killSwitches: [{ key: 'kill.writeback', tenantId: null, engaged: true }] }));

/** An LMS in memory, which records every send it is asked for. */
function lms(answer: (s: PassbackScore) => SendResult | Promise<SendResult> = () => ({ ok: true })) {
  const held = new Map<string, Map<string, number>>();
  const asked: PassbackScore[] = [];
  const adapter: LmsAdapter = {
    name: 'Test LMS',
    async send(s) {
      asked.push(s);
      const r = await answer(s);
      if (r.ok) {
        if (!held.has(s.lineItem)) held.set(s.lineItem, new Map());
        held.get(s.lineItem)!.set(s.studentId, s.scoreGiven);
      }
      return r;
    },
    async read(lineItem) {
      return { ok: true, scores: [...(held.get(lineItem) ?? new Map())].map(([studentId, scoreGiven]) => ({ studentId, scoreGiven })) };
    },
  };
  return { adapter, asked, held };
}

/** Ana released at 9 then a newer draft of 2; Ben a draft only. */
function book(): Gradebook {
  let b = step(enterScore(course(), PROF, { itemId: 'ps1', studentId: ANA.id, score: 9, mark: null, comment: '', reason: '', key: 'ana-ps1-enter' }, AT));
  b = step(release(b, PROF, { itemId: 'ps1', key: 'ps1-release-1' }, AT));
  b = step(enterScore(b, PROF, { itemId: 'ps1', studentId: ANA.id, score: 2, mark: null, comment: '', reason: 'unsure', key: 'ana-ps1-draft' }, AT));
  b = step(enterScore(b, PROF, { itemId: 'ps1', studentId: BEN.id, score: 7, mark: null, comment: '', reason: '', key: 'ben-ps1-draft' }, AT));
  return b;
}

describe('the passback gate', () => {
  it('is closed by default: the flag is off, and a plan sends nothing and says why', () => {
    const off = evaluateFlag(FLAG, ctx({ tenantPolicy: {} }));
    expect(off).toMatchObject({ allowed: false, step: 'tenant_entitlement' });
    const p = planPassback(book(), ['ps1'], off, {});
    expect(p).toMatchObject({ allowed: false, sends: [] });
    expect(p.reason).toContain('not enabled for this school');
  });

  it('is closed by kill.writeback, whatever else is on', () => {
    expect(KILLED).toMatchObject({ allowed: false, step: 'kill_switch' });
    expect(planPassback(book(), ['ps1'], KILLED, {}).sends).toEqual([]);
  });

  it('is open only with every gate open, which is the control for the two above', () => {
    expect(OPEN.allowed).toBe(true);
    const unactivated = evaluateFlag(FLAG, ctx({ activationReceipt: null }));
    expect(unactivated).toMatchObject({ allowed: false, step: 'activation_contract' });
    expect(planPassback(book(), ['ps1'], unactivated, {}).sends).toEqual([]);
  });
});

describe('a plan', () => {
  it('sends the released grade, never the newer draft, and nothing for a student with only a draft', () => {
    const p = planPassback(book(), ['ps1'], OPEN, {});
    expect(p.sends.map((s) => [s.studentId, s.scoreGiven, s.scoreMaximum, s.lineItem])).toEqual([[ANA.id, 9, 10, 'lti:ps1']]);
    expect(p.skips).toEqual([expect.objectContaining({ studentId: BEN.id, why: 'nothing-released' })]);
  });

  it('skips an item with no LMS column, and a released mark that has no number', () => {
    let b = step(enterScore(course(), PROF, { itemId: 'ps3', studentId: ANA.id, score: 5, mark: null, comment: '', reason: '', key: 'ana-ps3-enter' }, AT));
    b = step(release(b, PROF, { itemId: 'ps3', key: 'ps3-release' }, AT));
    b = step(enterScore(b, PROF, { itemId: 'ps2', studentId: ANA.id, score: null, mark: 'excused', comment: '', reason: '', key: 'ana-ps2-ex' }, AT));
    b = step(release(b, PROF, { itemId: 'ps2', key: 'ps2-release' }, AT));
    const p = planPassback(b, ['ps3', 'ps2'], OPEN, {});
    expect(p.sends).toEqual([]);
    expect(p.skips.map((s) => [s.itemId, s.studentId, s.why])).toEqual([
      ['ps3', ANA.id, 'no-line-item'], ['ps3', BEN.id, 'no-line-item'], ['ps2', ANA.id, 'no-score'], ['ps2', BEN.id, 'nothing-released'],
    ]);
  });
});

describe('running a plan', () => {
  it('sends each released version once: a second run finds it already sent and calls the LMS for nothing', async () => {
    const { adapter, asked } = lms();
    const b = book();
    const first = await runPassback(planPassback(b, ['ps1'], OPEN, {}), adapter, {}, () => OPEN, AT);
    expect(first).toMatchObject({ sent: 1, failed: 0, stopped: null });
    const second = planPassback(b, ['ps1'], OPEN, first.ledger);
    expect(second.sends).toEqual([]);
    expect(second.skips.find((s) => s.studentId === ANA.id)?.why).toBe('already-sent');
    await runPassback(second, adapter, first.ledger, () => OPEN, AT);
    expect(asked).toHaveLength(1);
    expect(asked[0].key).toBe(b.entries.find((e) => e.studentId === ANA.id && e.status === 'released')!.id);
  });

  it('does not send one version twice even when a plan lists it twice', async () => {
    const { adapter, asked } = lms();
    const p = planPassback(book(), ['ps1', 'ps1'], OPEN, {});
    expect(p.sends).toHaveLength(2);
    await runPassback(p, adapter, {}, () => OPEN, AT);
    expect(asked).toHaveLength(1);
  });

  it('records an LMS that is down as a retryable failure, retries it, and gives up after the limit', async () => {
    const down = lms(() => { throw new Error('503 from the LMS'); });
    let ledger: PassbackLedger = {};
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const r = await runPassback(planPassback(book(), ['ps1'], OPEN, ledger), down.adapter, ledger, () => OPEN, AT);
      expect(r).toMatchObject({ sent: 0, failed: 1 });
      ledger = r.ledger;
    }
    expect(Object.values(ledger)).toEqual([{ status: 'failed', attempts: MAX_ATTEMPTS, reason: '503 from the LMS', at: AT }]);
    const after = planPassback(book(), ['ps1'], OPEN, ledger);
    expect(after.sends).toEqual([]);
    expect(after.skips.find((s) => s.studentId === ANA.id)).toMatchObject({ why: 'gave-up' });
    expect(down.asked).toHaveLength(MAX_ATTEMPTS);
  });

  it('gives up at once on a failure the LMS says will not change', async () => {
    const refused = lms(() => ({ ok: false, retryable: false, reason: 'unknown user' }));
    const r = await runPassback(planPassback(book(), ['ps1'], OPEN, {}), refused.adapter, {}, () => OPEN, AT);
    expect(planPassback(book(), ['ps1'], OPEN, r.ledger).skips.find((s) => s.studentId === ANA.id)?.why).toBe('gave-up');
  });

  it('stops the moment the kill switch is engaged, part way through', async () => {
    let b = book();
    b = step(release(b, PROF, { itemId: 'ps1', key: 'ps1-release-2' }, AT)); // Ana's 2 and Ben's 7 are now released too
    b = step(enterScore(b, PROF, { itemId: 'mid', studentId: ANA.id, score: 88, mark: null, comment: '', reason: '', key: 'ana-mid-enter' }, AT));
    b = step(release(b, PROF, { itemId: 'mid', key: 'mid-release' }, AT));
    const p = planPassback(b, ['ps1', 'mid'], OPEN, {});
    expect(p.sends).toHaveLength(3);
    const { adapter, asked } = lms();
    const gates: FlagDecision[] = [OPEN, KILLED];
    const r = await runPassback(p, adapter, {}, () => gates.shift() ?? KILLED, AT);
    expect(asked).toHaveLength(1);
    expect(r.stopped).toContain('kill.writeback is engaged');
  });

  it('does nothing at all with a plan the gate refused', async () => {
    const { adapter, asked } = lms();
    const r = await runPassback(planPassback(book(), ['ps1'], KILLED, {}), adapter, {}, () => OPEN, AT);
    expect(asked).toEqual([]);
    expect(r.stopped).toContain('Passback is off');
  });
});

describe('reconciling with the LMS', () => {
  it('names a match, a difference, a score missing there, one not sent, and one the LMS has that we do not', async () => {
    let b = book();
    b = step(release(b, PROF, { itemId: 'ps1', key: 'ps1-release-3' }, AT)); // Ana 2, Ben 7 released
    const { adapter, held } = lms();
    const r = await runPassback(planPassback(b, ['ps1'], OPEN, {}), adapter, {}, () => OPEN, AT);
    const read = await adapter.read('lti:ps1');
    if (!read.ok) throw new Error('read failed');
    expect(reconcile(b, 'ps1', r.ledger, read.scores).map((d) => d.drift)).toEqual(['match', 'match']);

    held.get('lti:ps1')!.set(BEN.id, 6);
    held.get('lti:ps1')!.delete(ANA.id);
    held.get('lti:ps1')!.set('stranger', 10);
    const again = await adapter.read('lti:ps1');
    if (!again.ok) throw new Error('read failed');
    const drift = reconcile(b, 'ps1', r.ledger, again.scores);
    expect(drift).toEqual([
      { studentId: ANA.id, drift: 'missing-remote', ours: 2, theirs: null },
      { studentId: BEN.id, drift: 'different', ours: 7, theirs: 6 },
      { studentId: 'stranger', drift: 'unknown-remote', ours: null, theirs: 10 },
    ]);
    expect(reconcile(b, 'ps1', {}, []).map((d) => d.drift)).toEqual(['unsent', 'unsent']);
  });
});
