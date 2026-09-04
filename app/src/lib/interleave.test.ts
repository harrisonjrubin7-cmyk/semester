import { describe, expect, it } from 'vitest';
import { groupCount, interleave, longestRun, mixLine, worthMixing } from './interleave';

interface Card {
  id: string;
  course: string;
}

const of = (c: Card) => c.course;
const deck = (spec: string): Card[] =>
  spec.split('').map((course, i) => ({ id: `${course}${i}`, course }));
const shape = (cards: Card[]) => cards.map((c) => c.course).join('');

describe('nothing is lost or invented', () => {
  it('gives back exactly what it was given', () => {
    const before = deck('aaabbbccc');
    const after = interleave(before, of);
    expect(after).toHaveLength(before.length);
    expect([...after].sort((x, y) => x.id.localeCompare(y.id))).toEqual(
      [...before].sort((x, y) => x.id.localeCompare(y.id)),
    );
  });

  it('does not mutate the deck it was handed', () => {
    const before = deck('aabb');
    interleave(before, of);
    expect(shape(before)).toBe('aabb');
  });

  it('handles nothing, and one', () => {
    expect(interleave([], of)).toEqual([]);
    expect(interleave(deck('a'), of)).toHaveLength(1);
  });
});

describe('the mixing itself', () => {
  it('alternates where it can', () => {
    expect(shape(interleave(deck('aaabbb'), of))).toBe('ababab');
  });

  it('spreads three courses, even when one is entirely less urgent', () => {
    // The first case that drove the design. Taking whichever course had the
    // most urgent card waiting produced `ababab` then `ccc` — a third of the
    // run blocked, in exactly the situation with most to mix. An interleaver
    // that blocks the tail is not an interleaver.
    expect(longestRun(interleave(deck('aaabbbccc'), of), of)).toBe(1);
  });

  it('brings a small course in early rather than saving it for the end', () => {
    // The second case, and the one that survived to a real drive: taking
    // whichever course had the *most* cards left fixed the run above and
    // starved the smallest course instead. A drill session is twenty or thirty
    // cards; a course whose first card lands at position 240 is a course you
    // never see, while the app says "cards from 4 courses".
    const big = 'a'.repeat(60) + 'b'.repeat(60) + 'c'.repeat(60) + 'd'.repeat(20);
    const after = interleave(deck(big), of);
    const firstD = after.findIndex((c) => c.course === 'd');
    // A twentieth of the deck, so roughly one card in ten. Generous bound: the
    // point is that it is a handful of cards in, not two hundred.
    expect(firstD).toBeGreaterThanOrEqual(0);
    expect(firstD).toBeLessThan(15);
  });

  it('keeps a small course coming at its own rate, not in a clump', () => {
    const big = 'a'.repeat(60) + 'b'.repeat(60) + 'c'.repeat(60) + 'd'.repeat(20);
    const at = interleave(deck(big), of)
      .map((c, i) => (c.course === 'd' ? i : -1))
      .filter((i) => i >= 0);
    expect(at).toHaveLength(20);
    const gaps = at.slice(1).map((x, i) => x - at[i]);
    // 20 cards across 200 is one every ten. Nothing should be twice that
    // apart, which is what clumping at either end would produce.
    expect(Math.max(...gaps)).toBeLessThan(20);
  });

  it('runs the remainder together rather than dropping it', () => {
    // Five a's and one b cannot alternate. The alternative to a run at the end
    // is losing cards, which is not an alternative.
    const after = interleave(deck('aaaaab'), of);
    expect(after).toHaveLength(6);
    expect(shape(after).startsWith('ab')).toBe(true);
  });

  it('leaves a single course exactly as it was', () => {
    expect(shape(interleave(deck('aaaa'), of))).toBe('aaaa');
  });
});

describe('urgency survives it', () => {
  it('keeps each course’s own order', () => {
    // `dueFirst` put the most overdue card of each course first. Mixing must
    // not reorder within a course, or the ranking it produced is thrown away.
    const before: Card[] = [
      { id: 'a-overdue', course: 'a' },
      { id: 'b-overdue', course: 'b' },
      { id: 'a-unseen', course: 'a' },
      { id: 'b-unseen', course: 'b' },
      { id: 'a-known', course: 'a' },
    ];
    const after = interleave(before, of);
    const aOrder = after.filter((c) => c.course === 'a').map((c) => c.id);
    expect(aOrder).toEqual(['a-overdue', 'a-unseen', 'a-known']);
  });

  it('opens with the most urgent card there is', () => {
    // An overdue card must not fall behind a comfortable one merely to avoid
    // two of a kind in a row.
    const before: Card[] = [
      { id: 'most-urgent', course: 'a' },
      { id: 'b1', course: 'b' },
      { id: 'b2', course: 'b' },
    ];
    expect(interleave(before, of)[0].id).toBe('most-urgent');
  });

  it('takes from whichever course has the next most urgent card', () => {
    // Not round-robin: `b` has two cards more urgent than `a`'s second, so it
    // gets the third slot back.
    const before: Card[] = [
      { id: 'a1', course: 'a' },
      { id: 'b1', course: 'b' },
      { id: 'b2', course: 'b' },
      { id: 'a2', course: 'a' },
    ];
    expect(interleave(before, of).map((c) => c.id)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });
});

describe('when it is worth offering at all', () => {
  it('is not, with one course', () => {
    // A switch that does nothing is worse than no switch.
    expect(worthMixing(deck('aaaaa'), of)).toBe(false);
  });

  it('is not, for a handful of cards', () => {
    expect(worthMixing(deck('ab'), of)).toBe(false);
  });

  it('is, for a real run across courses', () => {
    expect(worthMixing(deck('aabbcc'), of)).toBe(true);
  });

  it('counts the courses in play', () => {
    expect(groupCount(deck('aabbcc'), of)).toBe(3);
    expect(groupCount([], of)).toBe(0);
  });
});

describe('measuring a run', () => {
  it('finds the longest stretch of one course', () => {
    expect(longestRun(deck('aabbbc'), of)).toBe(3);
    expect(longestRun(deck('abab'), of)).toBe(1);
    expect(longestRun([], of)).toBe(0);
  });
});

describe('what it says, where it feels wrong', () => {
  it('admits it is harder rather than selling it', () => {
    const said = mixLine(deck('aabb'), of, true);
    expect(said).toContain('harder');
    expect(said.toLowerCase()).not.toContain('optimis');
    expect(said.toLowerCase()).not.toContain('smart');
  });

  it('says why, because otherwise it gets switched off after one session', () => {
    const said = mixLine(deck('aabb'), of, false);
    expect(said).toContain('what kind of question');
  });

  it('says there is nothing to mix rather than offering it anyway', () => {
    expect(mixLine(deck('aaa'), of, false)).toContain('nothing to mix');
    expect(mixLine(deck('aaa'), of, true)).toContain('nothing to mix');
  });

  it('names the number of courses rather than saying "several"', () => {
    expect(mixLine(deck('aabbcc'), of, true)).toContain('3 courses');
  });
});
