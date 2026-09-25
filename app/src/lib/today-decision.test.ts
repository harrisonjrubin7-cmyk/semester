import { describe, expect, it } from 'vitest';
import { nextTodayDecision, pathSnapshot, showsTodayDecisionSurface } from './today-decision';
import { ROLES } from './role';
import type { DatedItem } from './types';

const requirement = (id: string, name: string, accepts: string[]) => ({
  id,
  programme: 'Recorded plan',
  name,
  need: 'courses' as const,
  count: 1,
  accepts,
  note: '',
});

const course = (id: string, code: string, current = false) => ({
  id,
  code,
  title: code,
  term: 'Fall 2026',
  hours: 3,
  grade: current ? '' : 'A',
  current,
});

describe('Today path snapshot', () => {
  it('asks for real audit details rather than presenting zero-percent fiction', () => {
    const result = pathSnapshot([], []);
    expect(result.state).toBe('incomplete');
    expect(result.heading).toContain('clearer path');
    expect(result.total).toBe(0);
    expect(result.source).toContain('not the registrar');
  });

  it('measures recorded requirement coverage, not a fabricated degree percentage', () => {
    const result = pathSnapshot(
      [requirement('writing', 'Writing', ['WRIT']), requirement('quant', 'Quantitative reasoning', ['MATH'])],
      [course('one', 'WRIT 1010')],
    );
    expect(result.state).toBe('review');
    expect(result.covered).toBe(1);
    expect(result.total).toBe(2);
    expect(result.percent).toBe(50);
    expect(result.firstUnresolved).toBe('Quantitative reasoning');
    expect(result.creditLine).toContain('3 credit hours recorded as finished');
  });

  it('counts this term as covered but never as finished credit', () => {
    const result = pathSnapshot(
      [requirement('writing', 'Writing', ['WRIT'])],
      [course('one', 'WRIT 1010', true)],
    );
    expect(result.state).toBe('moving');
    expect(result.creditLine).toBe('3 credit hours recorded in progress');
  });
});

describe('Today decision surface role exposure', () => {
  it('shows the student briefing only to the student role', () => {
    expect(ROLES.filter((role) => showsTodayDecisionSurface(role.id)).map((role) => role.id))
      .toEqual(['student']);
  });
});

describe('Today next decision', () => {
  const path = pathSnapshot(
    [requirement('writing', 'Writing', ['WRIT'])],
    [course('one', 'WRIT 1010')],
  );

  it('puts an unfinished 72-hour commitment ahead of lower-priority suggestions', () => {
    const deadline = {
      id: 'paper', title: 'Seminar reflection', daysAway: 1, dueShort: 'Tomorrow',
      checked: { confirmed: true },
    } as DatedItem;
    const result = nextTodayDecision({
      path,
      upcoming: [deadline],
      done: {},
      reviewDue: 8,
      catalogEmpty: false,
    });
    expect(result.id).toBe('deadline:paper');
    expect(result.itemId).toBe('paper');
    expect(result.source).toBe('Confirmed course-source deadline');
  });

  it('routes incomplete path data to the existing degree workspace', () => {
    const result = nextTodayDecision({
      path: pathSnapshot([], []), upcoming: [], done: {}, reviewDue: 0, catalogEmpty: false,
    });
    expect(result.destination).toBe('degree');
    expect(result.title).toBe('Complete your path details');
  });

  it('does not let a finished deadline displace the real next step', () => {
    const deadline = { id: 'done', title: 'Done', daysAway: 0, dueShort: 'Today' } as DatedItem;
    const result = nextTodayDecision({
      path, upcoming: [deadline], done: { done: true }, reviewDue: 2, catalogEmpty: false,
    });
    expect(result.destination).toBe('study');
  });
});
