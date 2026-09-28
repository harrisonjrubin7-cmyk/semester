import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHAIN,
  CUTOVER_CHECKLIST,
  RISKS,
  ROLLOUT_STATES,
  cutoverOpen,
  definition,
  showsOfficialData,
  transition,
  writesOfficialData,
  type Evidence,
  type Gate,
  type RolloutRecord,
} from './rollout';

const migration = readFileSync(
  resolve(__dirname, '../../../../supabase/migrations/20260928050000_tenant_rollout.sql'),
  'utf8',
);

const T0 = '2026-09-01T00:00:00Z';
const after = '2026-09-02T00:00:00Z';
const before = '2026-08-31T00:00:00Z';
const at = (state: RolloutRecord['state'], extra: Partial<RolloutRecord> = {}): RolloutRecord => ({ state, enteredAt: T0, ...extra });
const ev = (gates: readonly Gate[], when = after): Evidence[] => gates.map((gate) => ({ gate, recordedAt: when }));

describe('the registry and the migration are one machine', () => {
  it('every state has the exit gates the database enforces', () => {
    const body = migration.slice(migration.indexOf('private.rollout_exit_gates(from_state text)'));
    for (const d of ROLLOUT_STATES) {
      const line = new RegExp(`when '${d.state}' then array\\[([^\\]]*)\\]`).exec(body);
      expect(line, d.state).not.toBeNull();
      const gates = [...line![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
      expect(gates, d.state).toEqual([...d.exitGates]);
    }
  });

  it('the chain is in the same order in both', () => {
    const rankList = /array_position\(array\[([^\]]*)\]/.exec(migration)![1];
    expect([...rankList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...CHAIN]);
  });

  it('every gate a state names is one the evidence table accepts, and none is unused', () => {
    const check = /gate\s+text\s+not null check \(gate in \(([^)]*)\)\)/.exec(migration)![1];
    const accepted = new Set([...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    const used = new Set(ROLLOUT_STATES.flatMap((d) => d.exitGates));
    expect(used).toEqual(accepted);
  });
});

describe('transition', () => {
  it('the control: one step forward with fresh evidence is allowed', () => {
    expect(transition(at('sandbox_uat'), 'pilot_read_only', ev(['uat_signoff', 'rls_isolation_passed', 'sso_login_verified']))).toEqual({ ok: true });
  });

  it('names every missing gate', () => {
    expect(transition(at('sandbox_uat'), 'pilot_read_only', ev(['uat_signoff']))).toEqual({
      ok: false, reason: 'missing-evidence', missing: ['rls_isolation_passed', 'sso_login_verified'],
    });
  });

  it('evidence from before the state was entered does not count', () => {
    expect(transition(at('claimed'), 'security_review', ev(['security_kickoff'], before))).toMatchObject({ ok: false, reason: 'missing-evidence' });
  });

  it('no skipping, even with every gate on file', () => {
    const all = ev(ROLLOUT_STATES.flatMap((d) => d.exitGates));
    expect(transition(at('sandbox_uat'), 'production_active', all)).toEqual({ ok: false, reason: 'one-step' });
  });

  it('stepping down, holding and offboarding need no evidence', () => {
    expect(transition(at('pilot_write_enabled'), 'pilot_read_only', [])).toEqual({ ok: true });
    expect(transition(at('production_active'), 'suspended', [])).toEqual({ ok: true });
    expect(transition(at('pilot_read_only'), 'offboarding', [])).toEqual({ ok: true });
  });

  it('a hold resumes only to where it was held, with remediation', () => {
    const held = at('suspended', { resumeState: 'pilot_read_only' });
    expect(transition(held, 'production_active', ev(['remediation']))).toEqual({ ok: false, reason: 'resume-to-held' });
    expect(transition(held, 'pilot_read_only', [])).toMatchObject({ ok: false, reason: 'missing-evidence' });
    expect(transition(held, 'pilot_read_only', ev(['remediation']))).toEqual({ ok: true });
  });

  it('archive only from offboarding with a certificate, and it is final', () => {
    expect(transition(at('production_active'), 'archived', ev(['completion_certificate']))).toEqual({ ok: false, reason: 'archive-from-offboarding' });
    expect(transition(at('offboarding'), 'archived', [])).toMatchObject({ ok: false, reason: 'missing-evidence' });
    expect(transition(at('offboarding'), 'archived', ev(['completion_certificate']))).toEqual({ ok: true });
    expect(transition(at('archived'), 'offboarding', [])).toEqual({ ok: false, reason: 'archived' });
  });

  it('a directory listing cannot be held or offboarded', () => {
    expect(transition(at('directory'), 'paused', [])).toEqual({ ok: false, reason: 'not-in-rollout' });
    expect(transition(at('directory'), 'offboarding', [])).toEqual({ ok: false, reason: 'not-in-rollout' });
  });
});

describe('what a state may claim', () => {
  it('no official data before a pilot, and no writes until write-enabled', () => {
    for (const s of ['directory', 'requested', 'claimed', 'security_review', 'sandbox_uat'] as const) {
      expect(showsOfficialData(s), s).toBe(false);
    }
    expect(showsOfficialData('pilot_read_only')).toBe(true);
    expect(writesOfficialData('pilot_read_only')).toBe(false);
    expect(writesOfficialData('pilot_write_enabled')).toBe(true);
    expect(writesOfficialData('suspended')).toBe(false);
  });

  it('a pilot is labelled as one', () => {
    expect(definition('pilot_read_only').uiLabel).toBe('Pilot');
    expect(definition('pilot_write_enabled').uiLabel).toBe('Pilot');
  });
});

describe('registers', () => {
  it('cutover lists what is open, in order', () => {
    const done = new Set(CUTOVER_CHECKLIST.slice(0, -1));
    expect(cutoverOpen(done)).toEqual(['Executive sponsor approves go-live']);
    expect(cutoverOpen(new Set())).toEqual([...CUTOVER_CHECKLIST]);
  });

  it('risk IDs are unique and every risk has an owner and mitigation', () => {
    expect(new Set(RISKS.map((r) => r.id)).size).toBe(RISKS.length);
    for (const r of RISKS) expect(r.owner && r.mitigation, r.id).toBeTruthy();
  });
});
