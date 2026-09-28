import { describe, expect, it } from 'vitest';
import { EMPTY_MEETINGS, meetingSummary, newMeeting, payloadLines, readMeetings, readSharePayload, sharePayload, type Meeting } from './advisor-meeting';

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
    expect(payloadLines(p).map((s) => s.heading)).toEqual(['Agenda', 'Questions', 'Plan scenario: Study abroad', 'Courses being considered', 'Follow-up actions']);
  });

  it('never has a field for notes, history, grades or anything else', () => {
    const p = sharePayload(meeting({ attach: { scenario: 's1', courses: ['e3'], followUps: true } }), resolved);
    expect(Object.keys(p).sort()).toEqual(['agenda', 'courses', 'date', 'followUps', 'questions', 'scenario', 'sharedAs', 'title', 'version']);
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
