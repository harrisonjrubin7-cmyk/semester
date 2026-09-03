import { describe, expect, it } from 'vitest';
import {
  LANDMARKS,
  ahead,
  apply,
  blankTerm,
  breakDays,
  daysTo,
  filled,
  line,
  parse,
  pressing,
  progress,
  sheet,
  standing,
  type TermDate,
} from './registrar';

const now = new Date(2026, 9, 1, 10, 0); // 1 October 2026

const on = (iso: string, over: Partial<TermDate> = {}): TermDate => ({
  id: 'drop-clean',
  label: 'Last day to drop without a W',
  iso,
  until: '',
  cost: '',
  kind: 'deadline',
  ...over,
});

describe('what ships', () => {
  it('carries no dates at all', () => {
    expect(blankTerm().every((d) => d.iso === '' && d.until === '')).toBe(true);
  });

  it('says what each one costs, rather than what it is', () => {
    // The consequence is the reason a landmark is in the app; a label alone
    // ("Classes begin") tells a student nothing about when to care.
    expect(LANDMARKS.every((l) => l.cost.length > 20)).toBe(true);
  });

  it('gives every landmark a distinct id', () => {
    const ids = LANDMARKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('asks few enough questions to finish in one sitting', () => {
    expect(LANDMARKS.length).toBeLessThanOrEqual(14);
  });
});

describe('the saved sheet', () => {
  it('keeps your dates and takes the wording from the code', () => {
    const saved = [on('2026-10-10', { label: 'my own words for it', cost: 'mine' })];
    const row = sheet(saved).find((d) => d.id === 'drop-clean');
    expect(row?.iso).toBe('2026-10-10');
    expect(row?.label).toBe('Last day to drop without a W');
  });

  it('shows a landmark added in a later version, undated', () => {
    const row = sheet([]).find((d) => d.id === 'withdraw');
    expect(row).toBeDefined();
    expect(row?.iso).toBe('');
  });

  it('keeps a date of your own that matches no landmark', () => {
    const mine = on('2026-11-04', { id: 'own-thesis', label: 'Thesis proposal to the department' });
    expect(sheet([mine]).some((d) => d.id === 'own-thesis')).toBe(true);
  });

  it('counts only the landmarks towards being finished', () => {
    const mine = on('2026-11-04', { id: 'own-thesis' });
    const filledOne = on('2026-10-10');
    expect(progress([mine, filledOne])).toEqual({ done: 1, of: LANDMARKS.length });
  });
});

describe('where a date stands', () => {
  it('is soon inside a fortnight and quiet outside it', () => {
    expect(standing(on('2026-10-09'), now)).toBe('soon');
    expect(standing(on('2026-11-09'), now)).toBe('ahead');
  });

  it('is today on the day', () => {
    expect(standing(on('2026-10-01'), now)).toBe('today');
  });

  it('is open while a window is running', () => {
    expect(standing(on('2026-09-28', { until: '2026-10-06' }), now)).toBe('open');
  });

  it('is past once it has gone', () => {
    expect(standing(on('2026-09-30'), now)).toBe('past');
  });

  it('counts in days, which is how the question is asked', () => {
    expect(line(on('2026-10-10'), now)).toBe('In 9 days.');
    expect(line(on('2026-10-02'), now)).toBe('Tomorrow.');
    expect(line(on('2026-10-01'), now)).toBe('Today.');
    expect(line(on('2026-09-01'), now)).toBe('Passed.');
    expect(line(on('2026-09-28', { until: '2026-10-06' }), now)).toBe('Open now, 5 days left.');
    expect(line(on('2026-09-28', { until: '2026-10-01' }), now)).toBe('Closes today.');
  });
});

describe('what reaches Today', () => {
  const dates = [
    on('2026-10-09', { id: 'drop-clean' }),
    on('2026-12-01', { id: 'finals', kind: 'exams' }),
    on('2026-09-01', { id: 'classes-begin' }),
    on('2026-10-05', { id: 'break', kind: 'break', until: '2026-10-06' }),
    on('', { id: 'withdraw' }),
  ];

  it('shows a deadline a fortnight out', () => {
    expect(pressing(dates, now).map((d) => d.id)).toContain('drop-clean');
  });

  it('leaves the far ones alone', () => {
    expect(pressing(dates, now).map((d) => d.id)).not.toContain('finals');
  });

  it('says nothing about a date you have not filled in', () => {
    expect(pressing(dates, now).map((d) => d.id)).not.toContain('withdraw');
  });

  it('does not shout about a break, which cannot be missed', () => {
    expect(pressing(dates, now).map((d) => d.id)).not.toContain('break');
  });

  it('puts the soonest first', () => {
    const two = [on('2026-10-12', { id: 'withdraw' }), on('2026-10-03', { id: 'drop-clean' })];
    expect(pressing(two, now).map((d) => d.id)).toEqual(['drop-clean', 'withdraw']);
  });

  it('lists everything still to come on the screen of its own', () => {
    expect(ahead(dates, now).map((d) => d.id)).toEqual(['break', 'drop-clean', 'finals']);
  });

  it('knows the days a break covers, so nothing schedules into them', () => {
    expect([...breakDays(dates)]).toEqual(['2026-10-05', '2026-10-06']);
  });

  it('leaves a single-day entry out of the break days unless it is a break', () => {
    expect(breakDays([on('2026-10-09', { id: 'drop-clean' })]).size).toBe(0);
  });
});

describe('reading a registrar page', () => {
  it('takes a plain table', () => {
    const found = parse(
      [
        'August 26 (Wednesday) Classes begin',
        'September 8 Last day to add a course',
        'October 23 Last day to drop a course without a W',
      ].join('\n'),
      2026,
    );
    expect(found.map((f) => [f.id, f.iso])).toEqual([
      ['classes-begin', '2026-08-26'],
      ['add-deadline', '2026-09-08'],
      ['drop-clean', '2026-10-23'],
    ]);
  });

  it('reads a span as a span', () => {
    const [fall] = parse('October 15–16 Fall break', 2026);
    expect([fall.iso, fall.until, fall.kind]).toEqual(['2026-10-15', '2026-10-16', 'break']);
  });

  it('reads a span that crosses a month', () => {
    const [f] = parse('November 30 – December 4 Reading days', 2026);
    expect([f.iso, f.until]).toEqual(['2026-11-30', '2026-12-04']);
  });

  it('takes abbreviated months and ordinals', () => {
    expect(parse('Sept. 8th Last day to add a course', 2026)[0].iso).toBe('2026-09-08');
  });

  it('never guesses the year', () => {
    expect(parse('January 12 Classes begin', 2027)[0].iso).toBe('2027-01-12');
  });

  it('skips a line with a date and no label', () => {
    expect(parse('October 23\n2026\nSee the registrar', 2026)).toEqual([]);
  });

  it('skips a line with a label and no date', () => {
    expect(parse('Last day to drop a course', 2026)).toEqual([]);
  });

  it('does not offer the same landmark twice', () => {
    const found = parse('Oct 23 Last day to drop a course\nOct 23 last day to drop, no W', 2026);
    expect(found).toHaveLength(1);
  });

  it('keeps a row it cannot identify, in your own words', () => {
    const [f] = parse('November 4 Thesis proposal to the department', 2026);
    expect(f.id).toBe('');
    expect(f.label).toBe('Thesis proposal to the department');
  });

  it('prefers the withdrawal landmark over the drop one when the line says withdraw', () => {
    expect(parse('November 6 Last day to withdraw from a course', 2026)[0].id).toBe('withdraw');
  });

  it('refuses a day that is not a day', () => {
    expect(parse('October 47 Something or other', 2026)).toEqual([]);
  });
});

describe('folding confirmed rows in', () => {
  it('fills a landmark rather than adding a second copy of it', () => {
    const next = apply(blankTerm(), parse('October 23 Last day to drop a course', 2026));
    expect(next.filter((d) => d.id === 'drop-clean')).toHaveLength(1);
    expect(next.find((d) => d.id === 'drop-clean')?.iso).toBe('2026-10-23');
  });

  it('appends one it does not recognise', () => {
    const next = apply(blankTerm(), parse('November 4 Thesis proposal to the department', 2026));
    expect(filled(next).map((d) => d.label)).toEqual(['Thesis proposal to the department']);
  });

  it('does not append the same unrecognised row twice', () => {
    const found = parse('November 4 Thesis proposal to the department', 2026);
    expect(filled(apply(apply(blankTerm(), found), found))).toHaveLength(1);
  });

  it('overwrites a landmark date when the registrar moved it', () => {
    const first = apply(blankTerm(), parse('October 23 Last day to drop a course', 2026));
    const moved = apply(first, parse('October 30 Last day to drop a course', 2026));
    expect(moved.find((d) => d.id === 'drop-clean')?.iso).toBe('2026-10-30');
  });
});

describe('counting days', () => {
  it('does not let the time of day change the answer', () => {
    const late = new Date(2026, 9, 1, 23, 50);
    expect(daysTo('2026-10-02', late)).toBe(1);
  });
});
