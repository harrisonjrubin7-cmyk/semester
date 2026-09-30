import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cardsState, effectiveFreshness, schoolRecordsView, type RecordRow } from './school-records';

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

  it('says "no hold on record" only with a fresh window and fresh hold data that blocks nothing', () => {
    const clear = hold(false, { updated_at: '2026-10-01T11:58:00Z' });
    expect(schoolRecordsView([window(), clear], ME, NOW).readiness).toBe('no_hold_on_record');
    expect(schoolRecordsView([window({ freshness_status: 'stale' }), clear], ME, NOW).readiness).toBe('unknown');
    const staleClearedHold = hold(false, { updated_at: '2026-09-29T00:00:00Z' });
    expect(schoolRecordsView([window(), staleClearedHold], ME, NOW).readiness).toBe('unknown');
  });

  // Found by the Codex review of #779: with no hold rows at all — the hold
  // scope never approved, or the student's consent withheld — `every` over an
  // empty list is true, and a fresh window alone produced "No registration
  // hold on record". Absence of rows is not evidence the feed was read.
  it('says nothing about holds when no hold data has arrived', () => {
    expect(schoolRecordsView([window()], ME, NOW).readiness).toBe('unknown');
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

describe('the campus facts', () => {
  const alert = (severity: string, headline: string, over: Partial<RecordRow> = {}) => row('notification',
    { severity, headline, issued_at: '2026-10-01T11:50:00Z', expires_at: '2026-10-01T20:00:00Z',
      source_url: 'https://alerts.example.edu/1' },
    { source_of_truth: 'Campus alert system', updated_at: '2026-10-01T11:58:00Z', ...over });

  it('puts an emergency ahead of an advisory, drops expired alerts, and always carries the caveat', () => {
    const v = schoolRecordsView([
      alert('advisory', 'Shuttle suspended'),
      alert('emergency', 'Shelter in place — Science Hall'),
      alert('info', 'Old notice', { display: { severity: 'info', headline: 'Old notice', expires_at: '2026-10-01T10:00:00Z' } }),
    ], ME, NOW);
    expect(v.alerts.map((a) => a.text)).toEqual(['Emergency: Shelter in place — Science Hall', 'Advisory: Shuttle suspended']);
    for (const a of v.alerts) expect(a.caveat).toMatch(/not an emergency channel/);
  });

  it('marks an alert that has not been refreshed in fifteen minutes as not official', () => {
    const v = schoolRecordsView([alert('advisory', 'Shuttle suspended', { updated_at: '2026-10-01T11:30:00Z' })], ME, NOW);
    expect(v.alerts[0]).toMatchObject({ freshness: 'stale', official: false });
  });

  it('tells a bursar action item from an alert by whose it is, and never shows an amount', () => {
    const v = schoolRecordsView([
      row('notification', { office: 'Student Accounts', due_at: '2026-10-15T00:00:00Z', action_url: 'https://accounts.example.edu/a' },
        { subject_user_id: ME, source_of_truth: 'Bursar', updated_at: '2026-10-01T06:00:00Z' }),
    ], ME, NOW);
    expect(v.alerts).toEqual([]);
    expect(v.actions[0]).toMatchObject({ text: 'An action from Student Accounts — due Thu, Oct 15', official: true,
      link: 'https://accounts.example.edu/a' });
  });

  it('shows the next advising appointment with its preparation link', () => {
    const v = schoolRecordsView([
      row('appointment', { starts_at: '2026-10-02T15:00:00Z', office: 'Academic Advising', mode: 'video',
        prep_url: 'https://advising.example.edu/prep' }, { subject_user_id: ME, source_of_truth: 'Advising system' }),
      row('appointment', { starts_at: '2026-09-20T15:00:00Z', office: 'Past', mode: 'video' }, { subject_user_id: ME }),
    ], ME, NOW);
    expect(v.appointment).toMatchObject({ text: 'Advising appointment Fri, Oct 2, 3:00 PM UTC — Academic Advising, by video',
      link: 'https://advising.example.edu/prep', linkLabel: 'Prepare' });
  });

  it('shows who asked to hear from you, never why', () => {
    const v = schoolRecordsView([row('referral', { office: 'Writing Studio', action_url: 'https://writing.example.edu/book' },
      { subject_user_id: ME })], ME, NOW);
    expect(v.referrals[0]).toMatchObject({ text: 'Writing Studio asked to hear from you', linkLabel: 'Get in touch' });
  });

  it('offers one career deadline within a fortnight and one event within a week', () => {
    const v = schoolRecordsView([
      row('internship', { title: 'Later', employer: 'X', deadline_at: '2026-11-30T00:00:00Z' }),
      row('internship', { title: 'Policy research intern', employer: 'Example Institute', deadline_at: '2026-10-10T23:59:00Z',
        source_url: 'https://careers.example.edu/p/1' }),
      row('event', { title: 'Career fair', starts_at: '2026-10-03T17:00:00Z', location: 'Student Center' }),
      row('event', { title: 'Too far', starts_at: '2026-10-20T17:00:00Z' }),
    ], ME, NOW);
    expect(v.opportunity?.text).toBe('Policy research intern at Example Institute — apply by Sat, Oct 10');
    expect(v.event?.text).toBe('Career fair — Sat, Oct 3, 5:00 PM UTC, Student Center');
  });

  it('is empty when only far-off or somebody else’s campus facts exist', () => {
    const v = schoolRecordsView([
      row('event', { title: 'Too far', starts_at: '2026-12-20T17:00:00Z' }),
      row('appointment', { starts_at: '2026-10-02T15:00:00Z', office: 'X' }, { subject_user_id: 'someone-else' }),
    ], ME, NOW);
    expect(v.empty).toBe(true);
  });
});

describe('whether the cards are on, with the school’s narrowing', () => {
  type Answer = { data?: unknown; error?: { message: string } | null };
  // A database with only what cardsState reads.
  function db(narrowing: Answer) {
    const from = () => {
      const q: Record<string, unknown> = { select: () => q };
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
      return q;
    };
    return {
      rpc: async (name: string) => (name === 'feature_narrowing' ? { data: narrowing.data ?? null, error: narrowing.error ?? null } : { data: 'production', error: null }),
      from,
    } as unknown as SupabaseClient;
  }
  const row = (over: Record<string, string[]>) => ({ data: [{ permitted_roles: [], permitted_cohorts: [], roles: [], cohorts: [], ...over }] });

  it('is on with no narrowing — the control', async () => {
    expect(await cardsState(db({ data: [] }), 'vu', 'production', NOW)).toBe('on');
    expect(await cardsState(db(row({})), 'vu', 'production', NOW)).toBe('on');
  });

  it('is off for a student outside the pilot cohort, and on for a member', async () => {
    expect(await cardsState(db(row({ permitted_cohorts: ['cards-pilot'] })), 'vu', 'production', NOW)).toBe('off');
    expect(await cardsState(db(row({ permitted_cohorts: ['cards-pilot'], cohorts: ['cards-pilot'] })), 'vu', 'production', NOW)).toBe('on');
  });

  it('is off for a role the school did not name', async () => {
    expect(await cardsState(db(row({ permitted_roles: ['university_staff'] })), 'vu', 'production', NOW)).toBe('off');
    expect(await cardsState(db(row({ permitted_roles: ['university_staff'], roles: ['university_staff'] })), 'vu', 'production', NOW)).toBe('on');
  });

  it('is an error, never on, when the narrowing cannot be read', async () => {
    expect(await cardsState(db({ error: { message: 'Failed to fetch' } }), 'vu', 'production', NOW)).toBe('error');
  });
});
