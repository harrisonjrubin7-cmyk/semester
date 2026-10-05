/**
 * Launch completeness: three documents of 29 September 2026 held to the tree.
 *
 * The *University Launch Readiness, HECVAT, Data Migration, and Pilot Contract
 * Playbook*, its one-page summary, and the answer to "anything else missing or
 * needing refinement for the company, site, application, market, launch and
 * contracts" are kept under `docs/expansion/` as supplied. Between them they
 * ask for a HECVAT tracker with an owner and evidence on every row, a
 * registration and an LMS go-live checklist, a student-data migration
 * playbook, a first pilot agreement for a Registration and Path pilot, an SLA
 * and packaging matrix, a per-pilot command center, the company-wide go/no-go
 * gate, a claim register keyed on nine words, the pages the company site
 * needs, and one internal standard — the Semester Definition of Done.
 *
 * Most of that already exists somewhere on main, in pieces: HECVAT_READINESS
 * has thirty controls, the pilot outline has twenty-six sections, the claims
 * register has forty rows, the definer register holds every callable
 * function. What the briefs add is the join and a handful of things nothing
 * carries. So this is a crosswalk under D-108 and D-111: a supplied PDF is
 * never its own evidence, every cited file exists, and every standing is held
 * to the kind of file it cites.
 *
 * Two pages are rendered from this file by `launchcompleteness.test.ts`:
 * `docs/LAUNCH-COMPLETENESS.md` (the crosswalk) and
 * `docs/DEFINITION-OF-DONE.md` (the one standard the second brief asks for).
 * Edit the data, then `npm run registers` from app/.
 *
 * ## What is held to what
 *
 * - Every HECVAT row names a council seat in `SEATS` as its owner, and the id
 *   of the `HECVAT_READINESS.md` control it moves, or none.
 * - Every claim word names rows of `ops/claims.ts`, or says none exists.
 * - Every site page names a route of the app's site (`site/render.tsx`) and a
 *   path of the deployed company site (`company-site/sitemap.xml`), or none.
 * - Every package names a plan in `plans.ts` or a tier of the deal desk.
 * - Every command-center field names a `PilotPlan` field, or none.
 * - The pilot's 12–26 weeks is held to the code's exactly 26 (D-134).
 *
 * ## Due dates
 *
 * The first brief asks for an owner, a status, a due date and an evidence link
 * on every HECVAT row. The owner is a seat, the status is the standing and the
 * evidence is the cited files. The due date is left for the seat to set: a
 * date typed here by nobody who will meet it is the kind of claim the claims
 * register exists to refuse. The test holds any date that is set to an ISO
 * date after the reading.
 *
 * Standings were read at `origin/main` `ae4837c` on 29 September 2026.
 */

import type { Seat } from './launchreadiness';

export const READ_AT = { commit: 'ae4837c', date: '2026-09-29' } as const;

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/University-Launch-Readiness-HECVAT-Migration-and-Pilot-Contract-Playbook.pdf',
    title: 'Semester University Launch Readiness, HECVAT, Data Migration, and Pilot Contract Playbook',
    what: 'The go-live decision standard; the HECVAT preparation checklist in seven domains; the registration and LMS go-live checklists; the student-data migration playbook; the first pilot agreement outline; the SLA and packaging matrix; the go-live command center; the definition of done; ten next actions.',
  },
  {
    path: 'docs/expansion/University-Launch-Readiness-Audit-Summary.pdf',
    title: 'University launch readiness audit: HECVAT compliance, WCAG 2.2 accessibility, and a go-live checklist',
    what: 'What the playbook includes, and the five most important next actions.',
  },
  {
    path: 'docs/expansion/Complete-Company-Launch-Checklist.pdf',
    title: 'Anything else missing or needing further refinement — the complete-company checklist',
    what: 'Seven readiness areas; twelve core journeys and the states each needs; the launch acceptance rule; company foundation; fourteen public legal documents and eleven institutional ones; the Trust Room; the FERPA posture; onboarding, support and customer success; the claim register; the site pages and conversion points; operations, SLOs, revenue operations and contract boundaries; the thirty-one-line final gate; the Semester Definition of Done.',
  },
];

export const STANDINGS = ['tested', 'building', 'designed', 'not-started', 'held'] as const;
export type Standing = (typeof STANDINGS)[number];

export const STANDING_MEANING: Record<Standing, string> = {
  tested: 'An automated test or a database check holds the rule',
  building: 'Code carries some of it; the gap says what it does not',
  designed: 'A document says what it would be; nothing runs',
  'not-started': 'Nothing in the tree beyond a document naming the gap',
  held: 'A decision already on main answers it differently, and holds until the owner reopens it',
};

/** The files a `held` standing may cite: where decisions are written. */
export const DECISION_FILES: readonly string[] = [
  'docs/DECISION-LOG.md',
  'DECISIONS.md',
  'docs/DO-NOT-BUILD.md',
  'docs/LAUNCH-DECISIONS.md',
  'docs/PAID-PILOT-FRAMEWORK.md',
  'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md',
];

export interface Evidence {
  /** Repository-relative. The test fails if it does not exist. */
  path: string;
  shows: string;
}

export interface Item {
  /** Stable: `LC-<section>-nn`. */
  id: string;
  item: string;
  standing: Standing;
  evidence: Evidence[];
  /** What the tree lacks, or which decision holds. */
  gap: string;
}

type Ev = [path: string, shows: string][];
type Row = [item: string, standing: Standing, evidence: Ev, gap: string];

const ev = (list: Ev): Evidence[] => list.map(([path, shows]) => ({ path, shows }));
const id = (prefix: string, i: number) => `${prefix}-${String(i + 1).padStart(2, '0')}`;
const rows = (prefix: string, list: readonly Row[]): Item[] =>
  list.map(([item, standing, evidence, gap], i) => ({ id: id(prefix, i), item, standing, evidence: ev(evidence), gap }));

/** The weakest standing among items, `held` counting as answered. */
const RANK: Record<Standing, number> = { 'not-started': 0, designed: 1, building: 2, held: 3, tested: 3 };
export function weakest(items: readonly Item[]): Standing {
  if (items.length === 0) throw new Error('No items');
  return items.reduce((w, i) => (RANK[i.standing] < RANK[w] ? i.standing : w), items[0].standing);
}

// ── 1. The go-live decision standard ─────────────────────────────────────────

export const GO_LIVE: readonly Item[] = rows('LC-GO', [
  ['The defined student cohort can complete the core workflow end to end', 'building',
    [['docs/GOLDEN-PATH-TEST-SCRIPT.md', 'the student golden path, step by step'], ['app/src/lib/registration-day.ts', 'the plan, backups, conflicts and checklist the workflow ends in']],
    'Scripted for the student path only, and never run with a real cohort.'],
  ['The institution approves the defined data scope and authorized purpose', 'building',
    [['app/src/lib/gtm/pilot.ts', 'dataPlan (minimum necessary, read-only first, source-labelled) and productionDataApproved on every pilot']],
    'No institution has approved one; the approval is a boolean, not a signed record of fields.'],
  ['Access, consent, tenant isolation and audit controls are tested', 'tested',
    [['supabase/tenancy.check.sql', 'reads stay inside the school'], ['supabase/rls-coverage.check.sql', 'every table under row-level security'], ['supabase/support-access.check.sql', 'staff see a student only through a grant the student made'], ['supabase/role-grant-audit.check.sql', 'role grants are audited']],
    'HECVAT TEN-1 is still in progress: the negatives cover the tables the suites name.'],
  ['Student-facing data shows source, freshness and limitation', 'tested',
    [['app/src/lib/source.test.ts', 'the five source labels are the database’s labels'], ['app/src/components/SourceBadge.test.tsx', 'the label a fact prints']],
    'The source is on every fact; when it was last read is not.'],
  ['The product works with keyboard, screen readers, mobile reflow and error states', 'building',
    [['app/src/a11y/axe.test.tsx', 'an automated WCAG probe over the screens'], ['app/src/a11y/focus.test.ts', 'the focus ring'], ['app/src/widthgate.test.ts', 'the narrow-width gate'], ['docs/accessibility/AT-PASS-PROTOCOL.md', 'the assistive-technology pass nobody has run']],
    'No human screen-reader or 400% zoom pass is recorded.'],
  ['Monitoring, support, incident response, backups and rollback are operational', 'building',
    [['app/src/lib/statuspage.test.ts', 'the status page probes the project the app is built against'], ['supabase/support-tickets.check.sql', 'the ticket queue'], ['RESTORE.md', 'the restore procedure'], ['ROLLBACK.md', 'the rollback procedure']],
    'No production restore has been timed, no alert reaches a person and nobody is on call.'],
  ['The institution has training, communication and escalation contacts', 'designed',
    [['docs/LAUNCH-CONTENT-AND-TRAINING.md', 'the training content'], ['docs/launch/ANNOUNCEMENT-TEMPLATES.md', 'the communications']],
    'No institution, so no contacts; the command center below names where they would go.'],
  ['The pilot has success measures, a review date and a documented expansion or exit decision', 'tested',
    [['app/src/lib/gtm/pilot.ts', 'pilotReadiness refuses a kickoff without metrics, baselines, a midpoint review and a conversion date'], ['app/src/lib/gtm/pilot.test.ts', 'held']],
    'None beyond the pilot term below.'],
]);

// ── 2. The HECVAT tracker ────────────────────────────────────────────────────

export const HECVAT_DOMAINS = [
  '2.1 Company and governance',
  '2.2 Data privacy and FERPA posture',
  '2.3 Identity, access and authentication',
  '2.4 Application and database security',
  '2.5 Infrastructure, resilience and operations',
  '2.6 AI governance',
  '2.7 Accessibility and WCAG 2.2',
] as const;
export type HecvatDomain = (typeof HECVAT_DOMAINS)[number];

export interface HecvatRow extends Item {
  domain: HecvatDomain;
  /** The council seat that owns the row. */
  owner: Seat;
  /** The `docs/market-readiness/HECVAT_READINESS.md` control this row moves, or null where none exists. */
  control: string | null;
  /** Set by the owner, never here on their behalf. */
  due: string | null;
}

type HRow = [item: string, owner: Seat, control: string | null, standing: Standing, evidence: Ev, gap: string];
const hecvat = (domain: HecvatDomain, prefix: string, list: readonly HRow[]): HecvatRow[] =>
  list.map(([item, owner, control, standing, evidence, gap], i) => ({ id: id(prefix, i), domain, item, owner, control, due: null, standing, evidence: ev(evidence), gap }));

export const HECVAT: readonly HecvatRow[] = [
  ...hecvat('2.1 Company and governance', 'LC-HV1', [
    ['Legal entity and company ownership documented', 'founder', null, 'held', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: the owner attested a single-member LLC']], 'The formation documents are private and not indexed in the tree.'],
    ['Security leadership assigned', 'security', 'GOV-1', 'tested', [['SECURITY.md', 'the security owner and the severity model'], ['app/src/lib/security.test.ts', 'names an owner, not a placeholder']], 'The security seat is held by the founder until someone qualified accepts it.'],
    ['Privacy leadership assigned', 'privacy', null, 'designed', [['docs/operating-model/DATA-STEWARDSHIP.md', 'the stewardship roles']], 'No privacy governance charter naming a person.'],
    ['Risk-management process defined', 'founder', 'GOV-2', 'designed', [['docs/operating-model/RISK-GOVERNANCE.md', 'the risk register and its cadence']], 'The register exists; no review on its cadence is recorded.'],
    ['Vendor-management process defined', 'security', null, 'designed', [['docs/trust/VENDOR-RISK-REGISTER.md', 'the vendor inventory']], 'No assessment template has been run on a vendor.'],
    ['Security policy set maintained with revision dates', 'security', 'GOV-1', 'tested', [['SEMESTER-OPERATING-SYSTEM.md', 'every controlled document with its version and review dates'], ['app/src/lib/ops/operatingsystem.test.ts', 'held']], 'No index labelled as the security policy set.'],
    ['Employee and contractor confidentiality and IP terms exist', 'founder', null, 'designed', [['IP.md', 'what the company owns and how']], 'No agreement templates and no signed-record process.'],
    ['Background checks or personnel controls documented', 'operations', null, 'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'a one-person company answering the personnel rows']], 'No personnel control is written.'],
    ['Security training process exists', 'security', null, 'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'the training rows unanswered']], 'No training record or annual plan.'],
    ['Incident response team and contacts defined', 'security', 'IR-1', 'designed', [['docs/market-readiness/INCIDENT_RESPONSE.md', 'the process and roles'], ['docs/CRISIS-RESPONSE-RUNBOOK.md', 'the crisis runbook']], 'The contact tree is one person.'],
  ]),
  ...hecvat('2.2 Data privacy and FERPA posture', 'LC-HV2', [
    ['Data inventory is complete', 'privacy', 'PRIV-1', 'tested', [['RETENTION.md', 'every table with its retention answer'], ['app/src/lib/retention.test.ts', 'held']], 'Table by table, not field by field.'],
    ['Data classification is defined (Public / Internal / Student Private / Restricted)', 'privacy', null, 'designed', [['docs/MODULE-PRIVACY-MODEL.md', 'privacy by module']], 'The four-level standard is not written as one standard.'],
    ['Data-flow map is complete', 'engineering', null, 'designed', [['docs/ARCHITECTURE.md', 'the architecture']], 'No data-flow diagram a reviewer can read on its own.'],
    ['Authorized purpose documented per institutional deployment', 'privacy', 'PRIV-4', 'building', [['app/src/lib/gtm/pilot.ts', 'the pilot’s data plan']], 'No DPA or SOW signed that states a purpose.'],
    ['Minimum-necessary data rule is implemented', 'data', 'PRIV-6', 'tested', [['app/src/lib/advisor-meeting.test.ts', 'a share carries nothing the student did not tick'], ['supabase/advisor.check.sql', 'advisors read only what was shared'], ['app/server/integration/registry.test.ts', 'connector scopes declared per adapter']], 'Integrations declare scopes; no field-mapping registry per institution.'],
    ['No sale of student data, published', 'privacy', null, 'tested', [['app/src/lib/ops/claims.test.ts', 'the no-sale claim held to its evidence'], ['docs/legal/PRIVACY-POLICY-DRAFT.md', 'the promise in the policy draft']], 'The privacy policy is a draft awaiting counsel.'],
    ['No behavioral advertising on education records', 'privacy', null, 'tested', [['app/src/donotbuild.test.ts', 'no advertising or tracking SDK loads'], ['docs/legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md', 'the policy, drafted']], 'The policy is a draft awaiting counsel.'],
    ['Subprocessor register is current', 'privacy', 'PRIV-5', 'designed', [['docs/SUBPROCESSORS.md', 'the subprocessors']], 'Publication is in progress.'],
    ['Retention schedule exists, with deletion jobs', 'privacy', 'PRIV-1', 'tested', [['supabase/retention-sweeps.check.sql', 'the sweeps delete what the schedule says']], 'None.'],
    ['Export and deletion workflow exists', 'privacy', 'PRIV-2', 'tested', [['app/src/lib/deleteaccount.test.ts', 'delete-account'], ['supabase/deletion.check.sql', 'what deletion empties'], ['app/src/lib/export.test.ts', 'the export']], 'Per student; no tenant-wide export and no deletion certificate.'],
    ['Consent and sharing controls are explicit and revocable', 'privacy', 'PRIV-6', 'tested', [['supabase/familyshare.check.sql', 'family shares'], ['supabase/supportshares.check.sql', 'support shares']], 'None for the share kinds that exist.'],
    ['Education-record data is not redisclosed outside authorized purpose', 'privacy', 'PRIV-4', 'designed', [['docs/trust/DPA-CHECKLIST.md', 'the redisclosure clause']], 'A contract term; no DPA is signed.'],
    ['Privacy request workflow exists', 'privacy', null, 'designed', [['docs/STUDENT-DATA-CONTROL-CENTER.md', 'the student’s own controls']], 'No queue for requests an institution makes on a student’s behalf.'],
    ['Incident notification obligations documented', 'security', 'IR-1', 'tested', [['app/src/lib/security.test.ts', 'commits to a clock for telling people']], 'The contract clause waits on the DPA.'],
  ]),
  ...hecvat('2.3 Identity, access and authentication', 'LC-HV3', [
    ['SSO supported where the institution requires it', 'engineering', 'IAM-1', 'tested', [['supabase/tenant-sso-policy.check.sql', 'a school’s SSO policy'], ['docs/SAML-IMPLEMENTATION-RUNBOOK.md', 'SAML']], 'SAML only; no institution connected.'],
    ['Administrator MFA enforced', 'security', null, 'tested', [['supabase/console-approvals.check.sql', 'console approvals require aal2'], ['app/src/components/MfaStep.test.tsx', 'enrol and challenge']], 'Enforced on console approvals, not on every administrative write.'],
    ['High-risk actions require fresh authentication', 'security', null, 'designed', [['docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md', 'session management']], 'No step-up check found in code.'],
    ['RBAC/ABAC policy model documented', 'security', 'IAM-2', 'tested', [['supabase/capabilities.check.sql', 'capabilities, not role names'], ['supabase/my-capabilities.check.sql', 'what an account can do']], 'None.'],
    ['Object-level access controls tested', 'engineering', 'TEN-1', 'tested', [['supabase/rls-coverage.check.sql', 'row-level security everywhere'], ['supabase/access.check.sql', 'object access']], 'None.'],
    ['Tenant isolation tested', 'engineering', 'TEN-1', 'tested', [['supabase/tenancy.check.sql', 'reads inside the school'], ['supabase/integration-rls-matrix.check.sql', 'integration rows by tenant']], 'In progress in the readiness register.'],
    ['Access reviews are scheduled', 'security', 'IAM-3', 'not-started', [['docs/market-readiness/HECVAT_READINESS.md', 'IAM-3 not started']], 'No procedure and no retained evidence.'],
    ['Offboarding and deprovisioning supported', 'engineering', 'IAM-1', 'tested', [['supabase/scim-gateway.check.sql', 'SCIM deprovisioning'], ['supabase/identity-provisioning.check.sql', 'provisioning']], 'The institution gateway is not deployed.'],
    ['Session timeout and recovery behavior documented', 'security', null, 'designed', [['docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md', 'sessions']], 'No test holds a timeout.'],
  ]),
  ...hecvat('2.4 Application and database security', 'LC-HV4', [
    ['Secure SDLC exists', 'engineering', 'SDLC-1', 'building', [['.github/workflows/ci.yml', 'every change runs the gates'], ['REGRESSION-CHECKLIST.md', 'the gates and baselines']], 'No written SDLC policy separate from the checklist.'],
    ['Code review required', 'engineering', 'SDLC-1', 'designed', [['docs/BRANCH-PROTECTION.md', 'branch protection']], 'A document of the setting, not a reading of it.'],
    ['Dependency scanning runs in CI', 'engineering', 'SDLC-2', 'tested', [['app/src/lib/supplychain.test.ts', 'the licence and dependency policy'], ['docs/SUPPLY-CHAIN.md', 'the procedure']], 'None.'],
    ['Secret scanning runs in CI', 'engineering', 'SDLC-2', 'tested', [['app/src/lib/secrets.test.ts', 'the inventory and rotation log'], ['SECRETS.md', 'the inventory']], 'None.'],
    ['SAST/DAST approach documented', 'security', 'VULN-2', 'designed', [['docs/trust/PENETRATION-TEST-PLAN.md', 'the test plan'], ['.github/workflows/hawkscan.yml', 'local-preview DAST']], 'HawkScan is configured; the first run still requires the Actions secret and application-ID variable, and no independent test has occurred.'],
    ['Threat modeling for high-risk features', 'security', null, 'designed', [['docs/INTEGRATION-THREAT-MODEL.md', 'integrations']], 'Integrations only; no template for other features.'],
    ['RLS and database grants reviewed', 'security', 'TEN-1', 'tested', [['supabase/grants.check.sql', 'the grant allowlist'], ['supabase/rls-coverage.check.sql', 'coverage']], 'None.'],
    ['SECURITY DEFINER functions inventoried and approved', 'security', null, 'tested', [['app/src/lib/definerregister.test.ts', 'all 151 callable functions classified'], ['supabase/definer-sweep.check.sql', 'every one called by a stranger (DR-02, D-130)'], ['docs/DEFINER-RLS-REGISTER.md', 'the register']], 'DR-01 and DR-03 open, both low; the gtm_pilot_problems fix is live (D-129).'],
    ['API input validation and rate limits exist', 'engineering', null, 'tested', [['supabase/rate-limits.check.sql', 'the database rate limit'], ['app/server/institution/rate-limit.test.ts', 'the gateway’s']], 'None.'],
    ['Audit logs capture sensitive activity', 'security', 'LOG-1', 'tested', [['supabase/role-grant-audit.check.sql', 'role grants'], ['supabase/moderation-audit.check.sql', 'moderation']], 'None.'],
    ['Security headers and transport encryption configured', 'engineering', 'WEB-1', 'tested', [['app/src/lib/csp.test.ts', 'the content security policy'], ['app/src/lib/hostheaders.test.ts', 'the host’s headers']], 'None.'],
    ['Vulnerability remediation SLAs exist', 'security', 'VULN-1', 'tested', [['app/src/lib/security.test.ts', 'the severity model'], ['SECURITY.md', 'the SLAs']], 'None.'],
  ]),
  ...hecvat('2.5 Infrastructure, resilience and operations', 'LC-HV5', [
    ['Production, staging, preview and local environments separated', 'engineering', null, 'designed', [['STAGING.md', 'the environments']], 'Described, not read from the providers.'],
    ['Secrets managed server-side', 'engineering', null, 'tested', [['app/src/lib/secrets.test.ts', 'the four stores'], ['SECRETS.md', 'the inventory']], 'None.'],
    ['Backups configured', 'operations', 'BCP-1', 'designed', [['RESTORE.md', 'the provider’s backups']], 'The tier’s documentation, not a dashboard reading.'],
    ['Restore testing has occurred', 'operations', 'BCP-1', 'designed', [['RESTORE.md', 'the rehearsal against a throwaway database']], 'No production restore performed and timed.'],
    ['RTO/RPO objectives defined', 'operations', 'BCP-1', 'designed', [['docs/market-readiness/DISASTER_RECOVERY.md', 'the objectives']], 'Not measured.'],
    ['Monitoring and alerting active', 'operations', 'MON-1', 'building', [['app/src/lib/statuspage.test.ts', 'the synthetic probe'], ['MONITORING.md', 'the plan']], 'No alert reaches a person.'],
    ['Runtime-error tracking active', 'engineering', null, 'not-started', [['MONITORING.md', 'names it']], 'No error tracker.'],
    ['Integration health monitoring exists', 'engineering', 'INT-1', 'tested', [['supabase/integration-control-plane.check.sql', 'connector state'], ['app/src/lib/syncstatus.test.ts', 'the sync words']], 'None.'],
    ['Incident-response runbooks exist, with a tabletop record', 'security', 'IR-1', 'designed', [['docs/RUNBOOKS.md', 'the runbooks'], ['docs/market-readiness/INCIDENT_RESPONSE.md', 'the plan']], 'No tabletop record.'],
    ['Status page and customer communication process exist', 'operations', 'MON-1', 'tested', [['app/src/lib/statuspage.test.ts', 'the status page'], ['docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md', 'the templates']], 'None.'],
    ['Rollback process is tested', 'engineering', null, 'designed', [['ROLLBACK.md', 'owner and time, held by rollback.test.ts']], 'No rollback drill recorded.'],
    ['Capacity and peak-period plan exists', 'operations', null, 'designed', [['docs/REGISTRATION-DAY-MODE.md', 'the registration peak'], ['docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md', 'performance']], 'No load test.'],
  ]),
  ...hecvat('2.6 AI governance', 'LC-HV6', [
    ['AI use is publicly disclosed', 'trust', 'AI-1', 'tested', [['app/src/lib/trust/ai-training-policy.test.ts', 'the model-training and data-use policy held']], 'No AI Use Policy as its own public document.'],
    ['Approved AI providers and models inventoried', 'trust', 'AI-1', 'tested', [['app/src/ai/providers/providers.test.ts', 'the providers']], 'None.'],
    ['Provider data-use terms reviewed', 'trust', null, 'designed', [['docs/SUBPROCESSORS.md', 'providers as subprocessors']], 'No recorded review of each provider’s terms.'],
    ['No unauthorized model training on student or institution data', 'trust', null, 'tested', [['app/src/lib/trust/ai-training-policy.test.ts', 'the policy']], 'None.'],
    ['Source permissions checked before retrieval', 'engineering', 'AI-1', 'tested', [['app/src/lib/context.test.ts', 'what leaves the device, and nothing else']], 'None.'],
    ['Source citations and limitations shown', 'product', null, 'tested', [['app/src/ai/quality.test.ts', 'the line under every reply'], ['app/src/components/StudyStudio.anchors.test.tsx', 'page and slide anchors']], 'None.'],
    ['Course and institution AI policy hierarchy exists', 'trust', 'AI-1', 'tested', [['supabase/intelligence-policy.check.sql', 'the policy rows'], ['app/src/lib/coursestudio.test.ts', 'the course’s rules']], 'None.'],
    ['Prompt-injection defense tests exist', 'security', null, 'tested', [['app/src/ai/injection.test.ts', 'the fence']], 'The live red-team skips without a key and has not run.'],
    ['High-impact actions require exact preview and confirmation', 'product', null, 'tested', [['app/src/ai/threadactions.test.tsx', 'proposed actions the student presses']], 'None.'],
    ['AI history and output deletion supported', 'privacy', null, 'building', [['app/src/lib/threads.ts', 'conversations on the device']], 'Server-side AI records follow RETENTION.md; no one-press delete of them.'],
    ['AI quality, cost, latency and safety monitoring exist', 'engineering', 'AI-2', 'building', [['app/src/ai/providers/money.test.ts', 'the metered budget']], 'No evaluation set and no dashboard.'],
    ['AI incident and feedback process exists', 'trust', 'AI-3', 'building', [['app/src/lib/aikillswitch.test.ts', 'the kill switch, global and per school']], 'No AI incident playbook; the drill is unrun.'],
  ]),
  ...hecvat('2.7 Accessibility and WCAG 2.2', 'LC-HV7', [
    ['Accessibility statement published, with a reporting contact', 'accessibility', null, 'building', [['app/src/site/render.tsx', 'the /accessibility/ route'], ['docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md', 'the dated statement, drafted']], 'The statement is a draft; the page is not yet it.'],
    ['WCAG 2.2 AA baseline adopted', 'accessibility', null, 'tested', [['app/src/a11y/axe.test.tsx', 'the automated probe'], ['docs/WCAG-UI-AUDIT-SCORECARD.md', 'the scorecard']], 'Automated only.'],
    ['VPAT or dated VPAT plan exists', 'accessibility', null, 'designed', [['docs/trust/HECVAT-VPAT-PLAN.md', 'the plan']], 'No VPAT.'],
    ['Keyboard navigation tested', 'accessibility', null, 'tested', [['app/src/screens/Calendar.keyboard.test.tsx', 'the calendar by keyboard']], 'No manual test record across the core path.'],
    ['Visible focus and focus order tested', 'accessibility', null, 'tested', [['app/src/a11y/focus.test.ts', 'the ring'], ['app/src/a11y/modal.test.ts', 'focus in dialogs']], 'None.'],
    ['Screen-reader paths tested', 'accessibility', null, 'designed', [['docs/accessibility/AT-PASS-PROTOCOL.md', 'the protocol']], 'No NVDA or VoiceOver record.'],
    ['Contrast and non-color indicators tested', 'accessibility', null, 'tested', [['app/src/lib/contrast.test.ts', 'the whole ramp']], 'None.'],
    ['Zoom and reflow tested at 200–400%', 'accessibility', null, 'building', [['app/src/widthgate.test.ts', 'the narrow-width gate']], 'No zoom QA result.'],
    ['Reduced-motion support tested', 'accessibility', null, 'tested', [['app/src/a11y/motion.test.ts', 'jumps instead of gliding']], 'None.'],
    ['Captions and transcripts process exists', 'accessibility', null, 'designed', [['docs/VIDEO_PODCAST_ROADMAP.md', 'media']], 'No publishing checklist.'],
    ['Tables, charts, documents and exports accessible', 'accessibility', null, 'tested', [['app/src/lib/exportqa.test.ts', 'the exports']], 'Charts are not audited.'],
    ['Accessibility issues have a support and remediation path', 'accessibility', null, 'designed', [['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'governance']], 'No ticket category or SLA for it.'],
  ]),
];

// ── 3. The registration go-live checklist ────────────────────────────────────

export const REGISTRATION_GROUPS = ['Product and student experience', 'Registrar and governance', 'Technical and resilience'] as const;
export interface GroupedItem extends Item { group: string }
const grouped = (group: string, prefix: string, list: readonly Row[]): GroupedItem[] => rows(prefix, list).map((i) => ({ ...i, group }));

export const REGISTRATION: readonly GroupedItem[] = [
  ...grouped('Product and student experience', 'LC-REG1', [
    ['Student can create or sign in to an account securely', 'tested', [['app/src/components/MfaStep.test.tsx', 'the second factor']], 'SSO for students waits on an institution.'],
    ['Student can choose a program or enter planning data', 'tested', [['app/src/components/PathSnapshotCard.test.tsx', 'saves the student’s path and shows it back']], 'None.'],
    ['Path Snapshot labels verified, imported, student-entered and estimated data', 'tested', [['app/src/components/PathSnapshotCard.test.tsx', 'says it is not official'], ['app/src/lib/source.test.ts', 'the five labels']], 'None.'],
    ['Student can search and compare approved course options', 'tested', [['app/src/lib/registration.test.ts', 'the institution catalog, imported atomically']], 'Compared in the plan, not side by side.'],
    ['Student can create a term plan', 'tested', [['app/src/components/RegistrationDay.test.tsx', 'the plan on the device']], 'None.'],
    ['Schedule conflict detection works and explains conflicts', 'tested', [['app/src/lib/registration-day.test.ts', 'counts a conflict'], ['app/src/lib/registration-day.mode.test.ts', 'proposes an action per conflict']], 'None.'],
    ['Student can add a primary option and ranked backups', 'tested', [['app/src/components/RegistrationDay.test.tsx', 'adds a backup from the offered sections'], ['app/src/lib/registration-day.test.ts', 'refuses too many backups']], 'None.'],
    ['Registration readiness checklist is available', 'tested', [['app/src/lib/registration-day.test.ts', 'complete only with every check, a backup each, no conflict and a time']], 'None.'],
    ['Student can create an advisor agenda', 'tested', [['app/src/components/AdvisorMeeting.test.tsx', 'the agenda']], 'None.'],
    ['Agenda saved, exported or shared only with explicit confirmation', 'tested', [['app/src/lib/advisor-meeting.test.ts', 'nothing the student did not tick']], 'None.'],
    ['Registration time and hold category shown only when source is current and approved', 'designed', [['docs/REGISTRATION-DAY-MODE.md', 'the mode']], 'The time is student-entered; holds are not read from any system.'],
    ['Official registration handoff with source and freshness state', 'tested', [['app/src/components/RegistrationDayCard.test.tsx', 'opens the official system only after a confirmation'], ['app/src/lib/registration-day.mode.test.ts', 'https addresses only']], 'Freshness is not shown on the handoff.'],
    ['Semester never promises a seat or official eligibility', 'tested', [['app/src/lib/registration-day.mode.test.ts', 'never says Semester registers anybody'], ['app/src/components/RegistrationDay.test.tsx', 'registers nobody, and names the seat source']], 'None.'],
    ['Student can report wrong data or request help', 'tested', [['app/src/components/GetHelp.test.tsx', 'help'], ['app/src/components/ActionCenter.help.test.tsx', 'help from an action']], 'No “this is wrong” on a catalog fact itself.'],
  ]),
  ...grouped('Registrar and governance', 'LC-REG2', [
    ['Catalog and requirement data have named institutional owners', 'not-started', [['docs/REGISTRATION-DAY-MODE.md', 'names the catalog as the source']], 'No owner field on a catalog or requirement.'],
    ['Course and section content has source URL or system and last-reviewed date', 'building', [['app/src/lib/registration.ts', 'the imported catalog']], 'No last-reviewed date on a section.'],
    ['Registration rules have a documented source and effective date', 'not-started', [['docs/REGISTRATION-DAY-MODE.md', 'the rules the mode follows']], 'No effective date on any rule.'],
    ['Prerequisites, restrictions and capacity are source-labelled', 'building', [['app/src/lib/registration.ts', 'seats preserved on import']], 'Prerequisites and restrictions are not imported.'],
    ['Source refresh target and stale-data behavior configured', 'building', [['app/src/lib/syncstatus.ts', 'what waits and what is lost']], 'No refresh target per source.'],
    ['Registrar can publish or approve registration windows through a controlled workflow', 'tested', [['app/src/lib/registrar.test.ts', 'the registrar'], ['app/src/lib/registrar.calendar.test.ts', 'its calendar']], 'No approval step before a window reaches students.'],
    ['No client user can alter official registration, enrollment or hold state', 'tested', [['app/src/lib/registration-day.mode.test.ts', 'never says Semester registers anybody']], 'No write path to a student system exists; nothing refuses one being added.'],
    ['Audit records capture administrative changes', 'tested', [['supabase/role-grant-audit.check.sql', 'role grants'], ['supabase/console-approvals.check.sql', 'console approvals']], 'None.'],
    ['Institution approves pilot scope and data fields', 'building', [['app/src/lib/gtm/pilot.ts', 'productionDataApproved']], 'A boolean, not a list of fields.'],
  ]),
  ...grouped('Technical and resilience', 'LC-REG3', [
    ['Course search performance tested under expected peak load', 'not-started', [['docs/REGISTRATION-DAY-MODE.md', 'the peak']], 'No load test.'],
    ['Plan save is durable and idempotent', 'tested', [['app/src/lib/conflicts.test.ts', 'a record edited on both sides; the later kept'], ['app/src/state/deletions.test.tsx', 'a deletion made offline stays deleted after the app closes'], ['supabase/sync.check.sql', 'sync']], 'Device-first; the server copy is the sync’s.'],
    ['Conflict calculations have unit and end-to-end tests', 'building', [['app/src/lib/registration-day.test.ts', 'unit']], 'No end-to-end test.'],
    ['Stale SIS or catalog data visibly marked', 'building', [['app/src/lib/syncstatus.ts', 'sync state']], 'No SIS feed, so nothing to mark stale yet.'],
    ['Integration failure has official fallback behavior', 'tested', [['app/src/components/GetHelp.test.tsx', 'the official office'], ['app/src/components/OfflineBanner.test.tsx', 'offline']], 'None.'],
    ['Repeated or out-of-order events create no duplicate actions or plans', 'tested', [['supabase/outbox.check.sql', 'the outbox'], ['app/src/lib/registration-day.test.ts', 'drops duplicate backups']], 'No SIS event stream exists to reorder.'],
    ['Registration Day Mode behind a flag that can be disabled per tenant', 'building', [['app/src/lib/registration-day.mode.test.ts', 'follows the registration_day_mode flag']], 'The flag is build-level, not per tenant.'],
    ['Monitoring for plan save, course search, sync freshness and official handoff', 'not-started', [['MONITORING.md', 'the plan']], 'None of the four is monitored.'],
    ['Registration notifications honor quiet hours and preferences', 'tested', [['app/src/lib/registration-day.mode.test.ts', 'silenced by its toggle and by quiet hours']], 'None.'],
  ]),
];

// ── 4. The LMS and Course Studio go-live checklist ───────────────────────────

export const LMS: readonly GroupedItem[] = [
  ...grouped('Learning experience', 'LC-LMS1', [
    ['Course context accurate, source-labelled and tenant-scoped', 'tested', [['supabase/lti-integration.check.sql', 'the launch’s course, inside its school']], 'None.'],
    ['Student can access approved course materials according to permissions', 'tested', [['supabase/coursestudio.check.sql', 'published materials by course']], 'None.'],
    ['Upload pipeline validates file type and scans untrusted files', 'building', [['app/src/lib/mediascan.test.ts', 'images by their bytes']], 'Images only; no malware scan of documents.'],
    ['Extraction preserves page, slide, timestamp and file-version anchors', 'tested', [['app/src/components/StudyStudio.anchors.test.tsx', 'pages and slides']], 'No timestamp or file-version anchor.'],
    ['Student reviews extracted syllabus dates before they create actions or calendar entries', 'designed', [['docs/STUDY-READINESS-AND-SOURCE-LOCKER.md', 'the source locker']], 'No review step in code.'],
    ['Study assets show citations and allow correction or deletion', 'tested', [['app/src/lib/studystudio.test.ts', 'the study studio']], 'None.'],
    ['Course AI policy visible and enforced', 'tested', [['supabase/intelligence-policy.check.sql', 'the policy'], ['app/src/lib/coursestudio.test.ts', 'published rules']], 'None.'],
    ['Active-assessment restrictions offer safe alternatives, not dead ends', 'tested', [['app/src/lib/coursestudio.test.ts', 'never final answers without the instructor’s confirmation']], 'The rule is held; no study alternative is offered in its place.'],
    ['Student can create study plans and use practice tools', 'tested', [['app/src/components/StudyStudio.test.tsx', 'practice']], 'None.'],
    ['Student workspace files and drafts private by default', 'tested', [['supabase/rls-coverage.check.sql', 'every table under row-level security'], ['app/src/lib/files.test.ts', 'the drive']], 'None.'],
    ['Any sharing is explicit, scoped, expiring where appropriate and auditable', 'tested', [['supabase/supportshares.check.sql', 'support shares'], ['supabase/familyshare.check.sql', 'family shares']], 'None.'],
  ]),
  ...grouped('Faculty experience', 'LC-LMS2', [
    ['Faculty can create and approve course source packs', 'tested', [['app/src/components/StudyStudio.packs.test.tsx', 'source packs']], 'None.'],
    ['Faculty can publish course AI policy and allowed-use guidance', 'tested', [['app/src/lib/coursestudio.test.ts', 'rules before they are published']], 'None.'],
    ['Faculty can review how students see course materials', 'building', [['app/src/components/CourseStudio.test.tsx', 'the studio']], 'No student-view preview.'],
    ['Faculty role does not reveal private student plans or notes', 'tested', [['supabase/coursestudio.check.sql', 'what faculty read'], ['supabase/rls-coverage.check.sql', 'coverage']], 'None.'],
    ['Assessment and gradebook features labelled practice, draft or official', 'building', [['app/src/screens/grades.test.tsx', 'grades']], 'No official label, because nothing official exists.'],
    ['Official-grade sync requires institution approval, audit and reconciliation', 'tested', [['app/src/lib/ltiags.test.ts', 'grade services refused without a graded link'], ['supabase/ltiags.check.sql', 'held']], 'No reconciliation report.'],
  ]),
  ...grouped('Integration and standards', 'LC-LMS3', [
    ['LTI 1.3 configuration documented and tested', 'tested', [['docs/LTI-1.3-LAUNCH-RUNBOOK.md', 'the runbook'], ['app/src/lib/lti.test.ts', 'the launch']], 'None.'],
    ['Launches validate issuer, audience, deployment, nonce, state and signature', 'tested', [['supabase/lti.check.sql', 'the nonce is single-use'], ['app/src/lib/lti.test.ts', 'the claims']], 'None.'],
    ['Deep links return students to authorized LMS destinations', 'tested', [['app/src/lib/ltideeplink.test.ts', 'the settings claim']], 'The return is not tested end to end.'],
    ['Names and roles access restricted to the current course', 'building', [['app/src/lib/ltimembership.test.ts', 'the membership join']], 'NRPS is not implemented.'],
    ['Assignment and grade exchange disabled until approved and tested', 'tested', [['app/src/lib/ltiags.test.ts', 'refused without a graded link'], ['supabase/ltiags.check.sql', 'held']], 'None.'],
    ['LMS connection status, scopes, last sync and disconnect visible', 'building', [['app/src/lib/syncstatus.ts', 'sync words']], 'No LMS connection panel.'],
    ['No unsupported claim that Semester replaces LMS grading', 'tested', [['app/src/screens/lmsclaims.test.ts', 'what the app says about grades and submissions']], 'None.'],
  ]),
];

// ── 5. The student-data migration playbook ───────────────────────────────────

export const MIGRATION_SEQUENCE: readonly string[] = [
  'Discover', 'Classify', 'Minimize', 'Map', 'Transform', 'Sample import', 'Validate', 'Reconcile', 'Parallel run', 'Cutover', 'Archive/export legacy data', 'Monitor and correct',
];

export interface Domain { domain: string; pilot: string; expansion: string; risk: string; tree: string }

export const INVENTORY: readonly Domain[] = [
  { domain: 'Identity', pilot: 'SSO identifier / local account', expansion: 'SCIM lifecycle', risk: 'Avoid duplicate accounts; protect identifiers', tree: 'Local accounts and SAML; SCIM gateway checked, not deployed.' },
  { domain: 'Student profile', pilot: 'Student-entered minimum context', expansion: 'Approved program/term data', risk: 'Do not import sensitive demographic data unnecessarily', tree: 'Student-entered, labelled so.' },
  { domain: 'Program/requirements', pilot: 'Curated or approved planning data', expansion: 'SIS/catalog feed', risk: 'Clearly label estimates until verified', tree: 'The path snapshot says it is not official.' },
  { domain: 'Course catalog', pilot: 'Curated course list', expansion: 'Full catalog/section sync', risk: 'Source freshness and effective dates', tree: 'CSV/JSON import, atomic; no effective dates.' },
  { domain: 'Enrollment', pilot: 'Manual or approved current-term list', expansion: 'SIS roster sync', risk: 'Minimum field access and tenant scope', tree: 'LTI membership per launch; no roster sync.' },
  { domain: 'Plans', pilot: 'Student-created', expansion: 'Legacy plan import', risk: 'Preserve owner and edit history', tree: 'Student-created only.' },
  { domain: 'Course materials', pilot: 'Student-selected/authorized files', expansion: 'Approved LMS content', risk: 'Copyright, access, deletion, academic integrity', tree: 'Student files and faculty source packs.' },
  { domain: 'Grades', pilot: 'Exclude initially', expansion: 'Approved read-only summary or formal gradebook migration', risk: 'High sensitivity; official-record controls', tree: 'Student-entered only; grade passback gated.' },
  { domain: 'Financial data', pilot: 'Exclude initially', expansion: 'High-level deadlines/holds; later authorized workflows', risk: 'PCI, aid and account confidentiality', tree: 'Excluded; no payment data is held.' },
  { domain: 'Housing/health', pilot: 'Exclude initially', expansion: 'Narrow service workflows', risk: 'Restricted data and special legal obligations', tree: 'Excluded.' },
  { domain: 'Support cases', pilot: 'Exclude initially', expansion: 'Migration only with explicit purpose/retention plan', risk: 'Sensitive notes and confidentiality', tree: 'Excluded.' },
];

/** The seventeen artifacts, and the file that carries each today, or null. */
export const MIGRATION_ARTIFACTS: readonly { artifact: string; carriedBy: string | null; note: string }[] = [
  { artifact: 'Migration charter', carriedBy: null, note: 'QTI has one (docs/QTI-3-ASSESSMENT-AND-MIGRATION.md); student data has none.' },
  { artifact: 'Source-system inventory', carriedBy: 'docs/INTEROPERABILITY-ROADMAP.md', note: 'The systems, not an institution’s instances of them.' },
  { artifact: 'Approved data scope', carriedBy: 'app/src/lib/gtm/pilot.ts', note: 'The data plan on a pilot.' },
  { artifact: 'Data Processing Addendum / institutional agreement', carriedBy: 'docs/trust/DPA-CHECKLIST.md', note: 'A checklist, not an agreement.' },
  { artifact: 'Data classification map', carriedBy: null, note: 'See LC-HV2-02.' },
  { artifact: 'Field mapping specification', carriedBy: null, note: 'The template is on this page; no institution’s mapping exists.' },
  { artifact: 'Transformation rules', carriedBy: 'app/src/lib/registration.ts', note: 'The catalog import’s parsing, for courses only.' },
  { artifact: 'Data quality rules', carriedBy: 'app/src/lib/registration.ts', note: 'Rejects incomplete, duplicate and invalid rows atomically.' },
  { artifact: 'Duplicate and identity resolution rules', carriedBy: null, note: 'Account linking is by ticket (FERPA-IDENTITY-GUARDRAILS).' },
  { artifact: 'Sample data set and expected results', carriedBy: null, note: 'None.' },
  { artifact: 'Migration runbook', carriedBy: null, note: 'MIGRATION_PLAYBOOK: evidence path and roster staging exist; no production load path for any domain.' },
  { artifact: 'Rollback plan', carriedBy: null, note: 'ROLLBACK.md is for releases, not imports.' },
  { artifact: 'Reconciliation report', carriedBy: 'docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md', note: 'For integrations, not a one-time import.' },
  { artifact: 'Exception register', carriedBy: null, note: 'None.' },
  { artifact: 'Cutover approval record', carriedBy: 'supabase/tenant-rollout.check.sql', note: 'A school moves a state only with the leaving state’s exit evidence.' },
  { artifact: 'Archive/export plan', carriedBy: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', note: 'Offboarding, not legacy archive.' },
  { artifact: 'Post-migration validation report', carriedBy: null, note: 'None.' },
];

/** The field-mapping template, as the brief wrote it, and the Semester field that exists today. */
export const FIELD_MAP: readonly { source: string; target: string; classification: string; transformation: string; owner: string; retention: string; validation: string; tree: string }[] = [
  { source: 'SIS student ID', target: 'external_identity_id', classification: 'Student private', transformation: 'Tokenize/normalize if needed', owner: 'Registrar', retention: 'Contract-defined', validation: 'Match active record', tree: 'No such column; identities arrive by SAML or LTI subject.' },
  { source: 'Catalog course code', target: 'course.code', classification: 'Internal/public', transformation: 'Normalize subject/number', owner: 'Registrar', retention: 'Institutional', validation: 'Exists and unique', tree: 'Course.code in app/src/lib/types.ts.' },
  { source: 'Course section time', target: 'section.meeting_pattern', classification: 'Internal', transformation: 'Parse time zone/location', owner: 'Registrar', retention: 'Term lifecycle', validation: 'No invalid overlaps', tree: 'Meetings on the imported catalog (registration.ts).' },
  { source: 'Requirement rule', target: 'requirement.rule', classification: 'Internal', transformation: 'Map to rule schema', owner: 'Curriculum office', retention: 'Curriculum lifecycle', validation: 'Rule test suite', tree: 'No requirement rule schema.' },
  { source: 'Student plan item', target: 'plan_item', classification: 'Student private', transformation: 'Preserve owner/version', owner: 'Student', retention: 'Student retention', validation: 'Count and owner match', tree: 'Plans are the student’s own, on the device and in sync.' },
];

export const PARALLEL_RUN: readonly string[] = [
  'Legacy system remains official',
  'Semester imports/synchronizes approved data',
  'Semester performs workflow in shadow mode',
  'Differences are reconciled',
  'Institution validates results',
  'Cutover is approved by authorized owners',
  'Semester becomes authoritative only for approved domain',
  'Legacy data is archived/exported according to policy',
];

export const GUARDRAILS: readonly Item[] = rows('LC-MIG', [
  ['Never overwrite student-owned notes, drafts, plans or consent choices with imported data', 'tested', [['app/src/lib/conflicts.test.ts', 'says which side a merge kept, never silently']], 'No import path exists yet to hold to it.'],
  ['Never silently convert estimated data into institution-verified data', 'tested', [['app/src/lib/source.test.ts', 'the database refuses a label the app cannot name']], 'None.'],
  ['Never import restricted data into AI context by default', 'tested', [['app/src/lib/context.test.ts', 'no note body, nobody else’s name']], 'None.'],
  ['Never use production student records in development or test without formal approval', 'building', [['app/src/lib/demosplit.test.ts', 'the demo is never the product, and wears its label'], ['app/src/data/seed.test.ts', 'the seed']], 'No written approval process for an exception.'],
  ['Never cut over without rollback, reconciliation, ownership and support plans', 'tested', [['supabase/tenant-rollout.check.sql', 'each forward move needs exit-gate evidence']], 'The evidence is whatever is filed; no template requires these four.'],
]);

// ── 6. The first pilot agreement ─────────────────────────────────────────────

/** The one conflict between the brief and the code. */
export const PILOT_TERM: Item = {
  id: 'LC-PILOT-TERM',
  item: 'Pilot duration: the brief says 12–26 weeks (84–182 days)',
  standing: 'tested',
  evidence: ev([['app/src/lib/gtm/pilot.ts', 'pilotReadiness refuses anything but exactly 26 weeks (PILOT_WEEKS)'], ['app/src/lib/gtm/pilot.test.ts', 'held'], ['docs/PAID-PILOT-FRAMEWORK.md', 'the length rule: exactly 26 weeks (D-134)']]),
  gap: 'None: the owner chose exactly 26 weeks (D-134), the top of the brief’s range. It was 60–120 days when these briefs arrived.',
}

export const PILOT_SCOPE: readonly { term: string; brief: string; tree: string }[] = [
  { term: 'Parties', brief: 'Semester [legal entity]; Institution [full legal entity]', tree: 'The entity is a single-member LLC (HECVAT COMP-01).' },
  { term: 'Purpose', brief: 'A limited, time-bound pilot of planning, registration-readiness, advisor-agenda and related workflows', tree: 'PilotPlan.workflow.' },
  { term: 'Cohort', brief: '25–100 students', tree: 'PilotPlan.cohort is free text; no bound is enforced.' },
  { term: 'Duration', brief: '12–26 weeks', tree: 'Exactly 26 weeks, which the code enforces (LC-PILOT-TERM, D-134).' },
  { term: 'Use case', brief: 'Registration readiness and academic pathway planning', tree: 'The outline’s sample is an LMS/course pilot; this is the second shape.' },
  { term: 'Authorized modules', brief: 'Today, My Path, Plan, Action Center, advisor agenda, feedback/support', tree: 'Today, My Path and Plan are three of the five destinations; the Action Center is behind today_action_center.' },
  { term: 'Optional scope', brief: 'SSO; approved catalog/program data; selected calendar connection', tree: 'SAML; the catalog import; calendar feeds.' },
];

/** The eleven exclusions, each with what already keeps it out, or null. */
export const EXCLUSIONS: readonly { exclusion: string; keptOutBy: string | null; note: string }[] = [
  { exclusion: 'Official registration execution', keptOutBy: 'app/src/lib/registration-day.mode.test.ts', note: 'Never says Semester registers anybody.' },
  { exclusion: 'Official degree certification or graduation decision', keptOutBy: 'app/src/components/PathSnapshotCard.test.tsx', note: 'Says it is not official.' },
  { exclusion: 'Automatic add/drop/withdrawal', keptOutBy: 'app/src/lib/registration-day.mode.test.ts', note: 'No write path exists; nothing refuses one being added.' },
  { exclusion: 'Production SIS write access', keptOutBy: null, note: 'No SIS connector writes; a contract exclusion is needed to keep it so.' },
  { exclusion: 'Official gradebook replacement', keptOutBy: 'app/src/screens/lmsclaims.test.ts', note: 'The app does not say it.' },
  { exclusion: 'Payment or financial-aid processing', keptOutBy: 'app/src/lib/ops/claims.test.ts', note: 'The no-payment-data claim.' },
  { exclusion: 'Housing, dining, health, emergency, or broad parent/supporter portals', keptOutBy: null, note: 'Family sharing exists; a contract exclusion is needed.' },
  { exclusion: 'Unrestricted AI agents', keptOutBy: 'app/src/ai/threadactions.test.tsx', note: 'Every action is proposed and pressed.' },
  { exclusion: 'Public student social features', keptOutBy: null, note: 'Community exists behind its flags; the pilot must switch it off.' },
  { exclusion: 'Individual student surveillance or risk scoring', keptOutBy: 'ops/strategic-boundaries/README.md', note: 'Boundaries 1 and 4.' },
  { exclusion: 'Grades, retention, graduation or employment promises', keptOutBy: 'app/src/lib/ops/claims.test.ts', note: 'No causal claim without method.' },
];

/** The ten agreement attachments, A–J, and where each stands. */
export const ATTACHMENTS: readonly { letter: string; attachment: string; carriedBy: string | null; note: string }[] = [
  { letter: 'A', attachment: 'Pilot Statement of Work', carriedBy: 'docs/SAAS-LAUNCH-KIT.md', note: 'The SOW fields held to PilotPlan; no pilot-fee field.' },
  { letter: 'B', attachment: 'Data Processing Addendum', carriedBy: 'docs/trust/DPA-CHECKLIST.md', note: 'A checklist for counsel.' },
  { letter: 'C', attachment: 'Security Schedule', carriedBy: 'docs/trust/SECURITY-WHITEPAPER.md', note: 'The whitepaper; not a schedule.' },
  { letter: 'D', attachment: 'Accessibility Statement / VPAT or plan', carriedBy: 'docs/trust/HECVAT-VPAT-PLAN.md', note: 'A plan, not a VPAT.' },
  { letter: 'E', attachment: 'AI Policy and Data-Use Schedule', carriedBy: 'docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md', note: 'The training policy.' },
  { letter: 'F', attachment: 'Support and Escalation Policy', carriedBy: 'docs/market-readiness/SUPPORT_PLAYBOOK.md', note: 'No response targets.' },
  { letter: 'G', attachment: 'Implementation Plan', carriedBy: 'docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md', note: 'The playbook.' },
  { letter: 'H', attachment: 'Approved Data Field List', carriedBy: null, note: 'No list; the field-mapping template above is its shape.' },
  { letter: 'I', attachment: 'Subprocessor Register', carriedBy: 'docs/SUBPROCESSORS.md', note: 'In progress.' },
  { letter: 'J', attachment: 'Pricing Schedule', carriedBy: 'app/src/lib/governance/deal-desk.ts', note: 'The deal desk’s floors.' },
];

/** The suggested pilot support table, and what `docs/trust/SLA.md` says. */
export const SUPPORT_TABLE: readonly { level: string; commitment: string; tree: string }[] = [
  { level: 'Support hours', commitment: 'Business hours, institution time zone', tree: 'Not stated in SLA.md.' },
  { level: 'Critical acknowledgement', commitment: 'Within 4 business hours', tree: 'Not stated.' },
  { level: 'High acknowledgement', commitment: 'Within 1 business day', tree: 'Not stated.' },
  { level: 'Standard acknowledgement', commitment: 'Within 2 business days', tree: 'Not stated.' },
  { level: 'Planned maintenance', commitment: 'Advance notice where practical', tree: 'SLA.md excludes it from downtime.' },
  { level: 'Status communication', commitment: 'Status page / named contact', tree: 'The status page exists.' },
  { level: 'Availability', commitment: 'Stated only after it is measured', tree: 'SLA.md has uptime tiers; none is measured.' },
];

export const SUCCESS_MEASURES: readonly string[] = [
  'account creation and onboarding', 'Path Snapshot rate', 'plan creation', 'backup-course rate', 'conflict resolution',
  'advisor agenda rate', 'search-to-action success', 'student clarity score', 'advisor usefulness score', 'support/friction themes',
];

// ── 7. The packaging matrix ──────────────────────────────────────────────────

export type DealTier = 'pilot' | 'department' | 'campus' | 'system';
export const PACKAGES: readonly { name: string; buyer: string; scope: string; support: string; integrations: string; model: string; plan: string | null; tier: DealTier | null }[] = [
  { name: 'Semester Free', buyer: 'Individual student', scope: 'Personal planning basics', support: 'Self-service', integrations: 'Student-selected only', model: 'Free', plan: 'free', tier: null },
  { name: 'Semester Plus', buyer: 'Individual student', scope: 'Advanced planning, sharing, exports', support: 'Standard support', integrations: 'Calendar/files', model: 'Subscription', plan: 'plus', tier: null },
  { name: 'Semester Pro', buyer: 'Individual student', scope: 'Advanced scenarios, career, AI allowance', support: 'Priority self-service', integrations: 'Expanded personal connections', model: 'Subscription', plan: 'pro', tier: null },
  { name: 'Registration Pilot', buyer: 'Department/institution', scope: '25–100 cohort, planning and advisor workflow', support: 'Named implementation/support contact', integrations: 'Optional SSO/catalog read', model: 'Fixed pilot fee + implementation', plan: null, tier: 'pilot' },
  { name: 'Department', buyer: 'College/department', scope: 'Configured academic/student-success workflow', support: 'Business-hours support', integrations: 'SSO, approved source feeds', model: 'Annual license + setup', plan: 'institution', tier: 'department' },
  { name: 'Campus', buyer: 'Institution', scope: 'Multi-module student experience', support: 'Named customer-success lead', integrations: 'SSO, LMS/SIS read, content feeds', model: 'Enrollment-band annual license', plan: 'institution', tier: 'campus' },
  { name: 'Enterprise', buyer: 'System/multi-campus', scope: 'Advanced governance, integrations, operations', support: 'Premium/negotiated', integrations: 'SCIM, advanced SIS/LMS, custom connectors', model: 'Multi-year agreement', plan: 'institution', tier: 'system' },
];

export const PRICING_PRINCIPLES: readonly Item[] = rows('LC-PRICE', [
  ['Price product access separately from high-touch implementation', 'tested', [['app/src/lib/governance/deal-desk.ts', 'an implementation fee floor apart from the licence'], ['app/src/lib/governance/deal-desk.test.ts', 'refuses a fee under the floor']], 'None.'],
  ['Price complex integrations separately from standard configuration', 'designed', [['docs/SAAS-LAUNCH-KIT.md', 'the pricing layers']], 'No integration line in the deal desk.'],
  ['Use enrollment or active-user bands for institutional pricing', 'designed', [['docs/SAAS-LAUNCH-KIT.md', 'the bands']], 'The deal desk has tier minimums, not bands.'],
  ['Do not paywall student export, deletion or access to student-owned plans', 'tested', [['app/src/lib/plans.test.ts', 'the plans'], ['app/src/lib/deleteaccount.test.ts', 'deletion for every account']], 'None.'],
  ['Include an AI allowance; meter unusually high use only after transparent notice', 'building', [['app/src/ai/providers/money.test.ts', 'the metered budget']], 'No notice before metering.'],
  ['Offer pilot credits toward annual expansion', 'tested', [['app/src/lib/governance/deal-desk.test.ts', 'a capped pilot credit']], 'None.'],
  ['Do not discount away security, accessibility, support or implementation', 'tested', [['app/src/lib/governance/deal-desk.test.ts', 'refuses a fee under the floor, whatever the discount']], 'Only the implementation fee is held.'],
]);

// ── 8. The go-live command center ────────────────────────────────────────────

/** The per-pilot page's fields, each the PilotPlan field that carries it, or null. */
export const COMMAND_CENTER: readonly { field: string; carriedBy: string | null }[] = [
  { field: 'Pilot name and cohort', carriedBy: 'cohort' },
  { field: 'Go-live date', carriedBy: 'startDate' },
  { field: 'Executive sponsor', carriedBy: 'executiveSponsor' },
  { field: 'Technical owner', carriedBy: null },
  { field: 'Student-success owner', carriedBy: 'operationalChampion' },
  { field: 'Security/privacy owner', carriedBy: null },
  { field: 'Accessibility owner', carriedBy: null },
  { field: 'Content owner', carriedBy: null },
  { field: 'Semester implementation owner', carriedBy: null },
  { field: 'Current phase', carriedBy: null },
  { field: 'Open blockers', carriedBy: null },
  { field: 'Data scope approval', carriedBy: 'productionDataApproved' },
  { field: 'SSO status', carriedBy: null },
  { field: 'Integration status', carriedBy: null },
  { field: 'Content readiness', carriedBy: null },
  { field: 'Accessibility review', carriedBy: null },
  { field: 'Training completion', carriedBy: null },
  { field: 'Student communication status', carriedBy: null },
  { field: 'Support readiness', carriedBy: null },
  { field: 'Monitoring status', carriedBy: null },
  { field: 'Rollback readiness', carriedBy: null },
  { field: 'Success-metric baseline', carriedBy: 'baseline' },
  { field: 'Launch decision', carriedBy: null },
];

/** The go/no-go meeting agenda, each with the section of this page that answers it. */
export const AGENDA: readonly { step: string; answeredBy: string }[] = [
  { step: 'Confirm pilot scope and exclusions', answeredBy: '6. The first pilot agreement' },
  { step: 'Confirm approved data fields and retention schedule', answeredBy: '5. The student-data migration playbook' },
  { step: 'Confirm access/role/tenant isolation tests', answeredBy: '2. The HECVAT tracker' },
  { step: 'Confirm source freshness and official fallback behavior', answeredBy: '3. The registration go-live checklist' },
  { step: 'Confirm student, advisor and admin critical journeys', answeredBy: '9. The final launch gate' },
  { step: 'Confirm accessibility test outcomes and known limitations', answeredBy: '2. The HECVAT tracker' },
  { step: 'Confirm support, incident and escalation contacts', answeredBy: '8. The go-live command center' },
  { step: 'Confirm monitoring, backup, restore, feature flag and rollback readiness', answeredBy: '2. The HECVAT tracker' },
  { step: 'Confirm launch communications and training', answeredBy: '1. The go-live decision standard' },
  { step: 'Record go/no-go decision, approvers, risks and next review date', answeredBy: '8. The go-live command center' },
];

// ── 9. The final launch gate ─────────────────────────────────────────────────

export const GATE_GROUPS = ['Product', 'Trust', 'Company', 'Launch and market'] as const;

export const FINAL_GATE: readonly GroupedItem[] = [
  ...grouped('Product', 'LC-GATE1', [
    ['Core student journeys work end to end', 'building', [['docs/GOLDEN-PATH-TEST-SCRIPT.md', 'the script'], ['app/src/lib/registration-day.ts', 'the registration path']], 'See the journeys in the Definition of Done.'],
    ['Core staff and admin workflows work end to end', 'building', [['app/src/screens/console.test.tsx', 'the console']], 'No scripted staff or admin path.'],
    ['Real auth and persistent data are live', 'building', [['app/src/lib/deleteaccount.test.ts', 'delete-account, live in production']], 'Device-first by design; sync and accounts are live, institutional data is not.'],
    ['Mobile, keyboard, screen reader, error and loading states complete', 'building', [['app/src/a11y/axe.test.tsx', 'the probe'], ['docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md', 'the states']], 'No human pass.'],
    ['Source labels and data freshness visible', 'tested', [['app/src/lib/source.test.ts', 'the labels']], 'Freshness is not on every fact.'],
    ['Support and feedback paths exist', 'tested', [['supabase/support-tickets.check.sql', 'tickets'], ['supabase/feedback.check.sql', 'feedback']], 'No support address (DEP-09).'],
    ['Critical flows have tests and monitoring', 'building', [['app/src/lib/statuspage.test.ts', 'the probe']], 'Tests yes; monitoring of flows no.'],
    ['No demo data presented as verified production data', 'tested', [['app/src/lib/demosplit.test.ts', 'the demo wears its label, at its own address']], 'None.'],
  ]),
  ...grouped('Trust', 'LC-GATE2', [
    ['Privacy and terms published', 'designed', [['docs/legal/PRIVACY-POLICY-DRAFT.md', 'draft'], ['docs/legal/TERMS-OF-SERVICE-DRAFT.md', 'draft']], 'Drafts awaiting counsel.'],
    ['Security controls reviewed', 'designed', [['docs/trust/SECURITY-WHITEPAPER.md', 'the controls']], 'No independent review.'],
    ['RLS and authorization review complete', 'tested', [['supabase/rls-coverage.check.sql', 'coverage'], ['supabase/grants.check.sql', 'grants']], 'None.'],
    ['SECURITY DEFINER function review complete', 'tested', [['app/src/lib/definerregister.test.ts', 'all 151'], ['supabase/definer-sweep.check.sql', 'each called by a stranger']], 'DR-01 and DR-03 open, both low.'],
    ['Data inventory and retention schedule complete', 'tested', [['app/src/lib/retention.test.ts', 'the schedule']], 'Table level.'],
    ['Export/deletion works', 'tested', [['app/src/lib/deleteaccount.test.ts', 'deletion'], ['app/src/lib/export.test.ts', 'export']], 'Per student.'],
    ['AI policy and controls are live', 'building', [['app/src/lib/aikillswitch.test.ts', 'the switch']], 'No AI Use Policy.'],
    ['Accessibility statement and testing complete', 'building', [['app/src/a11y/axe.test.tsx', 'automated']], 'No statement, no human pass.'],
    ['Incident and restore drills performed', 'designed', [['RESTORE.md', 'the procedure'], ['docs/market-readiness/INCIDENT_RESPONSE.md', 'the plan']], 'Neither performed on production.'],
    ['Subprocessor register published', 'designed', [['docs/SUBPROCESSORS.md', 'the list']], 'In progress.'],
  ]),
  ...grouped('Company', 'LC-GATE3', [
    ['Entity, domain, banking, accounting, contracts, IP and insurance ready', 'designed', [['docs/SAAS-LAUNCH-KIT.md', 'the formation checklist and nine coverages']], 'An LLC exists; the rest is tracked there, mostly not started.'],
    ['Support, billing, refund and cancellation processes ready', 'building', [['app/src/lib/billing/checkout.test.ts', 'checkout'], ['app/src/lib/billing/cancel.test.ts', 'cancel reaches Stripe before it is recorded (D-132)']], 'The refund policy is a draft; failed-payment reminders are recorded, not sent.'],
    ['Company email, contact, careers, security, privacy and accessibility channels active', 'building', [['app/src/site/render.tsx', 'the contact, careers, security, privacy and accessibility routes']], 'No support address (DEP-09).'],
    ['Sales materials, pricing, SOW, DPA, MSA and SLA ready', 'designed', [['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'the outline'], ['docs/trust/SLA.md', 'the SLA outline']], 'No MSA.'],
    ['Trust Room and RFP response library ready', 'tested', [['supabase/trust-room.check.sql', 'the NDA-gated procurement room'], ['docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md', 'the library']], 'Not every Trust Room artifact exists; see the list.'],
  ]),
  ...grouped('Launch and market', 'LC-GATE4', [
    ['Website explains current product and future vision honestly', 'tested', [['app/src/lib/ops/claims.test.ts', 'every label on the site is the register’s']], 'None.'],
    ['Pricing and CTA paths work', 'tested', [['app/src/site/site.test.tsx', 'every route renders']], 'Join the pilot and the advisory council have no path.'],
    ['Product analytics measure meaningful actions', 'designed', [['docs/ANALYTICS-EVENTS.md', 'the events']], 'No “I understand what to do next” measure.'],
    ['Student advisory and pilot recruitment plan active', 'not-started', [['docs/PRIVATE-BETA-PROGRAM.md', 'the beta program']], 'No advisory council.'],
    ['Customer-success and implementation plan ready', 'designed', [['docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md', 'the playbook']], 'No success-plan template with the fourteen fields.'],
    ['Initial launch cohort defined', 'not-started', [['app/src/lib/gtm/pilot.ts', 'where a cohort would be recorded']], 'None defined.'],
    ['Feedback loop, bug triage and release process active', 'tested', [['supabase/feedback.check.sql', 'feedback'], ['app/src/lib/flags.test.ts', 'every flag with an owner and a rollback']], 'None.'],
    ['Public status and changelog available', 'tested', [['app/src/lib/statuspage.test.ts', 'the status page'], ['CHANGELOG.md', 'the changelog']], 'The changelog is not a site page.'],
  ]),
];

// ── 10. The claim register, keyed on nine words ──────────────────────────────

/** Each word the brief says needs evidence, and the rows of `ops/claims.ts` that carry it. Empty means nothing may say it. */
export const CLAIM_WORDS: readonly { word: string; needs: string; claims: readonly string[]; note: string }[] = [
  { word: 'Secure', needs: 'Security controls, monitoring, incident process, evidence', claims: ['rls', 'secrets', 'mfa', 'audit-log', 'incident-notice', 'pen-test', 'soc2'], note: 'Say which control, never the adjective.' },
  { word: 'Accessible', needs: 'WCAG testing, VPAT, known limitations, issue process', claims: ['a11y-site', 'a11y-app', 'a11y-human', 'vpat'], note: 'Automated testing is held; the human pass and VPAT are not.' },
  { word: 'AI-powered', needs: 'Accurate description of AI functions, providers, controls, limitations', claims: ['ai-course-policy'], note: 'No row describes the providers and limits in one line.' },
  { word: 'Integrated', needs: 'Real supported integration with documented scope and status', claims: ['sso', 'lti', 'sis', 'scim', 'oneroster', 'connector-health'], note: 'Each integration carries its own status.' },
  { word: 'Replaces', needs: 'Native authoritative workflow, migration, support, continuity, institutional agreement', claims: [], note: 'No row; lmsclaims.test.ts keeps the app from saying it replaces LMS grading.' },
  { word: 'Improves student success', needs: 'Responsible evidence and methodology', claims: [], note: 'No row; the proof policy refuses a causal claim without method.' },
  { word: 'Trusted by', needs: 'Written permission and verified customer relationship', claims: [], note: 'No row; the proof policy refuses a logo without written permission.' },
  { word: 'Enterprise-ready', needs: 'Contract, security, support, implementation, recovery and governance capability', claims: ['hecvat', 'dpa', 'soc2', 'restore-drill'], note: 'Every row it rests on is short of available.' },
  { word: 'Compliant', needs: 'Defined legal or standards scope and external/legal validation', claims: [], note: 'No row; HECVAT and TrustEd are not certifications.' },
];

// ── 11. Documents and pages ──────────────────────────────────────────────────

export const PUBLIC_LEGAL: readonly { doc: string; carriedBy: string | null; note: string }[] = [
  { doc: 'Privacy Policy', carriedBy: 'docs/legal/PRIVACY-POLICY-DRAFT.md', note: 'Draft.' },
  { doc: 'Terms of Service', carriedBy: 'docs/legal/TERMS-OF-SERVICE-DRAFT.md', note: 'Draft.' },
  { doc: 'Acceptable Use Policy', carriedBy: 'docs/legal/ACCEPTABLE-USE-POLICY-DRAFT.md', note: 'Draft.' },
  { doc: 'Community Guidelines', carriedBy: 'docs/legal/COMMUNITY-GUIDELINES-DRAFT.md', note: 'Draft; published only when a school turns Community on.' },
  { doc: 'Copyright / DMCA process', carriedBy: 'docs/legal/COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md', note: 'Draft; no designated agent is registered.' },
  { doc: 'AI Policy', carriedBy: 'docs/legal/AI-USE-POLICY-DRAFT.md', note: 'Draft; the training policy prevails where they differ.' },
  { doc: 'Cookie / analytics policy', carriedBy: 'docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md', note: 'Draft; no cookie is set, and the company site now says so.' },
  { doc: 'Accessibility Statement', carriedBy: 'docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md', note: 'Draft; claims no conformance.' },
  { doc: 'Security contact and responsible disclosure', carriedBy: 'SECURITY.md', note: 'Published, with security.txt.' },
  { doc: 'Subprocessor Register', carriedBy: 'docs/SUBPROCESSORS.md', note: 'In progress.' },
  { doc: 'Data Retention and Deletion Policy', carriedBy: 'docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md', note: 'Draft; RETENTION.md prevails.' },
  { doc: 'Support Policy', carriedBy: 'docs/legal/SUPPORT-POLICY-DRAFT.md', note: 'Draft; the company site’s /support-policy now matches it.' },
  { doc: 'Incident Response Summary', carriedBy: 'docs/legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md', note: 'Draft; the procedure is unexercised.' },
  { doc: 'Advertising and Sponsorship Policy', carriedBy: 'docs/legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md', note: 'Draft.' },
];

export const INSTITUTIONAL_DOCS: readonly { doc: string; carriedBy: string | null; note: string }[] = [
  { doc: 'Data Processing Addendum', carriedBy: 'docs/trust/DPA-CHECKLIST.md', note: 'Checklist.' },
  { doc: 'FERPA / student-data privacy summary', carriedBy: 'docs/FERPA-COPPA-1EDTECH-READINESS.md', note: 'Readiness.' },
  { doc: 'Pilot Statement of Work', carriedBy: 'docs/SAAS-LAUNCH-KIT.md', note: 'Fields only.' },
  { doc: 'Master Subscription Agreement', carriedBy: null, note: 'None.' },
  { doc: 'Service Level Agreement', carriedBy: 'docs/trust/SLA.md', note: 'Outline.' },
  { doc: 'Implementation Statement of Work', carriedBy: null, note: 'None.' },
  { doc: 'Acceptable Use addendum', carriedBy: null, note: 'None.' },
  { doc: 'AI and data-use addendum', carriedBy: 'docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md', note: 'A policy, not an addendum.' },
  { doc: 'Security addendum', carriedBy: 'docs/trust/SECURITY-WHITEPAPER.md', note: 'A whitepaper.' },
  { doc: 'Accessibility documentation / VPAT', carriedBy: 'docs/trust/HECVAT-VPAT-PLAN.md', note: 'A plan.' },
  { doc: 'Business continuity summary', carriedBy: 'docs/market-readiness/DISASTER_RECOVERY.md', note: 'Internal.' },
];

export const TRUST_ROOM: readonly { artifact: string; carriedBy: string | null }[] = [
  { artifact: 'Executive product overview', carriedBy: 'docs/launch/WHAT-IS-SEMESTER.md' },
  { artifact: 'Architecture diagram', carriedBy: 'docs/ARCHITECTURE.md' },
  { artifact: 'Data-flow diagram', carriedBy: null },
  { artifact: 'Data inventory', carriedBy: 'RETENTION.md' },
  { artifact: 'Security overview', carriedBy: 'docs/trust/SECURITY-WHITEPAPER.md' },
  { artifact: 'HECVAT Lite and Full response', carriedBy: 'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md' },
  { artifact: 'Privacy and FERPA summary', carriedBy: 'docs/FERPA-COPPA-1EDTECH-READINESS.md' },
  { artifact: 'DPA', carriedBy: 'docs/trust/DPA-CHECKLIST.md' },
  { artifact: 'AI data-use and governance policy', carriedBy: 'docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md' },
  { artifact: 'Accessibility statement and VPAT', carriedBy: 'docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md' },
  { artifact: 'Subprocessor register', carriedBy: 'docs/SUBPROCESSORS.md' },
  { artifact: 'Incident-response summary', carriedBy: 'docs/market-readiness/INCIDENT_RESPONSE.md' },
  { artifact: 'Business-continuity summary', carriedBy: 'docs/market-readiness/DISASTER_RECOVERY.md' },
  { artifact: 'Support SLA', carriedBy: 'docs/trust/SLA.md' },
  { artifact: 'Integration guide', carriedBy: null },
  { artifact: 'Implementation plan', carriedBy: 'docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md' },
  { artifact: 'Pilot SOW', carriedBy: 'docs/SAAS-LAUNCH-KIT.md' },
  { artifact: 'Insurance certificates', carriedBy: null },
];

/** The site pages the brief lists: a route of the app's site and a path of the deployed company site, or null. */
export const SITE_PAGES: readonly { page: string; app: string | null; company: string | null }[] = [
  { page: 'Homepage', app: '/', company: '/' },
  { page: 'Product overview', app: '/product/', company: '/product' },
  { page: 'How it works', app: '/product/', company: null },
  { page: 'For students', app: '/students/', company: '/students' },
  { page: 'For institutions', app: '/institutions/', company: '/institutions' },
  { page: 'For advisors and faculty', app: null, company: '/faculty' },
  { page: 'For campus services', app: null, company: '/services' },
  { page: 'Pricing', app: '/pricing/', company: '/pricing' },
  { page: 'Pilot program', app: null, company: null },
  { page: 'Trust Center', app: null, company: '/trust' },
  { page: 'Security', app: '/security/', company: '/trust-security' },
  { page: 'Privacy', app: '/privacy/', company: '/trust-privacy' },
  { page: 'Accessibility', app: '/accessibility/', company: '/accessibility' },
  { page: 'AI policy', app: '/trust/data-and-ai-transparency/', company: '/trust-ai' },
  { page: 'Integrations', app: '/platform/integrations/', company: '/integrations' },
  { page: 'Resources', app: '/resources/', company: null },
  { page: 'Help center', app: '/help/', company: '/help' },
  { page: 'Status page', app: null, company: '/status' },
  { page: 'About', app: '/about/', company: '/company' },
  { page: 'Careers', app: '/careers/', company: '/careers' },
  { page: 'Contact', app: '/contact/', company: '/contact' },
  { page: 'Changelog', app: null, company: null },
];

/** The conversion points, held to the app site's routes. */
export const CONVERSIONS: readonly { point: string; route: string | null }[] = [
  { point: 'Start free', route: '/start/' },
  { point: 'Join the pilot', route: null },
  { point: 'Request a demo', route: '/demo/' },
  { point: 'Explore for institutions', route: '/institutions/' },
  { point: 'Download security overview', route: null },
  { point: 'Use a free planning tool', route: '/tools/' },
  { point: 'Join student advisory council', route: null },
  { point: 'Become a campus ambassador', route: '/community/ambassadors/' },
  { point: 'Contact partnerships', route: '/community/partners/' },
  { point: 'Contact support', route: '/help/' },
];

/** What the complete-company brief also asks, and the register already holding it, so it is not held twice. */
export const HELD_ELSEWHERE: readonly { area: string; heldBy: string }[] = [
  { area: 'Company foundation (entity, EIN, banking, domain, email, IP, trademark, insurance, cap table, board)', heldBy: 'docs/SAAS-LAUNCH-KIT.md' },
  { area: 'Revenue operations (billing, refunds, CRM, pipeline, renewal, CAC, margin)', heldBy: 'docs/OPERATIONAL-REALITY-REGISTER.md' },
  { area: 'Service-level objectives', heldBy: 'docs/operating-model/SLOS-AND-ERROR-BUDGETS.md' },
  { area: 'Production operations checklist', heldBy: 'docs/OPERATIONAL-READINESS-PACK.md' },
  { area: 'FERPA operating posture', heldBy: 'docs/FERPA-IDENTITY-GUARDRAILS.md' },
  { area: 'Contract boundaries', heldBy: 'docs/trust/PILOT-AGREEMENT-OUTLINE.md' },
  { area: 'Customer success', heldBy: 'docs/PILOT-TO-ANNUAL-CONVERSION.md' },
  { area: 'Help and support', heldBy: 'docs/market-readiness/SUPPORT_PLAYBOOK.md' },
];

// ── The Semester Definition of Done ──────────────────────────────────────────

export const DOD_QUESTIONS: readonly Item[] = rows('DOD', [
  ['Does it help a real user complete a meaningful job?', 'designed', [['docs/DO-NOT-BUILD.md', 'what is refused because it does not']], 'Asked at review; no test can ask it.'],
  ['Does it fit the unified Semester system?', 'tested', [['app/src/lib/oneos.test.ts', 'the five destinations, the shared objects, the vocabulary']], 'None.'],
  ['Is the data persistent, authorized, sourced and explainable?', 'tested', [['supabase/rls-coverage.check.sql', 'authorized'], ['app/src/lib/source.test.ts', 'sourced']], 'Persistence is device-first; explainability is per Action Center row.'],
  ['Does it work accessibly and on mobile?', 'tested', [['app/src/a11y/axe.test.tsx', 'accessibly'], ['app/src/widthgate.test.ts', 'on a narrow screen']], 'Automated only.'],
  ['Is it secure, privacy-safe, observable, testable and supportable?', 'building', [['app/src/lib/flags.test.ts', 'every flag has an owner and a rollback'], ['docs/operating-model/QUALITY-MANAGEMENT.md', 'the engineering definition of done']], 'Observable: no error tracking.'],
  ['Can it fail safely?', 'tested', [['app/src/lib/failure.test.ts', 'every failure read into a sentence'], ['app/src/lib/aikillswitch.test.ts', 'the AI can be switched off']], 'None.'],
  ['Can it be configured by an institution?', 'tested', [['supabase/tenant-plan.check.sql', 'the school’s plan'], ['supabase/intelligence-policy.check.sql', 'the school’s AI policy']], 'Most modules are build flags, not tenant settings.'],
  ['Can it be migrated, audited, exported, retained and deleted appropriately?', 'building', [['app/src/lib/export.test.ts', 'exported'], ['supabase/retention-sweeps.check.sql', 'retained'], ['app/src/lib/deleteaccount.test.ts', 'deleted']], 'No production load path for customer data exists; the Migration Center records evidence and roster staging is a foundation.'],
  ['Can the company honestly sell and support it?', 'tested', [['app/src/lib/ops/claims.test.ts', 'no label on the site the register does not know']], 'Support has no address yet.'],
]);

/** What a feature needs before it is launch-complete: the launch acceptance rule. */
export const ACCEPTANCE: readonly string[] = [
  'Persistent data', 'Authorization', 'Source and freshness labels', 'Validation', 'Accessibility coverage',
  'Error handling', 'Analytics', 'Support ownership', 'Tests', 'Rollback or feature-flag control',
];

/** What every journey needs. */
export const JOURNEY_STATES: readonly string[] = [
  'Authenticated and unauthorized states', 'Empty state', 'Loading state', 'Error state', 'Stale-data state',
  'Offline or degraded behavior where relevant', 'Mobile state', 'Keyboard state', 'Screen-reader state', 'Audit event where sensitive', 'Support path',
];

export interface Journey extends Item { user: string; steps: string }
type JRow = [user: string, steps: string, standing: Standing, evidence: Ev, gap: string];
export const JOURNEYS: readonly Journey[] = ([
  ['Student', 'Create account → set profile → build plan → see next action → save work → get help', 'tested', [['app/src/data/onboarding.test.ts', 'onboarding'], ['app/src/components/ActionCenter.help.test.tsx', 'next action and help']], 'The next action is behind today_action_center.'],
  ['Student planning', 'Select courses → compare options → resolve conflict → save primary plan and backups → prepare advisor agenda', 'tested', [['app/src/lib/registration-day.test.ts', 'the plan, backups and conflicts'], ['app/src/components/AdvisorMeeting.test.tsx', 'the agenda']], 'None.'],
  ['Student learning', 'Open course → add/select materials → generate study asset → complete practice → view source → save progress', 'tested', [['app/src/components/StudyStudio.test.tsx', 'the studio'], ['app/src/components/StudyStudio.anchors.test.tsx', 'the source']], 'None.'],
  ['Student support', 'Search for help → see verified resource → prepare question → create follow-up action → receive response', 'tested', [['app/src/components/GetHelp.test.tsx', 'help'], ['supabase/help-requests.check.sql', 'the request']], 'The response depends on staff who are not yet there.'],
  ['Student career', 'Save project → confirm skills → create portfolio evidence → prepare application or mentor action', 'building', [['app/src/lib/skills-graph.ts', 'suggested, confirmed or verified skills with evidence']], 'No portfolio export or application step.'],
  ['Faculty', 'Create or manage course context → publish materials/policy → approve source pack → review student-facing experience', 'tested', [['app/src/lib/coursestudio.test.ts', 'publish'], ['app/src/components/StudyStudio.packs.test.tsx', 'source packs']], 'No student-view preview.'],
  ['Advisor', 'Receive student-approved agenda → review shared plan → complete follow-up without accessing private data', 'tested', [['supabase/advisor.check.sql', 'only what was shared'], ['app/src/lib/advisor-meeting.test.ts', 'what a share carries']], 'None.'],
  ['Staff', 'Publish a verified resource or action → see content owner status → update or retire content', 'tested', [['supabase/officeactions.check.sql', 'office actions']], 'No content-owner status view.'],
  ['Institution admin', 'Configure tenant → roles → content → integrations → features → audit and support workflow', 'building', [['app/src/screens/console.test.tsx', 'the console']], 'Configuration is split between the console and the service role.'],
  ['Support team', 'Receive student-created support grant → diagnose → respond → close → audit access', 'tested', [['supabase/support-access.check.sql', 'the grant'], ['supabase/support-tickets.check.sql', 'the ticket']], 'None.'],
  ['Privacy user', 'Export personal data → revoke sharing → disconnect account → request deletion', 'tested', [['app/src/lib/export.test.ts', 'export'], ['app/src/lib/deleteaccount.test.ts', 'deletion']], 'None.'],
  ['Finance customer', 'Upgrade or cancel membership → view invoice → manage payment method → retain data export rights', 'building', [['app/src/lib/membership.test.ts', 'Plus bought from the Account screen after a ticked consent (D-128)'], ['app/src/lib/billing/cancel.test.ts', 'cancel reaches Stripe (D-132)']], 'Not tested end to end with a real card; no invoice view.'],
] as readonly JRow[]).map(([user, steps, standing, evidence, gap], i) => ({ id: id('LC-JRN', i), item: user, user, steps, standing, evidence: ev(evidence), gap }));

export const DOD_RULE = 'If the answer is “no” to any of those questions, the work is not complete yet.';

// ── Next actions ─────────────────────────────────────────────────────────────

/** The playbook's ten next actions and the summary's five, each with where it now stands. */
export const NEXT_ACTIONS: readonly { action: string; from: 'playbook' | 'summary'; answeredBy: string }[] = [
  { action: 'Convert the HECVAT checklist into an owner-based tracker with evidence links and due dates', from: 'playbook', answeredBy: 'Section 2: every row has a seat, a standing and evidence; due dates are the seats’ to set.' },
  { action: 'Complete the RLS and SECURITY DEFINER remediation register', from: 'playbook', answeredBy: 'docs/DEFINER-RLS-REGISTER.md (D-127, D-130); its fix is live (D-129); DR-01 and DR-03 open, both low.' },
  { action: 'Build the Migration Center artifacts for the first pilot', from: 'playbook', answeredBy: 'Section 5 lists the seventeen and the template; most carry nothing.' },
  { action: 'Have counsel convert the outline into an MSA, Pilot SOW and DPA', from: 'playbook', answeredBy: 'Owed to counsel; the repository cannot do it.' },
  { action: 'Complete the Registration and LMS checklists with actual test evidence', from: 'playbook', answeredBy: 'Sections 3 and 4: every row cites a test or says what is missing.' },
  { action: 'Run an accessibility review of the core path, plan, agenda and support flow', from: 'playbook', answeredBy: 'Owed: docs/accessibility/AT-PASS-PROTOCOL.md, unrun.' },
  { action: 'Run an incident-response and backup-restore tabletop', from: 'playbook', answeredBy: 'Owed: LC-HV5-04 and LC-HV5-09.' },
  { action: 'Prepare the Trust Room and HECVAT response library', from: 'playbook', answeredBy: 'Section 11: fifteen of eighteen artifacts carried; the procurement room is checked.' },
  { action: 'Select one cohort, one sponsor, one workflow and one date', from: 'playbook', answeredBy: 'Owed: LC-GATE4-06.' },
  { action: 'Conduct the formal go/no-go meeting and document the decision', from: 'playbook', answeredBy: 'Section 8 holds the agenda; docs/GO-NO-GO-CHECKLIST.md holds the gates.' },
  { action: 'Assign an owner, status, due date and evidence link to each HECVAT row', from: 'summary', answeredBy: 'Section 2.' },
  { action: 'Complete the RLS and SECURITY DEFINER register before connecting broad institutional records', from: 'summary', answeredBy: 'docs/DEFINER-RLS-REGISTER.md.' },
  { action: 'Use the pilot outline for attorney-reviewed MSA, Pilot SOW and DPA', from: 'summary', answeredBy: 'Owed to counsel.' },
  { action: 'Select one pilot cohort and complete the registration and LMS checklists', from: 'summary', answeredBy: 'Sections 3 and 4; the cohort is owed.' },
  { action: 'Run a formal go/no-go review', from: 'summary', answeredBy: 'Section 8.' },
];

/** Every item with a standing, for the tests and the counts. */
export const ITEMS: readonly Item[] = [
  ...GO_LIVE, ...HECVAT, ...REGISTRATION, ...LMS, ...GUARDRAILS, PILOT_TERM, ...PRICING_PRINCIPLES, ...FINAL_GATE, ...DOD_QUESTIONS, ...JOURNEYS,
];
