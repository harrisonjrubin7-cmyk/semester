import { describe, expect, it } from 'vitest';
import { providerConnectionPresentation } from './provider-connection-state';

describe('provider connection presentation', () => {
  it('distinguishes a held connection from work still in progress', () => {
    expect(
      providerConnectionPresentation({ provider: 'Google', account: 'student@example.edu', connected: true, busy: false, ready: true }),
    ).toEqual({ state: 'confirmed', label: 'Connected', detail: 'student@example.edu' });

    expect(
      providerConnectionPresentation({ provider: 'Google', account: 'student@example.edu', connected: true, busy: true, ready: true }),
    ).toEqual({ state: 'updating', label: 'Connection updating', detail: 'student@example.edu' });
  });

  it('does not call an unconfirmed provider revocation disconnected', () => {
    for (const revocation of ['failed', 'manual'] as const) {
      expect(
        providerConnectionPresentation({ provider: 'Zoom', connected: false, busy: false, ready: true, revocation }),
      ).toEqual({ state: 'reconcile', label: 'Provider access may remain', detail: 'Review access at the provider' });
    }
  });

  it('separates an available sign-in from one this build cannot finish', () => {
    expect(providerConnectionPresentation({ provider: 'Microsoft', connected: false, busy: false, ready: true })).toEqual({
      state: 'pending',
      label: 'Not connected',
      detail: 'Sign-in available',
    });
    expect(providerConnectionPresentation({ provider: 'Apple', connected: false, busy: false, ready: false })).toEqual({
      state: 'blocked',
      label: 'Not connected',
      detail: 'Sign-in unavailable in this build',
    });
  });
});
