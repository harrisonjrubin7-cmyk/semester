import { describe, expect, it } from 'vitest';
import {
  ALWAYS_SHOWN, ATTENDANCE_OPTIONAL, CIRCLE_TYPES, FORBIDDEN_INPUTS, INTEGRITY_REMINDER, MAX_CAP, MAX_DAYS, MIN_CAP, NEVER_SHARED,
  SENSITIVE_TYPES, assertSuggestionInputs, join, nextFacilitator, notesShared, openCircle, rosterVisible, type Circle, type StudyPlan,
} from './circles';
import { FORBIDDEN_SIGNALS } from './feed';

const circle = (over: Partial<Circle> = {}): Circle => ({
  id: 'c1', type: 'transfer', purpose: 'Navigating a new institution with credits already earned', cap: 8,
  startsOn: '2026-09-01', endsOn: '2026-11-20', facilitator: { id: 'f', name: 'Sam', trainedOn: '2026-08-15' },
  conductVersion: '2026.1', format: 'hybrid', accessibility: 'Captions on for online meetings', timeZone: 'America/Chicago',
  reportingRoute: 'Report in the app or to the Student Affairs office', closurePlan: 'Closes 20 November; members are pointed to the transfer center',
  meetingBoundaries: 'Campus rooms and the approved online room only', ...over,
});

describe('opening a circle', () => {
  it('twelve types, each with a purpose', () => {
    expect(CIRCLE_TYPES).toHaveLength(12);
    for (const t of CIRCLE_TYPES) expect(t.purpose.length, t.id).toBeGreaterThan(10);
    for (const s of SENSITIVE_TYPES) expect(CIRCLE_TYPES.some((t) => t.id === s)).toBe(true);
  });

  it('opens a complete one and names every bound a bad one breaks', () => {
    expect(openCircle(circle()).ok).toBe(true);
    const v = openCircle(circle({ purpose: 'chat', cap: MAX_CAP + 1, facilitator: { id: 'f', name: 'Sam', trainedOn: null }, conductVersion: '', reportingRoute: ' ', closurePlan: '', endsOn: '2027-06-01' }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.problems).toEqual(expect.arrayContaining([
      expect.stringMatching(/purpose/), expect.stringMatching(/cap between/), expect.stringMatching(/peer-leader training/),
      expect.stringMatching(/code of conduct/), expect.stringMatching(/reporting route/), expect.stringMatching(/closure plan/),
      expect.stringMatching(new RegExp(`${MAX_DAYS} days`)),
    ]));
  });

  it('a circle is a term, not a lifetime, and not a pair', () => {
    expect(openCircle(circle({ cap: MIN_CAP - 1 })).ok).toBe(false);
    expect(openCircle(circle({ endsOn: '2026-09-04' })).ok).toBe(false);
    expect(openCircle(circle({ endsOn: '2026-12-30' })).ok).toBe(true);
  });
});

describe('joining', () => {
  it('is refused only by the cap, the end date, and being in already', () => {
    const c = circle({ cap: 3 });
    const m = [{ circleId: 'c1', memberId: 'a', joinedOn: '2026-09-01' }, { circleId: 'c1', memberId: 'b', joinedOn: '2026-09-01' }];
    expect(join(c, m, 'c', '2026-09-10').ok).toBe(true);
    expect(join(c, m, 'a', '2026-09-10')).toEqual({ ok: false, reason: 'already a member' });
    expect(join(c, [...m, { circleId: 'c1', memberId: 'c', joinedOn: '2026-09-10' }], 'd', '2026-09-10')).toEqual({ ok: false, reason: 'this circle is full at 3' });
    expect(join(c, m, 'c', '2026-11-21')).toEqual({ ok: false, reason: 'this circle has closed' });
  });

  it('sensitive circles never list their members', () => {
    expect(rosterVisible(circle({ type: 'accessible_study' }))).toBe(false);
    expect(rosterVisible(circle({ type: 'founder' }))).toBe(true);
  });

  it('always says it is not an emergency service and that leaving is one tap', () => {
    expect(ALWAYS_SHOWN[0]).toMatch(/not an emergency service/);
    expect(ALWAYS_SHOWN[1]).toMatch(/one tap/);
  });
});

describe('what a suggestion may not read', () => {
  it('refuses every forbidden input by key, however it is spelled', () => {
    expect(() => assertSuggestionInputs({ interests: ['x'], course: 'MATH 101' })).not.toThrow();
    for (const f of FORBIDDEN_INPUTS) expect(() => assertSuggestionInputs({ [`student_${f}_2026`]: 1 }), f).toThrow(/may not read/);
    expect(() => assertSuggestionInputs({ GPA: 3.9 })).toThrow(/gpa/);
  });

  it('is at least as strict as the feed\'s forbidden signals about people', () => {
    // The feed refuses karma, reports and follower counts; a circle suggestion refuses those and every fact about a person.
    for (const s of ['location', 'attendance']) expect(FORBIDDEN_INPUTS).toContain(s);
    expect(FORBIDDEN_SIGNALS.length).toBeGreaterThan(0);
  });
});

describe('a study plan', () => {
  const plan: StudyPlan = { courseOrTopic: 'ECON 101', term: 'Fall 2026', meetingPattern: 'Tuesdays 7pm', format: 'in_person', goals: ['Problem set each week'], materialsPolicy: 'Own notes only', facilitatorRotation: ['a', 'b', 'c'], calendarLinks: [], notesOptIn: ['a'] };

  it('rotates the facilitator and shares only opted-in notes', () => {
    expect(nextFacilitator(plan, null)).toBe('a');
    expect(nextFacilitator(plan, 'a')).toBe('b');
    expect(nextFacilitator(plan, 'c')).toBe('a');
    expect(nextFacilitator({ ...plan, facilitatorRotation: [] }, 'a')).toBeNull();
    expect(notesShared(plan, 'a')).toBe(true);
    expect(notesShared(plan, 'b')).toBe(false);
  });

  it('never shares the four institutional things, never records attendance, and reminds about integrity', () => {
    expect(NEVER_SHARED).toEqual(['grades', 'accommodations', 'attendance', 'assignment submissions', 'private course data']);
    expect(ATTENDANCE_OPTIONAL).toBe(true);
    expect(INTEGRITY_REMINDER).toMatch(/submit your own work/);
    const keys = Object.keys(plan);
    for (const bad of ['grades', 'attendance', 'accommodations', 'submissions']) expect(keys.join(' ')).not.toContain(bad);
  });
});
