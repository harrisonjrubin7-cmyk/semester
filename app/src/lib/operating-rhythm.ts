import { obj, textValue } from './device-library';
import { dateToIso, isoToDate, shiftIso } from './date';

export const RHYTHM_KEY = 'semester.operating-rhythm.v1';
export const rhythmKey = (account: string | null, term: string) => `${RHYTHM_KEY}:${account || 'device'}:${term}`;
export const TIME_BOXES = [2, 5, 10, 20, 25, 45] as const;
export const PROGRESS = [
  'Planned',
  'Started',
  'Moving forward',
  'Waiting',
  'Blocked',
  'Re-scoped',
  'Completed',
  'Archived',
] as const;
export const READINESS = ['Not yet', 'Partial', 'Ready'] as const;
export const AUDIT = [
  'Can I state one meaningful outcome and why it matters?',
  'Is my definition of done clear?',
  'Did I choose this goal and priority myself?',
  'Have I named one realistic obstacle?',
  'Do I have a specific if–then response?',
  'Can I find instructions, sources, notes, and support?',
  'Can I resume from my last progress and next step?',
  'Can I revise the plan when circumstances change?',
  'Can I tell what is done, next, waiting, or blocked?',
  'Do I know who to ask and what question to bring?',
  'Can I identify a helpful strategy to reuse?',
  'Can I use, pause, edit, export, or delete this plan in my preferred mode?',
] as const;
export const COPING = [
  ['I cannot start', 'I have not started after 10 minutes', 'Open the prompt and write one question'],
  ['The action is too large', 'The full action feels too large', 'Choose one 10-minute milestone'],
  [
    'I need a source',
    'I search for 15 minutes without a useful source',
    'Open an approved library guide and prepare one librarian question',
  ],
  [
    'Instructions are unclear',
    'I cannot explain the instructions',
    'Review the prompt and prepare an instructor question',
  ],
  [
    'I need feedback',
    'I am unsure whether my approach is right',
    'Prepare a two-sentence question for a TA, tutor, or instructor',
  ],
  ['I missed a work block', 'I miss my planned work block', 'Choose the next realistic 10-minute window'],
  ['My time changed', 'A commitment changes', 'Rebuild only the next three days'],
  ['Several items are urgent', 'More than three items feel urgent', 'Choose one primary outcome and reduce the rest'],
  ['I am waiting', 'The follow-up date arrives without a response', 'Prepare a follow-up to the official owner'],
  [
    'AI policy is unclear',
    'I do not know whether AI help is allowed',
    'Review course policy and prepare an instructor question',
  ],
  [
    'A decision is uncertain',
    'An option depends on information that needs confirmation',
    'Mark the assumption for review and prepare an official question',
  ],
  [
    'Returning after time away',
    'I return to interrupted work',
    'Read the last progress note and choose a 5-minute step',
  ],
] as const;
export const HELP_SCRIPTS = {
  Clarify: 'I understand ____. I am unsure about ____. Could you clarify what you expect for ____?',
  Feedback: 'I have tried ____. Could you tell me whether I am interpreting ____ correctly?',
  Meeting: 'I would like help deciding my next step on ____. I reviewed ____. My specific question is ____.',
  Research: 'I need help locating or evaluating sources about ____. I have already tried ____.',
  Timeline:
    'My timeline changed because ____. My revised plan is ____. Is there an important next step I should consider?',
  'AI policy': 'I want to follow the course policy. Is AI support allowed for ____ without completing graded work?',
  Accessibility: 'I am encountering a barrier with ____. What is the appropriate support or alternative route?',
  'Waiting on an office':
    'I submitted ____ on ____. Could you confirm the status and whether you need anything else from me?',
} as const;
export const FIELDS = [
  'outcome',
  'why',
  'done',
  'fixed',
  'changed',
  'uncertain',
  'must',
  'forward',
  'maintain',
  'step',
  'minimum',
  'window',
  'trigger',
  'response',
  'trigger2',
  'response2',
  'instructions',
  'rubric',
  'policy',
  'sources',
  'notes',
  'questions',
  'support',
  'progress',
  'midday',
  'next',
  'waiting',
  'followup',
  'close',
  'tomorrow',
  'helped',
  'carry',
  'reduce',
  'adjustment',
  'helpDraft',
  'milestones',
  'decisions',
  'assumptions',
  'handoff',
] as const;
export type Field = (typeof FIELDS)[number];
export interface RhythmPlan {
  date: string;
  values: Record<Field, string>;
  status: (typeof PROGRESS)[number];
  minutes: (typeof TIME_BOXES)[number];
  audit: (typeof READINESS)[number][];
  completedSteps: string[];
}
export interface RhythmLibrary {
  version: 1;
  plans: RhythmPlan[];
  preferences: {
    enabled: boolean;
    planningDay: string;
    workingTime: string;
    stuck: string;
    reflection: boolean;
  };
}
export const EMPTY_RHYTHM: RhythmLibrary = {
  version: 1,
  plans: [],
  preferences: {
    enabled: true,
    planningDay: 'Monday',
    workingTime: 'Varies',
    stuck: 'Smaller first step',
    reflection: false,
  },
};
export function newPlan(date: string): RhythmPlan {
  return {
    date,
    values: Object.fromEntries(FIELDS.map((k) => [k, ''])) as Record<Field, string>,
    status: 'Planned',
    minutes: 10,
    audit: AUDIT.map(() => 'Not yet'),
    completedSteps: [],
  };
}
function validDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && dateToIso(isoToDate(v)) === v;
}
export function readRhythm(v: unknown): RhythmLibrary {
  const bad = (): never => {
    throw new Error('Saved operating rhythm is not valid.');
  };
  if (!obj(v) || v.version !== 1 || !Array.isArray(v.plans) || v.plans.length > 240 || !obj(v.preferences))
    return bad();
  const p = v.preferences;
  if (
    typeof p.enabled !== 'boolean' ||
    typeof p.reflection !== 'boolean' ||
    ![p.planningDay, p.workingTime, p.stuck].every((s) => textValue(s, 100))
  )
    return bad();
  const plans = v.plans.map((r): RhythmPlan => {
    if (
      !obj(r) ||
      !validDate(r.date) ||
      !obj(r.values) ||
      !FIELDS.every((k) => textValue((r.values as Record<string, unknown>)[k], 4000))
    )
      return bad();
    if (
      !PROGRESS.includes(r.status as RhythmPlan['status']) ||
      !TIME_BOXES.includes(r.minutes as RhythmPlan['minutes']) ||
      !Array.isArray(r.audit) ||
      r.audit.length !== AUDIT.length ||
      !r.audit.every((a) => READINESS.includes(a))
    )
      return bad();
    if (
      r.completedSteps !== undefined &&
      (!Array.isArray(r.completedSteps) ||
        r.completedSteps.length > 100 ||
        !r.completedSteps.every((s) => textValue(s, 4000)))
    )
      return bad();
    return {
      date: r.date,
      completedSteps: (r.completedSteps || []) as string[],
      values: Object.fromEntries(FIELDS.map((k) => [k, (r.values as Record<string, string>)[k]])) as Record<
        Field,
        string
      >,
      status: r.status as RhythmPlan['status'],
      minutes: r.minutes as RhythmPlan['minutes'],
      audit: [...r.audit],
    };
  });
  if (new Set(plans.map((r) => r.date)).size !== plans.length) return bad();
  return {
    version: 1,
    plans,
    preferences: {
      enabled: p.enabled,
      reflection: p.reflection,
      planningDay: p.planningDay as string,
      workingTime: p.workingTime as string,
      stuck: p.stuck as string,
    },
  };
}
export function savePlan(l: RhythmLibrary, p: RhythmPlan): RhythmLibrary {
  return {
    ...l,
    plans: [...l.plans.filter((r) => r.date !== p.date), p].sort((a, b) => a.date.localeCompare(b.date)).slice(-240),
  };
}
export function monday(date: string): string {
  return shiftIso(date, -((isoToDate(date).getDay() + 6) % 7));
}
export function carryForward(p: RhythmPlan): RhythmPlan {
  const n = newPlan(shiftIso(p.date, 7));
  n.values.outcome = p.values.carry;
  n.values.step = p.values.next || p.values.tomorrow;
  n.values.support = p.values.support;
  return n;
}
export function starter(p: RhythmPlan): string {
  if (p.status === 'Waiting') return 'Check the follow-up date and prepare one question for the owner.';
  if (p.status === 'Blocked')
    return p.values.response || 'Open the instructions and write the question blocking your next step.';
  return (
    p.values.step ||
    (p.minutes <= 2
      ? 'Open the instructions and write one question.'
      : p.minutes <= 5
        ? 'Read the instructions and identify one assignment.'
        : p.minutes <= 10
          ? 'Create three headings or solve one known step.'
          : 'Choose one bounded milestone and a stopping point.')
  );
}
export function simulate(
  tasks: { title: string; context: string; minutes: number }[],
  buffer: number,
  available: number,
) {
  if (![buffer, available, ...tasks.map((t) => t.minutes)].every((n) => Number.isFinite(n) && n >= 0))
    throw new Error('Use non-negative planning estimates.');
  const describe = (items: typeof tasks) => {
    const switches = items.slice(1).filter((t, i) => t.context !== items[i].context).length;
    const work = items.reduce((n, t) => n + t.minutes, 0);
    return {
      items,
      switches,
      work,
      total: work + switches * buffer,
      remaining: available - work - switches * buffer,
    };
  };
  return {
    original: describe(tasks),
    batched: describe([...tasks].sort((a, b) => a.context.localeCompare(b.context))),
  };
}
export function markdown(p: RhythmPlan): string {
  return (
    `# Semester operating rhythm: ${p.date}\n\nPrivate student-owned planning aid.\n\nStatus: ${p.status}\nCompleted milestones: ${p.completedSteps.join('; ')}\nTime box: ${p.minutes} minutes\n\n` +
    FIELDS.filter((k) => p.values[k])
      .map((k) => `## ${k}\n\n${p.values[k]}\n`)
      .join('\n') +
    '\n## UDL support audit\n\n' +
    AUDIT.map((q, i) => `- ${q} ${p.audit[i]}`).join('\n')
  );
}
/** Downloaded proposal in local time; never an external calendar write. */
export function calendarProposal(p: RhythmPlan): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.values.window)) throw new Error('Choose a valid work window first.');
  const start = new Date(p.values.window);
  if (!Number.isFinite(start.getTime()) || dateToIso(start) !== p.values.window.slice(0, 10))
    throw new Error('Choose a valid work window first.');
  const end = new Date(start.getTime() + p.minutes * 60000);
  const local = (d: Date) =>
    `${dateToIso(d).replaceAll('-', '')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
  const escape = (s: string) =>
    s
      .replaceAll('\\', '\\\\')
      .replaceAll('\r', '')
      .replaceAll('\n', '\\n')
      .replaceAll(',', '\\,')
      .replaceAll(';', '\\;');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Semester//Operating Rhythm//EN',
    'BEGIN:VEVENT',
    `UID:rhythm-${p.date}-${local(start)}@semester`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `SUMMARY:${escape(p.values.outcome || 'Study block')}`,
    `DESCRIPTION:${escape(starter(p))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return (
    lines
      .map((line) => {
        let out = '',
          part = '',
          bytes = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (bytes + size > 75) {
            out += part + '\r\n';
            part = ' ';
            bytes = 1;
          }
          part += char;
          bytes += size;
        }
        return out + part;
      })
      .join('\r\n') + '\r\n'
  );
}

export function printable(p: RhythmPlan): string {
  const escape = (s: string) =>
    s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Semester plan ${escape(p.date)}</title><style>body{font:16px system-ui;max-width:800px;margin:24px auto;padding:16px;color:#111;background:white}section{break-inside:avoid}p{white-space:pre-wrap}td,th{text-align:left;border-bottom:1px solid #888;padding:8px}table{width:100%;border-collapse:collapse}@media print{body{margin:0}}</style><body><h1>Semester operating rhythm: ${escape(p.date)}</h1><p>Private student-owned planning aid. Status: ${escape(p.status)}. Time box: ${p.minutes} minutes.</p>${FIELDS.filter(
    (k) => p.values[k],
  )
    .map((k) => `<section><h2>${escape(k)}</h2><p>${escape(p.values[k])}</p></section>`)
    .join(
      '',
    )}<h2>UDL support audit</h2><table><thead><tr><th>Support question</th><th>Readiness</th></tr></thead><tbody>${AUDIT.map((q, i) => `<tr><th scope="row">${escape(q)}</th><td>${escape(p.audit[i])}</td></tr>`).join('')}</tbody></table><p>Open this file in a browser, then Print or Save as PDF.</p></body></html>`;
}
