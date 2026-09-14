/**
 * The green dots, and what happens to them when the channel breaks.
 *
 * Presence is the one thing in a room that is true only while a socket is
 * open, so the interesting case is not the happy one — it is what the screen
 * shows once nobody is telling it who left. A dot that survives its channel is
 * not a stale ornament, it is the room claiming somebody is sitting in it.
 *
 * Driven through a fake channel rather than a real one, because the question
 * is what `here` does with the four statuses it can be handed, and Realtime
 * has no say in that.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CLOSED' | 'TIMED_OUT';

/** The one channel the fake client hands out, with its callbacks exposed. */
const chan = {
  present: [] as string[],
  tracked: 0,
  sync: (() => {}) as () => void,
  status: ((_s: Status) => {}) as (s: Status) => void,
  on(_type: string, _filter: unknown, cb: () => void) {
    chan.sync = cb;
    return chan;
  },
  subscribe(cb: (s: Status) => void) {
    chan.status = cb;
    return chan;
  },
  track() {
    chan.tracked += 1;
    return Promise.resolve('ok');
  },
  presenceState() {
    return Object.fromEntries(chan.present.map((id) => [id, []]));
  },
};

vi.mock('./cloud', () => ({
  cloudConfigured: true,
  cloud: () =>
    Promise.resolve({
      channel: () => chan,
      removeChannel: () => Promise.resolve('ok'),
    }),
}));

const { here } = await import('./classmates');

/** `here` opens the channel off a promise, so let the microtasks run. */
const settled = () => new Promise((r) => setTimeout(r, 0));

describe('the dots go out when the channel does', () => {
  beforeEach(() => {
    chan.present = [];
    chan.tracked = 0;
  });

  it('says you are here once it is subscribed', async () => {
    here('2026FA', 'vanderbilt/BUS 1600', 'me', () => {});
    await settled();
    chan.status('SUBSCRIBED');
    expect(chan.tracked).toBe(1);
  });

  it.each<Status>(['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'])(
    'clears everybody on %s',
    async (status) => {
      const seen: string[][] = [];
      here('2026FA', 'vanderbilt/BUS 1600', 'me', (ids) => seen.push(ids));
      await settled();

      chan.status('SUBSCRIBED');
      chan.present = ['me', 'ben'];
      chan.sync();
      expect(seen.at(-1)).toEqual(['me', 'ben']);

      // Whatever went wrong, nobody is reporting leaves any more, so the two
      // dots on screen are the last thing heard rather than who is in the room.
      chan.status(status);
      expect(seen.at(-1)).toEqual([]);
    },
  );

  it('fills back in when the channel comes back', async () => {
    const seen: string[][] = [];
    here('2026FA', 'vanderbilt/BUS 1600', 'me', (ids) => seen.push(ids));
    await settled();

    chan.status('SUBSCRIBED');
    chan.present = ['me', 'ben'];
    chan.sync();
    chan.status('CHANNEL_ERROR');
    expect(seen.at(-1)).toEqual([]);

    // The client rejoins on its own and the join handler fires again, which is
    // why clearing costs a blink rather than the feature: saying you are here
    // happens again, and the next sync puts the room back.
    chan.status('SUBSCRIBED');
    expect(chan.tracked).toBe(2);
    chan.sync();
    expect(seen.at(-1)).toEqual(['me', 'ben']);
  });
});
