/**
 * The data-classification gate, asked before anything leaves the student's
 * hands: an upload, a paste into an AI request, a share, an export.
 *
 * Seven tiers, from the brief. The gate is deliberately a lookup and not a
 * judgement: it does not read the data and guess what it is. The student (or
 * the course configuration) says what tier the material is, and the gate says
 * what may happen to material of that tier. A classifier that inferred
 * "this looks like a health record" would be wrong in both directions and
 * would need to read the very data it is supposed to be protecting.
 *
 * What the gate adds is the default. Material nobody has classified is treated
 * as T3 — an education record — which blocks it from every AI path. An
 * unanswered question is not a permissive answer, the same rule
 * `CoursePolicy` follows for an unrecorded AI policy.
 */

export type Tier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export const TIERS: readonly { tier: Tier; name: string; examples: string }[] = [
  { tier: 'T0', name: 'Public', examples: 'Published articles, open datasets, public web pages' },
  { tier: 'T1', name: 'Course-authorized, non-sensitive', examples: 'Readings and datasets the instructor provided for this use' },
  { tier: 'T2', name: 'Your own academic work', examples: 'Your notes, drafts, code and survey instruments' },
  { tier: 'T3', name: 'Education records', examples: 'Grades, rosters, identifiable submissions, advising notes' },
  {
    tier: 'T4',
    name: 'Regulated or sensitive',
    examples: 'Health, disability, counseling, conduct, financial aid, immigration, human-subject data',
  },
  {
    tier: 'T5',
    name: 'Restricted research or IP',
    examples: 'Unpublished research, proprietary protocols, client data, grant content, export-controlled material',
  },
  { tier: 'T6', name: 'Highly restricted', examples: 'Controlled or classified material' },
];

export type Action = 'store' | 'ai' | 'share' | 'export' | 'external';

export type Verdict =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string; route: string };

const INSTITUTIONAL =
  'Use an institution-approved workflow with authorization, the minimum data needed and an access log. Ask your instructor or the data steward.';
const RESEARCH =
  'Route this through your institution’s research, compliance or security office. Semester will not process it.';

/**
 * What may happen to material of `tier`.
 *
 * `courseAllowsAi` is the course or assignment policy's answer, already
 * resolved — see `policy.ts`. The gate never widens it: a course that allows
 * AI does not make a T3 record sendable, and a course that forbids it makes
 * even T0 material unsendable *through the toolkit*.
 */
export function gate(tier: Tier | undefined, action: Action, courseAllowsAi: boolean): Verdict {
  const t = tier ?? 'T3';
  const unset = tier === undefined ? ' It has not been classified, so it is treated as an education record.' : '';

  if (t === 'T4' || t === 'T5' || t === 'T6') {
    if (action === 'store')
      return { allowed: false, reason: `Regulated or restricted material is not kept in Semester.${unset}`, route: RESEARCH };
    return { allowed: false, reason: `Regulated or restricted material is blocked from every Semester workflow.${unset}`, route: RESEARCH };
  }
  if (t === 'T3') {
    if (action === 'store') return { allowed: true, reason: `Kept on this device only.${unset}` };
    return { allowed: false, reason: `Education records are blocked from AI services, sharing and external tools.${unset}`, route: INSTITUTIONAL };
  }
  if (action === 'external')
    return {
      allowed: false,
      reason: 'No external tool is connected. Semester does not claim an integration until an approved connector exists.',
      route: 'Use the external tool directly under its own terms.',
    };
  if (action === 'ai' && !courseAllowsAi)
    return {
      allowed: false,
      reason: 'This course or assignment does not permit AI for this use, or its policy is not recorded.',
      route: 'Check the policy card, or ask your instructor.',
    };
  if (action === 'share' && t === 'T1')
    return { allowed: true, reason: 'Share only with people in the same course; the instructor’s terms still apply.' };
  return { allowed: true, reason: 'Permitted for this tier under the course policy.' };
}

export const tierName = (t: Tier) => TIERS.find((x) => x.tier === t)?.name ?? t;
