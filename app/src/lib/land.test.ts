import { describe, expect, it } from 'vitest';
import { HOME, landingFor, landingFrom, worthGoing } from './land';
import { dueReminders } from './notify';
import type { NotifKey } from '../data/misc';
import type { DatedItem } from './types';

/**
 * The ids are built in `notify.ts` and parsed in `land.ts`, which is two
 * places for one format to live. So rather than hand-writing ids here, this
 * asks `dueReminders` for real ones and lands those — if the format changes on
 * either side, this file fails rather than the app quietly sending everybody
 * home again.
 */

const NOW = new Date('2026-09-06T09:00:00');

const off = (): Record<NotifKey, boolean> => ({
  class: false,
  today: false,
  free: false,
  two: false,
  term: false,
  exam: false,
  sun: false,
});

const item = (over: Partial<DatedItem>): DatedItem =>
  ({
    id: 'econ-ps4',
    courseId: 'econ',
    title: 'Problem Set 4',
    kind: 'problem set',
    dueShort: 'Fri 11:59 PM',
    weight: '5%',
    daysAway: 2,
    isToday: false,
    ...over,
  }) as DatedItem;

const real = (on: Partial<Record<NotifKey, boolean>>, src: Parameters<typeof dueReminders>[2]) =>
  dueReminders(NOW, { ...off(), ...on } as Record<NotifKey, boolean>, src);

describe('a reminder about one deadline', () => {
  it('opens that deadline, not the list it is in', () => {
    const [r] = real({ two: true }, { items: [item({})], classes: [] });
    expect(r).toBeTruthy();
    expect(landingFor(r.id)).toEqual({ screen: 'item', item: 'econ-ps4' });
  });

  it('does the same for an exam', () => {
    const [r] = real(
      { exam: true },
      { items: [item({ id: 'econ-mid', title: 'Midterm', kind: 'exam', daysAway: 7 })], classes: [] },
    );
    expect(r).toBeTruthy();
    expect(landingFor(r.id)).toEqual({ screen: 'item', item: 'econ-mid' });
  });

  it('keeps an id that has colons of its own', () => {
    // An item id is not guaranteed to be colon-free, and splitting into three
    // would have truncated one.
    expect(landingFor('two:2026-09-06:brightspace:12:44')).toEqual({
      screen: 'item',
      item: 'brightspace:12:44',
    });
  });
});

describe('a reminder about a day rather than a thing', () => {
  it('puts a class fifteen minutes out on the day, where the room is', () => {
    const [r] = real(
      { class: true },
      { items: [], classes: [{ label: 'ECON 1020', at: 9 * 60 + 10, where: 'Buttrick 101' }] },
    );
    expect(r).toBeTruthy();
    expect(landingFor(r.id)).toEqual({ screen: 'calendar' });
  });

  it('puts the weekly report on the report', () => {
    const sunday = new Date('2026-09-06T19:00:00');
    const [r] = dueReminders(sunday, { ...off(), sun: true } as Record<NotifKey, boolean>, { items: [], classes: [] });
    expect(r).toBeTruthy();
    expect(landingFor(r.id)).toEqual({ screen: 'weekly' });
  });

  it('puts "3 due today" on home, which is where they are', () => {
    const [r] = real({ today: true }, { items: [item({ isToday: true })], classes: [] });
    expect(r).toBeTruthy();
    expect(landingFor(r.id)).toEqual(HOME);
  });
});

describe('what it refuses to guess', () => {
  it('lands home on a shape it does not know', () => {
    // A reminder from an older build sitting in a queue. Sending somebody to a
    // screen picked by a bad parse is worse than the behaviour it replaces.
    expect(landingFor('nonsense')).toEqual(HOME);
    expect(landingFor('unheardof:2026-09-06:x')).toEqual(HOME);
    expect(landingFor('')).toEqual(HOME);
    expect(landingFor(undefined as never)).toEqual(HOME);
  });

  it('lands home on a deadline reminder with no deadline in it', () => {
    expect(landingFor('two:2026-09-06')).toEqual(HOME);
    expect(landingFor('two:2026-09-06:')).toEqual(HOME);
  });
});

describe('reading what a notification carried', () => {
  it('takes the deadline it names', () => {
    expect(landingFrom({ item: 'econ-ps4' })).toEqual({ screen: 'item', item: 'econ-ps4' });
  });

  it('takes a screen it knows', () => {
    expect(landingFrom({ screen: 'weekly' })).toEqual({ screen: 'weekly' });
  });

  it('refuses a screen it does not', () => {
    // The payload is written by one version of the app and read by whichever
    // is installed when it arrives.
    expect(landingFrom({ screen: 'account' })).toEqual(HOME);
    expect(landingFrom({ screen: 'javascript:alert(1)' })).toEqual(HOME);
  });

  it('survives a payload that is not one', () => {
    expect(landingFrom(null)).toEqual(HOME);
    expect(landingFrom('two')).toEqual(HOME);
    expect(landingFrom({})).toEqual(HOME);
  });
});

describe('whether it is worth navigating at all', () => {
  it('says no for home, which is where the app already is', () => {
    expect(worthGoing(HOME)).toBe(false);
  });

  it('says yes for anywhere else', () => {
    expect(worthGoing({ screen: 'weekly' } as never)).toBe(true);
    expect(worthGoing({ screen: 'item', item: 'x' } as never)).toBe(true);
  });
});
