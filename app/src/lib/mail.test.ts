import { describe, expect, it } from 'vitest';
import {
  LATE_ENOUGH,
  brief,
  canAskForTime,
  composeUrl,
  fallbackSubject,
  parseDraft,
  purpose,
  salutation,
  type MailContext,
} from './mail';
import type { Course, DatedItem } from './types';

const course = {
  id: 'econ',
  code: 'ECON 1020',
  name: 'Principles of Macroeconomics',
  prof: 'Dr. John Stromme',
  email: 'john.stromme@vanderbilt.edu',
  meets: 'T/R',
  room: 'Buttrick 101',
  credits: '3',
  source: 'syllabus.pdf',
  grading: [],
} as Course;

const item = {
  id: 'econ-ps2',
  c: 'econ',
  title: 'Problem set 2',
  kind: 'Problem set',
  mon: 'Sep',
  day: 14,
  dueTime: '11:59p',
} as DatedItem;

const ctx = (over: Partial<MailContext> = {}): MailContext => ({
  course,
  item: null,
  from: 'Harrison',
  incoming: '',
  facts: '',
  ...over,
});

describe('salutation', () => {
  it('drops the title and keeps the surname', () => {
    expect(salutation('Dr. John Stromme')).toBe('Dear Professor Stromme,');
    expect(salutation('Prof. Jessica Trounstine')).toBe('Dear Professor Trounstine,');
  });

  it('keeps a two-word surname whole', () => {
    // "Torres Colón" is one surname. Cutting it to "Colón" is worse than
    // being wordy.
    expect(salutation('Prof. Gabriel Torres Colón')).toBe('Dear Professor Torres Colón,');
  });

  it('handles a bare surname and an empty field', () => {
    expect(salutation('Stromme')).toBe('Dear Professor Stromme,');
    expect(salutation('   ')).toBe('Dear Professor,');
  });
});

describe('parseDraft', () => {
  it('lifts the subject line off the front', () => {
    const { subject, body } = parseDraft('Subject: Extension on PS2\n\nDear Professor,\n\nHello.');
    expect(subject).toBe('Extension on PS2');
    expect(body).toBe('Dear Professor,\n\nHello.');
  });

  it('keeps everything as body when there is no subject line', () => {
    // Losing the first sentence is a worse failure than an empty subject box.
    const { subject, body } = parseDraft('Dear Professor,\n\nCould I have a week?');
    expect(subject).toBe('');
    expect(body).toBe('Dear Professor,\n\nCould I have a week?');
  });

  it('does not mistake the word subject inside the body', () => {
    const { subject, body } = parseDraft('Dear Professor,\n\nSubject: my major is undeclared.');
    expect(subject).toBe('');
    expect(body).toContain('Subject: my major');
  });
});

describe('composeUrl', () => {
  const draft = { to: 'a@b.edu', subject: 'ECON 1020 — PS2', body: 'Dear Professor,\n\nHi.' };

  it('builds a Gmail compose link', () => {
    const url = composeUrl('gmail', draft);
    expect(url.startsWith('https://mail.google.com/mail/?')).toBe(true);
    expect(url).toContain('view=cm');
    expect(new URL(url).searchParams.get('to')).toBe('a@b.edu');
    expect(new URL(url).searchParams.get('body')).toBe('Dear Professor,\n\nHi.');
  });

  it('builds an Outlook compose link', () => {
    const url = composeUrl('outlook', draft);
    expect(url.startsWith('https://outlook.office.com/mail/deeplink/compose?')).toBe(true);
    expect(new URL(url).searchParams.get('subject')).toBe('ECON 1020 — PS2');
  });

  it('falls back to mailto with the address in the path', () => {
    const url = composeUrl('default', draft);
    expect(url.startsWith('mailto:a%40b.edu?')).toBe(true);
    expect(url).toContain('subject=');
  });

  it('survives an empty address rather than producing a broken link', () => {
    expect(() => composeUrl('gmail', { ...draft, to: '' })).not.toThrow();
    expect(composeUrl('default', { ...draft, to: '' }).startsWith('mailto:?')).toBe(true);
  });
});

describe('brief', () => {
  it('passes on the course, the deadline and the salutation', () => {
    const text = brief(purpose('extension'), ctx({ item, facts: 'I have two exams that week.' }));
    expect(text).toContain('ECON 1020');
    expect(text).toContain('Dear Professor Stromme,');
    expect(text).toContain('Problem set 2');
    expect(text).toContain('Sep 14');
    expect(text).toContain('I have two exams that week.');
  });

  it('orders the model to leave blanks when the student has given no reason', () => {
    const text = brief(purpose('extension'), ctx());
    expect(text).toContain('square-bracket blanks');
    expect(text).toContain('Do not fill any of them in.');
  });

  it('does not demand blanks for an email that needs no facts', () => {
    expect(brief(purpose('thanks'), ctx())).not.toContain('square-bracket blanks');
  });

  it('keeps a placeholder name rather than inventing one', () => {
    expect(brief(purpose('thanks'), ctx({ from: '' }))).toContain('[your name]');
  });

  it('includes the incoming message when replying', () => {
    const text = brief(purpose('reply'), ctx({ incoming: 'Can you come Thursday at 2?' }));
    expect(text).toContain('Can you come Thursday at 2?');
  });
});

describe('fallbackSubject', () => {
  it('names the course and the thing', () => {
    expect(fallbackSubject(purpose('extension'), ctx({ item }))).toBe('ECON 1020 — Problem set 2');
  });

  it('copes with no course and no deadline', () => {
    const subject = fallbackSubject(purpose('meeting'), ctx({ course: null }));
    expect(subject).toBe('a meeting');
  });
});

describe('canAskForTime', () => {
  const item = (over: Partial<{ kind: string; weight: string; daysAway: number }> = {}) => ({
    kind: 'Essay',
    weight: '20%',
    daysAway: 0,
    ...over,
  });

  it('offers on graded work that is late or nearly due', () => {
    expect(canAskForTime(item({ daysAway: -3 }), false)).toBe(true);
    expect(canAskForTime(item({ daysAway: 0 }), false)).toBe(true);
    expect(canAskForTime(item({ daysAway: LATE_ENOUGH }), false)).toBe(true);
  });

  it('says nothing a week out, when the honest answer is to write it', () => {
    expect(canAskForTime(item({ daysAway: LATE_ENOUGH + 1 }), false)).toBe(false);
    expect(canAskForTime(item({ daysAway: 7 }), false)).toBe(false);
  });

  it('never offers an extension on an exam', () => {
    // There is no extension on a closed-note midterm sat at a fixed hour, and
    // a student who emailed to ask for one was told to by their own planner.
    expect(canAskForTime(item({ kind: 'Midterm 2' }), false)).toBe(false);
    expect(canAskForTime(item({ kind: 'Final Exam' }), false)).toBe(false);
    expect(canAskForTime(item({ kind: 'Quiz 3' }), false)).toBe(false);
  });

  it('says nothing about a reading, which has nothing to extend', () => {
    expect(canAskForTime(item({ weight: '' }), false)).toBe(false);
    expect(canAskForTime(item({ weight: '  ' }), false)).toBe(false);
  });

  it('says nothing about work already handed in', () => {
    expect(canAskForTime(item(), true)).toBe(false);
  });
});
