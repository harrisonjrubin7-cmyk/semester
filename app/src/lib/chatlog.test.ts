import { describe, expect, it } from 'vitest';
import { ROOM, TURNS, trim } from './chatlog';
import type { Turn } from './claude';

/**
 * A transcript is the one thing in this app with no natural size.
 *
 * So the tests are about the bounds, and about the one shape that breaks
 * resuming: a transcript that starts with an answer. The API refuses a
 * conversation whose first message is not from the user, so trimming from the
 * front has to land on a user turn — which means sometimes dropping one more
 * than the size alone required.
 */

const turn = (role: Turn['role'], n: number, size = 10): Turn => ({
  role,
  content: `${role}${n}`.padEnd(size, '.'),
});

/** A conversation of the usual shape: a question, an answer, a question… */
const talk = (pairs: number, size = 10): Turn[] =>
  Array.from({ length: pairs * 2 }, (_, i) =>
    turn(i % 2 === 0 ? 'user' : 'assistant', Math.floor(i / 2), size),
  );

describe('what is kept', () => {
  it('keeps a short conversation whole', () => {
    const t = talk(3);
    expect(trim(t)).toEqual(t);
  });

  it('keeps the newest turns, not the oldest', () => {
    // The end of a conversation is the part being continued.
    const kept = trim(talk(30));
    expect(kept.length).toBeLessThanOrEqual(TURNS);
    expect(kept.at(-1)).toEqual(talk(30).at(-1));
  });

  it('cuts on size as well as count, because size is what actually binds', () => {
    // Twenty turns of "what is due" is a few hundred characters. Twenty
    // answers about a syllabus is a hundred kilobytes.
    const kept = trim(talk(10, 9000));
    const size = kept.reduce((n, t) => n + t.content.length, 0);
    expect(size).toBeLessThanOrEqual(ROOM);
    expect(kept.length).toBeLessThan(20);
  });
});

describe('the shape that has to survive', () => {
  it('never starts with an answer', () => {
    /*
     * The API refuses a conversation whose first message is not from the
     * user, so a trim that lands mid-pair has to drop one more. A saved
     * conversation that cannot be resumed is worse than none: the student
     * sees their thread, types, and gets an error.
     */
    for (const pairs of [1, 2, 5, 13, 30]) {
      for (const size of [10, 3000, 9000]) {
        const kept = trim(talk(pairs, size));
        if (kept.length > 0) expect(kept[0].role, `${pairs}×${size}`).toBe('user');
      }
    }
  });

  it('returns nothing rather than an unusable fragment', () => {
    // One answer, alone, longer than the whole budget. There is no valid
    // conversation in that, and an empty box is the honest outcome.
    expect(trim([turn('assistant', 0, ROOM + 100)])).toEqual([]);
  });

  it('drops a leading answer left by a trim', () => {
    expect(trim([turn('assistant', 0), turn('user', 1), turn('assistant', 1)])[0].role).toBe('user');
  });
});
