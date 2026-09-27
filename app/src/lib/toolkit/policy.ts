import type { CoursePolicy } from '../types';

/**
 * AI-use policy for one piece of work, resolved from every layer that might
 * say something about it.
 *
 * Precedence is the brief's: assignment → course → school/program →
 * university → Semester's conservative fallback. The most specific layer that
 * speaks to a use decides it. A layer can speak in two ways — a rule for one
 * named use ("grammar help is allowed"), or a blanket stance for everything it
 * does not name ("AI is banned in this course"). A named rule beats a blanket
 * at the same layer; any statement beats silence at a less specific one.
 *
 * The fallback is not a default permission. When no layer says anything the
 * state is `unavailable`, which every caller treats as *not allowed* and shows
 * as "Policy unavailable — ask your instructor". The brief is explicit that
 * unknown policy must never be assumed to permit.
 *
 * Nothing here is fetched from an institution. The only layer the app holds
 * today is the course stance the student recorded from the syllabus
 * (`Course.ai`), and `fromCourse` labels it as exactly that — the student's
 * record, not a verified copy — rather than inventing a source link, an
 * effective date or instructor approval it does not have.
 */

export type UseState = 'allowed' | 'limited' | 'prohibited' | 'required' | 'unavailable';

export const USES = [
  ['brainstorming', 'Brainstorming'],
  ['outline-feedback', 'Outline feedback'],
  ['practice', 'Practice questions and flashcards'],
  ['grammar', 'Grammar clarification'],
  ['explanation', 'Explaining course material'],
  ['revision', 'AI-assisted revision of your writing'],
  ['diagrams', 'AI-generated diagrams or figures'],
  ['data-cleaning', 'Data-cleaning suggestions'],
  ['code-help', 'Debugging or code suggestions'],
  ['final-answers', 'Generating final answers for an assessment'],
] as const;

export type Use = (typeof USES)[number][0];

export type Layer = 'assignment' | 'course' | 'school' | 'university';
export const PRECEDENCE: readonly Layer[] = ['assignment', 'course', 'school', 'university'];

export interface PolicySource {
  layer: Layer;
  /** Where the words came from. Empty means nobody recorded one — shown as such. */
  link: string;
  /** In the policy's own words where possible. */
  text: string;
  effective: string;
  lastVerified: string;
  /** Who stated it: an instructor-provided policy, or the student's own record of the syllabus. */
  by: 'instructor' | 'institution' | 'student-record';
  blanket?: Exclude<UseState, 'unavailable'>;
  uses?: Partial<Record<Use, Exclude<UseState, 'unavailable'>>>;
}

export interface Resolved {
  use: Use;
  state: UseState;
  /** The layer that decided it, or undefined when none did. */
  from?: PolicySource;
}

/**
 * A course policy as the student recorded it. `unstated` says nothing, so it
 * produces no layer at all — which is what lets the fallback show.
 */
export function fromCourse(policy: CoursePolicy | undefined): PolicySource | undefined {
  if (!policy || policy.stance === 'unstated') return undefined;
  const blanket = policy.stance === 'banned' ? 'prohibited' : policy.stance === 'limited' ? 'limited' : 'allowed';
  return {
    layer: 'course',
    link: '',
    text: policy.note,
    effective: '',
    lastVerified: '',
    by: 'student-record',
    blanket,
    // Whatever a course allows, a final answer to an assessment is not
    // something a blanket "AI is allowed" can be read as permitting. Only an
    // explicit rule at some layer can.
    uses: blanket === 'prohibited' ? undefined : { 'final-answers': 'prohibited' },
  };
}

export function resolve(use: Use, layers: readonly (PolicySource | undefined)[]): Resolved {
  const present = layers.filter((l): l is PolicySource => !!l);
  for (const layer of PRECEDENCE) {
    const at = present.filter((p) => p.layer === layer);
    const named = at.find((p) => p.uses?.[use]);
    if (named) return { use, state: named.uses![use]!, from: named };
    const blanket = at.find((p) => p.blanket);
    if (blanket) return { use, state: blanket.blanket!, from: blanket };
  }
  return { use, state: 'unavailable' };
}

export function card(layers: readonly (PolicySource | undefined)[]) {
  const all = USES.map(([use]) => resolve(use, layers));
  return {
    allowed: all.filter((r) => r.state === 'allowed'),
    disclose: all.filter((r) => r.state === 'limited' || r.state === 'required'),
    prohibited: all.filter((r) => r.state === 'prohibited'),
    unavailable: all.filter((r) => r.state === 'unavailable'),
    all,
  };
}

/** Only `allowed`, `limited` and `required` permit. `unavailable` never does. */
export const permits = (state: UseState) => state === 'allowed' || state === 'limited' || state === 'required';

export const usageLabel = (use: Use) => USES.find(([u]) => u === use)?.[1] ?? use;

export const STATE_LABEL: Record<UseState, string> = {
  allowed: 'Allowed',
  limited: 'Allowed with disclosure',
  required: 'Required — disclose how you used it',
  prohibited: 'Not allowed',
  unavailable: 'Policy unavailable — ask your instructor',
};

/**
 * What the toolkit offers instead when a use is not permitted.
 *
 * The brief: redirect a prohibited assessment request toward explanation,
 * practice, worked analogous examples, planning and questions for the
 * instructor. Every alternative listed here is itself subject to the policy —
 * the UI filters out any that resolve to not permitted — so a course that
 * bans all AI is left with the non-AI ones (planning, instructor questions).
 */
export const REDIRECTS: readonly { label: string; needsAi: Use | null }[] = [
  { label: 'Plan the steps and deadlines for this work yourself', needsAi: null },
  { label: 'Write down the questions to bring to office hours', needsAi: null },
  { label: 'Explain the underlying concept from your course material', needsAi: 'explanation' },
  { label: 'Practise on a similar problem that is not the assessed one', needsAi: 'practice' },
];

export function redirect(layers: readonly (PolicySource | undefined)[]) {
  return REDIRECTS.filter((r) => r.needsAi === null || permits(resolve(r.needsAi, layers).state));
}
