import { describe, expect, it } from 'vitest';
import { LISTING_COLUMNS, arrange, deadlinePassed, eligibilityLines, fromCareerFeed, readModerated, trackerEntry, type Listing } from './listings';
import type { RecordRow } from './integration/school-records';

const NOW = new Date('2026-09-28T12:00:00Z');
const l = (id: string, deadline: string | null): Listing => ({ id, kind: 'job', title: id, from: 'x', body: '', url: null, deadline, eligibility: [], source: 'moderated' });

describe('verified listings', () => {
  it('shows eligibility as the office wrote it, and never judges it', () => {
    expect(eligibilityLines({ text: 'Juniors and seniors in economics', gpa_minimum: 3.2, majors: ['ECON', 'MATH'] })).toEqual([
      'Juniors and seniors in economics', 'gpa minimum: 3.2', 'majors: ECON, MATH',
    ]);
    // A sentence that sounds like a verdict is still just the office's text.
    expect(eligibilityLines({ text: 'You qualify if you are a first-year.' })).toEqual(['You qualify if you are a first-year.']);
    expect(eligibilityLines(null)).toEqual([]);
  });

  it('keeps only https links, from either source', () => {
    expect(readModerated({ id: '1', kind: 'job', title: 'T', url: 'http://x.example' })!.url).toBeNull();
    expect(readModerated({ id: '1', kind: 'job', title: 'T', url: 'https://x.example' })!.url).toBe('https://x.example');
    const row = { id: 'r', canonical_entity_type: 'internship', source_of_truth: 'Career office', source_url: 'javascript:alert(1)', display: { title: 'Intern', employer: 'Acme' } } as unknown as RecordRow;
    expect(fromCareerFeed([row])[0]).toMatchObject({ title: 'Intern', from: 'Acme', url: null, source: 'career_feed' });
  });

  it('drops kinds it does not show and rows without a title', () => {
    expect(readModerated({ id: '1', kind: 'deal', title: 'Pizza' })).toBeNull();
    expect(readModerated({ id: '1', kind: 'job', title: '  ' })).toBeNull();
  });

  it('never selects who submitted a listing', () => {
    expect(LISTING_COLUMNS).not.toContain('publisher_id');
  });

  it('orders by deadline, drops past ones, and keeps open-ended last', () => {
    expect(arrange([l('open', null), l('past', '2026-09-01'), l('late', '2026-11-01'), l('soon', '2026-10-01')], NOW).map((x) => x.id)).toEqual(['soon', 'late', 'open']);
  });

  it('tracks a listing with its link as the source, in the right tracker kind', () => {
    const t = trackerEntry({ id: 'x', kind: 'scholarship', title: 'Merit award', from: 'Aid office', body: '', url: 'https://aid.example/merit', deadline: '2026-11-15T00:00:00Z', eligibility: [], source: 'moderated' });
    expect(t).toMatchObject({ kind: 'funding', title: 'Merit award', org: 'Aid office', deadline: '2026-11-15', source: 'https://aid.example/merit' });
  });
});

describe('when a deadline has passed', () => {
  it('keeps a date-only deadline for the whole of that local day, and drops it the next', () => {
    const lateToday = new Date(2026, 9, 1, 23, 30);
    const earlyTomorrow = new Date(2026, 9, 2, 0, 30);
    expect(deadlinePassed('2026-10-01', lateToday)).toBe(false);
    expect(deadlinePassed('2026-10-01', earlyTomorrow)).toBe(true);
    expect(arrange([l('today', '2026-10-01')], lateToday).map((x) => x.id)).toEqual(['today']);
  });

  it('compares a timestamp as the instant it is — the control', () => {
    const at = '2026-10-01T12:00:00Z';
    expect(deadlinePassed(at, new Date('2026-10-01T11:59:00Z'))).toBe(false);
    expect(deadlinePassed(at, new Date('2026-10-01T12:01:00Z'))).toBe(true);
    expect(deadlinePassed(null, new Date())).toBe(false);
  });
});
