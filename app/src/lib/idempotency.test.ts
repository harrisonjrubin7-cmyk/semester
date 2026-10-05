import { describe, expect, it } from 'vitest';
import { IntentKeys } from './idempotency';

describe('one key per intent', () => {
  const counting = () => {
    let n = 0;
    return new IntentKeys(() => `key-${++n}`);
  };

  it('gives a retry of the same intent the same key', () => {
    const keys = counting();
    expect(keys.keyFor('pay:2026FA:25000')).toBe('key-1');
    expect(keys.keyFor('pay:2026FA:25000')).toBe('key-1');
  });

  it('gives a different intent — the amount changed — a different key', () => {
    const keys = counting();
    keys.keyFor('pay:2026FA:25000');
    expect(keys.keyFor('pay:2026FA:30000')).toBe('key-2');
  });

  it('mints a new key once the write has landed, so the next payment is a new payment', () => {
    const keys = counting();
    keys.keyFor('give:1');
    keys.settle('give:1');
    expect(keys.keyFor('give:1')).toBe('key-2');
  });

  it('makes keys the dining functions accept', () => {
    const key = new IntentKeys().keyFor('x');
    expect(key).toMatch(/^[A-Za-z0-9_.:-]{8,64}$/);
  });
});
