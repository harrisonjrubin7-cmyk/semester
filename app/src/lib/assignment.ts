/**
 * Assignment instructions in; a plan you can act on out.
 *
 * What this deliberately does not do is write the assignment. The app carries
 * a student's real coursework under their own name, and an app that hands back
 * a finished essay is not a study tool, it is a way of getting somebody
 * expelled. Vanderbilt's Honor Code is student-run and the work you submit is
 * supposed to be yours.
 *
 * What it does instead is the part students actually lose marks on, which is
 * not the writing:
 *
 *  - **What is really being asked.** Instructions bury three deliverables in a
 *    paragraph about formatting. They get pulled out and listed.
 *  - **How it is marked.** The rubric, with weights, so effort goes where the
 *    marks are rather than where the writing is easiest.
 *  - **A plan with dates.** Steps between now and the deadline, each one small
 *    enough to actually start, and savable as tasks.
 *  - **Which of your own units it touches**, so revision and the assignment
 *    stop being two separate jobs.
 *  - **What the instructions do not say.** The questions worth asking in
 *    office hours, which is the highest-value output here and the one nobody
 *    thinks to ask for.
 *
 * And separately, `critique` reads a draft you wrote and says where it misses
 * the rubric — without rewriting it, because feedback you act on teaches you
 * something and a rewrite does not.
 */

import { ask } from './claude';

export interface Deliverable {
  what: string;
  detail: string;
}

export interface Criterion {
  criterion: string;
  weight: string;
  means: string;
}

export interface Step {
  do: string;
  why: string;
  /** ISO date, or empty when the instructions give nothing to anchor to. */
  by: string;
  minutes: number;
}

export interface Breakdown {
  title: string;
  due: string;
  deliverables: Deliverable[];
  rubric: Criterion[];
  steps: Step[];
  units: string[];
  checklist: string[];
  unclear: string[];
}

const EMPTY: Breakdown = {
  title: '',
  due: '',
  deliverables: [],
  rubric: [],
  steps: [],
  units: [],
  checklist: [],
  unclear: [],
};

const SYSTEM =
  'You help a university student understand an assignment they have been set. ' +
  'You do NOT write the assignment, draft it, or produce any text they could submit — ' +
  'if asked to, you decline in the "unclear" field and still return the breakdown.\n\n' +
  'Reply with JSON only, this shape:\n' +
  '{"title":"","due":"YYYY-MM-DD or empty","deliverables":[{"what":"","detail":""}],' +
  '"rubric":[{"criterion":"","weight":"","means":""}],' +
  '"steps":[{"do":"","why":"","by":"YYYY-MM-DD or empty","minutes":0}],' +
  '"units":[""],"checklist":[""],"unclear":[""]}\n\n' +
  'Rules:\n' +
  '- deliverables: every separate thing that must be handed in, including ones buried in prose.\n' +
  '- rubric: only criteria the instructions actually state. Empty array if they state none. ' +
  'Never invent weights.\n' +
  '- steps: 4 to 8, ordered, each one sitting down and doing a specific thing. ' +
  'Spread the dates between today and the deadline, finishing at least a day early. ' +
  '"why" says what that step gets you.\n' +
  '- units: names from the course guide below that this assignment draws on. ' +
  'Copy the names exactly. Empty if none apply.\n' +
  '- checklist: what to verify before submitting — format, length, citation style, file type.\n' +
  '- unclear: what the instructions do not settle, phrased as questions to ask the ' +
  'instructor. This is the most useful field; be concrete.\n' +
  '- Use only what the instructions say. Do not invent a deadline, a word count or a weight.';

/** Pull the first JSON object out of a reply and parse it, or return null. */
function parseJson<T>(reply: string): T | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(reply.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Keep only what survives checking.
 *
 * A date that is not a date, a unit that is not in this course's guide, a step
 * with nothing to do — all dropped. The same rule the syllabus importer works
 * by: a fabricated detail is worse than a missing one, because the student
 * acts on it.
 */
function clean(raw: Partial<Breakdown>, unitNames: string[]): Breakdown {
  const date = (v: unknown): string => {
    const s = str(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '' : s;
  };

  return {
    title: str(raw.title) || 'Assignment',
    due: date(raw.due),
    deliverables: list(raw.deliverables)
      .map((d) => d as Deliverable)
      .filter((d) => str(d?.what))
      .map((d) => ({ what: str(d.what), detail: str(d.detail) })),
    rubric: list(raw.rubric)
      .map((r) => r as Criterion)
      .filter((r) => str(r?.criterion))
      .map((r) => ({ criterion: str(r.criterion), weight: str(r.weight), means: str(r.means) })),
    steps: list(raw.steps)
      .map((s) => s as Step)
      .filter((s) => str(s?.do))
      .map((s) => ({
        do: str(s.do),
        why: str(s.why),
        by: date(s.by),
        minutes: Number.isFinite(s?.minutes) ? Math.max(0, Math.round(Number(s.minutes))) : 0,
      })),
    // A unit it claims to touch has to be a unit this course actually has.
    units: list(raw.units)
      .map(str)
      .filter((u) => u && unitNames.includes(u)),
    checklist: list(raw.checklist).map(str).filter(Boolean),
    unclear: list(raw.unclear).map(str).filter(Boolean),
  };
}

export async function breakDown(
  instructions: string,
  context: string,
  unitNames: string[],
  signal?: AbortSignal,
): Promise<Breakdown> {
  const today = new Date().toISOString().slice(0, 10);
  const reply = await ask({
    signal,
    maxTokens: 2600,
    system: `${SYSTEM}\n\nToday is ${today}.\n\nThe course:\n${context}`,
    messages: [{ role: 'user', content: `Assignment instructions:\n\n${instructions}` }],
  });
  const raw = parseJson<Partial<Breakdown>>(reply);
  return raw ? clean(raw, unitNames) : EMPTY;
}

/**
 * Feedback on a draft the student wrote, against the assignment's own rubric.
 *
 * The prompt forbids rewriting for a reason that is practical as much as
 * ethical: a paragraph handed back rewritten teaches nothing and reads, to
 * anyone who knows the student's writing, like somebody else's. Naming the
 * problem and leaving the fix to them is what a good TA does.
 */
export function critique(
  draft: string,
  instructions: string,
  context: string,
  onText: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  return ask({
    signal,
    onText,
    maxTokens: 2000,
    system:
      'You are giving a university student feedback on their own draft, like a good TA in ' +
      'office hours. Rules you do not break:\n' +
      '- Never rewrite their sentences or supply replacement text. Name the problem and ' +
      'where it is; leave the fixing to them.\n' +
      '- Work against the assignment instructions and the course material below.\n' +
      '- Lead with the two or three things that would move the grade most, not a list of ' +
      'everything.\n' +
      '- Say what is already working, briefly and specifically, so they keep it.\n' +
      '- Flag any claim the course material does not support.\n' +
      'Plain prose, short paragraphs, no preamble.\n\n' +
      `The course:\n${context}`,
    messages: [
      {
        role: 'user',
        content: `Assignment instructions:\n${instructions || '(not given)'}\n\nMy draft:\n${draft}`,
      },
    ],
  });
}
