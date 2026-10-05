/**
 * The strategic boundaries: what Semester does not build, whoever asks and
 * however good the deal. `docs/DO-NOT-BUILD.md` holds the product-level
 * anti-patterns (no custom buttons, no unexplained scores); these are the
 * company-level lines, the ones that protect focus, ethics, privacy, legal
 * position and brand trust, and that a sales conversation is most likely to
 * test.
 *
 * Each boundary says **how it is held**. Where a rule can be checked by
 * reading the code — a credential that must not reach a browser, a library
 * that must not be depended on — `boundaries.test.ts` checks it and is named
 * as the holder. Where it cannot, the holder is a decision or a document plus
 * review, and the line says so instead of pretending.
 *
 * Changing a boundary is a decision: a pull request that edits this data and
 * says why, with a `D-nnn` in the decision log. The test reads the rendered
 * page from this data, so a boundary cannot be relaxed in code without the
 * page changing in the same diff.
 */

export interface Holder {
  /** A test, a check, a document or a decision record; the path must exist. */
  path: string;
  /** What that file actually holds, in one clause. */
  how: string;
}

export interface Boundary {
  id: string;
  /** The line, as the brief states it. */
  rule: string;
  /** What crossing it would cost. */
  protects: string;
  /** `mechanical` when a test fails the build; `review` when a person reads against this page. */
  held: 'mechanical' | 'review';
  holders: readonly Holder[];
  /** Decision-log entries that settled the shape of this line. */
  decisions: readonly string[];
  /** What a reader might mistake for a crossing, and why it is not one. */
  note?: string;
}

export const BOUNDARIES: readonly Boundary[] = [
  {
    id: 'risk-scoring',
    rule: 'No behavioral student-risk scoring.',
    protects: 'A student is never a number a stranger can act on. Attendance arithmetic, deadline counts and the student’s own readiness mark are computed; a propensity or a risk tier about a person is not.',
    held: 'review',
    holders: [
      { path: 'docs/DO-NOT-BUILD.md', how: 'Rule 3: nothing ranked or suggested without its reason, inputs and limits' },
      { path: 'app/src/lib/atrisk.ts', how: 'The only file with "risk" in its name computes which of today’s classes a policy makes costly to miss, from the student’s own marks; it scores nobody' },
      { path: 'app/src/lib/study-readiness.ts', how: 'Readiness is the student’s mark; Semester only counts (D-045)' },
    ],
    decisions: ['D-029', 'D-045'],
    note: 'app/src/lib/atrisk.ts is attendance arithmetic from lib/attend.ts and is silent for any course without a policy. The name predates this line; the behaviour does not cross it.',
  },
  {
    id: 'mental-health',
    rule: 'No mental-health inference.',
    protects: 'Semester shows the crisis notice verbatim and routes to people; it never decides that a student is struggling from what they do in the app.',
    held: 'review',
    holders: [
      { path: 'docs/ai-toolkit/CLINICAL-LEGAL-FINANCIAL-BOUNDARIES.md', how: 'The assistant refuses clinical territory and says where to go instead' },
      { path: 'docs/CRISIS-RESPONSE-RUNBOOK.md', how: 'The notice is shown verbatim on every report form; nothing is inferred to trigger it' },
      { path: 'app/src/lib/governance/ai-lifecycle.ts', how: 'AI gates: a use case that infers wellbeing has no gate to pass' },
    ],
    decisions: ['D-029'],
  },
  {
    id: 'emotion',
    rule: 'No emotion or facial analysis.',
    protects: 'The camera reads a barcode and joins a study call. It never reads a face.',
    held: 'mechanical',
    holders: [
      { path: 'app/src/lib/ops/boundaries.test.ts', how: 'No package depends on a face, emotion or affect library, and no source under app/src names a face-detection API' },
      { path: 'app/src/components/ScanIsbn.tsx', how: 'The one camera use outside calls: a barcode, decoded on device' },
    ],
    decisions: [],
  },
  {
    id: 'surveillance',
    rule: 'No unapproved proctoring or surveillance.',
    protects: 'Screen capture exists for one reason — a student sharing their own screen in a study call they started — and nowhere else.',
    held: 'mechanical',
    holders: [
      { path: 'app/src/lib/ops/boundaries.test.ts', how: 'Screen capture appears only in the allow-listed file, and no source names proctoring as a feature' },
      { path: 'app/src/lib/rtc.ts', how: 'The allow-listed file: peer study calls, started and ended by the student' },
    ],
    decisions: [],
    note: 'app/src/lib/learner-pathways.ts mentions proctoring once, as a checklist item reminding a student to confirm exam arrangements with their course. That is advice about the school’s proctoring, not Semester doing any.',
  },
  {
    id: 'parents',
    rule: 'No generic parent access to student records.',
    protects: 'A supporter reads a confirmed copy of what the student chose to share, through one logged reader, for as long as the student says. There is no parent role and no family view.',
    held: 'mechanical',
    holders: [
      { path: 'docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md', how: 'The model, and the open policy decision on minors that blocks building more' },
      { path: 'supabase/supportshares.check.sql', how: 'A supporter share is created by the student, scoped, revocable, and re-checks the role on every read' },
    ],
    decisions: ['D-037', 'D-038', 'D-039'],
  },
  {
    id: 'sis-direct',
    rule: 'No direct SIS production database connection.',
    protects: 'Institutional data arrives through a connector with a scope the institution approved, a freshness class and an audit trail — never through a database credential on a school’s system of record.',
    held: 'mechanical',
    holders: [
      { path: 'app/src/lib/ops/boundaries.test.ts', how: 'No package depends on a relational database driver, and no source carries a database connection string' },
      { path: 'app/src/lib/integration/catalog.ts', how: 'Provider domains, freshness and sync classes, and what no connector ingests by default' },
      { path: 'docs/architecture/0003-no-application-server.md', how: 'There is no server of Semester’s to hold such a connection' },
    ],
    decisions: ['D-007', 'ADR-0003'],
  },
  {
    id: 'service-role',
    rule: 'No service-role credentials in browsers.',
    protects: 'Row-level security is the authorization boundary. A service key in a bundle would be every student’s data on every device.',
    held: 'mechanical',
    holders: [
      { path: 'app/src/lib/ops/boundaries.test.ts', how: 'No file under app/src, app/public or app/index.html names the service role, and no VITE_ variable does' },
      { path: 'docs/architecture/0002-rls-is-the-authorization-boundary.md', how: 'Why the browser holds only the anon key' },
      { path: 'SECRETS.md', how: 'Where each secret lives, and that the service key lives only in Edge Functions' },
    ],
    decisions: ['ADR-0002'],
  },
  {
    id: 'ai-decisions',
    rule: 'No official decision by AI.',
    protects: 'Nothing the assistant writes carries the institution’s label, grades a student, or approves anything. It compares, drafts and explains; a person decides.',
    held: 'mechanical',
    holders: [
      { path: 'app/src/lib/source.test.ts', how: 'Only facts confirmed by the school’s system carry `institution_verified`; nothing the assistant writes may' },
      { path: 'docs/DO-NOT-BUILD.md', how: 'Rule 7' },
      { path: 'docs/operating-model/AI-LIFECYCLE-GATES.md', how: 'Consequential actions need a person in the loop to pass a gate' },
    ],
    decisions: ['D-034', 'D-041'],
  },
  {
    id: 'fake-data',
    rule: 'No fake data in production.',
    protects: 'A demo record shown as a real one is a lie to the person reading it and to the register that counts it.',
    held: 'mechanical',
    holders: [
      { path: 'app/src/data/institutional-preview.test.ts', how: 'Every preview record is marked synthetic, pilot-only and sandbox-explicit' },
      { path: 'docs/MASTER-LAUNCH-READINESS-REGISTER.md', how: 'PRG-008 and TRUST-005: what still separates preview data from production, and the gap' },
    ],
    decisions: [],
  },
  {
    id: 'data-sale',
    rule: 'No hidden student-data sale or behavioral advertising.',
    protects: 'No ad or tracking SDK is loaded, three marks are the whole analytics record, and sponsorship is a separate opt-in that reads nothing about the student.',
    held: 'mechanical',
    holders: [
      { path: 'app/src/donotbuild.test.ts', how: 'Rule 10: none of the common ad or tracking hosts appears in the source' },
      { path: 'docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', how: 'What is measured, what was promised never to be, and the test behind each' },
      { path: 'ANALYTICS.md', how: 'Three marks; a fourth is a decision, held by a check constraint' },
    ],
    decisions: ['D-005'],
  },
  {
    id: 'forks',
    rule: 'No custom per-tenant forks.',
    protects: 'One codebase, configured through versioned policies, entitlements, mappings and approved extensions. A fork is a second product with one customer.',
    held: 'review',
    holders: [
      { path: 'docs/operating-model/CONFIGURATION-TIERS.md', how: 'The tiers of variation, and that none is a fork' },
      { path: 'app/src/lib/governance/scorecard.ts', how: 'Configuration scores 0 when a request needs a code fork, which routes it to decline' },
    ],
    decisions: [],
  },
  {
    id: 'unmoderated',
    rule: 'No unmoderated marketplace or public social feed.',
    protects: 'Every community surface has a moderator, a queue and an audit event. There is no public feed and no listing that reaches students unreviewed.',
    held: 'review',
    holders: [
      { path: 'docs/VOLUNTEER-MODERATOR-PROGRAM.md', how: 'The program, its calibration and its audit tables' },
      { path: 'app/src/community/moderation.ts', how: 'Who may decide, and the blind view a moderator sees' },
      { path: 'supabase/migrations/20260928032000_community.sql', how: 'The moderation and volunteer tables, with their audit events' },
    ],
    decisions: [],
  },
];

/** Where screen capture may appear. Anything else is a finding. */
export const SCREEN_CAPTURE_ALLOWED: readonly string[] = ['src/lib/rtc.ts'];

/** Libraries whose presence in any package would cross the emotion/facial line. */
export const FACE_LIBRARIES = /face-api|@tensorflow-models\/face|@mediapipe\/face|affectiva|emotion-recognition|@vladmandic\/human/;

/** Relational database drivers: a dependency on one is a direct database connection waiting to be configured. */
export const DB_DRIVERS: readonly string[] = ['pg', 'pg-native', 'postgres', 'mysql', 'mysql2', 'oracledb', 'mssql', 'tedious', 'odbc', 'ibm_db', 'better-sqlite3'];
