import { obj, textValue } from './device-library';

/**
 * Advisor Meeting Mode (Phase G, `advisor_meeting_mode`): a student's own
 * preparation for a meeting with an advisor, kept on the device.
 *
 * - An agenda and questions (with a place for the answer given).
 * - Attachments the student picks: at most one graduation scenario and some
 *   of their saved courses — nothing else can be attached.
 * - Follow-up actions after the meeting, which are theirs.
 * - Private notes, which never leave the device: not in a share, not in an
 *   export.
 *
 * `sharePayload` is the only road from here to an advisor. It is built from
 * what the student ticked, is shown to them in full before anything is sent
 * (D-016), and is a snapshot: a later edit does not change what was shared.
 */

export const MEETING_KEY = 'semester.advisor-meeting.v1';
export const LIMITS = { meetings: 20, items: 30, text: 500, title: 120, courses: 12 } as const;

export interface Line {
  id: string;
  text: string;
}

export interface Question extends Line {
  /** What the advisor said, noted by the student after the meeting. */
  answer: string;
}

export interface FollowUp extends Line {
  done: boolean;
  /** YYYY-MM-DD, optional. */
  due: string | null;
}

export interface Meeting {
  id: string;
  title: string;
  /** YYYY-MM-DD, optional. */
  date: string | null;
  agenda: Line[];
  questions: Question[];
  attach: {
    /** A scenario id from the graduation simulator, or null. */
    scenario: string | null;
    /** Saved course ids from the course shortlist. */
    courses: string[];
    /** Whether follow-up actions go into a share. Off unless ticked. */
    followUps: boolean;
  };
  followUps: FollowUp[];
  /** Private. Never shared, never exported. */
  notes: string;
  created: number;
}

export interface MeetingLibrary {
  version: 1;
  meetings: Meeting[];
}

export const EMPTY_MEETINGS: MeetingLibrary = { version: 1, meetings: [] };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const bad = () => new Error('Saved meeting preparation is not valid.');

function lines<T extends Line>(value: unknown, extra: (v: Record<string, unknown>) => Omit<T, keyof Line>): T[] {
  if (!Array.isArray(value) || value.length > LIMITS.items) throw bad();
  return value.map((v) => {
    if (!obj(v) || !textValue(v.id, 100) || !v.id || !textValue(v.text, LIMITS.text)) throw bad();
    return { id: v.id, text: v.text, ...extra(v) } as T;
  });
}

export function readMeetings(value: unknown): MeetingLibrary {
  if (!obj(value) || value.version !== 1 || !Array.isArray(value.meetings) || value.meetings.length > LIMITS.meetings) throw bad();
  const meetings = value.meetings.map((m): Meeting => {
    if (!obj(m) || !textValue(m.id, 100) || !m.id || !textValue(m.title, LIMITS.title) || !textValue(m.notes, 5000) || typeof m.created !== 'number') throw bad();
    if (m.date !== null && (!textValue(m.date, 10) || !ISO_DAY.test(m.date))) throw bad();
    const a = m.attach;
    if (!obj(a) || (a.scenario !== null && !textValue(a.scenario, 100)) || typeof a.followUps !== 'boolean') throw bad();
    if (!Array.isArray(a.courses) || a.courses.length > LIMITS.courses || a.courses.some((c) => !textValue(c, 200) || !c)) throw bad();
    return {
      id: m.id,
      title: m.title,
      date: m.date,
      agenda: lines<Line>(m.agenda, () => ({})),
      questions: lines<Question>(m.questions, (v) => {
        if (!textValue(v.answer, LIMITS.text)) throw bad();
        return { answer: v.answer };
      }),
      attach: { scenario: a.scenario, courses: [...new Set(a.courses as string[])], followUps: a.followUps },
      followUps: lines<FollowUp>(m.followUps, (v) => {
        if (typeof v.done !== 'boolean' || (v.due !== null && (!textValue(v.due, 10) || !ISO_DAY.test(v.due)))) throw bad();
        return { done: v.done, due: v.due };
      }),
      notes: m.notes,
      created: m.created,
    };
  });
  if (new Set(meetings.map((m) => m.id)).size !== meetings.length) throw bad();
  return { version: 1, meetings };
}

export function newMeeting(now: number): Meeting {
  return {
    id: crypto.randomUUID(),
    title: 'Advisor meeting',
    date: null,
    agenda: [],
    questions: [],
    attach: { scenario: null, courses: [], followUps: false },
    followUps: [],
    notes: '',
    created: now,
  };
}

/** What an attached scenario and course look like once resolved — text only, as the student sees them. */
export interface AttachedScenario {
  name: string;
  lines: string[];
}

export interface AttachedCourse {
  code: string;
  section: string;
  title: string;
  credits: number;
  meets: string;
}

/** Exactly what an advisor would see. Nothing else is ever sent. */
export interface SharePayload {
  version: 1;
  sharedAs: string;
  title: string;
  date: string | null;
  agenda: string[];
  questions: string[];
  scenario: AttachedScenario | null;
  courses: AttachedCourse[];
  followUps: string[];
}

export function sharePayload(
  meeting: Meeting,
  resolved: { sharedAs: string; scenario: AttachedScenario | null; courses: AttachedCourse[] },
): SharePayload {
  const words = (l: Line[]) => l.map((x) => x.text.trim()).filter(Boolean);
  return {
    version: 1,
    sharedAs: resolved.sharedAs.trim().slice(0, 80),
    title: meeting.title.trim().slice(0, LIMITS.title) || 'Advisor meeting',
    date: meeting.date,
    agenda: words(meeting.agenda),
    questions: words(meeting.questions),
    scenario: meeting.attach.scenario ? resolved.scenario : null,
    courses: resolved.courses.slice(0, LIMITS.courses),
    followUps: meeting.attach.followUps ? words(meeting.followUps) : [],
  };
}

/** The payload in words — the preview before a share, and the advisor's view. */
export function payloadLines(p: SharePayload): { heading: string; items: string[] }[] {
  return [
    { heading: 'Agenda', items: p.agenda },
    { heading: 'Questions', items: p.questions },
    ...(p.scenario ? [{ heading: `Plan scenario: ${p.scenario.name}`, items: p.scenario.lines }] : []),
    ...(p.courses.length ? [{ heading: 'Courses being considered', items: p.courses.map((c) => `${c.code} · ${c.section} — ${c.title}, ${c.credits} credits, ${c.meets}`) }] : []),
    ...(p.followUps.length ? [{ heading: 'Follow-up actions', items: p.followUps }] : []),
  ].filter((s) => s.items.length > 0);
}

/**
 * The meeting summary for export or print: the agenda, questions with the
 * answers noted, attachments and follow-ups. Private notes are left out, and
 * the summary says so.
 */
export function meetingSummary(meeting: Meeting, p: SharePayload): string {
  const out = [`${p.title}${meeting.date ? ` — ${meeting.date}` : ''}`, 'Prepared in Semester. Planning notes, not an official record.', ''];
  const section = (heading: string, items: string[]) => {
    if (!items.length) return;
    out.push(heading.toUpperCase(), ...items.map((i) => `• ${i}`), '');
  };
  section('Agenda', p.agenda);
  section(
    'Questions',
    meeting.questions.filter((q) => q.text.trim()).map((q) => (q.answer.trim() ? `${q.text.trim()} — ${q.answer.trim()}` : q.text.trim())),
  );
  if (p.scenario) section(`Plan scenario: ${p.scenario.name}`, p.scenario.lines);
  section('Courses being considered', p.courses.map((c) => `${c.code} · ${c.section} — ${c.title}, ${c.credits} credits, ${c.meets}`));
  section(
    'Follow-up actions',
    meeting.followUps.filter((f) => f.text.trim()).map((f) => `${f.done ? '[done] ' : ''}${f.text.trim()}${f.due ? ` (by ${f.due})` : ''}`),
  );
  out.push('Private notes are not included.');
  return out.join('\n');
}
