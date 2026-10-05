/**
 * The Semester operating model: the ten product areas the reinforcement brief
 * of 29 September 2026 names, and for each the fourteen things it asks every
 * area to define — primary user, core problem, five owners, success metric,
 * integration dependencies, failure fallback and maturity stage, plus the
 * evidence the maturity rests on.
 *
 * ## What an owner is
 *
 * Every owner is a council seat (`launchreadiness.ts`), never a person and
 * never a team name nobody accepted. A seat that is vacant stays vacant here:
 * the rendered register prints the holder beside every owner, so an area whose
 * data owner is the vacant `data` seat says so rather than naming somebody. The
 * finding is the count, not the table — most of the fifty ownerships rest on
 * seats nobody holds yet.
 *
 * ## What a maturity may claim
 *
 * The register statuses (`communitiesregister.ts`): `designed` cites a
 * document, `building` cites code, `tested` cites a test. Nothing is above
 * `tested`, because no area has run at an institution; the stage the brief
 * calls "planned maturity" is `next`, one sentence on what would move it.
 *
 * `per-feature charters` (`governance/charters.ts`) sit one level below this:
 * a charter is one flag's page, this is the area the flag belongs to.
 *
 * Rendered into `docs/REINFORCEMENT-REGISTER.md` by
 * `reinforceregister.test.ts`, and held by `operatingmodel.test.ts`.
 */

import type { Seat } from '../launchreadiness';
import type { Status } from '../communitiesregister';

export interface ProductArea {
  id: string;
  area: string;
  primaryUser: string;
  problem: string;
  owners: {
    product: Seat;
    data: Seat;
    securityPrivacy: Seat;
    support: Seat;
    accessibility: Seat;
  };
  successMetric: string;
  /** Other areas this one cannot work without, by id. */
  dependsOn: readonly string[];
  /** Outside systems it reads, in words. Empty when it runs on the student's own data. */
  integrations: readonly string[];
  fallback: string;
  maturity: Status;
  evidence: readonly { path: string; shows: string }[];
  /** What would move it to the next stage. */
  next: string;
}

export const OWNER_ROLES = ['product', 'data', 'securityPrivacy', 'support', 'accessibility'] as const;

export const OWNER_LABEL: Record<(typeof OWNER_ROLES)[number], string> = {
  product: 'Product',
  data: 'Data',
  securityPrivacy: 'Security and privacy',
  support: 'Support',
  accessibility: 'Accessibility',
};

export const PRODUCT_AREAS: readonly ProductArea[] = [
  {
    id: 'student',
    area: 'Student Experience',
    primaryUser: 'A student, on any device, with or without a connected school',
    problem: 'The university is spread across systems, and nothing says what matters next or why.',
    owners: { product: 'product', data: 'data', securityPrivacy: 'privacy', support: 'success', accessibility: 'accessibility' },
    successMetric: 'Students completing at least one meaningful action in a week: a plan saved, a conflict resolved, an agenda made.',
    dependsOn: ['trust'],
    integrations: [],
    fallback: 'Local-first: everything a student added works on the device with no account and no network.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/lib/actions.ts', shows: 'one ranked list of what to do next, each with its reason' },
      { path: 'app/src/lib/actions.test.ts', shows: 'held' },
      { path: 'app/src/lib/find.ts', shows: 'one search, one ranker' },
      { path: 'app/src/lib/find.test.ts', shows: 'held' },
      { path: 'docs/architecture/0001-local-first-with-supabase.md', shows: 'the fallback is the architecture' },
    ],
    next: 'A weekly meaningful-action count that the app can report without reading content, measured in a pilot.',
  },
  {
    id: 'learning',
    area: 'Academic & Learning Experience',
    primaryUser: 'A student in a course, and the instructor who sets its policy',
    problem: 'Material, course policy and study work sit in separate tools, and nothing keeps study tied to its source.',
    owners: { product: 'product', data: 'data', securityPrivacy: 'privacy', support: 'success', accessibility: 'accessibility' },
    successMetric: 'Source-linked practice or a study plan completed for a course the student is taking.',
    dependsOn: ['ai', 'integrations'],
    integrations: ['An LMS through LTI 1.3, where a school connects one'],
    fallback: 'The student adds the syllabus and material themselves; nothing needs the LMS.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/lib/learning-loop.ts', shows: 'material to practice to review' },
      { path: 'app/src/lib/learning-loop.test.ts', shows: 'held' },
      { path: 'app/src/lib/coursestudio.ts', shows: 'the instructor’s course policy' },
      { path: 'app/src/lib/coursestudio.test.ts', shows: 'held' },
    ],
    next: 'One course run with its instructor’s policy in force, and the study outcome counted.',
  },
  {
    id: 'campus',
    area: 'Campus & Community Experience',
    primaryUser: 'A student looking for a resource, an office, a group or an event',
    problem: 'Campus resources and groups are hard to find and harder to trust as current.',
    owners: { product: 'product', data: 'data', securityPrivacy: 'trust', support: 'success', accessibility: 'accessibility' },
    successMetric: 'A verified resource found, or a safe handoff to the office that owns the problem.',
    dependsOn: ['integrations', 'trust'],
    integrations: ['The institution’s resource directory and events, where published'],
    fallback: 'The official office’s own page, linked, with the freshness label saying the copy may be old.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/lib/campusdirectory.ts', shows: 'the directory' },
      { path: 'app/src/lib/campusdirectory.test.ts', shows: 'held' },
      { path: 'app/src/lib/nowrongdoor.ts', shows: 'describe the problem, be sent to the office' },
      { path: 'app/src/lib/nowrongdoor.test.ts', shows: 'held' },
      { path: 'app/src/community/connect.test.ts', shows: 'the community rules' },
    ],
    next: 'A campus’s own offices publishing and owning their entries, with a review date each.',
  },
  {
    id: 'career',
    area: 'Career & Opportunity Experience',
    primaryUser: 'A student turning coursework into evidence, and later an employer the student opts in to',
    problem: 'What a student learned never reaches what they apply for.',
    owners: { product: 'product', data: 'data', securityPrivacy: 'privacy', support: 'success', accessibility: 'accessibility' },
    successMetric: 'Evidence saved, a portfolio item updated, or an application step completed.',
    dependsOn: ['learning', 'trust'],
    integrations: [],
    fallback: 'Export: the student’s evidence leaves as files, with or without Semester.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/lib/career-evidence.ts', shows: 'course and project work as evidence' },
      { path: 'app/src/lib/career-evidence.test.ts', shows: 'held' },
      { path: 'app/src/lib/skills-graph.ts', shows: 'course to skill to opportunity' },
    ],
    next: 'An employer-visibility opt-in used by a real student, expiring on its date.',
  },
  {
    id: 'institution',
    area: 'Institution Operations',
    primaryUser: 'An institution’s administrators, offices and implementation team',
    problem: 'An institution cannot govern a student product it cannot configure, audit or roll back.',
    owners: { product: 'product', data: 'data', securityPrivacy: 'security', support: 'success', accessibility: 'accessibility' },
    successMetric: 'A tenant moved through its rollout states with every exit gate met and none waived.',
    dependsOn: ['integrations', 'trust'],
    integrations: ['Institutional SSO', 'SCIM, for an institution that provisions'],
    fallback: 'The pilot_read_only rollout state: nothing is written back while anything is in doubt.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/screens/Console.tsx', shows: 'the operations console' },
      { path: 'app/src/screens/console.test.tsx', shows: 'held' },
      { path: 'app/src/lib/governance/rollout.ts', shows: 'the rollout chain and its exit gates' },
      { path: 'app/src/lib/governance/rollout.test.ts', shows: 'held' },
    ],
    next: 'One tenant configured by the institution itself rather than by the founder.',
  },
  {
    id: 'trust',
    area: 'Trust, Privacy & Security',
    primaryUser: 'Every student, and every reviewer who decides whether an institution may buy',
    problem: 'Nobody can trust a product with education records unless its controls can be shown, not asserted.',
    owners: { product: 'privacy', data: 'data', securityPrivacy: 'security', support: 'success', accessibility: 'accessibility' },
    successMetric: 'Every public claim and every high-risk action resting on a test or an audit record.',
    dependsOn: [],
    integrations: [],
    fallback: 'Deny by default: row-level security refuses what no policy allows.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/lib/sharing.ts', shows: 'every share has an end and a way back' },
      { path: 'app/src/lib/sharing.test.ts', shows: 'held' },
      { path: 'supabase/deletion.check.sql', shows: 'deletion' },
      { path: 'supabase/support-access.check.sql', shows: 'support reads need a live grant' },
      { path: 'docs/architecture/0002-rls-is-the-authorization-boundary.md', shows: 'the boundary' },
    ],
    next: 'The security and privacy seats accepted by people qualified to hold them, and an external assessment.',
  },
  {
    id: 'integrations',
    area: 'Integrations & Data',
    primaryUser: 'An institution’s integration owner',
    problem: 'Institutional data arrives late, partial or wrong, and nobody can see which.',
    owners: { product: 'data', data: 'data', securityPrivacy: 'security', support: 'operations', accessibility: 'accessibility' },
    successMetric: 'Every imported fact carrying its source and freshness, and every failing connection visible before a student sees stale data.',
    dependsOn: ['trust'],
    integrations: ['SIS', 'LMS', 'Calendars and files, with incremental consent'],
    fallback: 'Student-entered data, labelled as such, until the connection is healthy again.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/lib/integration/catalog.ts', shows: 'each source with its steward' },
      { path: 'app/src/lib/integration/quality.test.ts', shows: 'propose, simulate, approve, roll back' },
    ],
    next: 'One live institutional connection reconciled over a term.',
  },
  {
    id: 'ai',
    area: 'AI & Automation',
    primaryUser: 'A student asking for help with material they are allowed to use',
    problem: 'A general chatbot does not know the course, the policy or the source, and cannot say which it used.',
    owners: { product: 'product', data: 'data', securityPrivacy: 'privacy', support: 'success', accessibility: 'accessibility' },
    successMetric: 'Answers that cite the source they rest on, and consequential actions confirmed by the student before they happen.',
    dependsOn: ['learning', 'trust'],
    integrations: ['A model provider, through the metered gateway'],
    fallback: 'Every workflow runs without AI; the assistant is an addition, never the only way.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/ai/quality.ts', shows: 'per-answer source strength' },
      { path: 'app/src/ai/quality.test.ts', shows: 'held' },
      { path: 'app/src/lib/trust/ai-training-policy.test.ts', shows: 'no training on student data' },
      { path: 'docs/architecture/0004-ai-through-a-metered-gateway.md', shows: 'the gateway' },
    ],
    next: 'An evaluation set scored on every release (docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md).',
  },
  {
    id: 'success',
    area: 'Customer Success',
    primaryUser: 'An institution’s sponsor and implementation lead',
    problem: 'An institution that buys software and is left alone does not renew.',
    owners: { product: 'success', data: 'data', securityPrivacy: 'privacy', support: 'success', accessibility: 'accessibility' },
    successMetric: 'A success plan with goals, risks and a next review for every institution, and renewal decided 120 days before the end.',
    dependsOn: ['institution'],
    integrations: [],
    fallback: 'The founder, acting in the success seat, by hand.',
    maturity: 'tested',
    evidence: [
      { path: 'supabase/commercial.check.sql', shows: 'success plans, reviews, renewals and account health' },
      { path: 'docs/PILOT-TO-ANNUAL-CONVERSION.md', shows: 'the conversion process' },
    ],
    next: 'A screen that reads the success tables; today only the database holds them.',
  },
  {
    id: 'growth',
    area: 'Growth & Community',
    primaryUser: 'A student who has not signed up yet, and the ambassador who told them',
    problem: 'Paid acquisition asks for trust before showing value.',
    owners: { product: 'founder', data: 'data', securityPrivacy: 'privacy', support: 'success', accessibility: 'accessibility' },
    successMetric: 'Referred students who reach a first meaningful action, never raw sign-ups.',
    dependsOn: ['student', 'trust'],
    integrations: [],
    fallback: 'The public tools work with no account and send nothing.',
    maturity: 'tested',
    evidence: [
      { path: 'app/src/lib/referral.ts', shows: 'an ambassador sees two counts, never a person' },
      { path: 'app/src/lib/referral.test.ts', shows: 'held' },
      { path: 'app/src/site/tools/Tools.test.tsx', shows: 'five public tools, nothing sent' },
    ],
    next: 'A public tool’s result carried into an account the student makes; nothing does that yet.',
  },
];

/** Every ownership in the model, as area and role. */
export function ownerships(areas: readonly ProductArea[] = PRODUCT_AREAS): { area: string; role: (typeof OWNER_ROLES)[number]; seat: Seat }[] {
  return areas.flatMap((a) => OWNER_ROLES.map((role) => ({ area: a.id, role, seat: a.owners[role] })));
}

/** The ownerships that rest on a seat nobody holds. */
export function vacantOwnerships(held: (seat: Seat) => boolean, areas: readonly ProductArea[] = PRODUCT_AREAS) {
  return ownerships(areas).filter((o) => !held(o.seat));
}
