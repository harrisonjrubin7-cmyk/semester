import { obj, textValue } from './device-library';

export const RHYTHM_KEY = 'semester.daily-rhythm.v1';
export const TIMEBOXES = [2, 5, 10, 25, 45] as const;
export const PROGRESS = ['Planned', 'Started', 'Moving forward', 'Waiting', 'Blocked', 'Re-scoped', 'Completed', 'Archived'] as const;
export const RESPONSES = ['Keep plan', 'Move work block', 'Reduce scope', 'Ask for help', 'Put in Waiting', 'Stop for today'] as const;
export const FIELDS = {
  outcome: 'Today’s meaningful outcome', why: 'Why it matters', done: 'Definition of done',
  commitments: 'Fixed commitments', must: 'Must do', forward: 'Move forward', maintain: 'Maintain',
  first: 'First small action', window: 'First realistic work window', obstacle: 'If this obstacle happens',
  response: 'Then I will', minimum: 'Minimum viable progress', prompt: 'Official prompt or instructions',
  rubric: 'Rubric or course policy', sources: 'Selected sources and notes', question: 'My specific question',
  support: 'Human support route', tried: 'What I have already tried', changed: 'What changed at midday',
  next: 'Next smallest action', moved: 'What moved forward', waiting: 'What is waiting or blocked',
  tomorrow: 'Tomorrow’s first small action', helped: 'What helped today',
} as const;
export type Field = keyof typeof FIELDS;
export type DailyPlan = Record<Field, string> & {
  date: string; minutes: typeof TIMEBOXES[number]; status: typeof PROGRESS[number];
  repair: typeof RESPONSES[number]; paused: boolean;
  audit: Record<string, 'Not yet' | 'Partial' | 'Ready'>;
};
export interface RhythmLibrary { version: 1; days: DailyPlan[] }
export const EMPTY_RHYTHM: RhythmLibrary = { version: 1, days: [] };
export const AUDIT = {
  goal: 'Can I state one meaningful outcome and why it matters?',
  done: 'Is done clear enough to recognize?',
  obstacle: 'Have I named one realistic obstacle?',
  fallback: 'Do I have a specific if–then response?',
  resources: 'Can I find the prompt, sources, notes and support route?',
  start: 'Can I start with only the essential context?',
  progress: 'Can I tell what is done, next, waiting or blocked?',
  adapt: 'Can I revise the plan when something changes?',
  help: 'Do I know who to ask and what question to bring?',
  control: 'Can I edit, pause, export and delete my plan?',
} as const;
export function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function newDay(date: string): DailyPlan {
  if (!validDay(date)) throw new Error('Choose a valid date.');
  return { ...Object.fromEntries(Object.keys(FIELDS).map(k => [k, ''])) as Record<Field, string>,
    date, minutes: 5, status: 'Planned', repair: 'Keep plan', paused: false,
    audit: Object.fromEntries(Object.keys(AUDIT).map(k => [k, 'Not yet'])) };
}
export function readRhythm(value: unknown): RhythmLibrary {
  const invalid = () => { throw new Error('Saved daily plans are not valid.'); };
  if (!obj(value) || value.version !== 1 || !Array.isArray(value.days) || value.days.length > 120) return invalid();
  const days = value.days.map((day): DailyPlan => {
    if (!obj(day) || typeof day.date !== 'string' || !validDay(day.date) || typeof day.paused !== 'boolean') return invalid();
    if (!TIMEBOXES.includes(day.minutes as DailyPlan['minutes']) || !PROGRESS.includes(day.status as DailyPlan['status']) || !RESPONSES.includes(day.repair as DailyPlan['repair']) || !obj(day.audit)) return invalid();
    const result = newDay(day.date);
    for (const key of Object.keys(FIELDS) as Field[]) {
      if (!textValue(day[key], 2000)) return invalid();
      result[key] = day[key] as string;
    }
    for (const key of Object.keys(AUDIT)) {
      const state = day.audit[key];
      if (state !== 'Not yet' && state !== 'Partial' && state !== 'Ready') return invalid();
      result.audit[key] = state;
    }
    return { ...result, paused: day.paused, minutes: day.minutes as DailyPlan['minutes'], status: day.status as DailyPlan['status'], repair: day.repair as DailyPlan['repair'] };
  });
  if (new Set(days.map(d => d.date)).size !== days.length) return invalid();
  return { version: 1, days: days.sort((a, b) => a.date.localeCompare(b.date)) };
}
export function saveDay(library: RhythmLibrary, day: DailyPlan): RhythmLibrary {
  const days = [...library.days.filter(d => d.date !== day.date), day].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length > 120) throw new Error('Export or delete an older plan before adding another.');
  return readRhythm({ version: 1, days });
}
export const HELP_SCRIPTS = {
  clarify: 'Clarify instructions', feedback: 'Ask for feedback', meeting: 'Request a meeting',
  source: 'Ask for source support', timeline: 'Explain a changed plan', policy: 'Ask about AI policy',
  barrier: 'Ask about an access barrier', office: 'Follow up with an office',
} as const;
export function helpDraft(plan: DailyPlan, kind: keyof typeof HELP_SCRIPTS): string {
  const subject = plan.outcome.trim() || '[my action]';
  const question = plan.question.trim() || '[my specific question]';
  const tried = plan.tried.trim() || '[what I have tried]';
  const lines: Record<keyof typeof HELP_SCRIPTS, string> = {
    clarify: `I am working on ${subject}. I have reviewed ${tried}. Could you clarify ${question}?`,
    feedback: `I have tried ${tried} for ${subject}. Before I continue, could you give feedback on ${question}?`,
    meeting: `I would like help deciding my next step on ${subject}. I have reviewed ${tried}. Could we meet to discuss ${question}?`,
    source: `I need help finding or evaluating sources for ${subject}. I have tried ${tried}. My question is ${question}.`,
    timeline: `My timeline changed: ${plan.changed.trim() || '[what changed]'}. My revised next step is ${plan.next.trim() || '[revised plan]'}. Could you advise on ${question}?`,
    policy: `I want to follow the course policy for ${subject}. Is AI support allowed for ${question}? I will wait for clarification before using it.`,
    barrier: `I am encountering an access barrier with ${question}. I have tried ${tried}. What support or alternative route is available?`,
    office: `I am following up on ${subject}. I have tried ${tried}. Could you confirm ${question} and whether you need anything else from me?`,
  };
  return lines[kind];
}
export function exportDay(plan: DailyPlan): string {
  return `# Daily plan: ${plan.date}\n\nPrivate planning copy; share only what you choose.\n\n` +
    Object.entries(FIELDS).map(([key, label]) => `## ${label}\n${plan[key as Field]}\n`).join('\n') +
    `\nTime box: ${plan.minutes} minutes\nStatus: ${plan.status}\nRepair: ${plan.repair}\nPaused: ${plan.paused}\n\n## Support audit\n` +
    Object.entries(AUDIT).map(([key, question]) => `- ${question} ${plan.audit[key]}`).join('\n');
}
