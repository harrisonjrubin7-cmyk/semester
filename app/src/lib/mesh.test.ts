import { describe, expect, it } from 'vitest';
import {
  BEAT,
  FADES,
  KEPT,
  MARKS,
  RESTING,
  TTL,
  addressed,
  callsFirst,
  drop,
  expired,
  greets,
  heard,
  hostOf,
  reacted,
  polite,
  reconcile,
  seen,
  type Line,
  type Mark,
  type Roster,
  type Signal,
} from './mesh';

const NOW = 1_700_000_000_000;

const here = (from: string, at = NOW, over: Partial<typeof RESTING> = {}): Signal => ({
  t: 'here',
  from,
  at,
  flags: { ...RESTING, name: from, ...over },
});

describe('who a signal is for', () => {
  it('hands the room’s signals to everybody but the sender', () => {
    expect(addressed(here('bea'), 'ana')).toBe(true);
    expect(addressed(here('ana'), 'ana')).toBe(false);
  });

  it('hands an addressed one to its addressee only', () => {
    const offer: Signal = { t: 'offer', from: 'bea', to: 'ana', sdp: 'v=0' };
    expect(addressed(offer, 'ana')).toBe(true);
    expect(addressed(offer, 'cal')).toBe(false);
  });

  it('never hands anybody their own signal back', () => {
    // Broadcast means broadcast: the sender's own message returns on the
    // channel, and a peer that answered its own offer would deadlock.
    expect(addressed({ t: 'offer', from: 'ana', to: 'bea', sdp: 'v=0' }, 'ana')).toBe(false);
  });
});

describe('who offers', () => {
  it('is the lower id, and both ends agree', () => {
    expect(callsFirst('ana', 'bea')).toBe(true);
    expect(callsFirst('bea', 'ana')).toBe(false);
  });

  it('pairs exactly one caller with one polite peer, every way round', () => {
    // The property that stops glare. Asserted over pairs rather than by
    // reading the two functions, because the bug this prevents is the two of
    // them drifting apart.
    const ids = ['ana', 'bea', 'cal', 'dee', 'a', 'aa', 'z9'];
    for (const me of ids) {
      for (const them of ids) {
        if (me === them) continue;
        expect(callsFirst(me, them), `${me}/${them}`).not.toBe(callsFirst(them, me));
        expect(polite(me, them), `${me}/${them}`).toBe(!callsFirst(me, them));
      }
    }
  });
});

describe('the roster', () => {
  it('adds somebody the first time they say they are here', () => {
    const r = seen({}, here('bea'), NOW);
    expect(r.bea).toMatchObject({ id: 'bea', joinedAt: NOW, heard: NOW });
    expect(r.bea.flags.name).toBe('bea');
  });

  it('keeps the moment they arrived through every later beat', () => {
    // The gallery falls back to arrival order, so a heartbeat that refreshed
    // this would shuffle the tiles every five seconds.
    let r = seen({}, here('bea'), NOW);
    r = seen(r, here('bea'), NOW + BEAT);
    r = seen(r, here('bea'), NOW + BEAT * 2);
    expect(r.bea.joinedAt).toBe(NOW);
    expect(r.bea.heard).toBe(NOW + BEAT * 2);
  });

  it('takes a new state without moving them', () => {
    let r = seen({}, here('bea'), NOW);
    r = seen(r, { t: 'state', from: 'bea', flags: { ...RESTING, name: 'bea', muted: true } }, NOW + 10);
    expect(r.bea.flags.muted).toBe(true);
    expect(r.bea.joinedAt).toBe(NOW);
  });

  it('removes them when they leave', () => {
    const r = seen(seen({}, here('bea'), NOW), { t: 'gone', from: 'bea' }, NOW + 1);
    expect(r.bea).toBeUndefined();
  });

  it('does not invent a nameless peer out of an ICE candidate', () => {
    const r = seen({}, { t: 'ice', from: 'ghost', to: 'me', candidate: {} }, NOW);
    expect(Object.keys(r)).toEqual([]);
  });

  it('counts anything from a known peer as proof of life', () => {
    let r = seen({}, here('bea'), NOW);
    r = seen(r, { t: 'ice', from: 'bea', to: 'me', candidate: {} }, NOW + 400);
    expect(r.bea.heard).toBe(NOW + 400);
  });

  it('gives back the same object when nothing changed', () => {
    // The screen holds this in state; a new object per ignored signal is a
    // render per ignored signal.
    const r = seen({}, here('bea'), NOW);
    expect(seen(r, { t: 'gone', from: 'nobody' }, NOW)).toBe(r);
    expect(seen(r, { t: 'ice', from: 'nobody', to: 'me', candidate: {} }, NOW)).toBe(r);
  });

  it('never edits the roster it was handed', () => {
    const r = seen({}, here('bea'), NOW);
    const after = seen(r, { t: 'gone', from: 'bea' }, NOW + 1);
    expect(r.bea).toBeDefined();
    expect(after.bea).toBeUndefined();
  });
});

describe('peers that stop saying anything', () => {
  const roster = (): Roster => seen(seen({}, here('bea'), NOW), here('cal'), NOW);

  it('are kept while they are still beating', () => {
    expect(expired(roster(), NOW + TTL)).toEqual([]);
  });

  it('are named once they are past the deadline', () => {
    // A lid closed, a tab killed by the system, a browser that never got to
    // say `gone` — which is most of the ways a call ends.
    expect(expired(roster(), NOW + TTL + 1).sort()).toEqual(['bea', 'cal']);
  });

  it('survive one missed beat, and two', () => {
    expect(expired(roster(), NOW + BEAT * 2)).toEqual([]);
  });

  it('go quietly', () => {
    const left = drop(roster(), ['bea']);
    expect(Object.keys(left)).toEqual(['cal']);
    const same = roster();
    expect(drop(same, [])).toBe(same);
  });
});

describe('which connections to hold open', () => {
  it('opens one for somebody new', () => {
    const r = seen({}, here('bea'), NOW);
    expect(reconcile(r, [])).toEqual({ start: ['bea'], stop: [] });
  });

  it('closes one for somebody gone', () => {
    expect(reconcile({}, ['bea'])).toEqual({ start: [], stop: ['bea'] });
  });

  it('leaves a connection that is already right alone', () => {
    const r = seen({}, here('bea'), NOW);
    expect(reconcile(r, ['bea'])).toEqual({ start: [], stop: [] });
  });

  it('handles a room turning over in one step', () => {
    // Out of order, twice, some not at all — which is why this compares two
    // sets instead of acting on each event.
    const r = seen(seen({}, here('cal'), NOW), here('dee'), NOW);
    expect(reconcile(r, ['bea', 'cal'])).toEqual({ start: ['dee'], stop: ['bea'] });
  });
});

describe('the in-call chat', () => {
  const roster = seen({}, here('bea'), NOW);
  const said = (body: string, at = NOW): Signal => ({ t: 'said', from: 'bea', at, body });

  it('keeps the name as it was when they said it', () => {
    // Looked up at render, a message turns into "Somebody" the moment its
    // author hangs up — which is exactly when you are reading back what they
    // said.
    const lines = heard([], said('the answer is on slide 9'), roster);
    expect(lines[0]).toMatchObject({ name: 'bea', body: 'the answer is on slide 9' });
    const after = heard(lines, said('still here'), {});
    expect(after[0].name).toBe('bea');
    expect(after[1].name).toBe('Somebody');
  });

  it('ignores an empty one', () => {
    const lines: Line[] = [];
    expect(heard(lines, said('   '), roster)).toBe(lines);
  });

  it('ignores anything that is not a message', () => {
    const lines: Line[] = [];
    expect(heard(lines, here('bea'), roster)).toBe(lines);
  });

  it('keeps the last of a long call and not the first', () => {
    let lines: Line[] = [];
    for (let i = 0; i < KEPT + 20; i++) lines = heard(lines, said(`line ${i}`, NOW + i), roster);
    expect(lines).toHaveLength(KEPT);
    expect(lines[lines.length - 1].body).toBe(`line ${KEPT + 19}`);
    expect(lines[0].body).toBe('line 20');
  });

  it('gives every line an id of its own', () => {
    let lines: Line[] = [];
    for (let i = 0; i < 40; i++) lines = heard(lines, said('same words', NOW), roster);
    expect(new Set(lines.map((l) => l.id)).size).toBe(40);
  });
});

describe('reactions', () => {
  const react = (from: string, mark: string, at = NOW): Signal => ({ t: 'react', from, at, mark });

  it('shows one', () => {
    expect(reacted([], react('bea', '👏'), NOW)).toEqual([{ from: 'bea', mark: '👏', at: NOW }]);
  });

  it('lets one person hold one mark, not ten', () => {
    const first = reacted([], react('bea', '👏'), NOW);
    const second = reacted(first, react('bea', '🎉', NOW + 100), NOW + 100);
    expect(second).toHaveLength(1);
    expect(second[0].mark).toBe('🎉');
  });

  it('keeps everybody else’s', () => {
    const two = reacted(reacted([], react('bea', '👏'), NOW), react('cal', '👍'), NOW);
    expect(two.map((m) => m.from).sort()).toEqual(['bea', 'cal']);
  });

  it('fades them without needing a timer', () => {
    // Expiry on read, so a call left in a background tab does not pile up.
    const marks = reacted([], react('bea', '👏'), NOW);
    expect(reacted(marks, { t: 'gone', from: 'x' }, NOW + FADES - 1)).toHaveLength(1);
    expect(reacted(marks, { t: 'gone', from: 'x' }, NOW + FADES)).toHaveLength(0);
  });

  it('refuses a mark that is not one of the six', () => {
    // The channel is broadcast, so anything could arrive on it.
    expect(reacted([], react('bea', '<img src=x>'), NOW)).toEqual([]);
    for (const mark of MARKS) {
      expect(reacted([], react('bea', mark), NOW), mark).toHaveLength(1);
    }
  });

  it('gives back the same array when nothing moved', () => {
    const marks: Mark[] = [];
    expect(reacted(marks, here('bea'), NOW)).toBe(marks);
  });
});

describe('who counts as the host', () => {
  it('is whoever has been here longest, me included', () => {
    let r = seen({}, here('bea', NOW), NOW + 5_000);
    r = seen(r, here('cal', NOW), NOW + 9_000);
    expect(hostOf(r, 'me', NOW)).toBe('me');
    expect(hostOf(r, 'me', NOW + 20_000)).toBe('bea');
  });

  it('is the same person in every tab, because every tab works it out alone', () => {
    const r = seen(seen({}, here('zed'), NOW), here('ada'), NOW);
    expect(hostOf(r, 'me', NOW)).toBe('ada');
    expect(hostOf(r, 'ada', NOW)).toBe('ada');
  });

  it('is you when you are the only one here', () => {
    expect(hostOf({}, 'me', NOW)).toBe('me');
  });
});

describe('answering a hello', () => {
  it('answers somebody we have not heard from', () => {
    expect(greets(here('bea'), [])).toBe(true);
  });

  it('does not answer somebody we already know', () => {
    expect(greets(here('bea'), ['bea'])).toBe(false);
  });

  it('does not answer anything that is not a hello', () => {
    expect(greets({ t: 'gone', from: 'bea' }, [])).toBe(false);
    expect(greets({ t: 'state', from: 'bea', flags: RESTING }, [])).toBe(false);
  });

  it('terminates — a hello answered is a hello not answered again', () => {
    /*
     * The property that keeps a rule which sends a message on receiving one
     * from filling the channel. Played out in full between two peers, each
     * learning the other exactly as `lib/rtc.ts` does: a peer is "known" from
     * the moment anything is heard from them.
     *
     * Three messages, not an unbounded ping-pong: ana's arrival, bea's answer,
     * and ana's answer to that — which bea does not answer, because by then
     * ana is somebody bea has heard from.
     */
    const known: Record<string, string[]> = { ana: [], bea: [] };
    const sent: string[] = [];
    const queue = [{ from: 'ana', to: 'bea' }];

    while (queue.length > 0 && sent.length < 20) {
      const { from, to } = queue.shift()!;
      sent.push(`${from}→${to}`);
      const answer = greets(here(from), known[to]);
      if (!known[to].includes(from)) known[to].push(from);
      if (answer) queue.push({ from: to, to: from });
    }

    expect(sent).toEqual(['ana→bea', 'bea→ana', 'ana→bea']);
    expect(known.ana).toEqual(['bea']);
    expect(known.bea).toEqual(['ana']);
  });
});
