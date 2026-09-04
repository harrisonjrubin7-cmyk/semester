// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { REFILL_HOURS, canPush, enrolmentOf, keyBytes, needsRefill, queueFor } from './push';
import type { NotifKey } from '../data/misc';
import type { DatedItem } from './types';

/*
 * The real rule names, not the ones this file used to invent.
 *
 * These were `due`, `drill` and `registrar`, which are not rules — the cast
 * made them compile and `on.two` was quietly undefined, so a fixture called
 * ALL_ON had four of the seven rules switched off and every test using it was
 * weaker than it read.
 */
const ALL_ON: Record<NotifKey, boolean> = {
  class: true,
  today: true,
  free: true,
  two: true,
  term: true,
  exam: true,
  sun: true,
};

const NONE: Record<NotifKey, boolean> = {
  class: false,
  today: false,
  free: false,
  two: false,
  term: false,
  exam: false,
  sun: false,
};

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

  it('carries where each one should land', () => {
    // Without this the notification arrives, is tapped, and drops the student
    // on the home screen to go and find the thing it just told them about.
    const queue = queueFor(NOW, ALL_ON, railEveryDay);
    expect(queue.length).toBeGreaterThan(0);
    for (const r of queue) {
      expect(r.screen, r.id).toBeTruthy();
    }
  });

  it('names the deadline on the reminders that are about one', () => {
    const soon = {
      id: 'econ-ps4',
      courseId: 'econ',
      title: 'Problem Set 4',
      kind: 'problem set',
      dueShort: 'Thu 11:59 PM',
      weight: '5%',
      daysAway: 2,
      isToday: false,
    } as unknown as DatedItem;
    const withItem = queueFor(NOW, ALL_ON, () => ({ items: [soon], classes: [] }));
    const two = withItem.find((r) => r.id.startsWith('two:'));
    expect(two).toBeTruthy();
    expect(two?.screen).toBe('item');
    expect(two?.item).toBe('econ-ps4');
  });
});

describe('keeping the queue fed', () => {
  const HOUR = 3_600_000;
  const NOW = 1_788_000_000_000;

  it('refills when it never has', () => {
    expect(needsRefill(0, NOW)).toBe(true);
    expect(needsRefill(Number.NaN, NOW)).toBe(true);
  });

  it('leaves it alone until the interval has passed', () => {
    expect(needsRefill(NOW - 1 * HOUR, NOW)).toBe(false);
    expect(needsRefill(NOW - REFILL_HOURS * HOUR, NOW)).toBe(true);
  });

  it('refills when the clock has gone backwards', () => {
    // A device whose time was wrong and got corrected would otherwise never
    // refill again — the switch would say "on" and deliver nothing.
    expect(needsRefill(NOW + 5 * HOUR, NOW)).toBe(true);
  });

  it('keeps a horizon several days deep on a device opened once a day', () => {
    // The bug this exists for: the queue held a week, was written once at the
    // moment the switch was turned on, and was empty seven days later.
    expect(REFILL_HOURS).toBeLessThanOrEqual(24);
  });
});
