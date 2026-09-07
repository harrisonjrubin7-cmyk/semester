// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Turn } from './claude';
import { blank, fit, load, save, titleFor, MAX_THREADS, ROOM, type Thread } from './threads';

/**
 * Keeping more than one conversation, and the ways that loses one.
 *
 * Every test here is about a moment where a conversation could disappear
 * without anybody being told, because that is the whole failure this file
 * exists to prevent — the old single-slot store lost one every time somebody
 * pressed "new", and it never said so.
 */

const say = (n: number): Turn[] =>
  Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `line ${i}`,
  }));

const thread = (id: string, at: number, turns = say(2)): Thread => ({
  id,
  title: titleFor(turns),
  turns,
  at,
});

beforeEach(() => localStorage.clear());

describe('titles', () => {
  it('come from the first question, not the last answer', () => {
    // What somebody scanning the list is trying to remember is what they
    // asked. An answer's opening line is about the answer.
    const turns: Turn[] = [
      { role: 'user', content: 'When is the ECON final?' },
      { role: 'assistant', content: 'Friday 12 December at 3pm.' },
    ];
    expect(titleFor(turns)).toBe('When is the ECON final?');
  });

  it('cut at a word, not mid-word', () => {
    const long = 'What should I do about the ECON problem set that is due on Wednesday night';
    const title = titleFor([{ role: 'user', content: long }]);
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith('…')).toBe(true);
    // The cut lands on a boundary: what was kept is a prefix of the question,
    // and the character that came next in the original is a space — so no word
    // was sliced through.
    const kept = title.slice(0, -1);
    expect(long.startsWith(kept)).toBe(true);
    expect(long[kept.length]).toBe(' ');
  });

  it('collapse a pasted question onto one line', () => {
    // Two lines in a list of one-line rows breaks the row height for every
    // other row beside it.
    expect(titleFor([{ role: 'user', content: 'First part\n\nSecond part' }])).toBe(
      'First part Second part',
    );
  });

  it('name an empty thread rather than showing nothing', () => {
    expect(titleFor([])).toBe('New conversation');
  });
});

describe('fitting the set', () => {
  it('keeps the newest and drops the oldest past the cap', () => {
    const many = Array.from({ length: MAX_THREADS + 4 }, (_, i) => thread(`t${i}`, i * 1000));
    const kept = fit(many, 'nothing-open');
    expect(kept).toHaveLength(MAX_THREADS);
    // The newest survived, the oldest did not.
    expect(kept.map((t) => t.id)).toContain(`t${MAX_THREADS + 3}`);
    expect(kept.map((t) => t.id)).not.toContain('t0');
  });

  it('never drops the open one, even when it is the oldest', () => {
    /*
     * The case that matters. Enforcing a limit by deleting the conversation
     * somebody is in the middle of would happen at exactly the moment they
     * were adding to it — the save that makes room is triggered by the turn
     * being appended to the thread it would delete.
     */
    const many = Array.from({ length: MAX_THREADS + 4 }, (_, i) => thread(`t${i}`, i * 1000));
    const kept = fit(many, 't0');
    expect(kept.map((t) => t.id)).toContain('t0');
  });

  it('drops on characters as well as on count', () => {
    /*
     * Each thread here is just under `chatlog`'s own per-thread ceiling, so
     * it survives `trim` intact and the only thing that can drop it is the
     * budget for the whole set. Writing this with one enormous answer per
     * thread proved nothing: `trim` reduced each to empty on its own and the
     * set-wide rule never ran.
     */
    const big = (id: string, at: number): Thread => {
      const half = Math.floor(ROOM / 2) - 200;
      const turns: Turn[] = [
        { role: 'user', content: 'x'.repeat(100) },
        { role: 'assistant', content: 'y'.repeat(half) },
        { role: 'user', content: 'x'.repeat(100) },
        { role: 'assistant', content: 'y'.repeat(half) },
      ];
      return { id, title: 'big', turns, at };
    };
    const four = [big('a', 3), big('b', 2), big('c', 1), big('d', 0)];
    // Sanity: each one really does survive its own trim, or the rest of this
    // test would be measuring the wrong limit.
    expect(fit([four[0]], 'open')[0].turns).toHaveLength(4);

    const kept = fit(four, 'open');
    expect(kept.length).toBeLessThan(4);
    // Newest kept, oldest dropped.
    expect(kept.map((t) => t.id)).toContain('a');
    expect(kept.map((t) => t.id)).not.toContain('d');
  });

  it('forgets an empty thread unless it is the one you are typing into', () => {
    // Otherwise every visit that opened the chat and typed nothing leaves a
    // row behind, and after a week the list is mostly those.
    const kept = fit([thread('used', 2), { ...thread('spare', 1), turns: [] }], 'used');
    expect(kept.map((t) => t.id)).toEqual(['used']);

    const typing = fit([thread('used', 2), { ...thread('spare', 1), turns: [] }], 'spare');
    expect(typing.map((t) => t.id).sort()).toEqual(['spare', 'used']);
  });
});

describe('coming back to it', () => {
  it('reads back what was written', () => {
    save({ threads: [thread('a', 10), thread('b', 20)], openId: 'b' });
    const kept = load();
    expect(kept.threads.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(kept.openId).toBe('b');
  });

  it('opens the newest when the one that was open is gone', () => {
    // Not corruption: the open thread was empty, the tab closed, and `fit`
    // dropped it on the way out. An empty screen with no thread behind it is
    // the state every other branch here exists to avoid.
    save({ threads: [thread('a', 10), thread('b', 20)], openId: 'a' });
    const raw = JSON.parse(localStorage.getItem('semester.threads.v1')!);
    localStorage.setItem(
      'semester.threads.v1',
      JSON.stringify({ ...raw, openId: 'gone' }),
    );
    expect(load().openId).toBe('b');
  });

  it('gives a fresh thread when there is nothing stored', () => {
    const kept = load();
    expect(kept.threads).toHaveLength(1);
    expect(kept.threads[0].turns).toEqual([]);
    expect(kept.openId).toBe(kept.threads[0].id);
  });

  it('gives a fresh thread rather than throwing on nonsense', () => {
    localStorage.setItem('semester.threads.v1', '{ not json');
    expect(load().threads).toHaveLength(1);
    localStorage.setItem('semester.threads.v1', JSON.stringify({ threads: 'no' }));
    expect(load().threads).toHaveLength(1);
  });

  it('drops a turn that is not a turn instead of sending it to the model', () => {
    // A half-read transcript would go up as the conversation so far.
    localStorage.setItem(
      'semester.threads.v1',
      JSON.stringify({
        threads: [{ id: 'a', at: 1, turns: [{ role: 'user', content: 'real' }, { role: 'wat' }, null] }],
        openId: 'a',
      }),
    );
    expect(load().threads[0].turns).toEqual([{ role: 'user', content: 'real' }]);
  });
});

describe('the single conversation the app used to keep', () => {
  it('comes across once, and does not come across twice', () => {
    /*
     * Somebody upgrading mid-conversation should find it where they left it.
     * The second half matters as much: leaving the old key in place would
     * resurrect the same conversation as a new thread on every load, and
     * after a week of that the list is one question repeated.
     */
    localStorage.setItem(
      'semester.ask.v1',
      JSON.stringify({
        turns: [
          { role: 'user', content: 'What is due this week?' },
          { role: 'assistant', content: 'Three things.' },
        ],
        at: 1234,
        courseId: null,
      }),
    );

    const first = load();
    expect(first.threads).toHaveLength(1);
    expect(first.threads[0].title).toBe('What is due this week?');
    expect(first.threads[0].at).toBe(1234);
    expect(localStorage.getItem('semester.ask.v1')).toBe(null);

    // Second load reads the new key and finds the same one thread.
    const again = load();
    expect(again.threads).toHaveLength(1);
    expect(again.threads[0].id).toBe(first.threads[0].id);
  });

  it('does not run once threads exist', () => {
    save({ threads: [thread('a', 10)], openId: 'a' });
    localStorage.setItem(
      'semester.ask.v1',
      JSON.stringify({ turns: [{ role: 'user', content: 'old' }], at: 1, courseId: null }),
    );
    const kept = load();
    expect(kept.threads.map((t) => t.id)).toEqual(['a']);
    // And leaves the old key alone rather than deleting something it did not
    // read: this branch is not the migration.
    expect(localStorage.getItem('semester.ask.v1')).not.toBe(null);
  });
});

describe('blank threads', () => {
  it('get an id nothing else has', () => {
    const ids = new Set(Array.from({ length: 200 }, () => blank().id));
    expect(ids.size).toBe(200);
  });
});
