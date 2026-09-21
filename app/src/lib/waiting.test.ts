import { describe, expect, it } from 'vitest';
import { waiting, waitingLine, waitingRoom } from './waiting';
import type { Listed } from './roomchat';

/**
 * A row as `listed` builds one. Defaults are the ordinary case — joined,
 * unmuted, something unread — so every test below names only what it is
 * actually about, and a test about muting cannot accidentally also be a test
 * about having left the room.
 */
function row(code: string, over: Partial<Listed> = {}): Listed {
  return {
    key: `2026F:${code}`,
    code,
    joined: true,
    pinned: false,
    muted: false,
    preview: 'Kayo: is it due Friday?',
    when: 'Tue',
    at: 1_000,
    unread: 1,
    mentions: 0,
    ...over,
  };
}

describe('which rooms count', () => {
  /*
   * The control. Every exclusion below has to fail this one if it is written
   * too broadly — a `waiting` that returns nothing at all would pass all six
   * exclusion tests and be completely broken, and this is the test that says
   * so.
   */
  it('counts an ordinary joined room with something unread', () => {
    const w = waiting([row('ECON 1020')]);
    expect(w.rooms.map((r) => r.code)).toEqual(['ECON 1020']);
    expect(w.count).toBe(1);
  });

  it('counts several ordinary rooms, and totals them', () => {
    const w = waiting([row('ECON 1020', { unread: 4 }), row('PSCI 2200', { unread: 3, at: 2_000 })]);
    expect(w.rooms).toHaveLength(2);
    expect(w.count).toBe(7);
  });

  it('leaves out a room you muted', () => {
    const w = waiting([row('ECON 1020', { muted: true })]);
    expect(w.rooms).toEqual([]);
    expect(w.count).toBe(0);
  });

  it('leaves out a room you have not joined', () => {
    const w = waiting([row('ECON 1020', { joined: false })]);
    expect(w.rooms).toEqual([]);
    expect(w.count).toBe(0);
  });

  it('leaves out a room with nothing unread', () => {
    const w = waiting([row('ECON 1020', { unread: 0 })]);
    expect(w.rooms).toEqual([]);
  });

  it('keeps the unmuted rooms when one of several is muted', () => {
    const w = waiting([row('ECON 1020', { muted: true, unread: 9 }), row('PSCI 2200', { unread: 2 })]);
    expect(w.rooms.map((r) => r.code)).toEqual(['PSCI 2200']);
    expect(w.count).toBe(2);
  });

  it('counts a muted room that names you as still muted', () => {
    // Muting is the student saying do not tell me about this one, and being
    // named does not overrule it. The opposite is defensible and is not what
    // this does; the test exists so changing it has to be deliberate.
    const w = waiting([row('ECON 1020', { muted: true, mentions: 1 })]);
    expect(w.rooms).toEqual([]);
    expect(w.mentions).toBe(0);
  });
});

describe('the order', () => {
  it('puts a room that names you above a busier one that does not', () => {
    const w = waiting([
      row('ECON 1020', { unread: 40, at: 9_000 }),
      row('PSCI 2200', { unread: 1, mentions: 1, at: 1_000 }),
    ]);
    expect(w.rooms.map((r) => r.code)).toEqual(['PSCI 2200', 'ECON 1020']);
  });

  it('puts more mentions above fewer', () => {
    const w = waiting([
      row('ECON 1020', { mentions: 1, at: 9_000 }),
      row('PSCI 2200', { mentions: 3, at: 1_000 }),
    ]);
    expect(w.rooms.map((r) => r.code)).toEqual(['PSCI 2200', 'ECON 1020']);
  });

  it('falls back to what happened most recently', () => {
    const w = waiting([row('ECON 1020', { at: 1_000 }), row('PSCI 2200', { at: 9_000 })]);
    expect(w.rooms.map((r) => r.code)).toEqual(['PSCI 2200', 'ECON 1020']);
  });

  it('is stable by code when two rooms are otherwise equal', () => {
    const w = waiting([row('PSCI 2200'), row('ECON 1020')]);
    expect(w.rooms.map((r) => r.code)).toEqual(['ECON 1020', 'PSCI 2200']);
  });

  it('does not order by pinned', () => {
    // Pinned decides where a row sits in the list you are already reading.
    // This answers what should bring you back, which is a different question.
    const w = waiting([
      row('ECON 1020', { pinned: false, at: 9_000 }),
      row('PSCI 2200', { pinned: true, at: 1_000 }),
    ]);
    expect(w.rooms.map((r) => r.code)).toEqual(['ECON 1020', 'PSCI 2200']);
  });
});

describe('the totals', () => {
  it('adds the mentions across rooms', () => {
    const w = waiting([row('ECON 1020', { mentions: 2 }), row('PSCI 2200', { mentions: 1 })]);
    expect(w.mentions).toBe(3);
  });

  it('counts a mention as unread too, not instead of', () => {
    const w = waiting([row('ECON 1020', { unread: 5, mentions: 2 })]);
    expect(w.count).toBe(5);
    expect(w.mentions).toBe(2);
  });
});

describe('the line', () => {
  it('is empty when nothing is waiting', () => {
    expect(waitingLine(waiting([]))).toBe('');
    expect(waitingLine(waiting([row('ECON 1020', { unread: 0 })]))).toBe('');
  });

  it('never says you are caught up', () => {
    // A permanent row explaining that a row was not needed. `lib/you.ts`'s
    // third rule: a figure that rests on nothing is not shown.
    expect(waitingLine(waiting([row('ECON 1020', { muted: true })]))).toBe('');
  });

  it('names the room when one room has everything', () => {
    expect(waitingLine(waiting([row('ECON 1020', { unread: 4 })]))).toBe('4 new in ECON 1020.');
  });

  it('counts the rooms when there are several', () => {
    const w = waiting([row('ECON 1020', { unread: 4 }), row('PSCI 2200', { unread: 5, at: 2_000 })]);
    expect(waitingLine(w)).toBe('9 new, across 2 rooms.');
  });

  it('leads with being named, in the singular', () => {
    expect(waitingLine(waiting([row('ECON 1020', { unread: 3, mentions: 1 })]))).toBe(
      'A message names you in ECON 1020.',
    );
  });

  it('leads with being named, in the plural', () => {
    expect(waitingLine(waiting([row('ECON 1020', { unread: 6, mentions: 2 })]))).toBe(
      '2 messages name you in ECON 1020.',
    );
  });

  it('counts only the rooms that name you when several do', () => {
    const w = waiting([
      row('ECON 1020', { unread: 3, mentions: 1 }),
      row('PSCI 2200', { unread: 2, mentions: 1, at: 2_000 }),
      row('HIST 1500', { unread: 9 }),
    ]);
    // Three rooms have something; two name you, and it is those the line counts.
    expect(waitingLine(w)).toBe('2 messages name you, across 2 rooms.');
  });

  it('says nothing about volume once you have been named', () => {
    const w = waiting([row('ECON 1020', { unread: 40, mentions: 1 })]);
    expect(waitingLine(w)).not.toMatch(/40/);
  });

  it('carries no score, streak or comparison', () => {
    const w = waiting([row('ECON 1020', { unread: 4, mentions: 1 }), row('PSCI 2200', { unread: 2 })]);
    expect(waitingLine(w)).not.toMatch(/streak|in a row|%|score|points|behind|faster|than you/i);
  });
});

describe('where the line goes', () => {
  it('is null when nothing is waiting', () => {
    expect(waitingRoom(waiting([]))).toBeNull();
  });

  it('is the room that names you, not the loudest', () => {
    const w = waiting([
      row('ECON 1020', { unread: 40, at: 9_000 }),
      row('PSCI 2200', { unread: 1, mentions: 1 }),
    ]);
    expect(waitingRoom(w)).toBe('PSCI 2200');
  });
});
