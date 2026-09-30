import { obj, textValue } from './device-library';
import { SOURCE_LABELS, SOURCE_TEXT, type SourceLabel } from './source';

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

/**
 * The store for one account on this device, or for the signed-out device.
 * Meeting preparation — private notes included — is a person's own, so two
 * accounts on a shared browser never read each other's.
 */
export const meetingKey = (accountId: string | null | undefined): string => `${MEETING_KEY}:${accountId || 'device'}`;
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

/**
 * The library as it may leave the device in a backup: every private note
 * emptied. Notes are promised to stay on this device.
 */
export function withoutNotes(library: MeetingLibrary): MeetingLibrary {
  return { version: 1, meetings: library.meetings.map((m) => ({ ...m, notes: '' })) };
}

/**
 * A restored library, keeping the private notes this device already has for
 * the same meetings — a backup never carried them, so restoring one must not
 * erase them.
 */
export function keepNotes(incoming: MeetingLibrary, existing: unknown): MeetingLibrary {
  let before: MeetingLibrary;
  try {
    before = readMeetings(existing);
  } catch {
    return incoming;
  }
  const notes = new Map(before.meetings.map((m) => [m.id, m.notes]));
  return { version: 1, meetings: incoming.meetings.map((m) => ({ ...m, notes: m.notes || notes.get(m.id) || '' })) };
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
  /**
   * Where each part came from, what it assumes, and when it was prepared.
   * Optional on read: a share made before this existed still opens, and says
   * nothing about its sources rather than inventing some.
   */
  provenance?: Provenance;
}

export interface Provenance {
  /** The day the snapshot was prepared, `YYYY-MM-DD`. A day, not a moment, so a preview does not change under the student's finger. */
  preparedAt: string;
  sources: { what: string; label: SourceLabel }[];
  assumptions: string[];
}

/** Said the same way on every share, because they are true of every share. */
const ASSUMPTIONS = [
  'Nothing here comes from the school’s records; the student prepared it.',
  'Any estimate is the student’s planning arithmetic, not a degree audit or an official credit evaluation.',
  'Semester does not know seat availability or registration eligibility.',
] as const;

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function sharePayload(
  meeting: Meeting,
  resolved: { sharedAs: string; scenario: AttachedScenario | null; courses: AttachedCourse[] },
  now: Date = new Date(),
): SharePayload {
  const words = (l: Line[]) => l.map((x) => x.text.trim()).filter(Boolean);
  const scenario = meeting.attach.scenario ? resolved.scenario : null;
  const courses = resolved.courses.slice(0, LIMITS.courses);
  const followUps = meeting.attach.followUps ? words(meeting.followUps) : [];
  const sources: Provenance['sources'] = [
    { what: 'Agenda and questions, written by the student', label: 'student_entered' },
    ...(scenario ? [{ what: `Plan scenario “${scenario.name}”, the student’s own arithmetic over requirements they entered`, label: 'estimated' as const }] : []),
    ...(courses.length ? [{ what: 'Courses being considered, chosen by the student from their registration plan', label: 'student_entered' as const }] : []),
    ...(followUps.length ? [{ what: 'Follow-up actions, written by the student', label: 'student_entered' as const }] : []),
  ];
  return {
    version: 1,
    sharedAs: resolved.sharedAs.trim().slice(0, 80),
    title: meeting.title.trim().slice(0, LIMITS.title) || 'Advisor meeting',
    date: meeting.date,
    agenda: words(meeting.agenda),
    questions: words(meeting.questions),
    scenario,
    courses,
    followUps,
    provenance: { preparedAt: isoDay(now), sources, assumptions: [...ASSUMPTIONS] },
  };
}

/** The payload in words — the preview before a share, and the advisor's view. */
/**
 * A shared snapshot as it comes back from the database. The table accepts any
 * JSON object, and a student can call the share function directly, so what an
 * advisor opens is checked here before anything reads a field of it.
 */
export function readSharePayload(value: unknown): SharePayload {
  const bad = () => new Error('This share could not be read. Ask the student to share it again.');
  const texts = (v: unknown, max: number = LIMITS.items): string[] => {
    if (!Array.isArray(v) || v.length > max || v.some((x) => !textValue(x, LIMITS.text))) throw bad();
    return v as string[];
  };
  if (!obj(value) || value.version !== 1 || !textValue(value.sharedAs, LIMITS.title) || !textValue(value.title, LIMITS.title)) throw bad();
  if (value.date !== null && !textValue(value.date, 10)) throw bad();
  let scenario: AttachedScenario | null = null;
  if (value.scenario !== null) {
    const sc = value.scenario;
    if (!obj(sc) || !textValue(sc.name, LIMITS.title)) throw bad();
    scenario = { name: sc.name, lines: texts(sc.lines, 60) };
  }
  if (!Array.isArray(value.courses) || value.courses.length > LIMITS.courses) throw bad();
  const courses = value.courses.map((c): AttachedCourse => {
    if (!obj(c) || !textValue(c.code, 40) || !textValue(c.section, 40) || !textValue(c.title, 200) || !textValue(c.meets, 200)) throw bad();
    if (typeof c.credits !== 'number' || !Number.isFinite(c.credits)) throw bad();
    return { code: c.code, section: c.section, title: c.title, credits: c.credits, meets: c.meets };
  });
  let provenance: Provenance | undefined;
  if (value.provenance !== undefined) {
    const v = value.provenance;
    if (!obj(v) || !textValue(v.preparedAt, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(v.preparedAt)) throw bad();
    if (!Array.isArray(v.sources) || v.sources.length > 8) throw bad();
    const sources = v.sources.map((x) => {
      if (!obj(x) || !textValue(x.what, 300) || typeof x.label !== 'string' || !(SOURCE_LABELS as readonly string[]).includes(x.label)) throw bad();
      return { what: x.what, label: x.label as SourceLabel };
    });
    provenance = { preparedAt: v.preparedAt, sources, assumptions: texts(v.assumptions, 6) };
  }
  return {
    version: 1,
    sharedAs: value.sharedAs,
    title: value.title,
    date: value.date as string | null,
    agenda: texts(value.agenda),
    questions: texts(value.questions),
    scenario,
    courses,
    followUps: texts(value.followUps),
    ...(provenance ? { provenance } : {}),
  };
}

export function payloadLines(p: SharePayload): { heading: string; items: string[] }[] {
  return [
    { heading: 'Agenda', items: p.agenda },
    { heading: 'Questions', items: p.questions },
    ...(p.scenario ? [{ heading: `Plan scenario: ${p.scenario.name}`, items: p.scenario.lines }] : []),
    ...(p.courses.length ? [{ heading: 'Courses being considered', items: p.courses.map((c) => `${c.code} · ${c.section} — ${c.title}, ${c.credits} credits, ${c.meets}`) }] : []),
    ...(p.followUps.length ? [{ heading: 'Follow-up actions', items: p.followUps }] : []),
    ...(p.provenance
      ? [{
          heading: 'Where this comes from, and what it assumes',
          items: [
            ...p.provenance.sources.map((x) => `${SOURCE_TEXT[x.label]}: ${x.what}.`),
            `Prepared on ${p.provenance.preparedAt}; it may have changed since.`,
            ...p.provenance.assumptions,
          ],
        }]
      : []),
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
