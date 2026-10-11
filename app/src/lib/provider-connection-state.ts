export type ProviderConnectionState = 'confirmed' | 'pending' | 'updating' | 'blocked' | 'reconcile';

export interface ProviderConnectionPresentation {
  state: ProviderConnectionState;
  label: string;
  detail: string;
}

interface ProviderConnectionFacts {
  provider: string;
  account?: string;
  connected: boolean;
  busy: boolean;
  ready: boolean;
  revocation?: 'revoked' | 'failed' | 'manual';
}

/**
 * Turns provider facts into the one status shown on Connect.
 *
 * A local token proves only that this browser holds a connection. A failed or
 * manual revocation is therefore shown as reconciliation, not disconnected,
 * because permission may still exist at the provider.
 */
export function providerConnectionPresentation({
  provider,
  account,
  connected,
  busy,
  ready,
  revocation,
}: ProviderConnectionFacts): ProviderConnectionPresentation {
  if (connected) {
    return busy
      ? { state: 'updating', label: 'Connection updating', detail: account || provider }
      : { state: 'confirmed', label: 'Connected', detail: account || 'This account' };
  }

  if (revocation === 'failed' || revocation === 'manual') {
    return {
      state: 'reconcile',
      label: 'Provider access may remain',
      detail: 'Review access at the provider',
    };
  }

  return ready
    ? { state: 'pending', label: 'Not connected', detail: 'Sign-in available' }
    : { state: 'blocked', label: 'Not connected', detail: 'Sign-in unavailable in this build' };
}
