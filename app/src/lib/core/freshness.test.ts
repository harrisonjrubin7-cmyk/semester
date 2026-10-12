import { describe, expect, it } from 'vitest';
import { POLICY, optimistic, state } from './freshness';

const NOW = Date.UTC(2026, 9, 7, 12);

describe('freshness state', () => {
  it('maps projection lag to live, recent and delayed', () => {
    expect(state({ lastEventAt: NOW, appliedAt: NOW - 3000 }, NOW)).toBe('live');
    expect(state({ lastEventAt: NOW, appliedAt: NOW - 30e3 }, NOW)).toBe('recent');
    expect(state({ lastEventAt: NOW, appliedAt: NOW - 120e3 }, NOW)).toBe('delayed');
  });
  it('a failed worker wins over lag, and a rebuild wins over failure', () => {
    expect(state({ lastEventAt: NOW, appliedAt: NOW, workerFailed: true }, NOW)).toBe('failed');
    expect(state({ lastEventAt: NOW, appliedAt: NOW, workerFailed: true, rebuilding: true }, NOW)).toBe('rebuilding');
  });
  it('delayed data may be destroyed only at source; failed and rebuilding data may not be', () => {
    expect(POLICY[state({ lastEventAt: NOW, appliedAt: NOW - 120e3 }, NOW)].destructive).toBe('confirm-at-source');
    expect(POLICY[state({ lastEventAt: NOW, workerFailed: true }, NOW)].destructive).toBe('disabled');
    expect(POLICY[state({ lastEventAt: NOW, rebuilding: true }, NOW)].destructive).toBe('disabled');
  });
  it('a failed projection is not safe to show as current', () => {
    expect(POLICY.failed.safe).toBe(false);
    expect(POLICY.failed.display).toBe('last-known');
  });
});

describe('optimistic mutation', () => {
  it('confirms once the projection reaches the command version', () => {
    expect(optimistic(5, 5, NOW, NOW)).toBe('confirmed');
    expect(optimistic(5, 6, NOW, NOW)).toBe('confirmed');
  });
  it('stays pending before the timeout and rolls back after it', () => {
    expect(optimistic(5, 4, NOW - 5e3, NOW)).toBe('pending');
    expect(optimistic(5, 4, NOW - 20e3, NOW)).toBe('rolled-back');
  });
});
