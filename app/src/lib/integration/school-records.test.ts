import { describe, expect, it } from 'vitest';
import { effectiveFreshness, schoolRecordsView, type RecordRow } from './school-records';

const NOW = new Date('2026-10-01T12:00:00Z');
const ME = 'u1';
let n = 0;
function row(type: string, display: Record<string, unknown>, over: Partial<RecordRow> = {}): RecordRow {
  n += 1;
  return {
    id: `r${n}`, canonical_entity_type: type, canonical_entity_id: `c${n}`, subject_user_id: null,
    source_system: 'SIS', source_url: null, source_timestamp: null, source_of_truth: 'Registrar / SIS',
    freshness_status: 'live', updated_at: '2026-10-01T11:30:00Z', display, ...over,
  };
}
const window = (over: Partial<RecordRow> = {}) => row('registration_window',
  { audience: 'Juniors', opens_at: '2026-11-02T13:00:00Z', closes_at: '2026-11-20T23:00:00Z',
    source_url: 'https://registrar.example.edu/reg' }, over);
const hold = (blocks: boolean, over: Partial<RecordRow> = {}) => row('registration_hold',
  { office: 'Student Accounts', blocks_registration: blocks, action_url: 'https://accounts.example.edu/holds' },
  { subject_user_id: ME, ...over });

describe('freshness as a student sees it', () => {
  it('decays with age by the kind of fact', () => {
    expect(effectiveFreshness(hold(true, { updated_at: '2026-10-01T11:58:00Z' }), NOW)).toBe('live');
    expect(effectiveFreshness(hold(true, { updated_at: '2026-10-01T09:00:00Z' }), NOW)).toBe('stale');
    expect(effectiveFreshness(window({ updated_at: '2026-10-01T09:00:00Z' }), NOW)).toBe('recent');
  });

  it('never improves what the gateway stored', () => {
    expect(effectiveFreshness(window({ freshness_status: 'stale', updated_at: '2026-10-01T11:59:00Z' }), NOW)).toBe('stale');
    expect(effectiveFreshness(window({ freshness_status: 'estimated' }), NOW)).toBe('estimated');
  });
});

describe('the view', () => {
  it('is empty with nothing shared', () => {
    expect(schoolRecordsView([], ME, NOW)).toMatchObject({ empty: true, readiness: 'unknown' });
  });

  it('says when registration opens, from whom, and links the official page', () => {
    const v = schoolRecordsView([window()], ME, NOW);
    expect(v.window).toMatchObject({ text: 'Registration opens Mon, Nov 2 for Juniors', source: 'Registrar / SIS',
      official: true, link: 'https://registrar.example.edu/reg' });
  });

  it('blocks on a hold and shows only the office and its link', () => {
    const v = schoolRecordsView([window(), hold(true)], ME, NOW);
    expect(v.readiness).toBe('blocked');
    expect(v.holds[0]).toMatchObject({ text: 'Action required before you can register — Student Accounts',
      link: 'https://accounts.example.edu/holds', mine: true });
  });

  it('says "no hold on record" only when both the window and the hold feed are fresh', () => {
    expect(schoolRecordsView([window()], ME, NOW).readiness).toBe('no_hold_on_record');
    expect(schoolRecordsView([window({ freshness_status: 'stale' })], ME, NOW).readiness).toBe('unknown');
    const staleClearedHold = hold(false, { updated_at: '2026-09-29T00:00:00Z' });
    expect(schoolRecordsView([window(), staleClearedHold], ME, NOW).readiness).toBe('unknown');
  });

  it('marks a stale fact as not official', () => {
    const v = schoolRecordsView([window({ freshness_status: 'stale' })], ME, NOW);
    expect(v.window).toMatchObject({ freshness: 'stale', official: false });
  });

  it('ignores somebody else’s records even if they were handed over', () => {
    const v = schoolRecordsView([hold(true, { subject_user_id: 'someone-else' })], ME, NOW);
    expect(v.holds).toEqual([]);
  });

  it('counts enrollments and degree-audit requirements', () => {
    const v = schoolRecordsView([
      row('enrollment', { status: 'enrolled' }, { subject_user_id: ME }),
      row('enrollment', { status: 'enrolled' }, { subject_user_id: ME }),
      row('enrollment', { status: 'waitlisted' }, { subject_user_id: ME }),
      row('academic_requirement', { status: 'met' }, { subject_user_id: ME, source_of_truth: 'Degree audit system' }),
      row('academic_requirement', { status: 'in_progress' }, { subject_user_id: ME, source_of_truth: 'Degree audit system' }),
    ], ME, NOW);
    expect(v.enrollment?.text).toBe('Enrolled in 2 sections, waitlisted in 1');
    expect(v.requirements).toMatchObject({ text: '1 of 2 requirements met in your degree audit', met: 1, inProgress: 1,
      source: 'Degree audit system' });
  });

  it('drops a window that has closed, and a link that is not https', () => {
    const closed = window({ display: { opens_at: '2026-09-01T00:00:00Z', closes_at: '2026-09-10T00:00:00Z' } });
    expect(schoolRecordsView([closed], ME, NOW).window).toBeNull();
    const v = schoolRecordsView([hold(true, { display: { office: 'X', blocks_registration: true, action_url: 'javascript:alert(1)' } })], ME, NOW);
    expect(v.holds[0].link).toBeNull();
  });
});
