import { describe, expect, it } from 'vitest';
import {
  LONGEST_NAME,
  arrange,
  nameFor,
  renamed,
  rename,
  reorder,
  tintFor,
  tintTo,
  togglePin,
  yoursNote,
  yoursOf,
  type YoursBy,
} from './yours';

const econ = { id: 'econ', code: 'ECON 1020', name: 'Principles of Microeconomics' };
const psci = { id: 'psci', code: 'PSCI 1104', name: 'Understanding Political Controversy' };

const mod = (id: string) => ({ course: { id } });

describe('what a course is called', () => {
  it('uses the syllabus name until the student says otherwise', () => {
    expect(nameFor(econ)).toBe('Principles of Microeconomics');
    expect(nameFor(econ, {})).toBe('Principles of Microeconomics');
  });

  it('uses their name once they give one', () => {
    const all = rename({}, econ, 'Econ');
    expect(nameFor(econ, all)).toBe('Econ');
    expect(renamed(econ, all)).toBe(true);
  });

  it('falls back to the code rather than showing an empty row', () => {
    expect(nameFor({ id: 'x', code: 'BUS 1600', name: '' })).toBe('BUS 1600');
  });

  it('trims, and treats whitespace as clearing it', () => {
    expect(nameFor(econ, rename({}, econ, '  Econ  '))).toBe('Econ');
    const cleared = rename(rename({}, econ, 'Econ'), econ, '   ');
    expect(nameFor(econ, cleared)).toBe('Principles of Microeconomics');
  });

  it('does not store a name that is already the syllabus name', () => {
    // An override that overrides nothing, and one that would then stop
    // tracking the real name if a corrected syllabus changed it.
    const all = rename({}, econ, 'Principles of Microeconomics');
    expect(all).toEqual({});
    expect(renamed(econ, all)).toBe(false);
  });

  it('caps a name at a length that fits a list', () => {
    const all = rename({}, econ, 'x'.repeat(200));
    expect(yoursOf(all, 'econ').name).toHaveLength(LONGEST_NAME);
  });
});

describe('colour', () => {
  it('is absent until chosen', () => {
    expect(tintFor({}, 'econ')).toBeNull();
  });

  it('comes back as the accent itself, so the caller does not look it up', () => {
    const all = tintTo({}, 'econ', 'jade');
    expect(tintFor(all, 'econ')?.label).toBe('Jade');
    expect(tintFor(all, 'econ')?.base).toMatch(/^#/);
  });

  it('clears rather than storing an accent that does not exist', () => {
    // A synced record from a later version, or a typo in a test fixture.
    const all = tintTo(tintTo({}, 'econ', 'jade'), 'econ', 'chartreuse');
    expect(tintFor(all, 'econ')).toBeNull();
    expect(all).toEqual({});
  });
});

describe('the stored record', () => {
  it('disappears entirely when nothing is left in it', () => {
    // An entry of `{}` would sync forever and mean nothing.
    let all: YoursBy = rename({}, econ, 'Econ');
    all = tintTo(all, 'econ', 'jade');
    all = togglePin(all, 'econ');
    expect(Object.keys(all)).toEqual(['econ']);

    all = rename(all, econ, '');
    all = tintTo(all, 'econ', '');
    all = togglePin(all, 'econ');
    expect(all).toEqual({});
  });

  it('keeps what was said about one course when another is cleared', () => {
    let all: YoursBy = rename({}, econ, 'Econ');
    all = rename(all, psci, 'PSCI');
    all = rename(all, econ, '');
    expect(all).toEqual({ psci: { name: 'PSCI' } });
  });

  it('pins and unpins', () => {
    expect(yoursOf(togglePin({}, 'econ'), 'econ').pinned).toBe(true);
    expect(yoursOf(togglePin(togglePin({}, 'econ'), 'econ'), 'econ').pinned).toBeUndefined();
  });
});

describe('the order courses come out in', () => {
  const four = [mod('a'), mod('b'), mod('c'), mod('d')];
  const ids = (list: { course: { id: string } }[]) => list.map((m) => m.course.id);

  it('is import order until something is changed', () => {
    expect(ids(arrange(four, {}, []))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(arrange(four, undefined, undefined))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts a pinned course first, wherever it was', () => {
    expect(ids(arrange(four, togglePin({}, 'c'), []))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('keeps pinned courses among themselves in the arranged order', () => {
    let all: YoursBy = togglePin({}, 'c');
    all = togglePin(all, 'a');
    expect(ids(arrange(four, all, ['c', 'a']))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('follows an explicit order, and leaves untouched courses behind it', () => {
    expect(ids(arrange(four, {}, ['d', 'b']))).toEqual(['d', 'b', 'a', 'c']);
  });

  it('never drops or duplicates a course, whatever the stored order says', () => {
    // The order can name a course that has been deleted, and can be missing
    // one that was imported since. Neither may cost the student a class.
    const out = arrange(four, {}, ['gone', 'd', 'alsogone']);
    expect(ids(out).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(out)[0]).toBe('d');
  });

  it('does not mutate what it was given', () => {
    const before = ids(four);
    arrange(four, togglePin({}, 'd'), ['c']);
    expect(ids(four)).toEqual(before);
  });
});

describe('moving one along', () => {
  const shown = ['a', 'b', 'c'];

  it('swaps it with its neighbour', () => {
    expect(reorder(shown, 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(reorder(shown, 'a', 1)).toEqual(['b', 'a', 'c']);
  });

  it('does nothing at either end, or for a course that is not there', () => {
    expect(reorder(shown, 'a', -1)).toEqual(shown);
    expect(reorder(shown, 'c', 1)).toEqual(shown);
    expect(reorder(shown, 'zz', 1)).toEqual(shown);
  });

  it('returns a complete order, so the first move fixes the implicit rest', () => {
    expect(reorder(shown, 'b', -1)).toHaveLength(3);
  });
});

describe('what the settings row says', () => {
  it('says nothing about a course nobody has touched', () => {
    expect(yoursNote({}, 'econ', econ.name)).toBe('');
  });

  it('names each change, in one line', () => {
    let all: YoursBy = rename({}, econ, 'Econ');
    all = tintTo(all, 'econ', 'jade');
    all = togglePin(all, 'econ');
    expect(yoursNote(all, 'econ', econ.name)).toBe('called “Econ” · jade · pinned');
  });
});
