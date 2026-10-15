/**
 * Incident playbooks and the calendar that rehearses them.
 *
 * Four severity scales are in use at once across the trust, engineering and
 * security documents (P0–P3, SEV1–SEV4, Critical/High/Medium/Low, and the
 * community P0–P3 that routes to professionals). `incident-recovery.ts` is the
 * only one a test holds, and it is `SEV1`–`SEV4`, with a suspected cross-tenant
 * scope required to be `SEV1`. This file keeps that scale and lays the others
 * against it, instead of adding a fifth. The crosswalk is a proposal: choosing
 * the scale is the founder's decision, and until it is made the documents keep
 * disagreeing.
 *
 * Nothing here promises a response time to a customer. The trust documents say
 * no acknowledgement or update clock is authorized (one person holds every
 * role, with no rota), so the times below are internal targets the exercise
 * calendar tests, and `incident-comms.ts` keeps its own update intervals.
 *
 * Every playbook names the controls in `trustcontrols.ts` it leans on. A
 * playbook that leans on a control that is `absent` says so in the control's
 * gap, which is the honest place for it: the exercise will find it the first
 * time it is run.
 */

import type { Audience } from '../governance/incident-comms';
import type { IncidentSeverity } from '../incident-recovery';
import type { Seat } from '../launchreadiness';

export const SEVERITIES: readonly IncidentSeverity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];

export interface SeverityRow {
  severity: IncidentSeverity;
  means: string;
  /** The P-scale rows in APM-RUNBOOK, ON-CALL-AND-ESCALATION-POLICY and the deployment runbook. */
  pScale: string;
  /** The fix-clock words in SECURITY.md. */
  securityPolicy: string;
  /** The audit's SEV-0 to SEV-4 scale, which has one more rung at the top. */
  audit: string;
  /** Internal first-look target, not a promise. */
  firstLookTarget: string;
}

export const CROSSWALK: readonly SeverityRow[] = [
  {
    severity: 'SEV1',
    means: 'Suspected or confirmed cross-tenant exposure, a confirmed breach, an official record or grade changed without authority, or a broad outage of sign-in, submissions or registration.',
    pScale: 'P0',
    securityPolicy: 'Critical',
    audit: 'SEV-0 (breach, exposure, record integrity) and SEV-1 (broad outage)',
    firstLookTarget: 'Same hour while a person is reachable',
  },
  {
    severity: 'SEV2',
    means: 'A core workflow broken for many users, one major tenant or integration down, or a privacy or safety event with limited scope.',
    pScale: 'P1',
    securityPolicy: 'High',
    audit: 'SEV-2',
    firstLookTarget: 'Same business day',
  },
  {
    severity: 'SEV3',
    means: 'A limited function broken with a workaround, a degraded integration, or an accessibility regression on a non-critical path.',
    pScale: 'P2',
    securityPolicy: 'Medium',
    audit: 'SEV-3',
    firstLookTarget: 'Next business day',
  },
  {
    severity: 'SEV4',
    means: 'A cosmetic or low-impact defect, or a question.',
    pScale: 'P3',
    securityPolicy: 'Low',
    audit: 'SEV-4',
    firstLookTarget: 'Planned triage',
  },
];

export interface Playbook {
  id: string;
  title: string;
  /** What first tells us. */
  trigger: string;
  defaultSeverity: IncidentSeverity;
  /** Which message template in `incident-comms.ts` the communication uses. */
  audience: Audience;
  /** Stop the damage; each step is reversible or says so. */
  contain: readonly string[];
  /** Find out who, what, how much, and since when. */
  investigate: readonly string[];
  /** Restore and prove it. */
  recover: readonly string[];
  /** What is preserved and where, before anything is changed. */
  evidence: readonly string[];
  /** A decision on notification, contracts or law is needed (requires qualified human counsel review). */
  counsel: boolean;
  commander: Seat;
  /** Seats that must be in the room. */
  seats: readonly Seat[];
  /** Controls from trustcontrols.ts the playbook relies on. */
  controls: readonly string[];
  /** The kill switch or mode that contains it, if there is one. */
  lever?: string;
  /** What is true about running this today, drawn from the register. */
  today: string;
}

export const PLAYBOOKS: readonly Playbook[] = [
  {
    id: 'IR-01',
    title: 'Suspected cross-tenant access',
    trigger: 'A row-level-security alert, an unusual query pattern, an audit anomaly, or a report from a user or institution.',
    defaultSeverity: 'SEV1',
    audience: 'security',
    contain: [
      'Engage the narrowest kill switch that stops the path (kill.integration_sync, kill.sharing, or the affected connection), then the global one if the path is unknown.',
      'Revoke active sessions and tokens if account compromise is possible.',
      'Pause background jobs and exports that use the same path.',
    ],
    investigate: [
      'Name tenant A, tenant B, the data classes, the records and the time window.',
      'Decide whether the exposure was viewed, exported, modified or automated.',
      'Inspect connection-pool and session-context behaviour, then cache, search, analytics and support-tool paths.',
    ],
    recover: [
      'Patch the authorization fault and add the regression to the database suite.',
      'Run the cross-tenant scan for the same class of control across every table and function.',
      'Validate through production-like roles and pooled connections.',
    ],
    evidence: [
      'Request ids and deployment version for the window.',
      'audit_event, console_audit_event and access_log rows for both tenants, exported read-only.',
      'Database query statistics and function logs before the one-month provider log retention expires.',
    ],
    counsel: true,
    commander: 'founder',
    seats: ['founder', 'security', 'engineering', 'privacy'],
    controls: ['TC-SEC-01', 'TC-SEC-02', 'TC-REL-05'],
    lever: 'feature_kill_switch (global or per school)',
    today: 'Contained only by the switches; no alert detects it, and log retention caps how far back it can be scoped.',
  },
  {
    id: 'IR-02',
    title: 'Compromised account or credential stuffing',
    trigger: 'Impossible travel, an unusual device, a user report, a leaked-credential signal, or a spike in failed sign-ins.',
    defaultSeverity: 'SEV2',
    audience: 'security',
    contain: [
      'Sign the account out of other devices; require reauthentication and recovery verification.',
      'Disable high-risk actions on the account (payment, record changes, shares).',
      'For a spike, engage the invite-only door (set_invite_only) while sign-in limits are tuned.',
    ],
    investigate: [
      'Establish the compromised window from sign-in, device and activity records.',
      'List data read, exports, role changes and connected accounts.',
      'Look for persistence: new multi-factor factors, recovery changes, tokens, delegated access, shares.',
    ],
    recover: [
      'Restore verified control to the owner.',
      'Reverse unauthorized changes through the correction workflow, not by direct edit.',
      'Notify the user and, if an institution account, the tenant, as counsel advises.',
    ],
    evidence: ['Sign-in, device and activity records for the account.', 'Share, grant and request rows created in the window.'],
    counsel: true,
    commander: 'security',
    seats: ['security', 'engineering', 'success'],
    controls: ['TC-SEC-10', 'TC-SEC-11', 'TC-SUP-01'],
    lever: 'sign out other devices; invite-only door',
    today: 'There is no session list and no global revoke procedure; students have no multi-factor option.',
  },
  {
    id: 'IR-03',
    title: 'Official record or grade integrity',
    trigger: 'An unexpected grade or record change, a reconciliation mismatch, a faculty or registrar report, or an audit anomaly.',
    defaultSeverity: 'SEV1',
    audience: 'privacy',
    contain: [
      'Freeze the affected record workflow or grade-release job.',
      'Preserve before and after versions, approvals, integrations and actor identities.',
      'Do not overwrite or repair a record before the evidence is held.',
    ],
    investigate: [
      'Was the change authorized, correct, duplicated, malicious or caused by sync?',
      'Check source-of-truth precedence and connector mappings.',
      'List every affected student, term, section and downstream system.',
    ],
    recover: [
      'Correct through a formal workflow with documented authority.',
      'Notify the institutional owners; reconcile with the authoritative source and verify downstream systems.',
      'Add the invariant or contract test for the failure.',
    ],
    evidence: ['Ledger rows and their chain and seal status.', 'Human-override log entries.', 'Connector job ids and mapping version.'],
    counsel: true,
    commander: 'founder',
    seats: ['founder', 'data', 'engineering', 'privacy'],
    controls: ['TC-SEC-12', 'TC-SEC-08', 'TC-INC-01'],
    lever: 'kill.writeback',
    today: 'The ledger chains detect tampering; no live write-back adapter is registered, so the realistic case is a sandbox or manual import.',
  },
  {
    id: 'IR-04',
    title: 'AI data leak, unsafe advice or policy bypass',
    trigger: 'The assistant reveals protected information, acts or proposes an action it should not, cites an unauthorized source, or follows planted instructions.',
    defaultSeverity: 'SEV2',
    audience: 'ai_quality',
    contain: [
      'Engage kill.ai_generation for the tenant or globally; the switch fails closed.',
      'Preserve prompts, context-assembly logs, policy decisions, tool calls, sources and outputs.',
      'Stop automated follow-on actions and prevent replay.',
    ],
    investigate: [
      'Classify affected data and users.',
      'Was the fault retrieval filtering, policy, tool authorization, model output, prompt injection, provider behaviour or interface ambiguity?',
      'Examine related prompts and feature cohorts.',
    ],
    recover: [
      'Patch the policy, retrieval or tool boundary.',
      'Add the case to the adversarial suite and re-run the whole suite on the current model before re-enabling.',
      'Notify affected parties under the approved privacy and legal process.',
    ],
    evidence: ['The AI audit journal for the window (metadata only, 180 days).', 'The model identifier and route in use.'],
    counsel: true,
    commander: 'trust',
    seats: ['trust', 'engineering', 'privacy', 'founder'],
    controls: ['TC-AI-01', 'TC-AI-02', 'TC-AI-04', 'TC-REL-05'],
    lever: 'kill.ai_generation',
    today: 'The only switch ever drilled against production (29 September); the release step needs a second reviewer who is unassigned.',
  },
  {
    id: 'IR-05',
    title: 'Integration failure or bad synchronization',
    trigger: 'A connector health state of failed or mismatched, a reconciliation discrepancy, a schema drift, or an institution report.',
    defaultSeverity: 'SEV3',
    audience: 'integration_delay',
    contain: [
      'Disable the connection (kill.connection.<id>) so dependent automation stops; native data stays available.',
      'Quarantine automated changes from the affected source; never overwrite silently.',
    ],
    investigate: [
      'Last successful sync, source system, mapping version and counts.',
      'Whether any record was written back, and whether a retry could repeat an uncertain write.',
    ],
    recover: [
      'Fix the mapping or credential; replay through the sandbox, then a limited cohort.',
      'Reconcile counts and samples against the source before re-enabling.',
    ],
    evidence: ['Connection id, job ids, error journal and reconciliation report.'],
    counsel: false,
    commander: 'engineering',
    seats: ['engineering', 'success', 'champion'],
    controls: ['TC-SEC-02', 'TC-REL-01'],
    lever: 'kill.connection.<public id>',
    today: 'The adapter registry is empty and the institutional probe is unconfigured, so this is rehearsable against fixtures only.',
  },
  {
    id: 'IR-06',
    title: 'Platform outage, failed deploy or migration',
    trigger: 'The hourly probe fails, a deploy workflow fails, a migration deploy reports failure, or users report.',
    defaultSeverity: 'SEV2',
    audience: 'student_outage',
    contain: [
      'Stop further deploys; roll the page back through the pages workflow (measured 76 to 180 seconds).',
      'For a function fault, redeploy the previous function version.',
      'Engage read-only mode to protect data while the cause is found.',
    ],
    investigate: [
      'Deploy, migration and function logs for the first failing change.',
      'Whether data was written during the fault.',
    ],
    recover: [
      'The schema cannot roll back; recover forward with a corrective migration reviewed like any other.',
      'Verify with the production smoke and the status history; post the resolution.',
    ],
    evidence: ['The deploy run, migration ledger rows and function logs.'],
    counsel: false,
    commander: 'engineering',
    seats: ['engineering', 'operations'],
    controls: ['TC-REL-01', 'TC-REL-04', 'TC-INC-02'],
    lever: 'VITE_READ_ONLY (deploy), SEMESTER_READ_ONLY (gateway)',
    today: 'A migration deploy once failed silently for three days (18 to 21 September); read-only mode has never been engaged against production.',
  },
  {
    id: 'IR-07',
    title: 'Data loss and provider restore',
    trigger: 'Rows or tables missing or corrupted, a dropped object, or a provider incident affecting the database.',
    defaultSeverity: 'SEV1',
    audience: 'student_outage',
    contain: [
      'Engage read-only mode; stop jobs that write.',
      'Take a copy of the damaged state before any restore.',
    ],
    investigate: [
      'Determine the loss window and which tables are affected.',
      'Choose logical restore of named tables or provider point-in-time recovery into a second project.',
    ],
    recover: [
      'Restore into the second project, compare fingerprints, row counts and row-level security, then repoint or copy back.',
      'Replay deletions that fall inside the restore window (there is no deletion ledger by decision D-124).',
      'Record the measured recovery time and point.',
    ],
    evidence: ['Provider backup listing, restore logs and the comparison output.'],
    counsel: true,
    commander: 'operations',
    seats: ['operations', 'engineering', 'data', 'privacy'],
    controls: ['TC-REL-04', 'TC-PRV-02'],
    lever: 'read-only mode',
    today: 'Point-in-time recovery has never been restored; no recovery time or point objective exists; the second operator for a production restore is unassigned.',
  },
  {
    id: 'IR-08',
    title: 'Staff or support access misuse',
    trigger: 'An audit anomaly, a student report that a supporter saw something, an unreviewed break-glass grant, or a staff departure.',
    defaultSeverity: 'SEV2',
    audience: 'privacy',
    contain: [
      'Revoke the staff member\'s grants and sessions; end open break-glass and support grants.',
      'Hold the audit rows for the person and the period.',
    ],
    investigate: [
      'Everything the person read or changed, through support_access_event, console_audit_event and role-grant audit.',
      'Whether any student was told, as the student-visible log intends.',
    ],
    recover: [
      'Correct any change through the governed workflow; tell affected students and institutions as counsel advises.',
      'Add the missing review or control the incident exposed.',
    ],
    evidence: ['Support access events, console audit chain, role-grant audit and break-glass review rows.'],
    counsel: true,
    commander: 'security',
    seats: ['security', 'privacy', 'founder'],
    controls: ['TC-SEC-08', 'TC-SEC-09', 'TC-SUP-01', 'TC-TSF-02'],
    today: 'Break-glass is a record with no access effect; ordinary reviewer reads are not logged; the security seat is vacant.',
  },
  {
    id: 'IR-09',
    title: 'Community safety: threat, self-harm, abuse material',
    trigger: 'A P0 or P1 case, a crisis-language detection, a media match to known abuse, or a report of harm to a minor.',
    defaultSeverity: 'SEV1',
    audience: 'community_safety',
    contain: [
      'Preserve the content and its metadata; do not delete a known-abuse match (every deletion path exempts it).',
      'Withdraw distribution; restrict the account only through the two-person path for P0.',
      'Route to the professional named in the escalation policy; show the student the support resources. Semester is not an emergency service.',
    ],
    investigate: ['The case timeline, the reporter count and signals, and the author\'s history, through the logged reveal path only.'],
    recover: [
      'Decide and notify with the reason code; the author may appeal to a different reviewer.',
      'Record the outcome and any report made.',
    ],
    evidence: ['The case, its events, the decision and, for media, both hashes.'],
    counsel: true,
    commander: 'trust',
    seats: ['trust', 'privacy', 'founder'],
    controls: ['TC-TSF-01', 'TC-TSF-02', 'TC-TSF-03', 'TC-TSF-04', 'TC-TSF-05'],
    lever: 'community and image-post switches (off in production)',
    today: 'Community is held off. Escalation delivery, the image scanner, abuse-material reporting and any 24-hour coverage do not exist, so this playbook cannot be run live and Community must not be enabled until it can.',
  },
  {
    id: 'IR-10',
    title: 'Payment or billing error',
    trigger: 'A double charge, a forged or failed webhook, a chargeback, a wrong entitlement, or a refund request that cannot be explained.',
    defaultSeverity: 'SEV2',
    audience: 'student_outage',
    contain: [
      'Hold new checkout (the individual paid acquisition switch is code-held off).',
      'Do not retry an uncertain write; reconcile against the processor first.',
    ],
    investigate: ['Webhook signature and timing, payment events and invoices for the account, and processor records.'],
    recover: ['Refund or credit through the governed path; correct the entitlement; reconcile the ledger.'],
    evidence: ['payment_events, invoices and processor event ids.'],
    counsel: true,
    commander: 'finance',
    seats: ['finance', 'engineering', 'success'],
    controls: ['TC-SEC-12', 'TC-SEC-04'],
    lever: 'billing-checkout hold',
    today: 'Live billing was accepted on 3 October; refund, tax and consumer-payment questions are in the legal review queue.',
  },
  {
    id: 'IR-11',
    title: 'Accessibility barrier on a critical journey',
    trigger: 'A user report, a failed nightly sweep, or a regression in a keyboard or screen-reader path on sign-in, Today, Courses, Work, Registration or Degree.',
    defaultSeverity: 'SEV3',
    audience: 'accessibility',
    contain: [
      'Offer the accessible alternative route immediately (a text path, an export, a person) and tell the user it exists.',
      'Disable the new interaction behind its flag if a prior accessible path exists.',
    ],
    investigate: ['Reproduce with the assistive technology and browser the user named; capture steps, never screenshots without consent.'],
    recover: ['Fix, add the regression guard, and re-run the affected journey in the smoke and the manual protocol row.'],
    evidence: ['The report, reproduction steps, the fix and the guard.'],
    counsel: false,
    commander: 'accessibility',
    seats: ['accessibility', 'engineering', 'success'],
    controls: ['TC-A11-01', 'TC-A11-02', 'TC-A11-04', 'TC-A11-06'],
    today: 'A barrier is reported by email to one person; no response time is promised.',
  },
  {
    id: 'IR-12',
    title: 'Privacy request failure or over-deletion',
    trigger: 'A request past its due date, an erasure that touched a held account, a deletion that removed something it should not, or a request with a disputed identity.',
    defaultSeverity: 'SEV2',
    audience: 'privacy',
    contain: [
      'Stop the sweep or job involved; place or confirm the legal hold.',
      'Take no further action on a request whose requester has not been verified.',
    ],
    investigate: ['The request row, the hold state at the time, the sweep run record and what the erasure walked.'],
    recover: [
      'Restore from backup only within the provider window and only for what a hold required; otherwise record the loss.',
      'Tell the requester and, where a duty exists, the institution (requires qualified human counsel review).',
    ],
    evidence: ['data_subject_request rows, legal_holds, retention run records and audit events.'],
    counsel: true,
    commander: 'privacy',
    seats: ['privacy', 'data', 'engineering'],
    controls: ['TC-PRV-01', 'TC-PRV-02', 'TC-PRV-04'],
    today: 'No operator surface or overdue monitor handles a request; the thirty-day clock is a placeholder.',
  },
  {
    id: 'IR-13',
    title: 'Marketplace or partner fraud',
    trigger: 'A listing report, a partner complaint, a chargeback pattern, or a student reporting a harmful offer.',
    defaultSeverity: 'SEV2',
    audience: 'marketplace_sponsor',
    contain: ['Remove the listing and suspend the publisher role; hold payouts if any exist.'],
    investigate: ['The publisher\'s verification, every listing and every disclosure to students.'],
    recover: ['Notify affected students; add the screening rule.'],
    evidence: ['Listing history, moderation decisions and any disclosure snapshot.'],
    counsel: true,
    commander: 'trust',
    seats: ['trust', 'finance', 'founder'],
    controls: ['TC-TSF-08'],
    today: 'Only opportunity listings exist. Orders, payouts and seller verification do not, and the register keeps a marketplace deferred until they do.',
  },
  {
    id: 'IR-14',
    title: 'Key or secret compromise',
    trigger: 'A secret in a log, a repository or a bundle; a provider notice; a departing person with access.',
    defaultSeverity: 'SEV2',
    audience: 'security',
    contain: ['Rotate the secret at the provider first, then in the function environment; revoke the old one.'],
    investigate: ['Where it was exposed, for how long, and what it could read or write.'],
    recover: ['Record the rotation; for the journal key, re-encrypt (not yet possible: no key identifier).'],
    evidence: ['The exposure location and the provider\'s key-use log.'],
    counsel: true,
    commander: 'security',
    seats: ['security', 'engineering'],
    controls: ['TC-SEC-05', 'TC-SEC-13'],
    today: 'The rotation log is empty and has never been exercised; the gateway journal key cannot be rotated without losing history.',
  },
  {
    id: 'IR-15',
    title: 'Provider failure',
    trigger: 'The hosting, database, authentication, AI or payment provider reports an incident or the probe fails.',
    defaultSeverity: 'SEV3',
    audience: 'student_outage',
    contain: ['Switch to the documented degraded mode: saved workspace stays usable; official-system links replace connected data with a freshness label.'],
    investigate: ['The provider status, which components probed down, and what is queued locally.'],
    recover: ['Confirm sync drains with no duplicate; post the resolution.'],
    evidence: ['Status history rows and the provider notice.'],
    counsel: false,
    commander: 'operations',
    seats: ['operations', 'engineering'],
    controls: ['TC-REL-01', 'TC-INC-02'],
    today: 'The degraded-mode map exists; no failover provider exists for any component.',
  },
];

export const playbook = (id: string): Playbook | undefined => PLAYBOOKS.find((p) => p.id === id);

export type Form = 'tabletop' | 'game-day' | 'drill' | 'restore';

export interface Exercise {
  id: string;
  /** Weeks after the founder starts the programme; no calendar date is invented. */
  week: number;
  form: Form;
  playbooks: readonly string[];
  seats: readonly Seat[];
  /** What must be true for the exercise to count as having been held. */
  passes: string;
  /** The file it produces. `{date}` is the day it was held. */
  artifact: string;
  /** What it finds out that nothing yet has. */
  tests: string;
}

const EVIDENCE = 'docs/evidence/operations/{date}-';

export const EXERCISES: readonly Exercise[] = [
  {
    id: 'TT-01', week: 2, form: 'tabletop', playbooks: ['IR-01'], seats: ['founder', 'security', 'engineering'],
    passes: 'Walked through with the real contact tree and the real switch list; every step names who does it and what tool; every gap is a remediation item.',
    artifact: `${EVIDENCE}cross-tenant-tabletop.md`, tests: 'Whether anyone but the founder can contain a cross-tenant event.',
  },
  {
    id: 'TT-02', week: 4, form: 'drill', playbooks: ['IR-04'], seats: ['founder', 'engineering', 'trust'],
    passes: 'The AI switch engaged, observed refusing, released by a second reviewer, and the timeline filed.',
    artifact: `${EVIDENCE}ai-switch-two-person-drill.md`, tests: 'The two-person release rule, which has never been exercised because the second reviewer is unassigned.',
  },
  {
    id: 'TT-03', week: 6, form: 'restore', playbooks: ['IR-07'], seats: ['operations', 'engineering', 'data'],
    passes: 'A provider backup restored into a second project; fingerprints, row counts and row-level security compared; recovery time and point measured and recorded.',
    artifact: `${EVIDENCE}provider-restore-drill.md`, tests: 'The first measured recovery time and point; whether point-in-time recovery is bought.',
  },
  {
    id: 'TT-04', week: 8, form: 'tabletop', playbooks: ['IR-02', 'IR-14'], seats: ['security', 'engineering', 'success'],
    passes: 'Account takeover and secret rotation walked; a secret actually rotated and logged.',
    artifact: `${EVIDENCE}credential-incident-tabletop.md`, tests: 'Whether there is any way to sign every session out.',
  },
  {
    id: 'TT-05', week: 10, form: 'game-day', playbooks: ['IR-06', 'IR-15'], seats: ['engineering', 'operations'],
    passes: 'Read-only mode engaged on production for a stated window; page rollback performed; the status page posted and resolved through its validated file.',
    artifact: `${EVIDENCE}outage-game-day.md`, tests: 'The read-only switches and the incident posting path, neither of which has run in production.',
  },
  {
    id: 'TT-06', week: 12, form: 'tabletop', playbooks: ['IR-12'], seats: ['privacy', 'data', 'engineering'],
    passes: 'A synthetic request taken from intake to closure with a verified requester, a held account blocking it, and the due date monitored.',
    artifact: `${EVIDENCE}privacy-request-tabletop.md`, tests: 'The operator side of the request workflow, which does not yet exist.',
  },
  {
    id: 'TT-07', week: 14, form: 'tabletop', playbooks: ['IR-03', 'IR-10'], seats: ['founder', 'data', 'finance'],
    passes: 'A record-integrity and a billing-error scenario walked against the ledger and processor records.',
    artifact: `${EVIDENCE}record-and-billing-tabletop.md`, tests: 'Whether the correction workflow can be carried out by someone other than the author.',
  },
  {
    id: 'TT-08', week: 16, form: 'tabletop', playbooks: ['IR-08'], seats: ['security', 'privacy', 'founder'],
    passes: 'A staff-misuse scenario; the break-glass grant opened, reviewed by a different person, and the access effect observed.',
    artifact: `${EVIDENCE}staff-access-tabletop.md`, tests: 'Whether break-glass widens any access, which today it does not.',
  },
  {
    id: 'TT-09', week: 18, form: 'tabletop', playbooks: ['IR-11'], seats: ['accessibility', 'engineering', 'success'],
    passes: 'A reported barrier on a critical journey traced from email to fix, with the accessible alternative offered inside the exercise.',
    artifact: `${EVIDENCE}accessibility-incident-tabletop.md`, tests: 'Whether the barrier route reaches a person other than the founder.',
  },
  {
    id: 'TT-10', week: 20, form: 'tabletop', playbooks: ['IR-05'], seats: ['engineering', 'success', 'champion'],
    passes: 'A failed-sync scenario with an institution contact on the call, against fixtures.',
    artifact: `${EVIDENCE}integration-failure-tabletop.md`, tests: 'The first conversation with a customer contact.',
  },
  {
    id: 'TT-11', week: 22, form: 'tabletop', playbooks: ['IR-09'], seats: ['trust', 'privacy', 'founder'],
    passes: 'A self-harm and a known-abuse-media scenario walked with counsel and the campus safety contact; the result is a go or no-go on enabling Community.',
    artifact: `${EVIDENCE}community-safety-tabletop.md`, tests: 'Whether Community can be enabled at all.',
  },
  {
    id: 'TT-12', week: 26, form: 'game-day', playbooks: ['IR-01', 'IR-04', 'IR-07'], seats: ['founder', 'security', 'engineering', 'operations', 'privacy', 'trust'],
    passes: 'A staffed half-day with a scenario no participant has seen, communications drafted through the composer and sent to a test list, and the post-incident review held within five business days.',
    artifact: `${EVIDENCE}half-year-game-day.md`, tests: 'Everything together, including key-person absence: one named participant is told they are unavailable.',
  },
  {
    id: 'TT-13', week: 30, form: 'tabletop', playbooks: ['IR-13'], seats: ['trust', 'finance', 'founder'],
    passes: 'Run only if a marketplace is proposed; otherwise recorded as not applicable with the date.',
    artifact: `${EVIDENCE}marketplace-fraud-tabletop.md`, tests: 'Whether the marketplace controls exist before it is built.',
  },
];

/** The cadence after the first year. */
export const CADENCE = {
  monthly: 'One playbook, rotating, as a one-hour tabletop; the artifact is the findings list.',
  quarterly: 'One cross-functional exercise that includes a communication to a test list and a restore or switch drill.',
  yearly: 'A staffed game day, an external review of the playbooks, and a re-read of this calendar against the register.',
  perRelease: 'A high-risk release rehearses the lever of the playbook it could trigger.',
} as const;
