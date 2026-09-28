import type { Kind } from '../lib/feedback';
import type { Read } from '../lib/mode';
import type { HelpState } from './converse';

/**
 * How to read an answer: source strength, policy state, and what it can and
 * cannot claim — inspectable on every reply, in the same three lines.
 *
 * The assistant already shows what it read (`Using`, from `readMode`) and
 * whether the school's policy lets it answer (`HelpState`). What it did not do
 * is say, in words a student can act on, how much to trust the reply: an
 * answer grounded in three ticked sources and an answer from general
 * knowledge looked the same under the text. These are the brief's three
 * signals, each derived from state the conversation already holds, so the
 * line cannot say "strong source" about an answer that read nothing.
 *
 *   Source strength   strong / limited / none
 *   Policy state      allowed / limited / unavailable
 *   Confidence        what it can support, what it cannot determine, what
 *                     needs a person or an official record
 *
 * And the six reasons a reply can be marked: helpful, not helpful, incorrect,
 * a source problem, a policy problem, an accessibility problem. The first two
 * stay on the device, as before. The other four open the report the app
 * already sends, on the kind and with the first words the reason names, so a
 * student who says "the source is wrong" is not asked to classify it again.
 */

export type SourceStrength = 'strong' | 'limited' | 'none';
export type PolicyState = 'allowed' | 'limited' | 'unavailable';

export interface Quality {
  source: { level: SourceStrength; says: string };
  policy: { level: PolicyState; says: string };
  /** What Semester can support, what it cannot determine, what needs confirming. */
  can: string;
  cannot: string;
  confirm: string;
}

export interface QualityInput {
  read: Read | null;
  help: HelpState;
  /** How many of the student's sources were available to the answer. */
  sources: number;
}

/**
 * How many pieces of the student's own material an answer had: the saved
 * sources attached as evidence, plus each course whose study material the
 * context builder read. The generic lines it always adds — today's date, the
 * active term, which screen — are not material and are not counted, so a
 * grounded answer that read nothing of the student's is “limited”, not
 * “strong”.
 */
export function sourcesRead(used: readonly string[], evidence: number): number {
  return evidence + used.filter((u) => /study material$/.test(u)).length;
}

export function sourceStrength(read: Read | null, sources: number): SourceStrength {
  if (!read) return 'none';
  if (read.mode === 'grounded') return sources > 0 ? 'strong' : 'limited';
  if (read.mode === 'app') return 'limited';
  return 'none';
}

export function policyState(help: HelpState): PolicyState {
  switch (help.kind) {
    case 'ready':
      return 'allowed';
    case 'course-off':
      return 'limited';
    default:
      return 'unavailable';
  }
}

const SOURCE_SAYS: Record<SourceStrength, string> = {
  strong: 'Strong source: read from your own material, and each point can be checked against it.',
  limited: 'Limited source: read from the app’s own record of your term, not from course material.',
  none: 'No source: general knowledge. Nothing of yours was read, so check anything that matters.',
};

const POLICY_SAYS: Record<PolicyState, string> = {
  allowed: 'Allowed for this request under the AI policy in force.',
  limited: 'Limited: the course’s AI policy bans help with its work, so this is planning help only.',
  unavailable: 'Unavailable: the school’s policy could not be read, or allows no mode, so nothing was sent.',
};

/** The three lines for one reply. Pure: reads nothing but its input. */
export function quality(input: QualityInput): Quality {
  const source = sourceStrength(input.read, input.sources);
  const policy = policyState(input.help);
  const can =
    source === 'strong'
      ? 'What your material says, quoted from it.'
      : source === 'limited'
        ? 'What your courses, deadlines and calendar say, as you entered them.'
        : 'General explanation only.';
  const cannot =
    'Your grades of record, your registration, another person’s work, or anything your school did not publish to the app.';
  const confirm =
    policy === 'allowed'
      ? 'Anything about requirements, registration, aid or a deadline that matters: confirm with the official record or the office that owns it.'
      : 'Whether the course allows AI help with this: ask the instructor, and use the source itself meanwhile.';
  return { source: { level: source, says: SOURCE_SAYS[source] }, policy: { level: policy, says: POLICY_SAYS[policy] }, can, cannot, confirm };
}

/** The six reasons, in the order they are offered. */
export interface Reason {
  id: 'helpful' | 'not-helpful' | 'incorrect' | 'source' | 'policy' | 'accessibility';
  label: string;
  /** A report of this kind with these first words; absent for the two local marks. */
  report?: { kind: Kind; note: string };
}

export const REASONS: readonly Reason[] = [
  { id: 'helpful', label: 'Helpful' },
  { id: 'not-helpful', label: 'Not helpful' },
  { id: 'incorrect', label: 'Incorrect', report: { kind: 'wrong', note: 'An answer from Ask Semester is incorrect: ' } },
  { id: 'source', label: 'Source issue', report: { kind: 'wrong', note: 'An answer cited a source wrongly or missed one: ' } },
  { id: 'policy', label: 'Policy issue', report: { kind: 'bug', note: 'An answer should not have been allowed, or was refused wrongly, under the AI policy: ' } },
  { id: 'accessibility', label: 'Accessibility issue', report: { kind: 'bug', note: 'Accessibility barrier in an answer: ' } },
];
