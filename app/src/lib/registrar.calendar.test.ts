import { describe, expect, it } from 'vitest';
import { apply, blankTerm, fromCalendar } from './registrar';
import type { TermCalendar } from './school';

const term = (over: Partial<TermCalendar> = {}): TermCalendar => ({
  termName: 'Fall 2026',
  startsOn: '2026-08-26',
  endsOn: '2026-12-04',
  deadlines: [],
  ...over,
});

describe('fromCalendar', () => {
  it('turns the term itself into the three landmarks it is', () => {
    const rows = fromCalendar(term({ finalsFrom: '2026-12-07', finalsTo: '2026-12-15' }));
    expect(rows.map((r) => [r.id, r.iso, r.until])).toEqual([
      ['classes-begin', '2026-08-26', ''],
      ['last-class', '2026-12-04', ''],
      ['finals', '2026-12-07', '2026-12-15'],
    ]);
  });

  it("matches a school's own wording to a landmark, the way a pasted page is matched", () => {
    const rows = fromCalendar(
      term({
        deadlines: [
          { label: 'Last day to drop a course without a W', on: '2026-10-23' },
          { label: 'Last day to withdraw from a course', on: '2026-11-06' },
        ],
      }),
    );
    expect(rows.find((r) => r.iso === '2026-10-23')?.id).toBe('drop-clean');
    expect(rows.find((r) => r.iso === '2026-11-06')?.id).toBe('withdraw');
  });

  it("keeps a deadline that matches nothing in the school's words, with no landmark", () => {
    const rows = fromCalendar(term({ deadlines: [{ label: 'Founders Walk', on: '2026-08-25' }] }));
    const own = rows.find((r) => r.label === 'Founders Walk');
    expect(own?.id).toBe('');
    expect(own?.iso).toBe('2026-08-25');
  });

  it('carries a break across its two dates', () => {
    const rows = fromCalendar(
      term({ breaks: [{ label: 'Thanksgiving break', from: '2026-11-21', to: '2026-11-29' }] }),
    );
    const b = rows.find((r) => r.label === 'Thanksgiving break');
    expect([b?.id, b?.iso, b?.until, b?.kind]).toEqual(['break', '2026-11-21', '2026-11-29', 'break']);
  });

  it('keeps a second break rather than losing it to the first', () => {
    // The bug this pins: `HINTS` matches both "Fall Break" and "Thanksgiving
    // Break" to the `break` landmark, and treating that as an identity
    // dropped Thanksgiving silently. A term has two breaks; that is ordinary.
    const rows = fromCalendar(
      term({
        breaks: [
          { label: 'Fall Break', from: '2026-10-22', to: '2026-10-23' },
          { label: 'Thanksgiving Break', from: '2026-11-21', to: '2026-11-29' },
        ],
      }),
    );
    expect(rows.filter((r) => r.kind === 'break')).toHaveLength(2);
    // The first keeps the landmark; the second keeps the school's words.
    expect(rows.find((r) => r.label === 'Fall Break')?.id).toBe('break');
    const thanks = rows.find((r) => r.label === 'Thanksgiving Break');
    expect(thanks?.id).toBe('');
    expect([thanks?.iso, thanks?.until]).toEqual(['2026-11-21', '2026-11-29']);
  });

  it('drops a deadline that only restates the term field above it', () => {
    const rows = fromCalendar(term({ deadlines: [{ label: 'Classes begin', on: '2026-09-01' }] }));
    expect(rows.filter((r) => r.id === 'classes-begin')).toHaveLength(1);
    // The term's own start wins, because it is the field made for it.
    expect(rows.find((r) => r.id === 'classes-begin')?.iso).toBe('2026-08-26');
  });

  it('skips a blank date rather than offering a row with nothing in it', () => {
    const rows = fromCalendar(term({ startsOn: '', endsOn: '', deadlines: [{ label: 'Grades posted', on: '' }] }));
    expect(rows).toEqual([]);
  });

  it('feeds the same apply path a pasted page feeds', () => {
    const rows = fromCalendar(term({ deadlines: [{ label: 'Last day to drop without a W', on: '2026-10-23' }] }));
    const saved = apply(blankTerm(), rows);
    expect(saved.find((d) => d.id === 'drop-clean')?.iso).toBe('2026-10-23');
    expect(saved.find((d) => d.id === 'classes-begin')?.iso).toBe('2026-08-26');
    // The consequence text still comes from the code, not from the school.
    expect(saved.find((d) => d.id === 'drop-clean')?.cost).toMatch(/transcript/);
  });
});
