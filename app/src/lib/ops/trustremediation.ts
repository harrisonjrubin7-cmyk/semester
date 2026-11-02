/**
 * The remediation sequence for the gaps the control register records.
 *
 * Each item names the controls it moves, the files that show the gap today,
 * the seat that owns it, what must be filed when it is done, and the point at
 * which it has to be done: before an invitation-only beta carries more than the
 * founder's own data, before an institutional pilot, before anything is
 * charged to an institution, or before a broad enterprise sale. Those four
 * points are the release profiles in `release-profiles.ts`, and they set the
 * priority: P0 is the nearest.
 *
 * Two kinds of item are mixed on purpose and labelled. Most are code or
 * configuration a developer can finish. Some are only a person can do —
 * engaging counsel, an assessor, an institution contact, staffing a seat —
 * and `person` marks them so the sequence does not pretend that writing
 * software closes them.
 *
 * An item is `done` only when its proof is a test, check or workflow in the
 * tree that fails without it. `trustremediation.test.ts` holds every control
 * that is not `enforced` to at least one item, so a gap in the register cannot
 * go untracked.
 */

import type { Seat } from '../launchreadiness';

export const POINTS = ['invitation', 'pilot', 'paid', 'enterprise'] as const;
export type Point = (typeof POINTS)[number];

export const POINT_TITLE: Record<Point, string> = {
  invitation: 'Before an invitation-only beta carries real student data',
  pilot: 'Before an institutional pilot',
  paid: 'Before an institution is charged',
  enterprise: 'Before a broad enterprise sale',
};

export const PRIORITY: Record<Point, 'P0' | 'P1' | 'P2' | 'P3'> = { invitation: 'P0', pilot: 'P1', paid: 'P2', enterprise: 'P3' };

export type Effort = 'S' | 'M' | 'L';

export interface Item {
  id: string;
  before: Point;
  title: string;
  /** What is wrong today, in terms of the tree. */
  finding: string;
  /** Files that show it; every one must exist. */
  sources: readonly string[];
  fix: string;
  moves: readonly string[];
  owner: Seat;
  effort: Effort;
  /** Only a person, counsel, a vendor or an institution can close this; code alone cannot. */
  person?: true;
  needs?: readonly string[];
  /** What is filed under docs/evidence/ when it is done. */
  files: string;
  /** Present only on a finished item: the guard that fails without it. */
  done?: { proof: string; on: string };
}

export const ITEMS: readonly Item[] = [
  // ── Before an invitation-only beta carries real student data ──
  {
    id: 'TR-01', before: 'invitation', owner: 'accessibility', effort: 'S',
    title: 'Let the nightly contrast sweep fail',
    finding: 'contrast.yml piped the sweep through tee with no pipefail, so every nightly run was green while the log said FINDINGS: 159 (run of 3 October).',
    sources: ['.github/workflows/contrast.yml'],
    fix: 'Name shell: bash on both sweep steps, and hold every workflow to it.',
    moves: ['TC-A11-04'],
    files: 'The first red nightly run, linked from the fix for TR-02.',
    done: { proof: 'app/src/lib/workflowshell.test.ts', on: '2026-10-04' },
  },
  {
    id: 'TR-02', before: 'invitation', owner: 'accessibility', effort: 'S', needs: ['TR-01'],
    title: 'Fix the last painted-contrast finding, the journey card hover',
    finding: 'Of the 159 findings on 3 October, 156 came from the Work empty-state line, which commit 545010c had already moved from the 3:1 faint rung to the audited dim rung. The other three were .journey-reason on a hovered journey card on Industry Dark at 3.96:1 against 4.5: accent-deep is audited on the page and the panel, not on the lighter surface a hovered card moves to. Measured across every accent, the raise also fails on Graphite (4.20 to 4.48) and on Industry Dark (3.59 to 3.96). The 26 button-hierarchy walls reported then measure 0 on current main (63 of 63 destinations, both controls passing).',
    sources: ['app/src/styles/app.css', 'app/src/components/JourneyCards.tsx', 'app/src/lib/contrast.test.ts', 'app/src/screens/Work.tsx'],
    fix: 'A hovered or focused card keeps its accent border and sets the reason in the ground\'s full-strength ink; contrast.test.ts works out from the palette whether that override is needed and requires the stylesheet rule if so, and holds the ink to 4.5:1 on the raise on every ground. The palette is untouched. The guard was shown red against the stylesheet without the rule and green with it; the browser sweep of the home screen on Industry Dark and Graphite, which reported the hover finding before, reports none.',
    moves: ['TC-A11-03', 'TC-A11-04'],
    files: 'The first green nightly run.',
    done: { proof: 'app/src/lib/contrast.test.ts', on: '2026-10-04' },
  },
  {
    id: 'TR-03', before: 'invitation', owner: 'success', effort: 'S',
    title: 'Bring public accessibility text back inside the evidence',
    finding: 'The company site says axe-core was run on every page and form (no such run is in the tree), calls the nightly sweep a check of painted pixels while it was green with failures, and lists captions and form errors as known issues after both were fixed.',
    sources: ['PUBLIC-CLAIMS-APPROVAL-REGISTER.md', 'company-site/index.html', 'docs/accessibility/AT-PASS-PROTOCOL.md'],
    fix: 'Change the text to what the tree can show, and add the new claims to the register with their evidence.',
    moves: ['TC-A11-01', 'TC-A11-06'],
    files: 'The claims-register diff.',
  },
  {
    id: 'TR-04', before: 'invitation', owner: 'trust', effort: 'M',
    title: 'Reconcile the registers that contradict each other',
    finding: 'The database suites are counted as 36, 78 and 106 in three documents; RET-001 says no legal hold can be placed while legal_holds and four checks exist; MFA is "absent" in two registers and implemented for the console; SOC2-READINESS says no risk register and no tabletop; the threat model says thirteen functions where sixteen exist.',
    sources: ['docs/SECURITY-GAP-ANALYSIS.md', 'docs/SECURITY-THREAT-MODEL.md', 'docs/trust/EVIDENCE-REGISTER.md', 'docs/trust/SOC2-READINESS.md', 'app/src/lib/masterregister.ts'],
    fix: 'Correct each to what the tree shows, citing the file, and add a count to the test that holds the document.',
    moves: ['TC-PRV-02', 'TC-SEC-10'],
    files: 'The corrected documents.',
  },
  {
    id: 'TR-05', before: 'invitation', owner: 'security', effort: 'S',
    title: 'Make the dependency audit block',
    finding: 'The audit step is continue-on-error although the tree reports no vulnerabilities, "could be made blocking by deleting one line".',
    sources: ['.github/workflows/ci.yml'],
    fix: 'Remove continue-on-error; keep a dated allowlist for an advisory with no fix.',
    moves: ['TC-SEC-05'],
    files: 'The CI run that fails on a planted advisory, then passes.',
  },
  {
    id: 'TR-06', before: 'invitation', owner: 'founder', effort: 'S', person: true,
    title: 'Decide the severity scale',
    finding: 'Four scales coexist and the trust documents promise no response time while docs/vanderbilt/incident-routing.md promises fifteen minutes.',
    sources: ['app/src/lib/incident-recovery.ts', 'docs/INCIDENT-RECOVERY-PLAYBOOK.md', 'docs/trust/APM-RUNBOOK.md', 'docs/vanderbilt/incident-routing.md', 'SECURITY.md'],
    fix: 'Adopt SEV1 to SEV4 with the crosswalk in docs/integrated-trust/INCIDENT-RESPONSE.md, then edit each document to match; remove any clock the trust documents say is not authorized.',
    moves: ['TC-INC-01'],
    files: 'The decision record D-<pull request number>.',
  },
  {
    id: 'TR-07', before: 'invitation', owner: 'operations', effort: 'S', person: true,
    title: 'Send failures somewhere a second person sees',
    finding: 'The only alert is AI spend; a failed workflow notifies the repository owner by default and nothing else.',
    sources: ['MONITORING.md', 'docs/vanderbilt/incident-routing.md'],
    fix: 'Send production-smoke and main-red notifications to a shared address read by a second person; test it with a planted failure.',
    moves: ['TC-REL-06', 'TC-INC-03'],
    files: 'The test alert and the name of the person it reached.',
  },
  {
    id: 'TR-08', before: 'invitation', owner: 'privacy', effort: 'M',
    title: 'Run erasure and export through the real function',
    finding: 'The erasure drill ran inside a rolled-back block; the delete-account function, storage objects, a held account and an account with community content were not exercised.',
    sources: ['docs/drills/erasure-drill-2026-09-30.md', 'supabase/functions/delete-account/index.ts'],
    fix: 'With a synthetic signed-in account, call the function, check storage and the held-account refusal, and file the record.',
    moves: ['TC-PRV-01', 'TC-PRV-02'],
    files: 'docs/evidence/privacy/ erasure-through-function record.',
  },
  {
    id: 'TR-09', before: 'invitation', owner: 'security', effort: 'S',
    title: 'Inventory and rotate the keys the table omits',
    finding: 'SEMESTER_JOURNAL_KEY and SEMESTER_AUTH_SERVICE_KEY are not in the rotation table, the rotation log is empty, and the journal key has no identifier.',
    sources: ['SECRETS.md', 'app/server/institution/journal-crypto.ts', 'docs/trust/ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md'],
    fix: 'Add both to the table and to the guard that reads it; rotate one key and log it; give the journal format a key id.',
    moves: ['TC-SEC-13'],
    files: 'The rotation log entry.',
  },
  {
    id: 'TR-10', before: 'invitation', owner: 'operations', effort: 'M', person: true,
    title: 'Restore from the provider once, and measure it',
    finding: 'No provider backup or point-in-time restore has ever been done, no recovery time or point is measured, and the plan-tier backup window is assumed rather than read.',
    sources: ['RESTORE.md', 'docs/engineering-operations/DISASTER-RECOVERY-TEST-PLAN.md', 'docs/evidence/restore/2026-09-30-logical-rehearsal.md'],
    fix: 'Run exercise TT-03: restore into a second project, compare, time it; decide whether to buy point-in-time recovery; record the dashboard setting.',
    moves: ['TC-REL-04'],
    files: 'docs/evidence/operations/ provider-restore-drill.',
  },
  {
    id: 'TR-11', before: 'invitation', owner: 'trust', effort: 'S', person: true,
    title: 'Keep Community and image posts off until their prerequisites exist',
    finding: 'The escalation sender and the media scanner do not exist, no abuse-material route exists, and Community is not age-gated in SQL.',
    sources: ['docs/COMMUNITY-MEDIA-SAFETY.md', 'docs/CAMPUS-ESCALATION-POLICY.md', 'docs/COMMUNITIES-REGISTER.md'],
    fix: 'State in the register that Community is held off until TR-34, TR-35 and TR-36 are done, and add a release-profile gate that refuses it.',
    moves: ['TC-TSF-01', 'TC-TSF-03', 'TC-TSF-04', 'TC-TSF-05'],
    files: 'The register line.',
  },

  // ── Before an institutional pilot ──
  {
    id: 'TR-12', before: 'pilot', owner: 'founder', effort: 'M', person: true,
    title: 'Staff the security seat and name a backup for every role',
    finding: 'Security, trust, data and finance seats are vacant; every backup is unassigned; the second reviewer of the AI switch does not exist.',
    sources: ['app/src/lib/launchreadiness.ts', 'docs/engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md', 'docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md'],
    fix: 'Engage a security lead (fractional or vCISO), a trust lead, and a second reviewer; accept each seat in writing.',
    moves: ['TC-INC-03', 'TC-SEC-09'],
    files: 'The accepted seats, as role labels.',
  },
  {
    id: 'TR-13', before: 'pilot', owner: 'security', effort: 'L', needs: ['TR-12'],
    title: 'Multi-factor and passkeys for students and platform staff',
    finding: 'platform_admin and support_agent grants now require aal2 in has_capability and the console can enrol/challenge TOTP. Student-facing enrolment, passkeys, production Auth configuration evidence and recovery testing remain open.',
    sources: ['supabase/migrations/20261008223000_privileged_role_mfa.sql', 'supabase/privileged-mfa.check.sql', 'app/src/components/MfaStep.tsx', 'app/src/lib/console/client.ts', 'docs/trust/PASSWORD-SESSION-AND-MFA-STANDARD.md'],
    fix: 'Add student-facing enrolment and passkeys; record Supabase Auth settings; test recovery and every production provider console.',
    moves: ['TC-SEC-10', 'TC-SEC-11'],
    files: 'The database boundary is checked; the remaining work is student/passkey flows and recorded production configuration.',
  },
  {
    id: 'TR-14', before: 'pilot', owner: 'security', effort: 'M', needs: ['TR-12'],
    title: 'Make break-glass change what it can reach',
    finding: 'private.break_glass_active is consumed by nothing, yet the operations console map marks break-glass done.',
    sources: ['supabase/console-control-plane.check.sql', 'docs/OPERATIONS-CONSOLE-MAP.md'],
    fix: 'Either consume it in has_capability with a check that the widened read happens only inside scope and expiry, or relabel the map "record only".',
    moves: ['TC-SEC-09'],
    files: 'Exercise TT-08.',
  },
  {
    id: 'TR-15', before: 'pilot', owner: 'security', effort: 'M',
    title: 'Static analysis, Deno dependency updates and function behaviour tests',
    finding: 'No CodeQL or Semgrep runs, Dependabot does not cover Deno imports, video, pipeline or packages, and the Edge Function registry proves a guard is present rather than that it works.',
    sources: ['.github/dependabot.yml', 'docs/trust/SECURITY-TESTING-PLAN.md'],
    fix: 'Add a code-scanning workflow on pull requests; extend the update configuration; give each of the sixteen functions a test of its own verification, not only the registry entry.',
    moves: ['TC-SEC-06', 'TC-SEC-04'],
    files: 'The first scan result.',
  },
  {
    id: 'TR-16', before: 'pilot', owner: 'security', effort: 'L', person: true, needs: ['TR-12', 'TR-19'],
    title: 'Independent penetration test and authenticated scan',
    finding: 'Never performed; the dynamic scan covers a static preview only.',
    sources: ['docs/trust/PENETRATION-TEST-PLAN.md', 'stackhawk.yml'],
    fix: 'Engage a firm against a non-production project with the gateway deployed; point the dynamic scan at it with credentials; close findings on the stated clocks.',
    moves: ['TC-SEC-07', 'TC-SEC-16'],
    files: 'The summary report and the closure list.',
  },
  {
    id: 'TR-17', before: 'pilot', owner: 'engineering', effort: 'M',
    title: 'Serve the security headers',
    finding: 'HSTS, frame-ancestors and the content policy header are specified for hosts that do not serve production; GitHub Pages sends none.',
    sources: ['app/vercel.json', 'app/public/_headers', 'app/src/lib/hostheaders.test.ts'],
    fix: 'Move production to a host that sends them, or front Pages with one; add a smoke that reads the live response headers.',
    moves: ['TC-SEC-14'],
    files: 'The live header capture.',
  },
  {
    id: 'TR-18', before: 'pilot', owner: 'engineering', effort: 'M',
    title: 'Close tenant scoping of classmates, rooms and groups',
    finding: 'G-03 is open, legacy tables are incomplete, FORCE ROW LEVEL SECURITY is declared nowhere, and the cross-layer isolation suite does not exist.',
    sources: ['docs/SECURITY-THREAT-MODEL.md', 'docs/security/ferpa-risk-and-permission-matrix.md', 'supabase/tenancy.check.sql'],
    fix: 'Key the three tables by tenant; add FORCE where the owner role is not the API role; add a test that spans cache, search, queue and storage.',
    moves: ['TC-SEC-01', 'TC-SEC-02'],
    files: 'The suite run.',
  },
  {
    id: 'TR-19', before: 'pilot', owner: 'engineering', effort: 'M',
    title: 'Deploy the gateway and configure its production probe',
    finding: 'The gateway is not deployed and the hourly institutional job is skipped for want of two URLs.',
    sources: ['.github/workflows/production-smoke.yml', 'app/api/institution/[...path].ts', 'docs/trust/APM-RUNBOOK.md'],
    fix: 'Deploy, set the two variables, and let the probe run; record the first day.',
    moves: ['TC-SEC-03', 'TC-REL-01', 'TC-AI-02'],
    files: 'The first status-history day for the gateway.',
  },
  {
    id: 'TR-20', before: 'pilot', owner: 'privacy', effort: 'L',
    title: 'Operator side of data-subject requests',
    finding: 'A request can be raised and nothing moves it: no identity verification step, no status transition, no overdue monitor.',
    sources: ['supabase/audit-and-subject-requests.check.sql', 'docs/DATA-RIGHTS-REQUEST-RUNBOOK.md', 'docs/DATA-RETENTION-EXPORT-DELETION.md'],
    fix: 'Build a service-role function and console screen to verify, assign, transition and complete a request, with an overdue alert at seven days, two days and overdue; rehearse quarterly.',
    moves: ['TC-PRV-04'],
    files: 'Exercise TT-06.',
  },
  {
    id: 'TR-21', before: 'pilot', owner: 'privacy', effort: 'M', person: true,
    title: 'Counsel decisions that block the privacy operations',
    finding: 'The request clock, retention periods, hold procedure, law-enforcement process and deletion-ledger decision are placeholders or drafts (requires qualified human counsel review).',
    sources: ['LEGAL-REVIEW-QUEUE.md', 'docs/legal-drafts/DATA-SUBJECT-REQUEST-PROCEDURE-DRAFT.md', 'docs/legal-drafts/LEGAL-HOLD-PROCEDURE-DRAFT.md', 'docs/legal-drafts/LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md'],
    fix: 'Take the queue items to counsel with the facts the drafts list; record each decision.',
    moves: ['TC-PRV-03', 'TC-PRV-04', 'TC-TSF-06'],
    files: 'The closed queue rows.',
  },
  {
    id: 'TR-22', before: 'pilot', owner: 'privacy', effort: 'M', person: true,
    title: 'Sign provider terms and approve subprocessors',
    finding: 'No provider terms are signed, regions and transfers are not verified, and deletion propagation has no evidence.',
    sources: ['docs/trust/PROVIDER-TERMS.md', 'docs/trust/DPA-CHECKLIST.md', 'docs/SUBPROCESSORS.md'],
    fix: 'Execute terms with each listed provider; file the region and retention settings; test a deletion at one provider.',
    moves: ['TC-PRV-08'],
    files: 'The executed terms index and the provider deletion record.',
  },
  {
    id: 'TR-23', before: 'pilot', owner: 'data', effort: 'M',
    title: 'Hold backup expiry and financial purges under a legal hold',
    finding: 'Nothing suspends provider backup expiry for a held scope and purge_financial_records() is not stated as hold-gated.',
    sources: ['supabase/legal-holds.check.sql', 'RETENTION.md'],
    fix: 'Gate the financial purge on tenant_is_held; document the backup-expiry procedure for a hold and rehearse it.',
    moves: ['TC-PRV-02'],
    files: 'The check and the rehearsal.',
  },
  {
    id: 'TR-24', before: 'pilot', owner: 'privacy', effort: 'M',
    title: 'Complete the owed privacy assessments',
    finding: 'Seven surfaces are assessed and seven are owed; sharing records no purpose or basis. The standalone Course Engine assessment is owed before activation.',
    sources: ['app/src/lib/governance/pia.ts', 'docs/trust/FERPA-CONSENT-WORKFLOW.md'],
    fix: 'Assess the owed surfaces, add purpose, basis and revocation reason columns to shares, and make revocation undeletable by the student.',
    moves: ['TC-PRV-05', 'TC-PRV-07'],
    files: 'The assessments.',
  },
  {
    id: 'TR-25', before: 'pilot', owner: 'accessibility', effort: 'M', person: true,
    title: 'Run the manual assistive-technology pass',
    finding: 'No dated manual result exists; nineteen criteria have no automated evidence.',
    sources: ['docs/accessibility/AT-PASS-PROTOCOL.md', 'docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md'],
    fix: 'Run the protocol on the golden path with screen reader, zoom, forced colours and voice control; file results and findings; repeat on every high-risk release.',
    moves: ['TC-A11-06'],
    files: 'docs/evidence/accessibility/ the filled protocol.',
  },
  {
    id: 'TR-26', before: 'pilot', owner: 'accessibility', effort: 'M',
    title: 'Widen automated accessibility coverage',
    finding: 'axe covers fifteen jsdom cases and cannot judge contrast or target size; search, directory, mail, ask, help, calls, the console and every signed-in or error state are outside it.',
    sources: ['app/src/a11y/axe.test.tsx', 'app/scripts/accessibility-smoke.mjs', 'app/scripts/targets-sweep.mjs'],
    fix: 'Run axe in the real browser smoke over every destination and state; add a 375 pixel width; move the target sweep into the nightly workflow; add a text-spacing check.',
    moves: ['TC-A11-01', 'TC-A11-04'],
    files: 'The expanded smoke output.',
  },
  {
    id: 'TR-27', before: 'pilot', owner: 'operations', effort: 'L', needs: ['TR-07'],
    title: 'Measure the service-level objectives',
    finding: 'No objective has a measured value; nothing feeds the error-budget calculator.',
    sources: ['app/src/lib/governance/error-budgets.ts', 'docs/engineering-operations/SLO-SLI-DRAFT.md'],
    fix: 'Define the event stream and denominators for the eight journeys, emit them, compute a first full month, and have the release review read the state.',
    moves: ['TC-REL-02'],
    files: 'The first measured month.',
  },
  {
    id: 'TR-28', before: 'pilot', owner: 'operations', effort: 'M', needs: ['TR-07'],
    title: 'Report client errors and alert on them',
    finding: 'No client error reporting exists; web vitals, API latency, queue depth and denials are not collected.',
    sources: ['docs/trust/APM-RUNBOOK.md', 'docs/trust/LOGGING-MONITORING-AND-ALERTING-STANDARD.md'],
    fix: 'Add privacy-minimized error reporting and the five alerts in docs/integrated-trust/RELIABILITY-PROGRAM.md.',
    moves: ['TC-REL-06'],
    files: 'A test alert reaching a named person.',
  },
  {
    id: 'TR-29', before: 'pilot', owner: 'operations', effort: 'S',
    title: 'Engage every switch and read-only mode in production',
    finding: 'Only the AI switch was ever engaged; read-only mode never was.',
    sources: ['docs/FEATURE-FLAG-REGISTRY.md', 'docs/engineering-operations/FEATURE-FLAG-AND-KILL-SWITCH-STANDARD.md'],
    fix: 'Exercise TT-05 and a drill per switch, in a stated window.',
    moves: ['TC-REL-05'],
    files: 'The drill records.',
  },
  {
    id: 'TR-30', before: 'pilot', owner: 'operations', effort: 'M', needs: ['TR-12'],
    title: 'Hold the first four quarters of exercises',
    finding: 'One document walkthrough has been held; sixteen game days are planned and none held.',
    sources: ['docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md', 'app/src/lib/governance/risk.ts'],
    fix: 'Run TT-01 to TT-12 on the calendar in docs/integrated-trust/TABLETOP-CALENDAR.md and file each.',
    moves: ['TC-INC-04', 'TC-INC-03'],
    files: 'One file per exercise.',
  },
  {
    id: 'TR-31', before: 'pilot', owner: 'security', effort: 'M', needs: ['TR-12'],
    title: 'Adopt the drafted threat models',
    finding: 'Uploads, family, marketplace, mobile, career, community and support had no threat model; the package drafts them.',
    sources: ['docs/integrated-trust/THREAT-MODELS.md', 'docs/SECURITY-THREAT-MODEL.md'],
    fix: 'The security and privacy seats review each, tie every high row to a test or check, and mark the cell held.',
    moves: ['TC-SEC-02', 'TC-TSF-08'],
    files: 'The reviewed models.',
  },
  {
    id: 'TR-32', before: 'pilot', owner: 'engineering', effort: 'M',
    title: 'Meter AI by cost and read tenant policy in the function',
    finding: 'The AI function counts calls, not cost, and does not read the tenant AI policy; prompts are not redacted for personal data.',
    sources: ['supabase/functions/claude/index.ts', 'docs/trust/AI-RISK-ASSESSMENT.md'],
    fix: 'Meter tokens, read ai_policy before a call, redact the documented identifiers, and pin the model identifier.',
    moves: ['TC-AI-01', 'TC-AI-02'],
    files: 'The tests and a run.',
  },
  {
    id: 'TR-33', before: 'pilot', owner: 'trust', effort: 'M',
    title: 'Repeat the adversarial AI run as a gate',
    finding: 'One run of twenty-one cases on one model through the shared-key route; not part of any gate.',
    sources: ['docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json', 'docs/trust/MODEL-AND-PROMPT-CHANGE-MANAGEMENT.md'],
    fix: 'Add tenant, family and record-reading cases; run on every model or prompt change and file the result.',
    moves: ['TC-AI-04'],
    files: 'The run, per change.',
  },
  {
    id: 'TR-34', before: 'pilot', owner: 'trust', effort: 'M',
    title: 'Log moderator reads and make case events immutable',
    finding: 'Reading the queue or a case is not logged; case events can be edited and are deleted with the case; cases have no assignee or clock.',
    sources: ['docs/COMMUNITIES-REGISTER.md', 'supabase/community.check.sql'],
    fix: 'Log reads, add an immutability trigger, add assignee and due time with a stale-case alert.',
    moves: ['TC-TSF-01', 'TC-TSF-02'],
    files: 'The extended check.',
  },
  {
    id: 'TR-35', before: 'pilot', owner: 'engineering', effort: 'S', person: true,
    title: 'Gate Community join and post on minor status',
    finding: 'The Community migration does not reference minor status; only discovery, matching and mentoring are gated.',
    sources: ['supabase/minimum-age.check.sql', 'supabase/community.check.sql'],
    fix: 'Decide the posture with counsel, then enforce it in SQL with a check.',
    moves: ['TC-PRV-06'],
    files: 'The check.',
  },
  {
    id: 'TR-36', before: 'pilot', owner: 'trust', effort: 'L', person: true, needs: ['TR-12'],
    title: 'Build and counsel the community safety prerequisites',
    finding: 'No escalation sender, scanner, hash provider, abuse-material reporting, takedown clock or staffed coverage exists.',
    sources: ['docs/COMMUNITY-MEDIA-SAFETY.md', 'docs/CAMPUS-ESCALATION-POLICY.md', 'supabase/functions/_shared/escalation.ts'],
    fix: 'Write the two functions, sign an agreement and a hash-provider arrangement, take the reporting section to counsel, and run TT-11 before enabling.',
    moves: ['TC-TSF-03', 'TC-TSF-04', 'TC-TSF-05'],
    files: 'The community-safety tabletop and counsel record.',
  },
  {
    id: 'TR-37', before: 'pilot', owner: 'success', effort: 'M',
    title: 'Name the support owner and hours, and set ticket retention',
    finding: 'Tickets are behind a flag that is off; no owner or hours; no closed-ticket retention.',
    sources: ['docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md', 'supabase/support-tickets.check.sql'],
    fix: 'Staff the queue, publish hours in plain terms, switch the flag on for the pilot, and add the retention period.',
    moves: ['TC-SUP-02'],
    files: 'The first week of queue figures.',
  },
  {
    id: 'TR-38', before: 'pilot', owner: 'security', effort: 'S',
    title: 'Assert that impersonation does not exist',
    finding: 'The absence of staff impersonation is true and unguarded.',
    sources: ['docs/OPERATIONS-CONSOLE-MAP.md', 'app/src/lib/ops/boundaries.ts'],
    fix: 'Add a database check that no function lets one account read as another outside the grant tables.',
    moves: ['TC-SUP-03'],
    files: 'The check.',
  },
  {
    id: 'TR-39', before: 'pilot', owner: 'trust', effort: 'M',
    title: 'Deliver incident messages and give a message a record',
    finding: 'The composer builds text; no subscriber list or delivery exists and posting means editing JSON and waiting for a deploy.',
    sources: ['app/src/lib/governance/incident-comms.ts', 'app/public/status-incidents.json'],
    fix: 'Add a send path to a test list and an institution contact list with delivery receipts; record each message sent against its incident.',
    moves: ['TC-INC-01', 'TC-INC-02'],
    files: 'Exercise TT-12 sends.',
  },
  {
    id: 'TR-40', before: 'pilot', owner: 'accessibility', effort: 'S',
    title: 'Caption the remaining audio and video',
    finding: 'Forty-eight caption files against fifty-two audio files; video has none.',
    sources: ['app/scripts/captions.ts', 'app/src/lib/webvtt.test.ts'],
    fix: 'Generate the four missing files and have the test require one per media file; caption or transcribe the video.',
    moves: ['TC-A11-07'],
    files: 'The extended test.',
  },

  {
    id: 'TR-49', before: 'pilot', owner: 'engineering', effort: 'M', needs: ['TR-12'],
    title: 'Make the combined risk review a release gate',
    finding: 'evaluate() in riskreview.ts is read by its own test and by whoever runs a release; no release profile, workflow or activation check consults it, and none of the governance evaluators is wired to CI.',
    sources: ['app/src/lib/ops/riskreview.ts', 'app/src/lib/governance/release-profiles.ts', 'app/src/lib/governance/activation-control-plane.ts'],
    fix: 'Add a combined-risk-review gate to the technical release gates, resolved through gateFor() for the capabilities a profile names, and have a high-risk activation read it; regenerate the profile register.',
    moves: ['TC-PRV-07'],
    files: 'The regenerated release-profile register.',
  },

  // ── Before an institution is charged ──
  {
    id: 'TR-41', before: 'paid', owner: 'engineering', effort: 'L', needs: ['TR-19'],
    title: 'Load beyond the database',
    finding: 'The harness is database only; the full-stack run has never been run; there is no browser soak, no large-tenant or many-small-tenants case, no upload or AI cost load; the plans scenario still misses its budget intermittently.',
    sources: ['docs/LOAD-AND-SOAK.md', 'docs/LOAD-HARNESS-OPEN-ISSUE-PLANS-P95.md', 'docs/engineering-operations/CAPACITY-AND-SCALING-PLAN.md'],
    fix: 'Run edge.mjs against a branch, add the missing shapes, find the cause of the plans miss, and re-read the capacity figure after the push speed-up.',
    moves: ['TC-REL-03'],
    files: 'The measured capacity record.',
  },
  {
    id: 'TR-42', before: 'paid', owner: 'finance', effort: 'M', person: true, needs: ['TR-27'],
    title: 'Decide what is committed to customers',
    finding: 'The SLA is not started as a commitment, its numbers differ from the objectives, and the trust documents authorize no clock.',
    sources: ['docs/trust/SLA.md', 'app/src/lib/sla.ts', 'app/src/lib/governance/error-budgets.ts'],
    fix: 'After a measured quarter, reconcile the SLA to the objectives, decide the credit schedule and support hours, and have counsel review.',
    moves: ['TC-REL-02'],
    files: 'The approved SLA and decision record.',
  },
  {
    id: 'TR-43', before: 'paid', owner: 'security', effort: 'M',
    title: 'Keep incident evidence beyond the provider window',
    finding: 'Provider logs are kept a month and the access log ninety days; there is no protected evidence store or chain of custody.',
    sources: ['SECURITY.md', 'docs/trust/INCIDENT-RESPONSE-PLAN.md'],
    fix: 'Export audit and function logs to a write-once store on a schedule; write the custody procedure and rehearse it in TT-01.',
    moves: ['TC-INC-04'],
    files: 'The first export and the custody record.',
  },
  {
    id: 'TR-44', before: 'paid', owner: 'trust', effort: 'M',
    title: 'Publish moderation figures from a verified process',
    finding: 'No transparency reporting exists, and the draft procedure forbids publishing any figure without a verified reporting process.',
    sources: ['docs/legal-drafts/LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md'],
    fix: 'Define each figure from the case tables, verify against a sample by hand, and publish quarterly once Community is on.',
    moves: ['TC-TSF-07'],
    files: 'The first verified report.',
  },
  {
    id: 'TR-45', before: 'paid', owner: 'privacy', effort: 'L',
    title: 'One full-account export, including device data',
    finding: 'No single export file exists and device-only content is outside it.',
    sources: ['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'supabase/deletion.check.sql'],
    fix: 'Add the device bundle to the export and a signed, expiring delivery with an accessible format.',
    moves: ['TC-PRV-01'],
    files: 'The export check.',
  },
  {
    id: 'TR-46', before: 'paid', owner: 'engineering', effort: 'S',
    title: 'Enforce the branch ruleset and a second reviewer',
    finding: 'The ruleset is not active and CODEOWNERS names one person, so self-review is impossible.',
    sources: ['.github/rulesets/main.json', 'docs/BRANCH-PROTECTION.md'],
    fix: 'Apply the ruleset once a second reviewer exists.',
    moves: ['TC-SEC-15'],
    files: 'The live ruleset capture.',
  },

  // ── Before a broad enterprise sale ──
  {
    id: 'TR-47', before: 'enterprise', owner: 'security', effort: 'L', person: true, needs: ['TR-16', 'TR-27'],
    title: 'An independent attestation',
    finding: 'SOC 2 and ISO 27001 are readiness assessments, HECVAT and VPAT are drafts, and no ACR exists.',
    sources: ['docs/trust/SOC2-READINESS.md', 'docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md', 'docs/market-readiness/HECVAT_READINESS.md'],
    fix: 'Engage an auditor for a type I report, an accessibility assessor for an ACR, and complete the HECVAT from filed evidence.',
    moves: ['TC-A11-06', 'TC-SEC-16'],
    files: 'The reports, with their scope stated.',
  },
  {
    id: 'TR-48', before: 'enterprise', owner: 'trust', effort: 'L', person: true,
    title: 'Marketplace prerequisites before any marketplace',
    finding: 'No orders, payouts, seller verification, buyer-seller disputes or listing reports exist; the register defers it.',
    sources: ['docs/COMMUNITIES-REGISTER.md', 'ops/strategic-boundaries/README.md'],
    fix: 'Treat the controls in docs/integrated-trust/TRUST-AND-SAFETY.md as entry criteria; build none of the commerce before they exist.',
    moves: ['TC-TSF-08'],
    files: 'The completed entry criteria.',
  },
];

export const item = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);

export const priority = (i: Item): 'P0' | 'P1' | 'P2' | 'P3' => PRIORITY[i.before];

export const open = (): readonly Item[] => ITEMS.filter((i) => !i.done);

/** A dependency order: every item after the ones it needs; ties by id. Throws on a cycle. */
export function inOrderOfWork(): Item[] {
  const out: Item[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (i: Item) => {
    const s = state.get(i.id);
    if (s === 'done') return;
    if (s === 'visiting') throw new Error(`cycle through ${i.id}`);
    state.set(i.id, 'visiting');
    for (const n of i.needs ?? []) {
      const d = item(n);
      if (d) visit(d);
    }
    state.set(i.id, 'done');
    out.push(i);
  };
  for (const i of [...ITEMS].sort((a, b) => POINTS.indexOf(a.before) - POINTS.indexOf(b.before) || a.id.localeCompare(b.id))) visit(i);
  return out;
}
