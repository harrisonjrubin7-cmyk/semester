import { describe, expect, it } from 'vitest';
import { CONNECTION_STATUSES, PROVIDER_DOMAINS } from './catalog';
import { NATIVE_FALLBACK } from './fallback';
import {
  OPERATOR_NEXT_STEP, connectionHealth, degradedExperience, type Health, type HealthInput, type HealthReason,
} from './health';

const now = new Date('2026-10-01T12:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const healthy: HealthInput = {
  approved: true, paused: false, killSwitchEngaged: false, auth: 'ok', breaker: 'closed', rateLimitedUntil: null,
  lastSuccessAt: minutesAgo(30), lastRun: { status: 'succeeded', at: minutesAgo(30) },
  freshnessTargetMinutes: 24 * 60, openDeadLetters: 0, driftHeld: false, now,
};
const h = (over: Partial<HealthInput>) => connectionHealth({ ...healthy, ...over });

describe('connection health', () => {
  it('is healthy when nothing is wrong (the control for every row below)', () => {
    expect(h({})).toMatchObject({ status: 'healthy', reason: 'ok', freshness: 'recent' });
  });

  it('decides each reason', () => {
    const cases: [Partial<HealthInput>, string, HealthReason][] = [
      [{ approved: false }, 'configuring', 'not_approved'],
      [{ killSwitchEngaged: true }, 'paused', 'kill_switch'],
      [{ paused: true }, 'paused', 'paused_by_operator'],
      [{ auth: 'needs_reauth' }, 'error', 'reauthorization_required'],
      [{ breaker: 'open' }, 'error', 'circuit_open'],
      [{ lastSuccessAt: null, lastRun: null }, 'configuring', 'never_synced'],
      [{ lastRun: { status: 'failed', at: minutesAgo(5) } }, 'degraded', 'provider_unavailable'],
      [{ rateLimitedUntil: new Date(now.getTime() + 60_000) }, 'degraded', 'rate_limited'],
      [{ driftHeld: true }, 'degraded', 'schema_drift'],
      [{ lastRun: { status: 'partial', at: minutesAgo(5) } }, 'degraded', 'partial_failure'],
      [{ openDeadLetters: 2 }, 'degraded', 'dead_letters_waiting'],
      [{ lastSuccessAt: minutesAgo(3 * 24 * 60) }, 'degraded', 'stale'],
    ];
    for (const [over, status, reason] of cases) expect(h(over), reason).toMatchObject({ status, reason });
  });

  it('treats a failure with nothing current behind it as an outage, and one with current data as a wobble', () => {
    const failed = { status: 'failed' as const, at: minutesAgo(5) };
    expect(h({ lastRun: failed })).toMatchObject({ status: 'degraded' });
    expect(h({ lastRun: failed, lastSuccessAt: minutesAgo(5 * 24 * 60) })).toMatchObject({ status: 'error' });
    expect(h({ lastRun: failed, lastSuccessAt: null })).toMatchObject({ status: 'error' });
  });

  it('lets a rate limit that has already ended go', () => {
    expect(h({ rateLimitedUntil: new Date(now.getTime() - 1) })).toMatchObject({ status: 'healthy' });
  });

  it('resolves two signals that disagree the same way every time', () => {
    // A paused connection with a dead grant is paused: the operator's decision outranks the fault.
    expect(h({ paused: true, auth: 'needs_reauth' })).toMatchObject({ reason: 'paused_by_operator' });
    // A kill switch outranks a pause.
    expect(h({ killSwitchEngaged: true, paused: true })).toMatchObject({ reason: 'kill_switch' });
    // A dead grant outranks an open breaker, because retrying cannot fix it.
    expect(h({ auth: 'needs_reauth', breaker: 'open' })).toMatchObject({ reason: 'reauthorization_required' });
    // An unapproved connection is never reported as anything but waiting for approval.
    expect(h({ approved: false, killSwitchEngaged: true, auth: 'needs_reauth' })).toMatchObject({ reason: 'not_approved' });
  });

  it('gives every reason an operator next step', () => {
    for (const reason of Object.keys(OPERATOR_NEXT_STEP) as HealthReason[]) {
      expect(OPERATOR_NEXT_STEP[reason].length, reason).toBeGreaterThan(10);
    }
    expect(OPERATOR_NEXT_STEP.reauthorization_required).toMatch(/retrying will not help/);
  });
});

describe('the degraded experience', () => {
  const states: Health[] = (['healthy', 'degraded', 'error', 'paused', 'configuring', 'disconnected'] as const)
    .map((status) => ({ status, reason: 'ok' as HealthReason, freshness: 'stale' as const }));

  it('never removes the native journey, for any domain in any state', () => {
    for (const domain of PROVIDER_DOMAINS) {
      for (const state of states) {
        const x = degradedExperience(domain, state, 'Your school');
        expect(x.coreJourneyAvailable, `${domain}/${state.status}`).toBe(true);
        expect(x.nativeRoute).toBe(NATIVE_FALLBACK[domain].nativeRoute);
        expect(x.augments).toBe(NATIVE_FALLBACK[domain].augments);
      }
    }
  });

  it('says nothing to the student when all is well or nothing is connected yet', () => {
    for (const status of ['healthy', 'configuring', 'disconnected'] as const) {
      expect(degradedExperience('lms', { status, reason: 'ok', freshness: 'live' }, 'Canvas').student).toBeNull();
    }
  });

  it('tells the student what still works, in plain words, when it is not updating', () => {
    for (const status of ['degraded', 'error', 'paused'] as const) {
      const s = degradedExperience('lms', { status, reason: 'stale', freshness: 'stale' }, 'Canvas').student ?? '';
      expect(s).toMatch(/Canvas isn.t updating right now/);
      expect(s).toMatch(/Courses, assignments and deadlines still works here/);
      expect(s).toMatch(/last updated/);
      expect(s).not.toMatch(/error|failed|exception|token|401|429/i);
    }
  });

  it('calls data official only when the connection is healthy and the data is live or recent', () => {
    const official = (status: Health['status'], freshness: Health['freshness']) =>
      degradedExperience('sis', { status, reason: 'ok', freshness }, 'Registrar').officialCurrent;
    expect(official('healthy', 'live')).toBe(true);
    expect(official('healthy', 'recent')).toBe(true);
    expect(official('healthy', 'stale')).toBe(false);
    expect(official('degraded', 'recent')).toBe(false);
    expect(official('paused', 'live')).toBe(false);
    expect(official('healthy', 'manual')).toBe(false);
  });

  it('carries state in words and a glyph, one distinct badge per status', () => {
    const badges = CONNECTION_STATUSES.map((status) => degradedExperience('lms', { status, reason: 'ok', freshness: 'live' }, 'x').badge);
    expect(new Set(badges).size).toBe(CONNECTION_STATUSES.length);
    for (const b of badges) expect(b).toMatch(/^\S+ \S/);
  });
});
