import { CONTROLS as ME_CONTROLS, type MeControl } from './mecontrols';
import { POLICIES, type Policy, type PolicyStatus } from './ops/claims';
import { SYNC_GROUPS } from './privacy';

/**
 * The Data & AI Transparency page, as data.
 *
 * The brief's rule for the page: public, plain-language, specific and
 * evidence-linked, and never the sentence "we take privacy seriously". And
 * its warning, kept: *do not publish the information table until it matches
 * the implemented data inventory.* So the table here is built from the
 * inventory the privacy screen is already held to (`SYNC_GROUPS`, which
 * `privacy.test.ts` holds against every persisted field), the controls are
 * the rows under Me (`mecontrols.ts`), and the supporting documents carry
 * the status the legal register gives them. Nothing on the page is typed a
 * second time from memory.
 *
 * What the page may not say is as important as what it says. The four
 * "never" lines are each held by a test or a policy in the tree, cited beside
 * them, and the sentence the brief says to replace only after legal review
 * is printed with that caveat on the page.
 */

export interface Category {
  category: string;
  examples: string;
  why: string;
  /** Which sync groups it corresponds to, so the table cannot name a class the inventory does not hold. */
  groups: readonly number[];
  /** Or, when it is not synced content at all, where the brief's row is answered. */
  note?: string;
}

/** The brief's six categories, mapped onto the inventory the app is held to. */
export const CATEGORIES: readonly Category[] = [
  { category: 'Account information', examples: 'Email address and sign-in records, when you sign in', why: 'Account access, security and support', groups: [], note: 'Held by the account service, not synced content; an account is optional.' },
  { category: 'Academic context', examples: 'Courses, terms, plans, requirements, grades you record', why: 'Planning, course organisation and the study tools', groups: [0, 1, 8] },
  { category: 'Student-provided content', examples: 'Notes, actions, documents, uploads you keep on the device, preferences', why: 'The features you choose to use', groups: [2, 3, 5, 6, 7, 9, 10, 11] },
  { category: 'Institution-provided information', examples: 'A course’s published rules, an office’s published actions, official dates', why: 'The institutional experiences your school switches on', groups: [], note: 'Nothing is provided by an institution today: no institutional connection is live.' },
  { category: 'Usage and technical information', examples: 'Which family of client read a calendar; first-party counts with no identifier', why: 'Security, support, accessibility and performance', groups: [], note: 'No user-agent string, no address, no third-party analytics; see the analytics policy.' },
  { category: 'AI interaction data', examples: 'What you told the assistant about yourself; the sources you ticked; feedback you send', why: 'The AI features, their safety and quality, and support', groups: [4], note: 'Conversations live on the device; the gateway keeps metadata for 180 days, never the text.' },
];

/** What the page prints for a category's examples: the inventory's own phrases, when it has any. */
export function inventoryPhrases(c: Category): string[] {
  return c.groups.map((i) => SYNC_GROUPS[i].says);
}

/** The six things the app shows when AI is used, and where each is on screen. */
export const AI_SHOWS: readonly { what: string; where: string }[] = [
  { what: 'Whether AI was used', where: 'An answer from the assistant is always in the assistant; study material drafted with AI is labelled and linked to its sources.' },
  { what: 'The source material, or the source limitation', where: '“Using: …” under each reply says what it read, and “How to read this answer” rates the source strong, limited or none.' },
  { what: 'The applicable course or institution policy', where: 'The policy state under each reply — allowed, limited, unavailable — and a course’s published rules shown before the assistant answers.' },
  { what: 'Whether content is generated, summarised or retrieved', where: 'The mode the question was read in, shown beside the reply, and the quotations a teach-back reply must carry from the material.' },
  { what: 'Known limitations and what needs review', where: '“What it cannot determine” and “What needs a person or the official record”, under every reply.' },
  { what: 'A route to report an incorrect, harmful, inaccessible or policy-inappropriate response', where: 'Six reasons under every reply: helpful, not helpful, incorrect, source issue, policy issue, accessibility issue. The last four open a report.' },
];

/** The controls the brief lists, each answered by a row under Me. */
export const CONTROLS: readonly MeControl[] = ME_CONTROLS;

export interface Never {
  line: string;
  /** What holds it: a path in the tree. */
  path: string;
  shows: string;
}

export const NEVER: readonly Never[] = [
  { line: 'Semester does not use student data to create opaque behavioural, disciplinary or “risk” scores that determine a student’s academic future.', path: 'app/src/lib/institution-ops.ts', shows: 'Forbidden measures are refused, and aggregates only at n ≥ 10' },
  { line: 'The product is not designed to manipulate attention, hide important choices, or pressure anyone into sharing more than a feature needs.', path: 'docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md', shows: 'The engagement and notification rules' },
  { line: 'Access by support staff is limited, authorised, logged and time-bound.', path: 'supabase/support-access.check.sql', shows: 'A support read needs a live grant, and the grant expires' },
  { line: 'Personal information is not sold. Student content and institution data are not used to train general-purpose AI models.', path: 'RETENTION.md', shows: '“Nothing is used to train anything”, the promise every retention clock is held under' },
  { line: 'Education records, personal plans and study activity are not used for behavioural advertising. A campaign cannot select a student by any of them.', path: 'app/src/lib/gtm/campaign.test.ts', shows: 'Every education-record and sensitive field is refused as a targeting criterion, by name, and a field nobody has classified is refused too' },
  { line: 'Study activity is not used to label a student as capable or incapable, motivated or unmotivated.', path: 'app/src/lib/institution-ops.test.ts', shows: 'Individual risk scores, reading time and attention or engagement inference are refused as measures, not hidden' },
];

export type ArtifactStatus = PolicyStatus | 'exists';

export interface Artifact {
  title: string;
  status: ArtifactStatus;
  /** A path in the tree, required unless not-started. */
  path: string | null;
  note?: string;
}

const policy = (id: string): Policy => {
  const p = POLICIES.find((x) => x.id === id);
  if (!p) throw new Error(`no policy ${id}`);
  return p;
};

/** The brief’s required supporting artifacts, each with where it stands. Policies carry the legal register’s status. */
export function artifacts(): Artifact[] {
  const fromPolicy = (id: string, title: string): Artifact => {
    const p = policy(id);
    return { title, status: p.status, path: p.path, note: p.note };
  };
  return [
    fromPolicy('privacy', 'Privacy policy'),
    fromPolicy('ai-use', 'AI policy'),
    { title: 'Security overview', status: 'exists', path: 'SECURITY.md' },
    fromPolicy('a11y-statement', 'Accessibility statement'),
    fromPolicy('subprocessors', 'Subprocessor list'),
    fromPolicy('dpa', 'Data-processing agreement'),
    { title: 'Data-retention schedule summary', status: 'exists', path: 'RETENTION.md' },
    { title: 'Law-enforcement and government request policy', status: 'not-started', path: null, note: 'Owed with counsel; no request has been received.' },
    { title: 'Vulnerability disclosure policy', status: 'exists', path: 'SECURITY.md', note: 'The reporting section of the security overview; no bounty.' },
    { title: 'Incident communication policy', status: 'exists', path: 'docs/operating-model/INCIDENT-COMMUNICATIONS.md' },
    { title: 'AI system and change log', status: 'exists', path: 'docs/operating-model/AI-LIFECYCLE-GATES.md', note: 'The gates a change passes; the per-change log begins with the first governed deployment.' },
    { title: 'Model and provider inventory summary', status: 'exists', path: 'docs/SUBPROCESSORS.md', note: 'Providers are listed with what each receives; the model inventory is the provider registry row AI-002.' },
    { title: 'Customer data export and offboarding guide', status: 'exists', path: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', note: 'Written; the institutional half has not been run.' },
  ];
}

export const ARTIFACT_WORD: Record<ArtifactStatus, string> = {
  'not-started': 'Not started',
  outline: 'Outline',
  draft: 'Draft',
  'in-force': 'In force',
  exists: 'Written',
};

/** Where a question goes. Every one is the contact address with a subject the seat reads. */
export const CONTACTS: readonly { topic: string; subject: string; seat: string }[] = [
  { topic: 'Privacy questions', subject: 'Privacy', seat: 'the privacy seat' },
  { topic: 'Security reports', subject: 'Security report', seat: 'the security seat' },
  { topic: 'Accessibility feedback', subject: 'Accessibility', seat: 'the accessibility seat' },
  { topic: 'AI safety or policy reports', subject: 'AI policy', seat: 'the product seat' },
];

/** The sentence the brief says to replace only after legal review, printed with that caveat. */
export const LEGAL_CAVEAT = 'This wording has not had legal review. Before it is a policy, it must match the vendor agreements, the technical configuration and the data-processing practice exactly; the legal page says where each policy stands.';
