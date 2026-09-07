import { describe, expect, it } from 'vitest';
import { ROOM, TURNS, fit, trim } from './chatlog';
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

describe('what a long conversation keeps', () => {
  const say = (role: 'user' | 'assistant', n: number, size = 20) => ({
    role,
    content: `${role[0]}${n} ` + 'x'.repeat(size),
  });

  /** Pairs of question and answer, each pair big enough to matter. */
  const pairs = (count: number, size: number): Turn[] =>
    Array.from({ length: count }, (_, i) => [say('user', i, size), say('assistant', i, size)]).flat();

  it('leaves a conversation that fits exactly alone', () => {
    const turns = pairs(3, 10);
    expect(fit(turns)).toEqual({ turns, dropped: 0 });
  });

  it('keeps the opening exchange when it has to drop something', () => {
    /*
     * The whole point. Trimming from the front loses the question that set up
     * everything after it — the course, the exam, the constraint — and twenty
     * turns later the model has the detail and none of the premise.
     */
    const turns = pairs(8, ROOM / 6);
    const kept = fit(turns);
    expect(kept.dropped).toBeGreaterThan(0);
    expect(kept.turns[0].content).toBe(turns[0].content);
    expect(kept.turns[1].content).toBe(turns[1].content);
  });

  it('keeps the most recent turns too', () => {
    const turns = pairs(8, ROOM / 6);
    const kept = fit(turns);
    expect(kept.turns[kept.turns.length - 1].content).toBe(turns[turns.length - 1].content);
  });

  it('takes the gap out of the middle, not the ends', () => {
    const turns = pairs(8, ROOM / 6);
    const kept = fit(turns).turns.map((t) => t.content);
    const missing = turns.map((t) => t.content).filter((c) => !kept.includes(c));
    const at = missing.map((c) => turns.findIndex((t) => t.content === c));
    // Every dropped turn is from neither the first pair nor the last.
    expect(Math.min(...at)).toBeGreaterThan(1);
    expect(Math.max(...at)).toBeLessThan(turns.length - 1);
  });

  it('still begins with a question, which the API requires', () => {
    for (const n of [2, 5, 8, 14]) {
      const kept = fit(pairs(n, ROOM / 5)).turns;
      if (kept.length) expect(kept[0].role, `${n} pairs`).toBe('user');
    }
  });

  it('reports how many went, so the screen can say so', () => {
    const turns = pairs(8, ROOM / 6);
    const kept = fit(turns);
    expect(kept.dropped).toBe(turns.length - kept.turns.length);
  });

  it('keeps the recent end when even the opening will not fit beside it', () => {
    // One enormous first answer. Keeping it would leave no room for anything
    // the person is actually still talking about.
    const turns: Turn[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'y'.repeat(ROOM - 10) },
      { role: 'user', content: 'recent question' },
      { role: 'assistant', content: 'recent answer' },
    ];
    const kept = fit(turns);
    expect(kept.turns.map((t) => t.content)).toEqual(['recent question', 'recent answer']);
    expect(kept.dropped).toBe(2);
  });

  it('never returns a transcript the API would refuse', () => {
    const kept = fit([{ role: 'assistant', content: 'orphan' }]);
    expect(kept.turns).toEqual([]);
  });

  it('counts turns dropped by the turn cap as well as the size cap', () => {
    const turns = pairs(TURNS, 5);
    const kept = fit([...turns, ...pairs(3, 5)]);
    expect(kept.dropped).toBeGreaterThan(0);
  });
});
