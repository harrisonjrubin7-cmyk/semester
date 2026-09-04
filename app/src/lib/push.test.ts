// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { canPush, enrolmentOf, keyBytes, queueFor } from './push';
import type { NotifKey } from '../data/misc';
import type { DatedItem } from './types';

const ALL_ON = {
  class: true,
  due: true,
  exam: true,
  drill: true,
  registrar: true,
} as unknown as Record<NotifKey, boolean>;

const NONE = {
  class: false,
  due: false,
  exam: false,
  drill: false,
  registrar: false,
} as unknown as Record<NotifKey, boolean>;

const NOW = new Date(2026, 8, 8, 8, 0); // Tue 8 Sep 2026, 8am

/** A class at 11:00 on whatever day is asked about. */
const railEveryDay = () => ({
  items: [] as DatedItem[],
  classes: [{ label: 'BUS 1600', at: 11 * 60, where: 'Alumni Hall 201' }],
});

describe('whether a push can arrive at all', () => {
  it('says no in a browser with no push manager', () => {
    // jsdom has a service worker shim and no PushManager, which is the same
    // shape as a real browser that cannot do this.
    expect(canPush()).toBe(false);
  });
});

describe('the key the browser insists on', () => {
  it('turns base64url into the bytes it wants', () => {
    // The string form is rejected outright and the error says nothing useful.
    const bytes = keyBytes('BEl-abc_123');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles the padding that base64url leaves off', () => {
    expect(() => keyBytes('AAAA')).not.toThrow();
    expect(() => keyBytes('AAA')).not.toThrow();
    expect(() => keyBytes('AA')).not.toThrow();
  });
});

describe('flattening a subscription', () => {
  const sub = (json: unknown, endpoint = 'https://push.example/abc') =>
    ({ endpoint, toJSON: () => json }) as unknown as PushSubscription;

  it('takes the endpoint and both keys', () => {
    expect(
      enrolmentOf(
        sub({ endpoint: 'https://push.example/abc', keys: { p256dh: 'PK', auth: 'AU' } }),
      ),
    ).toEqual({ endpoint: 'https://push.example/abc', p256dh: 'PK', auth: 'AU' });
  });

  it('refuses one that is missing a key', () => {
    // A subscription without both keys cannot be encrypted to, so storing it
    // would mean a row that fails on every send forever.
    expect(enrolmentOf(sub({ endpoint: 'https://push.example/abc', keys: { p256dh: 'PK' } })))
      .toBeNull();
    expect(enrolmentOf(sub({ keys: { p256dh: 'PK', auth: 'AU' } }, ''))).toBeNull();
  });

  it('survives a subscription that will not serialise', () => {
    const bad = {
      endpoint: 'x',
      toJSON: () => {
        throw new Error('nope');
      },
    } as unknown as PushSubscription;
    expect(enrolmentOf(bad)).toBeNull();
  });
});

describe('queueing the week', () => {
  it('finds the reminder each rule will produce, with when it fires', () => {
    const queue = queueFor(NOW, ALL_ON, railEveryDay);
    expect(queue.length).toBeGreaterThan(0);
    // The class warning is fifteen minutes before an 11:00 class, so the
    // first one is 10:45 on the day this was planned from.
    const first = new Date(queue[0].at);
    expect(first.getHours()).toBe(10);
    expect(first.getMinutes()).toBe(45);
    expect(queue[0].title).toBeTruthy();
  });

  it('never queues anything already past', () => {
    // A server that sends a reminder about this morning at lunchtime is one
    // nobody trusts twice.
    expect(queueFor(NOW, ALL_ON, railEveryDay).every((r) => r.at > NOW.getTime())).toBe(true);
  });

  it('comes back in order', () => {
    const queue = queueFor(NOW, ALL_ON, railEveryDay);
    const times = queue.map((r) => r.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('says nothing at all with every rule switched off', () => {
    expect(queueFor(NOW, NONE, railEveryDay)).toEqual([]);
  });

  it('does not queue the same reminder twice', () => {
    const ids = queueFor(NOW, ALL_ON, railEveryDay).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
