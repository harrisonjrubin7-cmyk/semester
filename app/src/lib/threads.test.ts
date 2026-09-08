// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Turn } from './claude';
import {
  blank,
  fit,
  sift,
  load,
  save,
  clearAll,
  archive,
  loadArchive,
  unarchive,
  startedOn,
  titleFor,
  MAX_THREADS,
  MAX_ARCHIVE,
  ROOM,
  type Thread,
  bucket,
  grouped,
  nameOf,
  search,
  foundIn,
} from './threads';

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

describe('a conversation you named yourself', () => {
  const t = (over: Partial<Thread> = {}): Thread => ({
    id: 'a', title: 'What is elasticity?', turns: [{ role: 'user', content: 'What is elasticity?' }],
    at: 1, ...over,
  });

  it('is called what you called it', () => {
    expect(nameOf(t({ name: 'Midterm plan' }))).toBe('Midterm plan');
  });

  it('falls back to the first question when it has no name', () => {
    expect(nameOf(t())).toBe('What is elasticity?');
  });

  it('falls back when the name is only spaces, not to a blank row', () => {
    expect(nameOf(t({ name: '   ' }))).toBe('What is elasticity?');
  });

  it('survives the title being recomputed, which is the whole reason it is a separate field', () => {
    // `title` is rewritten from the turns on every change. A name written into
    // it would last until the next question and then silently revert.
    const named = { ...t({ name: 'Midterm plan' }), title: titleFor([{ role: 'user', content: 'A later question' }]) };
    expect(nameOf(named)).toBe('Midterm plan');
  });
});

describe('pinning', () => {
  const big = (id: string, at: number, pinned = false): Thread => ({
    id, title: id, at, pinned: pinned || undefined,
    turns: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'x'.repeat(20_000) }],
  });

  it('keeps a thread the cap would otherwise drop', () => {
    /*
     * The point of pinning, and the thing it would be dishonest to offer
     * without: the revision plan from week three is exactly the conversation
     * a twelve-thread cap deletes in week eight.
     */
    const old = big('keep-me', 1, true);
    const rest = Array.from({ length: MAX_THREADS + 4 }, (_, i) => big(`t${i}`, 100 + i));
    const kept = fit([old, ...rest], 't0');
    expect(kept.map((x) => x.id)).toContain('keep-me');
  });

  it('puts pinned threads first, and newest within each group', () => {
    const list = [big('old-pin', 1, true), big('new', 300), big('older', 2)];
    expect(fit(list, 'new').map((x) => x.id)).toEqual(['old-pin', 'new', 'older']);
  });

  it('does not promise more than it can keep', () => {
    // Enough enormous pinned threads to exceed the whole budget still lose
    // the oldest. A promise the code cannot keep is worse than a stated limit.
    const many = Array.from({ length: 20 }, (_, i) => big(`p${i}`, i, true));
    const kept = fit(many, 'p19');
    expect(kept.length).toBeLessThan(many.length);
    expect(kept.map((x) => x.id)).toContain('p19');
  });
});

describe('searching the conversations', () => {
  const t = (id: string, first: string, said = '', over: Partial<Thread> = {}): Thread => ({
    id, title: first, at: Number(id.slice(1)) || 1,
    turns: [{ role: 'user', content: first }, ...(said ? [{ role: 'assistant' as const, content: said }] : [])],
    ...over,
  });

  const list = [
    t('t3', 'What is elasticity?', 'Responsiveness of quantity to price.'),
    t('t2', 'When is the BUS final?', 'December the ninth, at nine in the morning.'),
    t('t1', 'New conversation', 'Something about redlining and the HOLC.'),
  ];

  it('matches what a thread is called', () => {
    expect(search(list, 'elasticity').map((x) => x.id)).toEqual(['t3']);
  });

  it('matches what was said in it, which is usually why you are looking', () => {
    expect(search(list, 'redlining').map((x) => x.id)).toEqual(['t1']);
  });

  it('matches a name you gave it', () => {
    const named = [...list, t('t9', 'Untitled', '', { name: 'Midterm plan' })];
    expect(search(named, 'midterm').map((x) => x.id)).toEqual(['t9']);
  });

  it('ignores case and spacing on both sides', () => {
    expect(search(list, '  ELASTICITY ').map((x) => x.id)).toEqual(['t3']);
  });

  it('matches across a line break in the transcript', () => {
    const wrapped = [t('t5', 'q', 'nine in\nthe morning')];
    expect(search(wrapped, 'nine in the morning')).toHaveLength(1);
  });

  it('is every thread for an empty query, never none', () => {
    expect(search(list, '')).toHaveLength(3);
    expect(search(list, '   ')).toHaveLength(3);
  });

  it('puts pinned first among the matches, the same as with no query', () => {
    // Same order typed and untyped, so searching does not make the reader
    // re-find their bearings on every keystroke.
    const pinned = [
      ...list.map((x) => ({ ...x, turns: [...x.turns, { role: 'user' as const, content: 'about the exam' }] })),
      t('t0', 'Oldest, and pinned', 'about the exam', { pinned: true }),
    ];
    expect(search(pinned, '')[0].id).toBe('t0');
    const hits = search(pinned, 'about the exam');
    expect(hits).toHaveLength(4);
    expect(hits[0].id).toBe('t0');
  });

  it('says where a content match was found, but not a title one', () => {
    expect(foundIn(list[2], 'redlining')).toContain('redlining');
    expect(foundIn(list[0], 'elasticity')).toBe('');
    expect(foundIn(list[0], '')).toBe('');
  });
});

describe('a hundred conversations, and an archive under them', () => {
  const many = (n: number, size = 10): Thread[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `t${i}`,
      title: '',
      turns: [
        { role: 'user' as const, content: `Q${i}`.padEnd(size, '.') },
        { role: 'assistant' as const, content: 'A'.padEnd(size, '.') },
      ],
      // Oldest last, so `t0` is newest and the tail is what should fall out.
      at: 10_000 - i,
    }));

  beforeEach(() => localStorage.clear());

  it('keeps a hundred where it used to keep twelve', () => {
    expect(MAX_THREADS).toBe(100);
    const { kept, shed } = sift(many(100), 't0');
    expect(kept).toHaveLength(100);
    expect(shed).toEqual([]);
  });

  it('moves what is over the cap into the archive rather than deleting it', () => {
    // The whole point of the change. This used to be a `continue`.
    const { kept, shed } = sift(many(104), 't0');
    expect(kept).toHaveLength(100);
    expect(shed.map((t) => t.id)).toEqual(['t100', 't101', 't102', 't103']);
    // And whole, not as a stub: an archived conversation you cannot read is
    // a row saying you used to have something.
    expect(shed[0].turns).toHaveLength(2);
  });

  it('moves what is over the character limit too, which is the limit that binds', () => {
    // Twenty threads of 10k characters is 200k against a 150k budget.
    const { kept, shed } = sift(many(20, 10_000), 't0');
    expect(kept.length).toBeLessThan(20);
    expect(shed.length).toBeGreaterThan(0);
    expect(kept.length + shed.length).toBe(20);
  });

  it('never sheds the open one, however old it is', () => {
    const { kept, shed } = sift(many(104), 't103');
    expect(kept.some((t) => t.id === 't103')).toBe(true);
    expect(shed.some((t) => t.id === 't103')).toBe(false);
  });

  it('never sheds a pinned one', () => {
    const all = many(104).map((t) => (t.id === 't103' ? { ...t, pinned: true } : t));
    const { shed } = sift(all, 't0');
    expect(shed.some((t) => t.id === 't103')).toBe(false);
  });

  it('does not archive conversations nobody had', () => {
    // An empty thread is dropped, as it always was. An archive of blank rows
    // is not a record of anything.
    const all = [...many(100), { id: 'blank', title: '', turns: [], at: 1 }];
    const { kept, shed } = sift(all, 't0');
    expect(kept.some((t) => t.id === 'blank')).toBe(false);
    expect(shed.some((t) => t.id === 'blank')).toBe(false);
  });
});

describe('the archive itself', () => {
  beforeEach(() => localStorage.clear());

  const one = (id: string, at: number): Thread => ({
    id,
    title: '',
    turns: [{ role: 'user', content: `Q ${id}` }, { role: 'assistant', content: 'A' }],
    at,
  });

  it('holds what it is given, newest first', () => {
    archive([one('a', 1), one('c', 3), one('b', 2)]);
    expect(loadArchive().map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });

  it('adds to what is already there rather than replacing it', () => {
    archive([one('a', 1)]);
    archive([one('b', 2)]);
    expect(loadArchive().map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('does not keep two copies of one conversation', () => {
    // Restore a thread, ask one more question, and it falls out again.
    archive([one('a', 1)]);
    archive([{ ...one('a', 9), name: 'Renamed' }]);
    const all = loadArchive();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Renamed');
  });

  it('is bounded too, so an archive cannot fill the store either', () => {
    const lots = Array.from({ length: MAX_ARCHIVE + 20 }, (_, i) => one(`a${i}`, i));
    expect(archive(lots).length).toBeLessThanOrEqual(MAX_ARCHIVE);
  });

  it('gives one back, and stops holding it', () => {
    archive([one('a', 1), one('b', 2)]);
    expect(unarchive('a')?.id).toBe('a');
    expect(loadArchive().map((t) => t.id)).toEqual(['b']);
  });

  it('is nothing for an id it does not have', () => {
    expect(unarchive('nope')).toBeNull();
  });

  it('titles what it hands back, so a restored row is not blank', () => {
    archive([{ ...one('a', 1), title: '' }]);
    expect(loadArchive()[0].title).toBe('Q a');
  });

  it('goes when everything goes', () => {
    // "Wipe every conversation" has to mean the older ones too.
    archive([one('a', 1)]);
    clearAll();
    expect(loadArchive()).toEqual([]);
  });

  it('is written by save, not only by a caller who remembers to', () => {
    const all = Array.from({ length: 102 }, (_, i) => ({
      id: `t${i}`,
      title: '',
      turns: [{ role: 'user' as const, content: `Q${i}` }, { role: 'assistant' as const, content: 'A' }],
      at: 10_000 - i,
    }));
    save({ threads: all, openId: 't0' });
    expect(load().threads).toHaveLength(100);
    expect(loadArchive().map((t) => t.id)).toEqual(['t100', 't101']);
  });
});

describe('where a conversation was started', () => {
  const labels = (screen: string) => ({ grades: 'Grades', today: 'Today' })[screen];

  it('is the screen name when the screen is known', () => {
    const t: Thread = { id: 'a', title: 'Q', turns: [], at: 1, from: 'grades' };
    expect(startedOn(t, labels)).toBe('Grades');
  });

  it('is nothing at all when it is not', () => {
    // A row reading "from grade-projection" is worse than one that says
    // nothing. Threads from before this existed are the same case.
    expect(startedOn({ id: 'a', title: 'Q', turns: [], at: 1 }, labels)).toBe('');
    expect(startedOn({ id: 'a', title: 'Q', turns: [], at: 1, from: 'gone' }, labels)).toBe('');
  });

  it('survives a round trip through the store', () => {
    localStorage.clear();
    save({ threads: [{ id: 'a', title: 'Q', turns: [{ role: 'user', content: 'Q' }], at: 1, from: 'grades' }], openId: 'a' });
    expect(load().threads[0].from).toBe('grades');
  });
});

describe('grouping the list by day', () => {
  // A Wednesday, mid-morning, so "today" has hours either side of the clock.
  const NOW = new Date(2026, 8, 9, 10, 30).getTime();
  const at = (d: Date) => d.getTime();

  it('reads day boundaries rather than elapsed hours', () => {
    // Eleven last night is Yesterday at half past ten this morning, not
    // "11 hours ago" — the question is which day it was.
    expect(bucket(at(new Date(2026, 8, 9, 0, 5)), NOW)).toBe('Today');
    expect(bucket(at(new Date(2026, 8, 8, 23, 55)), NOW)).toBe('Yesterday');
    expect(bucket(at(new Date(2026, 8, 8, 0, 1)), NOW)).toBe('Yesterday');
    expect(bucket(at(new Date(2026, 8, 7, 23, 59)), NOW)).toBe('Previous 7 days');
  });

  it('counts the seven days from the start of today, not from now', () => {
    // Otherwise the window shrinks as the day goes on and a thread moves from
    // one heading to another while somebody is looking at it.
    expect(bucket(at(new Date(2026, 8, 2, 0, 0)), NOW)).toBe('Previous 7 days');
    expect(bucket(at(new Date(2026, 8, 1, 23, 59)), NOW)).toBe('Older');
  });

  it('lifts pinned threads out of the buckets entirely', () => {
    const old: Thread = { ...blank(), id: 'a', at: at(new Date(2026, 7, 1)), pinned: true };
    const today: Thread = { ...blank(), id: 'b', at: NOW };
    expect(grouped([old, today], NOW).map((g) => g.label)).toEqual(['Pinned', 'Today']);
  });

  it('leaves out a heading with nothing under it', () => {
    // A heading over no rows is a list that looks broken.
    const today: Thread = { ...blank(), id: 'b', at: NOW };
    expect(grouped([today], NOW).map((g) => g.label)).toEqual(['Today']);
  });

  it('keeps every thread, in the order it was given', () => {
    const a: Thread = { ...blank(), id: 'a', at: NOW };
    const b: Thread = { ...blank(), id: 'b', at: NOW - 1000 };
    const c: Thread = { ...blank(), id: 'c', at: at(new Date(2026, 7, 1)) };
    const out = grouped([a, b, c], NOW).flatMap((g) => g.threads.map((t) => t.id));
    expect(out).toEqual(['a', 'b', 'c']);
  });
});
