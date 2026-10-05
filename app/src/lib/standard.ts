/**
 * The Semester Standard: the public, measurable commitments the company is
 * held to, each with what holds it in the tree today and what does not yet.
 *
 * Three briefs asked for the same page under the same name — a living public
 * standard, one line per commitment, with annual progress published against
 * it — and each gave a slightly different list. This is the union, eleven
 * lines, worded so that each is checkable: "every fact has a source" is held
 * by the test that holds the five source labels, "every public claim has
 * evidence" by the claims register, "every AI answer has policy and source
 * context" by the quality line under every reply.
 *
 * The status words are deliberately three, and none is "done":
 *
 *   held    — a test or a check in the tree fails when the line is broken
 *   partly  — held on some surfaces, owed on the rest; the gap says which
 *   owed    — stated, and nothing in the tree holds it yet
 *
 * `standard.test.ts` holds every cited path to the tree and states the
 * counts, so the page cannot say more than the tree does. `/semester-standard/`
 * prints it. The standard is a moat only if it is auditable and the gaps are
 * disclosed, which is why the gap column is on the public page.
 */

export type Held = 'held' | 'partly' | 'owed';

export interface Commitment {
  id: string;
  /** The line, as the page prints it. Starts with "Every". */
  line: string;
  /** How it is measured — what a reader could check. */
  measure: string;
  status: Held;
  /** What holds it: repository paths, each with what it shows. */
  holds: readonly { path: string; shows: string }[];
  /** What is not held yet. Empty only when `held`. */
  gap: string;
}

export const STANDARD: readonly Commitment[] = [
  {
    id: 'source',
    line: 'Every important fact has a source.',
    measure: 'Every fact the app shows carries one of five labels — Institution verified, Imported, Student entered, Estimated, Needs review — and a label cannot call an estimate official.',
    status: 'held',
    holds: [{ path: 'app/src/lib/source.test.ts', shows: 'The five labels, what each means, and that “verified” is only for institution-verified' }, { path: 'app/src/lib/provenance.ts', shows: 'Source, scope and status as one shape on every surface' }],
    gap: '',
  },
  {
    id: 'estimate',
    line: 'Every estimate has its limitation stated.',
    measure: 'A path snapshot, a graduation projection or a cost scenario says it is an estimate, what it rests on, and that the official record decides.',
    status: 'held',
    holds: [{ path: 'app/src/site/tools/Tools.test.tsx', shows: 'The public graduation tool labels its result Estimated and says it is not a degree audit' }, { path: 'app/src/lib/explain.ts', shows: 'Every screen answers “where did this come from”, and the degree path says it is not the audit' }],
    gap: '',
  },
  {
    id: 'share',
    line: 'Every share has a recipient, a scope, a duration and a revoke control.',
    measure: 'No share exists without a named recipient, a stated scope and an expiry, and the student can take it back from one place.',
    status: 'partly',
    holds: [{ path: 'app/src/lib/advisor-shares.test.ts', shows: 'An advising share names its recipient, its scope and its expiry, and is revocable' }, { path: 'app/src/lib/familyshare.test.ts', shows: 'A supporter share follows the same rules' }, { path: 'app/src/lib/mecontrols.ts', shows: 'Sharing is one row under Me' }],
    gap: 'The purpose of a share is not yet a field the recipient sees, and no share has been made with a real institution.',
  },
  {
    id: 'keyboard',
    line: 'Every critical workflow is keyboard-operable.',
    measure: 'Every route passes an axe-core run for serious and critical violations on every change; a person with a screen reader and keyboard has walked the main journey.',
    status: 'partly',
    holds: [{ path: 'app/src/a11y/axe.test.tsx', shows: 'No serious or critical violation on any route, desktop and phone' }, { path: 'app/src/lib/ops/claims.ts', shows: 'The human review is an in-preparation claim on the accessibility page, not an available one' }],
    gap: 'No review by a person with a screen reader has been recorded. Automated checks find a minority of barriers.',
  },
  {
    id: 'ai-context',
    line: 'Every AI answer has policy and source context.',
    measure: 'Under every reply: source strength, policy state, what it can support, what it cannot determine, and what needs a person or the official record.',
    status: 'held',
    holds: [{ path: 'app/src/ai/quality.test.ts', shows: 'Source strength from what was read, policy state from the help state the composer obeys' }, { path: 'app/src/ai/Turns.tsx', shows: 'The “How to read this answer” disclosure under a reply, and six reasons to mark it' }],
    gap: '',
  },
  {
    id: 'ai-boundary',
    line: 'Every AI feature answers to a policy boundary.',
    measure: 'A school’s policy decides which modes exist; a course’s policy is shown before an answer; a banned course gets planning help only.',
    status: 'partly',
    holds: [{ path: 'app/src/ai/converse.ts', shows: 'helpState: ready, checking, unreachable, school-off, course-off — and the composer obeys it' }, { path: 'app/src/lib/coursestudio.ts', shows: 'An instructor’s published rules, versioned' }, { path: 'docs/market-readiness/AI_GOVERNANCE.md', shows: 'The enforcement boundaries and the production approval a mode needs' }],
    gap: 'Department and multi-campus policy are under way, and no institution has set a policy in production.',
  },
  {
    id: 'integration-health',
    line: 'Every integration shows health and freshness.',
    measure: 'Each connection shows its scope, owner, last successful sync, failure state and what to do meanwhile, to the student who added it and to the staff who run it.',
    status: 'partly',
    holds: [{ path: 'app/src/lib/integration/freshness.ts', shows: 'Freshness words a connection prints' }, { path: 'app/src/lib/trustdashboard.ts', shows: 'Connections with last sync, scope and owner on the institution’s trust dashboard' }],
    gap: 'The staff dashboard is behind an off-by-default flag, no alert fires on a stale source, and no institutional connection is live to be measured.',
  },
  {
    id: 'incident',
    line: 'Every critical incident has a communication path.',
    measure: 'For each audience — students, staff, the institution’s IT — a template, an owner, a channel and a time, and a notice in the app only on the screens the incident touches.',
    status: 'partly',
    holds: [{ path: 'app/src/lib/governance/incident-comms.ts', shows: 'Notices by audience, with what each must say' }, { path: 'app/src/lib/statusnotice.ts', shows: 'A notice on the screens it concerns, and nowhere else' }, { path: 'SECURITY.md', shows: 'Notice within 72 hours of a confirmed exposure' }],
    gap: 'The process has not been exercised, even as a tabletop; that is an item on the proof calendar.',
  },
  {
    id: 'export',
    line: 'Every customer can export and offboard.',
    measure: 'A student exports everything on every plan and deletes the account; an institution receives its data in open formats and a documented offboarding.',
    status: 'partly',
    holds: [{ path: 'app/src/lib/plans.test.ts', shows: 'Export, deletion and saved plans are on every plan, including Free' }, { path: 'supabase/deletion.check.sql', shows: 'Deleting the account removes its rows from every table' }, { path: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', shows: 'The institution’s half, designed' }],
    gap: 'No institutional export exists because no institution is connected; the format and the runbook are written, not run.',
  },
  {
    id: 'audit',
    line: 'Every high-risk action is audited.',
    measure: 'Role grants, moderation, support reads, gateway actions and policy changes each write a record that cannot be edited or deleted, and a reviewer can export it.',
    status: 'partly',
    holds: [{ path: 'supabase/role-grant-audit.check.sql', shows: 'The role-grant audit cannot be updated or deleted' }, { path: 'supabase/support-access.check.sql', shows: 'A support read needs a live grant, and the grant is logged' }, { path: 'app/src/lib/governance/policysim.ts', shows: 'A policy change names the audit event it will write before it is staged' }],
    gap: 'No unified event schema, and no export a reviewer can verify. The claims register says so on the security page.',
  },
  {
    id: 'evidence',
    line: 'Every public claim and every operational promise has evidence.',
    measure: 'Each capability the site names carries a status word from a register that refuses a word above what the readiness rows support; each customer commitment names its seat, its date and its record.',
    status: 'held',
    holds: [{ path: 'app/src/lib/ops/claims.test.ts', shows: 'A page cannot print a status the register does not support' }, { path: 'app/src/lib/ops/commitments.test.ts', shows: 'Every customer commitment has an owner, a date and a record' }],
    gap: '',
  },
];

export interface Counts {
  held: number;
  partly: number;
  owed: number;
}

export function counts(standard: readonly Commitment[] = STANDARD): Counts {
  return {
    held: standard.filter((c) => c.status === 'held').length,
    partly: standard.filter((c) => c.status === 'partly').length,
    owed: standard.filter((c) => c.status === 'owed').length,
  };
}

/** The one sentence the page opens with. */
export function summary(standard: readonly Commitment[] = STANDARD): string {
  const c = counts(standard);
  return `${standard.length} commitments: ${c.held} held by a check that fails when broken, ${c.partly} held in part with the gap stated, ${c.owed} stated and not yet held.`;
}
