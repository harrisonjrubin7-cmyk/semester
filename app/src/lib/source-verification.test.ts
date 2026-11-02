import { describe, expect, it } from 'vitest';
import {
  CONNECTION_STATES,
  EVALUATION_STATES,
  FRESHNESS_STATES,
  isDefinitiveSourceVerification,
  type SourceVerification,
} from './source-verification';

const definitive: SourceVerification = {
  evaluation: 'ready',
  freshness: 'current',
  connection: 'confirmed',
};

describe('source verification', () => {
  it('matches the fixed pilot connection-state vocabulary', () => {
    expect(CONNECTION_STATES).toEqual([
      'confirmed',
      'pending',
      'updating',
      'stale',
      'blocked',
      'degraded',
      'reconcile',
      'resolved',
    ]);
  });

  it('allows only a ready evaluation from a current, confirmed source', () => {
    for (const evaluation of EVALUATION_STATES) {
      for (const freshness of FRESHNESS_STATES) {
        for (const connection of CONNECTION_STATES) {
          expect(
            isDefinitiveSourceVerification({ evaluation, freshness, connection }),
            `${evaluation}/${freshness}/${connection}`,
          ).toBe(evaluation === 'ready' && freshness === 'current' && connection === 'confirmed');
        }
      }
    }

    expect(isDefinitiveSourceVerification(definitive)).toBe(true);
  });
});
