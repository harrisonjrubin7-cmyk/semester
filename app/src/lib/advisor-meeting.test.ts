import { describe, expect, it } from 'vitest';
import { EMPTY_MEETINGS, meetingSummary, meetingWithNamedAgenda, namedAgendaText, newMeeting, payloadLines, readMeetings, readSharePayload, sharePayload, type Meeting } from './advisor-meeting';

/**
 * Phase G's meeting model: what the device keeps, and — the part that
 * matters — that a share and a summary carry only what the student chose.
 */

const meeting = (over: Partial<Meeting> = {}): Meeting => ({
  ...newMeeting(1),
  id: 'm1',
  title: 'Spring planning',
  date: '2026-10-05',
  agenda: [{ id: 'a1', text: 'Spring courses' }, { id: 'a2', text: '  ' }],
  questions: [{ id: 'q1', text: 'Can I take ECON 3010 early?', answer: 'Yes, with consent' }],
  followUps: [{ id: 'f1', text: 'Email the department', done: false, due: '2026-10-10' }],
  notes: 'I am worried about money this term',
  ...over,
});

const resolved = {
  sharedAs: 'Sam',
  scenario: { name: 'Study abroad', lines: ['Estimated finish: Fall 2028 → Fall 2029 (+2 terms)'] },
  courses: [{ code: 'ECON 3010', section: '01', title: 'Game Theory', credits: 3, meets: 'Tue 13:00–14:15' }],
};

describe('what a share carries', () => {
  it('carries the agenda and questions, and nothing the student did not tick', () => {
    const p = sharePayload(meeting(), resolved);
    expect(p.agenda).toEqual(['Spring courses']);
    expect(p.questions).toEqual(['Can I take ECON 3010 early?']);
    expect(p.scenario).toBeNull();
    expect(p.followUps).toEqual([]);
    expect(JSON.stringify(p)).not.toContain('worried');
    expect(JSON.stringify(p)).not.toContain('Yes, with consent');
  });

  it('carries a scenario and follow-ups only when ticked', () => {
    const p = sharePayload(meeting({ attach: { scenario: 's1', courses: ['e3'], followUps: true } }), resolved);
    expect(p.scenario?.name).toBe('Study abroad');
    expect(p.followUps).toEqual(['Email the department']);
    expect(payloadLines(p).map((s) => s.heading)).toEqual(['Agenda', 'Questions', 'Plan scenario: Study abroad', 'Courses being considered', 'Follow-up actions', 'Where this comes from, and what it assumes']);
  });

  it('never has a field for notes, history, grades or anything else', () => {
    const p = sharePayload(meeting({ attach: { scenario: 's1', courses: ['e3'], followUps: true } }), resolved);
    expect(Object.keys(p).sort()).toEqual(['agenda', 'courses', 'date', 'followUps', 'provenance', 'questions', 'scenario', 'sharedAs', 'title', 'version']);
  });
});

describe('where a share says it came from', () => {
  const day = new Date(2026, 8, 30, 15, 0);

  it('names each part attached, with the honest label, and the day it was prepared', () => {
    const p = sharePayload(meeting({ attach: { scenario: 's1', courses: ['e3'], followUps: true } }), resolved, day);
    expect(p.provenance?.preparedAt).toBe('2026-09-30');
    expect(p.provenance?.sources.map((x) => x.label)).toEqual(['student_entered', 'estimated', 'student_entered', 'student_entered']);
    expect(payloadLines(p).at(-1)).toMatchObject({ heading: 'Where this comes from, and what it assumes' });
    const said = payloadLines(p).at(-1)!.items.join(' ');
    expect(said).toContain('Estimated: Plan scenario');
    expect(said).toContain('Prepared on 2026-09-30; it may have changed since.');
    expect(said).toContain('not a degree audit or an official credit evaluation');
    expect(said).toContain('does not know seat availability');
  });

  it('claims no source for what was not attached, and never a school record', () => {
    const p = sharePayload(meeting(), { sharedAs: 'Sam', scenario: null, courses: [] }, day);
    expect(p.provenance?.sources.map((x) => x.label)).toEqual(['student_entered']);
    expect(JSON.stringify(p.provenance)).not.toMatch(/institution_verified|imported/);
  });

  it('is the same all day, so a preview does not change before it is sent', () => {
    const a = sharePayload(meeting(), resolved, new Date(2026, 8, 30, 8, 0));
    const b = sharePayload(meeting(), resolved, new Date(2026, 8, 30, 23, 59));
    expect(a).toEqual(b);
  });

  it('still opens a share made before it existed, and says nothing about sources', () => {
    const p = sharePayload(meeting(), resolved, day);
    const { provenance: _drop, ...older } = p;
    const read = readSharePayload(JSON.parse(JSON.stringify(older)));
    expect(read.provenance).toBeUndefined();
    expect(payloadLines(read).some((s) => s.heading.startsWith('Where this comes from'))).toBe(false);
  });

  it('refuses a provenance block that is not what it says it is', () => {
    const p = sharePayload(meeting(), resolved, day);
    const bad = (prov: unknown) => expect(() => readSharePayload({ ...p, provenance: prov })).toThrow('This share could not be read.');
    bad({ ...p.provenance, preparedAt: 'yesterday' });
    bad({ ...p.provenance, sources: [{ what: 'x', label: 'guaranteed' }] });
    bad({ ...p.provenance, sources: new Array(9).fill({ what: 'x', label: 'estimated' }) });
    bad({ ...p.provenance, assumptions: 'none' });
    bad('yes');
  });
});

describe('a share as an advisor opens it', () => {
  it('reads back exactly what the student shared', () => {
    const p = sharePayload(meeting({ attach: { scenario: 's1', courses: ['e3'], followUps: true } }), resolved);
    expect(readSharePayload(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('refuses a snapshot of the wrong shape before anything renders it', () => {
    const p = sharePayload(meeting(), resolved);
    for (const broken of [{}, null, { ...p, agenda: 'Spring courses' }, { ...p, courses: [{ code: 'X' }] }, { ...p, scenario: { name: 'S' } }]) {
      expect(() => readSharePayload(broken)).toThrow('This share could not be read.');
    }
  });
});

describe('the summary', () => {
  it('has the answers noted and the follow-ups, leaves out private notes, and says so', () => {
    const m = meeting({ attach: { scenario: null, courses: [], followUps: false } });
    const text = meetingSummary(m, sharePayload(m, resolved));
    expect(text).toContain('Spring planning — 2026-10-05');
    expect(text).toContain('• Can I take ECON 3010 early? — Yes, with consent');
    expect(text).toContain('• Email the department (by 2026-10-10)');
    expect(text).not.toContain('worried');
    expect(text).toContain('Private notes are not included.');
    expect(text).toContain('not an official record');
  });
});

describe('the device store', () => {
  it('reads what it writes, and refuses anything else', () => {
    const lib = { version: 1 as const, meetings: [meeting({ attach: { scenario: 's1', courses: ['e3', 'e3'], followUps: true } })] };
    const back = readMeetings(JSON.parse(JSON.stringify(lib)));
    expect(back.meetings[0].attach.courses).toEqual(['e3']);
    expect(back.meetings[0].questions[0].answer).toBe('Yes, with consent');
    expect(readMeetings(EMPTY_MEETINGS)).toEqual(EMPTY_MEETINGS);
    expect(() => readMeetings({ version: 2, meetings: [] })).toThrow();
    expect(() => readMeetings({ version: 1, meetings: [{ ...meeting(), date: '5 Oct' }] })).toThrow();
    expect(() => readMeetings({ version: 1, meetings: [meeting(), meeting()] })).toThrow();
    expect(() => readMeetings({ version: 1, meetings: [{ ...meeting(), agenda: Array.from({ length: 31 }, (_, i) => ({ id: String(i), text: 'x' })) }] })).toThrow();
  });
});

describe('named courses on the student agenda', () => {
  const named = [{ code: 'ECON 1020', term: 'Fall 2026', secret: 'SECRET-GRADE-99' }];

  it('writes only the code and term, and leaves notes and attachments empty', () => {
    const next = meetingWithNamedAgenda(EMPTY_MEETINGS, named, 10);
    expect(namedAgendaText({ code: 'ECON 1020', term: 'Fall 2026' })).toBe('ECON 1020 (Fall 2026). Named on this device. Not an enrollment.');
    expect(next.meetings).toHaveLength(1);
    expect(next.meetings[0].title).toBe('Courses I am considering');
    expect(next.meetings[0].agenda.map((line) => line.text)).toEqual([namedAgendaText({ code: 'ECON 1020', term: 'Fall 2026' })]);
    expect(next.meetings[0].notes).toBe('');
    expect(next.meetings[0].questions).toEqual([]);
    expect(next.meetings[0].attach).toEqual({ scenario: null, courses: [], followUps: false });
    expect(JSON.stringify(next)).not.toContain('SECRET-GRADE-99');
    expect(JSON.stringify(next)).not.toContain('worried');
  });

  it('does not duplicate a line, and does not touch notes or attachments already on the meeting', () => {
    const existing = meeting({ attach: { scenario: 's1', courses: ['c1'], followUps: true } });
    const lib = { version: 1 as const, meetings: [existing] };
    const next = meetingWithNamedAgenda(lib, [{ code: 'ECON 1020', term: 'Fall 2026' }], 50);
    expect(next.meetings).toHaveLength(1);
    expect(next.meetings[0].id).toBe(existing.id);
    expect(next.meetings[0].notes).toBe('I am worried about money this term');
    expect(next.meetings[0].attach).toEqual(existing.attach);
    expect(next.meetings[0].agenda.map((line) => line.text)).toEqual([
      'Spring courses',
      '  ',
      namedAgendaText({ code: 'ECON 1020', term: 'Fall 2026' }),
    ]);
    const again = meetingWithNamedAgenda(next, [{ code: 'ECON 1020', term: 'Fall 2026' }], 60);
    expect(again).toBe(next);
  });

  it('opens another meeting when the newest agenda is already full', () => {
    const full = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, text: `line ${i}` }));
    const kept = meeting({ agenda: full, notes: 'kept' });
    const next = meetingWithNamedAgenda({ version: 1, meetings: [kept] }, [{ code: 'ECON 1020', term: null }], 2);
    expect(next.meetings).toHaveLength(2);
    expect(next.meetings.find((item) => item.id === kept.id)?.agenda).toHaveLength(30);
    expect(next.meetings.find((item) => item.id === kept.id)?.notes).toBe('kept');
    expect(next.meetings.some((item) => item.agenda.some((line) => line.text === namedAgendaText({ code: 'ECON 1020', term: null })))).toBe(true);
  });
});
