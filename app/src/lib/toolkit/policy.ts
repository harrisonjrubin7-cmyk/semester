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

function blanketOf(stance: unknown): Exclude<UseState, 'unavailable'> | undefined {
  switch (stance) {
    case 'banned':
      return 'prohibited';
    case 'limited':
      return 'limited';
    case 'allowed':
      return 'allowed';
    default:
      return undefined;
  }
}

/**
 * A course policy as the student recorded it. `unstated` says nothing, so it
 * produces no layer at all — which is what lets the fallback show.
 */
export function fromCourse(policy: CoursePolicy | undefined): PolicySource | undefined {
  // Mapped value by value rather than "anything else is allowed": a stance
  // the app does not recognise — a typo in stored data, a value added later —
  // is not a permission, so it produces no layer and the card shows
  // "Policy unavailable". A switch rather than an object lookup, so a stance
  // named after an Object.prototype member ("constructor", "__proto__") is
  // unrecognised too.
  const blanket = blanketOf(policy?.stance);
  if (!policy || !blanket) return undefined;
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

/**
 * A course's rules as its instructor published them in Course Studio
 * (`course_ai_rules`, D-101). Same floor as `fromCourse`: a blanket "allowed"
 * is never read as permitting a final answer to an assessment — only a rule
 * that names `final-answers` does, and Course Studio asks the instructor to
 * confirm that one by name (F3). Rules that say nothing produce no layer.
 */
export interface InstructorRules {
  blanket: Exclude<UseState, 'unavailable'> | null;
  uses: Partial<Record<Use, Exclude<UseState, 'unavailable'>>>;
  words: string;
  link: string;
  /** `YYYY-MM-DD`, or '' when the instructor gave none. */
  effective: string;
  /** `YYYY-MM-DD` the version was published. */
  published: string;
}

export function fromInstructor(rules: InstructorRules | undefined): PolicySource | undefined {
  if (!rules) return undefined;
  const named = Object.keys(rules.uses).length > 0;
  if (!rules.blanket && !named) return undefined;
  const uses = { ...rules.uses };
  if (rules.blanket && rules.blanket !== 'prohibited' && !uses['final-answers']) uses['final-answers'] = 'prohibited';
  return {
    layer: 'course',
    link: rules.link,
    text: rules.words,
    effective: rules.effective,
    lastVerified: rules.published,
    by: 'instructor',
    blanket: rules.blanket ?? undefined,
    uses,
  };
}

/** Who outranks whom within one layer: the instructor's word over the student's own note. */
const AUTHORITY: Record<PolicySource['by'], number> = { instructor: 0, institution: 1, 'student-record': 2 };

export function resolve(use: Use, layers: readonly (PolicySource | undefined)[]): Resolved {
  const present = layers.filter((l): l is PolicySource => !!l);
  for (const layer of PRECEDENCE) {
    // Within a layer, sources are asked in order of authority, and each
    // answers with a rule naming the use or else its blanket. So an
    // instructor's blanket beats a student's named rule, and the student's
    // note decides only what the instructor left unsaid.
    const at = present.filter((p) => p.layer === layer).sort((a, b) => AUTHORITY[a.by] - AUTHORITY[b.by]);
    for (const p of at) {
      const named = p.uses?.[use];
      if (named) return { use, state: named, from: p };
      if (p.blanket) return { use, state: p.blanket, from: p };
    }
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
