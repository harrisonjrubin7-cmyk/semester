import { describe, expect, it } from 'vitest';
import { mayShowDefinitiveReadiness, type SourceResult } from './source-definitive';

const ready: SourceResult = { evaluation: 'ready', freshness: 'current', connection: 'confirmed' };

describe('mayShowDefinitiveReadiness', () => {
  it('allows a definitive result only when evaluation, freshness and connection all agree', () => {
    expect(mayShowDefinitiveReadiness(ready)).toBe(true);
  });

  it.each([
    ['stale freshness', { ...ready, freshness: 'stale' }],
    ['unknown freshness', { ...ready, freshness: 'unknown' }],
    ['failed freshness', { ...ready, freshness: 'failed' }],
    ['updating freshness', { ...ready, freshness: 'updating' }],
    ['degraded connection', { ...ready, connection: 'degraded' }],
    ['reconcile connection', { ...ready, connection: 'reconcile' }],
    ['blocked evaluation', { ...ready, evaluation: 'blocked' }],
    ['needs_review evaluation', { ...ready, evaluation: 'needs_review' }],
    ['failed evaluation', { ...ready, evaluation: 'failed' }],
  ] as const)('withholds a definitive result on %s', (_label, result) => {
    expect(mayShowDefinitiveReadiness(result)).toBe(false);
  });
});
