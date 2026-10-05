/**
 * The proof calendar: the schedule for producing the evidence needed to sell.
 *
 * The master register lets no row above `tested` until an artifact exists
 * under `docs/evidence/`, and none does. This is the order in which those
 * artifacts get made — three months of them, then a quarterly cycle that
 * turns enterprise readiness into a recurring discipline rather than a
 * one-time push.
 *
 * Each item names the seat that produces it, the artifact it files, the
 * register rows the artifact would move, and where it already lives in the
 * 90-day program or the operating rhythm. `proofcalendar.test.ts` holds
 * every one of those references to something that exists, so the calendar
 * cannot promise to move a row that is not there or cite a review nobody
 * scheduled.
 *
 * The clock starts with day 1 of `docs/90-DAY-LAUNCH-PROGRAM.md`, which is
 * the founder's decision to start it; no date is invented here.
 */

import type { Seat } from '../launchreadiness';

export type Window = 'month-1' | 'month-2' | 'month-3' | 'quarterly';

export const WINDOWS: readonly Window[] = ['month-1', 'month-2', 'month-3', 'quarterly'];

export const WINDOW_TITLE: Record<Window, string> = {
  'month-1': 'Month 1',
  'month-2': 'Month 2',
  'month-3': 'Month 3',
  quarterly: 'Every quarter',
};

export interface ProofItem {
  id: string;
  window: Window;
  /** What is proved, as the brief names it. */
  proof: string;
  owner: Seat;
  /**
   * The artifact, under docs/evidence/. A quarterly item's name carries
   * `{quarter}`, filled in as `2027Q1` and so on, so each cycle files its own.
   */
  artifact: string;
  /** What the artifact contains, for the person producing it. */
  contains: string;
  /** Master-register row ids the artifact would let move above `tested`. */
  moves: readonly string[];
  /** The task in docs/90-DAY-LAUNCH-PROGRAM.md this closes, if one. */
  ninetyDay?: string;
  /** For a quarterly item: the row of the quarterly table in OPERATING-RHYTHM.md it belongs to. */
  rhythm?: string;
}

export const CALENDAR: readonly ProofItem[] = [
  // ── Month 1 ──
  {
    id: 'auth-rls',
    window: 'month-1',
    proof: 'Auth/RLS test report',
    owner: 'security',
    artifact: 'docs/evidence/auth-rls-test-report.md',
    contains: 'Every policy check under supabase/*.check.sql run against a fresh project, the run recorded with its commit, and each role’s positive and negative case named',
    moves: ['IAM-006', 'IAM-007', 'IAM-008', 'IAM-009'],
    ninetyDay: 'data-inventory',
  },
  {
    id: 'a11y-baseline',
    window: 'month-1',
    proof: 'Accessibility baseline',
    owner: 'accessibility',
    artifact: 'docs/evidence/accessibility-baseline.md',
    contains: 'The golden path with a screen reader, keyboard only, 320px and 200% zoom, by a person, with each failure filed against the WCAG scorecard',
    moves: ['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005'],
    ninetyDay: 'a11y-core',
  },
  {
    id: 'restore-drill',
    window: 'month-1',
    proof: 'Backup restore drill',
    owner: 'engineering',
    artifact: 'docs/evidence/restore-drill.md',
    contains: 'A restore into a disposable project per RESTORE.md, timed, with the row counts before and after',
    moves: ['SRE-004', 'SRE-005'],
    ninetyDay: 'restore-rehearsal',
  },
  {
    id: 'tabletop',
    window: 'month-1',
    proof: 'Support/incident tabletop',
    owner: 'success',
    artifact: 'docs/evidence/incident-tabletop.md',
    contains: 'One P1 walked through from first report to customer notice, who did what, and the gaps found in the runbooks',
    moves: ['SEC-007', 'SUP-001'],
    ninetyDay: 'support-ready',
  },
  // ── Month 2 ──
  {
    id: 'usability',
    window: 'month-2',
    proof: 'Student workflow usability study',
    owner: 'product',
    artifact: 'docs/evidence/student-usability-study.md',
    contains: 'Five or more students through Today, My Path, registration and the plan, tasks timed, and whether they could say where each fact came from',
    moves: ['STU-001', 'STU-003', 'STU-005', 'STU-010', 'TRUST-001'],
  },
  {
    id: 'load-test',
    window: 'month-2',
    proof: 'Load test',
    owner: 'engineering',
    artifact: 'docs/evidence/load-test.md',
    contains: 'A registration-morning profile against a preview project, the rate limits observed, and the point at which the journeys’ SLOs would break',
    moves: ['SRE-007', 'SRE-009'],
  },
  {
    id: 'hecvat',
    window: 'month-2',
    proof: 'HECVAT evidence inventory',
    owner: 'security',
    artifact: 'docs/evidence/hecvat-evidence-inventory.md',
    contains: 'Each HECVAT question with the artifact that answers it or the word none, so the response is written from evidence and not from hope',
    moves: ['SEC-001', 'SEC-011'],
    ninetyDay: 'trust-outline',
  },
  {
    id: 'dpa-trust',
    window: 'month-2',
    proof: 'DPA/Trust Center review',
    owner: 'privacy',
    artifact: 'docs/evidence/dpa-trust-center-review.md',
    contains: 'Counsel’s read of the DPA checklist and the trust package, each [DECIDE] resolved or assigned',
    moves: ['SEC-009', 'SEC-013', 'LEG-002'],
    ninetyDay: 'trust-outline',
  },
  // ── Month 3 ──
  {
    id: 'uat',
    window: 'month-3',
    proof: 'Institution UAT',
    owner: 'champion',
    artifact: 'docs/evidence/institution-uat.md',
    contains: 'The golden-path script run by the pilot institution’s own students and staff, results signed by the champion',
    moves: ['IMP-001'],
    ninetyDay: 'uat',
  },
  {
    id: 'sso-integration',
    window: 'month-3',
    proof: 'SSO/integration test',
    owner: 'data',
    artifact: 'docs/evidence/sso-integration-test.md',
    contains: 'Sign-in through the school’s IdP and one connector’s sync, observed end to end, with the freshness class it met',
    moves: ['IAM-003', 'INT-001', 'INT-014'],
    ninetyDay: 'identity',
  },
  {
    id: 'vpat',
    window: 'month-3',
    proof: 'VPAT/ACR',
    owner: 'accessibility',
    artifact: 'docs/evidence/vpat-acr.md',
    contains: 'The conformance report, by someone qualified, over the piloted screens, with each partial support explained',
    moves: ['A11Y-007'],
  },
  {
    id: 'pilot-baseline',
    window: 'month-3',
    proof: 'Pilot outcome baseline',
    owner: 'success',
    artifact: 'docs/evidence/pilot-outcome-baseline.md',
    contains: 'The charter’s two or three measures read before launch, so the midpoint report has something to be compared with',
    moves: ['SUP-003'],
    ninetyDay: 'launch-metrics',
  },
  // ── Quarterly ──
  {
    id: 'access-review',
    window: 'quarterly',
    proof: 'Access review',
    owner: 'security',
    artifact: 'docs/evidence/access-review-{quarter}.md',
    contains: 'Every privileged grant re-justified or revoked, read from the role-grant audit',
    moves: ['IAM-011'],
    rhythm: 'Access review',
  },
  {
    id: 'vendor-review',
    window: 'quarterly',
    proof: 'Vendor review',
    owner: 'privacy',
    artifact: 'docs/evidence/vendor-review-{quarter}.md',
    contains: 'docs/SUBPROCESSORS.md re-read against what actually runs, and each vendor’s assurance current',
    moves: ['SEC-010'],
    rhythm: 'Vendor and subprocessor review',
  },
  {
    id: 'ai-evaluation',
    window: 'quarterly',
    proof: 'AI evaluation',
    owner: 'product',
    artifact: 'docs/evidence/ai-evaluation-{quarter}.md',
    contains: 'Each enabled AI use case re-run through its G5 review: risk, value, cost and incidents this quarter',
    moves: ['AI-001', 'AI-011'],
    rhythm: 'AI governance board',
  },
  {
    id: 'a11y-review',
    window: 'quarterly',
    proof: 'Accessibility review',
    owner: 'accessibility',
    artifact: 'docs/evidence/accessibility-review-{quarter}.md',
    contains: 'The scorecard re-walked over what shipped this quarter, and the blocker rate',
    moves: ['A11Y-006'],
    rhythm: 'Security, privacy and accessibility review',
  },
  {
    id: 'dr-exercise',
    window: 'quarterly',
    proof: 'DR exercise',
    owner: 'engineering',
    artifact: 'docs/evidence/dr-exercise-{quarter}.md',
    contains: 'A restore into another region or project, timed against the recovery objective',
    moves: ['SRE-006'],
    rhythm: 'Disaster-recovery exercise',
  },
  {
    id: 'security-risk-review',
    window: 'quarterly',
    proof: 'Security/risk review',
    owner: 'security',
    artifact: 'docs/evidence/security-risk-review-{quarter}.md',
    contains: 'Open vulnerabilities by age, the risk register read row by row, and each acceptance renewed or retired',
    moves: ['SEC-001', 'SEC-004'],
    rhythm: 'Security, privacy and accessibility review',
  },
  {
    id: 'customer-advisory',
    window: 'quarterly',
    proof: 'Customer advisory review',
    owner: 'success',
    artifact: 'docs/evidence/customer-advisory-{quarter}.md',
    contains: 'Themes from the advisory conversations, and which reached the roadmap',
    moves: ['SUP-003'],
    rhythm: 'Customer advisory input',
  },
];

export interface EvidenceDir {
  exists: (path: string) => boolean;
  /** File names directly under docs/evidence/, or `[]` when the directory is absent. */
  list: () => readonly string[];
}

/** Whether the artifact has been filed: the exact file, or for a quarterly item any file of that cycle's pattern. */
export function filed(item: ProofItem, dir: EvidenceDir): boolean {
  if (!item.artifact.includes('{quarter}')) return dir.exists(item.artifact);
  const name = item.artifact.slice('docs/evidence/'.length);
  const re = new RegExp('^' + name.replace('.', '\\.').replace('{quarter}', '\\d{4}Q[1-4]') + '$');
  return dir.list().some((f) => re.test(f));
}
