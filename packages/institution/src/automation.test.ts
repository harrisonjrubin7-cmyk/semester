import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_TEXT, groundsFor, mayStep, missing, rank, type Grounds } from './automation.ts';

const FULL: Grounds = { confirmed: true, authority: 'registrar:enroll', policy: 'reg-window-open', audit: 'evt_1' };

describe('the automation ladder', () => {
  it('has the seven rungs in the brief’s order, each with a meaning and an example', () => {
    expect(LEVELS).toEqual(['inform', 'recommend', 'draft', 'prepare', 'confirm', 'execute', 'verify']);
    for (const l of LEVELS) {
      expect(LEVEL_TEXT[l].means.length).toBeGreaterThan(10);
      expect(LEVEL_TEXT[l].example.length).toBeGreaterThan(10);
    }
  });

  it('asks nothing of the rungs below confirm', () => {
    for (const l of LEVELS.slice(0, 4)) expect(missing(l)).toEqual([]);
  });

  it('asks for all four before execute, and names each that is missing', () => {
    expect(missing('execute')).toEqual(['a confirmation', 'an authority', 'a policy', 'an audit trail']);
    expect(missing('execute', { ...FULL, policy: null })).toEqual(['a policy']);
    expect(missing('execute', { ...FULL, authority: '  ' })).toEqual(['an authority']);
    expect(missing('execute', FULL)).toEqual([]);
  });

  it('never verifies what did not run', () => {
    expect(missing('verify', FULL, false)).toEqual(['an execution to verify']);
    expect(missing('verify', FULL, true)).toEqual([]);
  });

  it('refuses inform → execute even with every ground supplied', () => {
    for (const from of ['inform', 'recommend', 'draft', 'prepare'] as const) {
      const r = mayStep({ from, to: 'execute' }, FULL);
      expect(r.ok, from).toBe(false);
      expect(r.missing).toEqual(['a confirmation step before execute']);
    }
    expect(mayStep({ from: 'confirm', to: 'execute' }, FULL).ok).toBe(true);
    expect(mayStep({ from: 'confirm', to: 'execute' }, { ...FULL, audit: null }).ok).toBe(false);
  });

  it('lets a feature step down, or up within the rungs that ask nothing', () => {
    expect(mayStep({ from: 'execute', to: 'inform' }).ok).toBe(true);
    expect(mayStep({ from: 'inform', to: 'prepare' }).ok).toBe(true);
    expect(mayStep({ from: 'prepare', to: 'confirm' }).ok).toBe(false);
    expect(rank('verify')).toBe(6);
  });


  it('reads the grounds for a commit from what the gateway decided, and leaves a gap as null', () => {
    const full = groundsFor({ confirmed: true, institutionId: 'vu', area: 'registration', actionId: 'add-course', correlationId: 'c1' });
    expect(full).toEqual({ confirmed: true, authority: 'vu:registration:write', policy: 'action:registration:add-course', audit: 'journal:c1' });
    expect(mayStep({ from: 'confirm', to: 'execute' }, full).ok).toBe(true);
    // Truthy is not confirmed: only the explicit boolean counts.
    for (const c of ['true', 1, 'yes', null, undefined]) {
      expect(groundsFor({ confirmed: c, institutionId: 'vu', area: 'registration', actionId: 'a', correlationId: 'c' }).confirmed, String(c)).toBe(false);
    }
    const bare = groundsFor({ confirmed: true, institutionId: '', area: 'registration', actionId: '  ', correlationId: undefined });
    expect(bare).toEqual({ confirmed: true, authority: null, policy: null, audit: null });
    expect(mayStep({ from: 'confirm', to: 'execute' }, bare).missing).toEqual(['an authority', 'a policy', 'an audit trail']);
  });
});
