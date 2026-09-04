import { describe, expect, it } from 'vitest';
import {
  headline,
  isLate,
  mine,
  pace,
  paceLine,
  perPerson,
  standing,
  unclaimed,
  type Group,
  type Member,
  type Part,
} from './groupwork';

const NOW = new Date(2026, 8, 10, 9, 0); // Thursday 10 September 2026
const DAY = 86_400_000;

const group = (over: Partial<Group> = {}): Group => ({
  id: 'g1',
  name: 'Opera Philadelphia case',
  about: '',
  due: '2026-09-20',
  ...over,
});

const part = (over: Partial<Part> = {}): Part => ({
  id: 'p1',
  title: 'Market sizing',
  owner: '',
  done: false,
  due: '',
  createdAt: NOW.getTime() - 10 * DAY,
  ...over,
});

const member = (userId: string, handle: string): Member => ({ userId, handle });

describe('where the group stands', () => {
  it('counts what is done and what nobody has claimed', () => {
    const parts = [
      part({ id: 'a', done: true, owner: 'u1' }),
      part({ id: 'b', owner: 'u2' }),
      part({ id: 'c' }),
      part({ id: 'd' }),
    ];
    expect(standing(group(), parts, NOW)).toEqual({
      total: 4,
      done: 1,
      unclaimed: 2,
      daysLeft: 10,
    });
  });

  it('does not count a finished part as unclaimed even with no owner', () => {
    expect(standing(group(), [part({ done: true })], NOW).unclaimed).toBe(0);
  });

  it('has no days left when no deadline is set', () => {
    expect(standing(group({ due: '' }), [], NOW).daysLeft).toBeNull();
  });

  it('says so plainly when the list is empty', () => {
    expect(headline(standing(group(), [], NOW))).toBe('Nothing on the list yet.');
  });

  it('reads as counts and days', () => {
    const parts = [part({ id: 'a', done: true }), part({ id: 'b' }), part({ id: 'c' })];
    expect(headline(standing(group(), parts, NOW))).toBe('1 of 3 done, 2 unclaimed, 10 days left.');
  });

  it('stops counting once everything is done', () => {
    expect(headline(standing(group(), [part({ done: true })], NOW))).toBe('All 1 done.');
  });

  it('says when the deadline has gone', () => {
    const past = group({ due: '2026-09-01' });
    expect(headline(standing(past, [part()], NOW))).toContain('past the deadline');
  });

  it('says due today on the day', () => {
    expect(headline(standing(group({ due: '2026-09-10' }), [part()], NOW))).toContain('due today');
  });
});

describe('are we going to make it', () => {
  it('has nothing to say before anything is ticked, but says the rate needed', () => {
    const parts = [part({ id: 'a' }), part({ id: 'b' }), part({ id: 'c' })];
    expect(pace(group(), parts, NOW).known).toBe(false);
    expect(paceLine(group(), parts, NOW)).toBe(
      'Nothing ticked yet. Finishing on time means 0.3 parts a day from here.',
    );
  });

  it('compares two rates, both of them counts', () => {
    // Five parts, three done over ten days — 0.3 a day. Two left over ten
    // days needs 0.2 a day, so it lands with room.
    const parts = [
      part({ id: 'a', done: true }),
      part({ id: 'b', done: true }),
      part({ id: 'c', done: true }),
      part({ id: 'd' }),
      part({ id: 'e' }),
    ];
    const p = pace(group(), parts, NOW);
    expect(p.rate).toBe(0.3);
    expect(p.needed).toBe(0.2);
    expect(p.short).toBe(0);
    expect(paceLine(group(), parts, NOW)).toContain('lands with room');
  });

  it('says how many short when the rate does not get there', () => {
    // One done in ten days, nine left, ten days to go.
    const parts = [
      part({ id: 'a', done: true }),
      ...Array.from({ length: 9 }, (_, n) => part({ id: `x${n}` })),
    ];
    const p = pace(group(), parts, NOW);
    expect(p.short).toBe(8);
    expect(paceLine(group(), parts, NOW)).toBe(
      'At the rate so far, 8 short — 0.1 a day against the 0.9 it needs.',
    );
  });

  it('measures from the first part, not from an empty fortnight before it', () => {
    const recent = [
      part({ id: 'a', done: true, createdAt: NOW.getTime() - 2 * DAY }),
      part({ id: 'b', createdAt: NOW.getTime() - 2 * DAY }),
    ];
    // One in two days is 0.5 a day, not one in sixteen.
    expect(pace(group(), recent, NOW).rate).toBe(0.5);
  });

  it('refuses to speak without a deadline rather than guessing', () => {
    const parts = [part({ done: true }), part({ id: 'b' })];
    expect(pace(group({ due: '' }), parts, NOW).known).toBe(false);
    expect(paceLine(group({ due: '' }), parts, NOW)).toMatch(/no rate to compare against/);
  });

  it('says the deadline has passed rather than a rate', () => {
    const parts = [part(), part({ id: 'b', done: true })];
    expect(paceLine(group({ due: '2026-09-01' }), parts, NOW)).toBe(
      '1 part still open, and the deadline has passed.',
    );
  });

  it('says nothing at all when everything is done', () => {
    expect(paceLine(group(), [part({ done: true })], NOW)).toBe('');
  });
});

describe('who is holding what', () => {
  const members = [member('u2', 'ben'), member('u1', 'ana'), member('u3', 'cara')];
  const parts = [
    part({ id: 'a', owner: 'u1', done: true }),
    part({ id: 'b', owner: 'u1' }),
    part({ id: 'c', owner: 'u2' }),
    part({ id: 'd' }),
  ];

  it('sorts by name, not by output', () => {
    // Sorting by output makes this a league table, and a group that opens the
    // app to see who is behind has a worse conversation than it needed to.
    expect(perPerson(members, parts).map((s) => s.member.handle)).toEqual(['ana', 'ben', 'cara']);
  });

  it('counts what each person has and has finished', () => {
    const [ana] = perPerson(members, parts);
    expect([ana.has, ana.done]).toEqual([2, 1]);
  });

  it('shows somebody holding nothing rather than leaving them out', () => {
    const cara = perPerson(members, parts).find((s) => s.member.handle === 'cara');
    expect(cara?.has).toBe(0);
  });

  it('lists what nobody has claimed, oldest first', () => {
    const two = [
      part({ id: 'new', createdAt: NOW.getTime() }),
      part({ id: 'old', createdAt: NOW.getTime() - 5 * DAY }),
    ];
    expect(unclaimed(two).map((p) => p.id)).toEqual(['old', 'new']);
  });

  it('gives a person their own open parts, soonest first', () => {
    const theirs = [
      part({ id: 'later', owner: 'u1', due: '2026-09-18' }),
      part({ id: 'sooner', owner: 'u1', due: '2026-09-12' }),
      part({ id: 'undated', owner: 'u1' }),
      part({ id: 'done', owner: 'u1', done: true }),
      part({ id: 'theirs', owner: 'u2' }),
    ];
    expect(mine(theirs, 'u1').map((p) => p.id)).toEqual(['sooner', 'later', 'undated']);
  });
});

describe('when a part is late', () => {
  it('is late past its own date', () => {
    expect(isLate(part({ due: '2026-09-01' }), NOW)).toBe(true);
  });

  it('is not late on its own account without a date of its own', () => {
    // The group's deadline does not make every line late; a part with no date
    // is not late until the whole thing is.
    expect(isLate(part({ due: '' }), NOW)).toBe(false);
  });

  it('is not late once it is done', () => {
    expect(isLate(part({ due: '2026-09-01', done: true }), NOW)).toBe(false);
  });
});
