/**
 * What success means in the first twelve months, as measures.
 *
 * "Be the leader" is directionally useful and cannot be checked. This is the
 * first version of it that can: the brief's four groups — students,
 * institutions, platform, business — each measure defined, and for each the
 * place the number would come from today, or the statement that no such
 * place exists yet.
 *
 * ## No target is set here
 *
 * A target is the founder's decision, and a number written into a repository
 * by an agent is a number nobody decided. So every `target` is `null` until a
 * decision in docs/DECISION-LOG.md sets it, and `firstyear.test.ts` refuses a
 * target with no decision behind it. The measures are defined so that the
 * decision, when it comes, is about a number and not about what the number
 * means.
 *
 * ## No collection is implied
 *
 * ANALYTICS.md holds three marks and nothing else, and D-005 says a fourth
 * lands with its question and its migration in the same pull request, for
 * review. A measure below whose `state` is `defined` is exactly that: a
 * definition. It does not start counting anything.
 */

export type Group = 'students' | 'institutions' | 'platform' | 'business';

export const GROUPS: readonly Group[] = ['students', 'institutions', 'platform', 'business'];

export const GROUP_TITLE: Record<Group, string> = {
  students: 'Students',
  institutions: 'Institutions',
  platform: 'Platform',
  business: 'Business',
};

/**
 * - `measured`: a query or check in the repository returns the number today.
 * - `instrumented`: the definition and its target shape exist in code, but no reading has been taken.
 * - `defined`: defined here only; the reading needs work that has not been decided.
 */
export type MeasureState = 'measured' | 'instrumented' | 'defined';

export interface Measure {
  id: string;
  group: Group;
  /** As the brief names it. */
  name: string;
  /** What is counted, precisely enough that two people would get the same number. */
  definition: string;
  state: MeasureState;
  /** Where the number comes from, or would. Must exist when given. */
  source: string | null;
  /** Why the state is what it is, and what would raise it. */
  note: string;
  /** Set only by a decision. */
  target: { value: string; decision: string } | null;
}

export const MEASURES: readonly Measure[] = [
  // ── Students ──
  {
    id: 'active-users',
    group: 'students',
    name: 'Active users',
    definition: 'Distinct accounts with an `opened` row in the week, Monday to Sunday; the current week reported as partial',
    state: 'measured',
    source: 'supabase/analytics.sql',
    note: 'The weekly-active figure of ANALYTICS.md. Block 0 first, every time, to tell an empty week from a table nothing writes to.',
    target: null,
  },
  {
    id: 'meaningful-actions',
    group: 'students',
    name: 'Meaningful actions completed',
    definition: 'Of the accounts first seen in a week, the share that had a course of their own and had answered a card within 7 days of arriving',
    state: 'measured',
    source: 'ANALYTICS.md',
    note: 'Activation, as the three marks define it. Actions beyond those two — a plan saved, a deadline done — are not counted, and counting them is a D-005 decision.',
    target: null,
  },
  {
    id: 'path-clarity',
    group: 'students',
    name: 'Path clarity score',
    definition: 'After the usability study’s scenarios, the share of students who can say what they should do next this week and why, unprompted',
    state: 'defined',
    source: 'docs/PROOF-CALENDAR.md',
    note: 'A survey question, asked in the Month 2 usability study, not a mark. It is a reading taken by a person on a sample, and it stays one.',
    target: null,
  },
  {
    id: 'return-rate',
    group: 'students',
    name: 'Return rate',
    definition: 'Of the accounts first seen in a week, the share that opened the app again between 28 and 34 days after their first day; cohorts younger than 34 days excluded',
    state: 'measured',
    source: 'supabase/analytics.sql',
    note: 'The 30-day retention figure of ANALYTICS.md.',
    target: null,
  },
  {
    id: 'trust-comprehension',
    group: 'students',
    name: 'Trust/source comprehension',
    definition: 'In the usability study, the share of students who correctly say where a shown fact came from and whether the school confirmed it',
    state: 'defined',
    source: 'docs/TRUST-CUES-AND-SOURCE-PRESENTATION.md',
    note: 'The source labels exist and are tested; whether a student understands them is a reading taken with students, in the Month 2 study.',
    target: null,
  },
  {
    id: 'a11y-task-success',
    group: 'students',
    name: 'Accessibility task success',
    definition: 'The share of golden-path steps completed by students using assistive technology, without help, in the accessibility baseline and each quarterly review',
    state: 'instrumented',
    source: 'app/scripts/accessibility-smoke.mjs',
    note: 'The smoke drives the critical journeys with the accessibility tree in a real browser on every change. Success by a person with assistive technology is the Month 1 baseline.',
    target: null,
  },
  // ── Institutions ──
  {
    id: 'signed',
    group: 'institutions',
    name: 'Signed departments/institutions',
    definition: 'Institutions or departments with a signed agreement carrying at least one binding commitment',
    state: 'instrumented',
    source: 'app/src/lib/ops/commitments.ts',
    note: 'Read from the commitment register, which is empty until the champion seat is held.',
    target: null,
  },
  {
    id: 'implementation-time',
    group: 'institutions',
    name: 'Implementation time',
    definition: 'Calendar days from the signed agreement to the cohort’s go-live record',
    state: 'defined',
    source: 'docs/operating-model/PILOT-TO-PRODUCTION.md',
    note: 'Both dates exist in the lifecycle; nobody has run it. The first pilot sets the first reading.',
    target: null,
  },
  {
    id: 'pilot-conversion',
    group: 'institutions',
    name: 'Pilot-to-annual conversion',
    definition: 'Pilots whose midpoint report led to a signed annual agreement, as a share of pilots that reached the midpoint',
    state: 'defined',
    source: 'docs/90-DAY-LAUNCH-PROGRAM.md',
    note: 'The `midpoint-report` and `annual-proposal` items of the 90-day program are the two ends of it.',
    target: null,
  },
  {
    id: 'renewal',
    group: 'institutions',
    name: 'Renewal rate',
    definition: 'Annual agreements renewed at term, by count and by value',
    state: 'defined',
    source: null,
    note: 'No agreement has a term yet. Readable from the commitment register once contracts carry dates.',
    target: null,
  },
  {
    id: 'expansion',
    group: 'institutions',
    name: 'Expansion rate',
    definition: 'Institutions that added a department, a package or a module within the year, as a share of signed institutions',
    state: 'defined',
    source: null,
    note: 'Needs a second package to exist; docs/LAUNCH-DECISIONS.md step 3 lists the four.',
    target: null,
  },
  {
    id: 'security-review-time',
    group: 'institutions',
    name: 'Security-review cycle time',
    definition: 'Calendar days from an institution’s first security questionnaire to its sign-off',
    state: 'defined',
    source: 'docs/market-readiness/HECVAT_READINESS.md',
    note: 'The Month 2 HECVAT evidence inventory is what shortens it; the first review is the first reading.',
    target: null,
  },
  // ── Platform ──
  {
    id: 'journey-slo',
    group: 'platform',
    name: 'Critical journey SLO',
    definition: 'For each journey in `JOURNEYS`, good events over eligible events in the month, against its objective',
    state: 'instrumented',
    source: 'app/src/lib/governance/error-budgets.ts',
    note: 'Targets, not readings: Semester has no measured availability history, and nothing here may be quoted as an achieved figure.',
    target: null,
  },
  {
    id: 'incidents',
    group: 'platform',
    name: 'P0/P1 incidents',
    definition: 'Incidents at P0 or P1 in the month, with time to notice and time to resolve',
    state: 'defined',
    source: 'docs/trust/APM-RUNBOOK.md',
    note: 'The severity scale and the runbook exist; the incident log they would fill does not.',
    target: null,
  },
  {
    id: 'restore-success',
    group: 'platform',
    name: 'Restore success',
    definition: 'Restore drills completed within the recovery objective, as a share of drills run',
    state: 'defined',
    source: 'RESTORE.md',
    note: 'The drill is on the proof calendar for Month 1; no drill has been run.',
    target: null,
  },
  {
    id: 'integration-freshness',
    group: 'platform',
    name: 'Integration freshness',
    definition: 'For each connector, the share of syncs that met their freshness class in the month',
    state: 'instrumented',
    source: 'app/src/lib/integration/catalog.ts',
    note: 'The freshness classes are data and the tick records each run; no connector is live for a customer.',
    target: null,
  },
  {
    id: 'a11y-blockers',
    group: 'platform',
    name: 'Accessibility blocker rate',
    definition: 'Blocking accessibility findings per released screen, from the scorecard, per quarter',
    state: 'defined',
    source: 'docs/WCAG-UI-AUDIT-SCORECARD.md',
    note: 'The scorecard scores components with cited tests; a blocker count over releases starts with the quarterly review.',
    target: null,
  },
  // ── Business ──
  {
    id: 'arr',
    group: 'business',
    name: 'ARR/MRR',
    definition: 'Annualised value of signed agreements in force, and the monthly figure',
    state: 'defined',
    source: 'docs/FINANCIAL-READINESS-WORKSPACE.md',
    note: 'D-009 keeps billing out of the app; the figure comes from the agreements themselves, in the financial workspace.',
    target: null,
  },
  {
    id: 'gross-retention',
    group: 'business',
    name: 'Gross retention',
    definition: 'Value renewed at term as a share of value up for renewal, before expansion',
    state: 'defined',
    source: null,
    note: 'No agreement has reached term.',
    target: null,
  },
  {
    id: 'net-retention',
    group: 'business',
    name: 'Net retention',
    definition: 'Value renewed plus expansion, as a share of value up for renewal',
    state: 'defined',
    source: null,
    note: 'No agreement has reached term.',
    target: null,
  },
  {
    id: 'gross-margin',
    group: 'business',
    name: 'Gross margin',
    definition: 'Revenue less hosting, AI and support cost of serving it, as a share of revenue',
    state: 'defined',
    source: 'docs/operating-model/COMMERCIAL-GOVERNANCE.md',
    note: 'The AI cost controls are where the cost side is governed; there is no revenue yet.',
    target: null,
  },
  {
    id: 'cac-payback',
    group: 'business',
    name: 'CAC payback',
    definition: 'Months of an institution’s gross margin needed to repay the cost of acquiring it',
    state: 'defined',
    source: null,
    note: 'Needs both a cost of acquisition and a margin; neither exists.',
    target: null,
  },
  {
    id: 'runway',
    group: 'business',
    name: 'Runway',
    definition: 'Months of operation at the current net burn',
    state: 'defined',
    source: 'docs/operating-model/OPERATING-RHYTHM.md',
    note: 'The monthly review’s first row. The number lives in the financial workspace, not the repository.',
    target: null,
  },
];
