import type { AppNotification } from '../lib/types';

/** Which alerts the app can send. Toggled in onboarding and in Settings. */
export const NOTIF_DEFS = [
  { k: 'class', label: 'Class starting in 15 minutes' },
  { k: 'today', label: 'Anything due today, at 8am' },
  { k: 'two', label: 'Two-day warning on big assignments' },
  { k: 'free', label: '“Nothing due tonight” all-clear' },
  { k: 'sun', label: 'Sunday night: your weekly report' },
  { k: 'exam', label: 'Exam in one week' },
  { k: 'term', label: 'A registrar deadline a week out' },
] as const;

export type NotifKey = (typeof NOTIF_DEFS)[number]['k'];

export const DEFAULT_NOTIFS: Record<NotifKey, boolean> = {
  class: true,
  today: true,
  two: true,
  free: false,
  sun: true,
  exam: true,
  // On by default, unlike the other opt-ins: this is the one whose cost is
  // money rather than points, and somebody who has not filled the dates in
  // gets nothing from it anyway.
  term: true,
};

/** The morning batch. A demonstration of the alert style, not a live feed. */
export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    code: 'BUS 1600',
    when: '7:02 AM',
    title: 'Group Assignment 1 lands tonight',
    body: 'ECOALF case, 11:59 PM. Your team hasn’t opened the doc.',
  },
  {
    id: 'n2',
    code: 'CORE 2500',
    when: '7:02 AM',
    title: 'Reflection #1 due before 1:15p',
    body: 'Self-assessed. Rubric is attached in Brightspace.',
  },
  {
    id: 'n3',
    code: 'PSCI 1104',
    when: '6:41 AM',
    title: 'Class canceled today',
    body: 'Prof. Trounstine is at APSA. 2:45p is yours.',
  },
  {
    id: 'n4',
    code: 'ECON 1020',
    when: 'Yesterday',
    title: 'PSet 1 posted',
    body: 'Due Friday 11:59 PM on Gradescope. No extensions, ever.',
  },
];

/** Connected sources, shown in Settings. */
export const SOURCES = [
  { label: 'Brightspace', meta: '4 courses · synced 6:40 AM', state: 'On' },
  { label: 'Gradescope', meta: 'ECON 1020 problem sets', state: 'On' },
  { label: 'Apple Calendar', meta: 'Two-way, “Fall 2026” calendar', state: 'On' },
  { label: 'Top Hat', meta: 'Join code 782449', state: 'Link' },
];

/** What the syllabus importer finds — the ECON schedule, resolved to dates. */
export const EXTRACT = [
  { id: 'x1', title: 'Problem Set 1', when: 'Fri Sep 4, 11:59 PM', kind: 'Problem set' },
  { id: 'x2', title: 'Problem Set 2', when: 'Fri Sep 11, 11:59 PM', kind: 'Problem set' },
  { id: 'x3', title: 'Problem Set 3', when: 'Fri Sep 18, 11:59 PM', kind: 'Problem set' },
  { id: 'x4', title: 'Midterm 1 — in class', when: 'Wed Sep 30', kind: 'Exam · 25–30%' },
  { id: 'x5', title: 'Midterm 2 — in class', when: 'Wed Nov 4', kind: 'Exam · 25–30%' },
  { id: 'x6', title: 'Fall break — no class', when: 'Oct 22–23', kind: 'Break' },
  { id: 'x7', title: 'Thanksgiving break', when: 'Nov 21–29', kind: 'Break' },
  { id: 'x8', title: 'Midterm 3 / Final exam', when: 'Tue Dec 15, 3:00–5:00p', kind: 'Exam' },
  { id: 'x9', title: 'Top Hat participation', when: 'Every class', kind: 'Extra credit' },
];

/** Real text from the ECON syllabus, pre-pasted into the importer. */
export const PASTED = `Important Dates:
• MIDTERM 1 : September 30th (Wednesday, in class)
• Fall Break: October 22–23rd (I.e., No Class Friday)
• MIDTERM 2 : November 4th (Wednesday, in class)
• Thanksgiving Break: November 21st–29th (Full Week Off)
• MID 3/FINAL EXAM : (Will take place during our official "final exam slot")
  9:05: Tuesday December 15th, 3:00–5:00p

Evaluation:
20% Problem Sets — Due roughly every Friday. All deadlines and
submissions will be in gradescope.
80% Exams — three multiple-choice exams, in class, closed-note.`;

export const LOAD_STEPS = [
  'Splitting pages…',
  'Finding the schedule table…',
  'Resolving “roughly every Friday”…',
  'Cross-checking the academic calendar…',
];

/** The three onboarding screens. */
