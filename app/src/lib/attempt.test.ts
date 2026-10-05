import { describe, expect, it } from 'vitest';
import { Attempts, ServiceError, newKey, serviceError, settled } from './attempt';

/**
 * The retry rule both ledgers depend on: a key belongs to an attempt, is kept
 * across a retry whose outcome was unknown, and is dropped once the server
 * has answered — yes or no.
 */

describe('an idempotency key', () => {
  it('is one both ledgers accept, whatever the prefix', () => {
    for (const prefix of ['enroll:3f1c', 'enter:item-1:ana:9.5::', 'a b/c?d', '']) {
      const key = newKey(prefix);
      expect(key).toMatch(/^[A-Za-z0-9:._-]{8,128}$/);
    }
  });

  it('is new each time it is made', () => {
    expect(newKey('x')).not.toBe(newKey('x'));
  });
});

describe('an attempt', () => {
  it('keeps its key until it is settled, then makes a new one', () => {
    let n = 0;
    const a = new Attempts((p) => `${p}.${++n}`);
    const first = a.keyFor('enroll:s1');
    expect(a.keyFor('enroll:s1')).toBe(first);
    expect(a.pending('enroll:s1')).toBe(true);
    a.settle('enroll:s1');
    expect(a.pending('enroll:s1')).toBe(false);
    expect(a.keyFor('enroll:s1')).not.toBe(first);
  });

  it('keeps separate keys for separate requests', () => {
    const a = new Attempts();
    expect(a.keyFor('enroll:s1')).not.toBe(a.keyFor('enroll:s2'));
  });
});

describe('a failed call', () => {
  it('with a SQLSTATE is an answer, in the server’s own words', () => {
    const e = serviceError({ code: 'P0001', message: 'semester: that student is not enrolled in this course' }, 'Fallback.');
    expect(e.answered).toBe(true);
    expect(e.message).toBe('That student is not enrolled in this course.');
    expect(settled(e)).toBe(true);
  });

  it('with no SQLSTATE is the network, and says the outcome is unknown', () => {
    const e = serviceError({ message: 'TypeError: Failed to fetch', code: '' }, 'The enrollment was not sent.');
    expect(e.answered).toBe(false);
    expect(e.message).toMatch(/^The enrollment was not sent\. .*not known whether the change was made/);
    expect(settled(e)).toBe(false);
  });

  it('that is not a ServiceError is never taken as settled', () => {
    expect(settled(new Error('boom'))).toBe(false);
    expect(settled(new ServiceError('x', false))).toBe(false);
  });
});
