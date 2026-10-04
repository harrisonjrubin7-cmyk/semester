/**
 * The critical-journey catalog: every role and every domain, and what proves
 * each journey today.
 *
 * `docs/engineering-operations/CRITICAL-FLOW-TEST-PLAN.md` names ten priority
 * flows (CF-01..CF-10). They are the *spine*; this is the rest of the body: one
 * row for each journey a role in `rolelaunch.ts` must be able to finish, so
 * that "which journeys does a data steward have, and what covers them?" has an
 * answer that is not somebody's memory.
 *
 * A row is honest about three things the older plans only implied:
 *
 *   - what already proves it (`evidence`, every path checked to exist);
 *   - what does not (`owed`, in words);
 *   - how far it must be proved before it is allowed to ship (`gate`).
 *
 * The status is derived, never typed: a row with no evidence is `owed`; a row
 * with evidence and a non-empty `owed` is `partial`; only a row with evidence
 * and nothing owed is `automated`. That is the repository's own rule —
 * "Partial is not a pass" — written as arithmetic, so a row cannot be promoted
 * by editing a word.
 *
 * See docs/quality-system/02-JOURNEYS.md, which is held to this file by
 * `journey-catalog.test.ts`.
 */

/** The seven places a change is stopped, in order. Defined in docs/quality-system/04-GATES-AND-CI.md. */
export const QUALITY_GATES = [
  'commit',
  'pull-request',
  'integration',
  'staging',
  'canary',
  'production',
  'tenant-launch',
] as const;
export type QualityGate = (typeof QUALITY_GATES)[number];

/** The suites a journey can be proved by. Each is a section of docs/quality-system/03-SUITES.md. */
export type Layer =
  | 'unit'
  | 'component'
  | 'rls'
  | 'contract'
  | 'e2e'
  | 'a11y'
  | 'offline'
  | 'ai'
  | 'load'
  | 'security'
  | 'recovery'
  | 'synthetic';

export const DOMAINS = [
  'identity',
  'academic',
  'learning',
  'productivity',
  'ai',
  'campus',
  'community',
  'family',
  'finance',
  'career',
  'marketplace',
  'administration',
  'support-trust',
  'integration',
  'operations',
] as const;
export type Domain = (typeof DOMAINS)[number];

export type Priority = 'P0' | 'P1' | 'P2';

export interface JourneyEvidence {
  path: string;
  shows: string;
}

export interface Journey {
  /** `J-<DOMAIN>-NN`. Never reused. */
  id: string;
  title: string;
  domain: Domain;
  /** Rows of `public.app_roles` (rolelaunch.ts) that must be able to finish it. */
  roles: readonly string[];
  /** People who are not an app role: a guardian is a relationship, not a grant. */
  actors?: readonly string[];
  /** P0: blocks every gate it is named in. P1: blocks tenant launch. P2: tracked. */
  priority: Priority;
  /** The CRITICAL-FLOW-TEST-PLAN flow this journey is a part of, if any. */
  cf?: string;
  /** The first gate at which this journey must pass, and every later one. */
  gate: QualityGate;
  layers: readonly Layer[];
  /** Commands that exercise it, from `app/` unless they start `supabase/`. */
  run: readonly string[];
  evidence: readonly JourneyEvidence[];
  /** What is not yet proved. Empty only when nothing is owed. */
  owed: readonly string[];
  /** Whether production verification probes it (docs/quality-system/07). */
  synthetic: boolean;
}

export type JourneyStatus = 'automated' | 'partial' | 'owed';

export function statusOf(journey: Journey): JourneyStatus {
  if (journey.evidence.length === 0) return 'owed';
  return journey.owed.length === 0 ? 'automated' : 'partial';
}

// ── role groups: the same categories rolelaunch.ts uses, spelled out ─────────

const LEARNERS = [
  'prospective_student',
  'student',
  'undergraduate_student',
  'graduate_student',
  'admitted_student',
  'transfer_student',
  'dual_enrollment_student',
  'alumni',
] as const;
const ENROLLED = [
  'student',
  'undergraduate_student',
  'graduate_student',
  'transfer_student',
  'dual_enrollment_student',
] as const;

const SQL = (suite: string, shows: string): JourneyEvidence => ({ path: `supabase/${suite}.check.sql`, shows });
const APP = (path: string, shows: string): JourneyEvidence => ({ path: `app/${path}`, shows });

export const JOURNEYS: readonly Journey[] = [
  // ── identity ──────────────────────────────────────────────────────────────
  {
    id: 'J-ID-01',
    title: 'Sign up, verify, sign in, recover, use on a second device',
    domain: 'identity',
    roles: [...LEARNERS],
    priority: 'P0',
    cf: 'CF-02',
    gate: 'pull-request',
    layers: ['e2e', 'rls', 'offline', 'synthetic'],
    run: ['npm run smoke:sync', 'npm run smoke:golden'],
    evidence: [
      APP('scripts/account-sync.mjs', 'two devices through a real local Supabase Auth'),
      APP('scripts/golden-path.mjs', 'first run to resume, phone and desktop'),
    ],
    owed: ['sign-up → verify → recover → export → delete in one scripted run (release gate G1)'],
    synthetic: true,
  },
  {
    id: 'J-ID-02',
    title: 'Provision and deprovision people through SSO and SCIM',
    domain: 'identity',
    roles: ['university_admin', 'department_admin', 'university_staff', 'integration_admin', 'implementation_manager'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['contract', 'rls', 'security'],
    run: ['npx vitest run server/institution/scim.test.ts', 'supabase/check.sh identity-provisioning'],
    evidence: [
      APP('server/institution/scim.test.ts', 'SCIM lifecycle and group mapping at the service'),
      SQL('identity-provisioning', 'provisioning rows, tenant-scoped'),
      SQL('tenant-sso-policy', 'per-tenant SSO policy'),
    ],
    owed: ['a real identity provider; the SCIM service is not mounted on a route'],
    synthetic: false,
  },
  {
    id: 'J-ID-03',
    title: 'Grant a role: request, a second person approves, audit first',
    domain: 'identity',
    roles: ['platform_admin', 'university_admin', 'data_steward', 'implementation_manager', 'portfolio_council'],
    priority: 'P0',
    gate: 'pull-request',
    layers: ['rls', 'security'],
    run: ['supabase/check.sh console-approvals', 'supabase/check.sh rolegrants', 'supabase/check.sh role-grant-audit'],
    evidence: [
      SQL('console-approvals', 'self-approval refused; no grant without the audit row'),
      SQL('rolegrants', 'who may grant which role'),
      SQL('role-grant-audit', 'every grant leaves an audit event'),
    ],
    owed: ['browser journey for the approvals view; role-grant paths outside the console are asserted absent only by a grep'],
    synthetic: false,
  },

  // ── academic ──────────────────────────────────────────────────────────────
  {
    id: 'J-ACA-01',
    title: 'Add a course from its syllabus; deadlines and degree path follow',
    domain: 'academic',
    roles: [...ENROLLED],
    priority: 'P0',
    cf: 'CF-03',
    gate: 'pull-request',
    layers: ['e2e', 'a11y', 'unit'],
    run: ['npm run smoke:golden', 'npm run smoke:a11y'],
    evidence: [
      APP('scripts/golden-path.mjs', 'syllabus pasted, reviewed, approved, listed on the course'),
      APP('scripts/accessibility-smoke.mjs', 'critical journeys at desktop and 400% reflow'),
      APP('src/lib/degree.test.ts', 'path snapshot, and that it is not an audit'),
    ],
    owed: ['the same journey signed in', 'hostile and malformed files through the real extractor'],
    synthetic: false,
  },
  {
    id: 'J-ACA-02',
    title: 'Plan registration, resolve conflicts, hand off to the official system',
    domain: 'academic',
    roles: ['student', 'undergraduate_student', 'graduate_student', 'registrar'],
    priority: 'P0',
    cf: 'CF-04',
    gate: 'staging',
    layers: ['unit', 'rls', 'contract', 'load'],
    run: ['supabase/check.sh registration_transaction', 'npx vitest run src/lib/registration-day.test.ts', 'supabase/load.sh'],
    evidence: [
      SQL('registration_transaction', 'enrollment transaction, registrar overrides, refusals'),
      APP('src/lib/registration-day.test.ts', 'registration-day behaviour'),
      APP('server/institution/registration.test.ts', 'gateway registration contract'),
    ],
    owed: ['readback against a real student information system; no seat or eligibility claim exists until then'],
    synthetic: false,
  },
  {
    id: 'J-ACA-03',
    title: 'Publish the catalog and requirements; approve a transfer equivalency',
    domain: 'academic',
    roles: ['registrar', 'department_chair', 'dean', 'transfer_student', 'transfer_partner_admin'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'contract'],
    run: ['supabase/check.sh academic-record', 'supabase/check.sh records'],
    evidence: [
      SQL('academic-record', 'institution-approved record with change history'),
      SQL('records', 'record access by scope'),
    ],
    owed: ['a named registrar acceptance run on the tenant'],
    synthetic: false,
  },
  {
    id: 'J-ACA-04',
    title: 'Advising meeting from a plan the student chose to share',
    domain: 'academic',
    roles: ['academic_advisor', 'student', 'undergraduate_student', 'graduate_student'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'unit'],
    run: ['supabase/check.sh advisor', 'supabase/check.sh share-audit'],
    evidence: [
      SQL('advisor', 'advisor sees only what was shared'),
      SQL('share-audit', 'each share is audited and revocable'),
      APP('server/institution/advising.test.ts', 'gateway advising contract'),
    ],
    owed: ['browser journey for an advisor and a student on two devices'],
    synthetic: false,
  },
  {
    id: 'J-ACA-05',
    title: 'Arrive: pre-arrival actions, orientation checklist, accepted mentor',
    domain: 'academic',
    roles: ['admitted_student', 'orientation_leader', 'peer_mentor', 'first_year_staff'],
    priority: 'P2',
    gate: 'tenant-launch',
    layers: ['rls'],
    run: ['supabase/check.sh mentor-rosters'],
    evidence: [SQL('mentor-rosters', 'a mentor sees only students who accepted them, in one cohort')],
    owed: ['browser journey for an admitted student'],
    synthetic: false,
  },
  {
    id: 'J-ACA-06',
    title: 'Explore programs and cost estimates without an account',
    domain: 'academic',
    roles: ['prospective_student'],
    priority: 'P1',
    gate: 'production',
    layers: ['e2e', 'synthetic'],
    run: ['npm run smoke:cold', 'npm run smoke:public-production'],
    evidence: [
      APP('scripts/cold-smoke.mjs', 'every address opens cold'),
      APP('scripts/public-production-smoke.mjs', 'the deployed public app and PostgREST'),
    ],
    owed: ['cost-estimate and readiness tools asserted in the browser, not only that the address opens'],
    synthetic: true,
  },

  // ── learning ──────────────────────────────────────────────────────────────
  {
    id: 'J-LRN-01',
    title: 'Build a course, publish, grade, give feedback, release grades',
    domain: 'learning',
    roles: ['faculty', 'teaching_assistant', 'student'],
    priority: 'P0',
    gate: 'tenant-launch',
    layers: ['rls', 'unit', 'security'],
    run: ['supabase/check.sh gradebook', 'supabase/check.sh coursestudio'],
    evidence: [
      SQL('gradebook', 'grade writes by course scope; grade-change audit'),
      SQL('coursestudio', 'course authoring and publication'),
    ],
    owed: ['browser journey for a grade change end to end', 'grade passback to a real learning system'],
    synthetic: false,
  },
  {
    id: 'J-LRN-02',
    title: 'Launch from the learning system by LTI, with grade passback off',
    domain: 'learning',
    roles: ['faculty', 'student', 'integration_admin'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['contract', 'rls', 'security'],
    run: ['supabase/check.sh lti', 'supabase/check.sh ltiags', 'npx vitest run src/lib/ltigate.test.ts'],
    evidence: [
      SQL('lti', 'launch validation'),
      SQL('ltiags', 'assignment and grade services scope'),
      APP('src/lib/ltigate.test.ts', 'writeback kill switch and default-off'),
    ],
    owed: ['run against a real platform; certification is not claimed'],
    synthetic: false,
  },
  {
    id: 'J-LRN-03',
    title: 'Study with sources: practice, flashcards, a plan, save or dismiss',
    domain: 'learning',
    roles: ['student', 'undergraduate_student', 'graduate_student', 'tutor', 'learning_center_staff'],
    priority: 'P1',
    cf: 'CF-05',
    gate: 'pull-request',
    layers: ['component', 'a11y', 'ai'],
    run: ['npx vitest run src/components/StudyStudio.test.tsx'],
    evidence: [APP('src/components/StudyStudio.test.tsx', 'the study studio, component level')],
    owed: ['browser journey with the model unavailable', 'tutoring session workflow for staff roles'],
    synthetic: false,
  },
  {
    id: 'J-LRN-04',
    title: 'Issue and revoke a functional accommodation passport',
    domain: 'learning',
    roles: ['disability_services_officer', 'disability_services_staff', 'faculty', 'student'],
    priority: 'P0',
    gate: 'tenant-launch',
    layers: ['rls', 'security'],
    run: ['supabase/check.sh expansion', 'supabase/check.sh grants'],
    evidence: [
      SQL('expansion', 'accommodation passport rows and their limits'),
      SQL('grants', 'no diagnosis is readable by faculty'),
    ],
    owed: ['a browser journey', 'faculty-side view acceptance by a disability-services officer'],
    synthetic: false,
  },

  // ── productivity ──────────────────────────────────────────────────────────
  {
    id: 'J-PRD-01',
    title: 'Add actions, events and notes offline; reconnect; conflicts shown',
    domain: 'productivity',
    roles: [...ENROLLED, 'admitted_student', 'alumni'],
    priority: 'P0',
    cf: 'CF-01',
    gate: 'pull-request',
    layers: ['offline', 'unit', 'rls', 'e2e'],
    run: ['npx vitest run src/lib/offline.test.ts src/lib/merge.test.ts', 'supabase/check.sh sync', 'npm run smoke:sync'],
    evidence: [
      APP('src/lib/offline.test.ts', 'poor-network behaviour at the unit'),
      APP('src/lib/merge.test.ts', 'field-level merge'),
      SQL('sync', 'sync rows, owner-scoped'),
      SQL('calendar', 'calendar rows, owner-scoped'),
    ],
    owed: ['throttled and partitioned browser run', 'clock-skew, reorder and revoke-while-offline simulator'],
    synthetic: false,
  },
  {
    id: 'J-PRD-02',
    title: 'Write a document, sheet or deck; export it; restore it elsewhere',
    domain: 'productivity',
    roles: [...ENROLLED, 'alumni'],
    priority: 'P1',
    gate: 'pull-request',
    layers: ['unit', 'component', 'rls'],
    run: ['npx vitest run src/lib/export.test.ts', 'supabase/check.sh productivity'],
    evidence: [
      APP('src/lib/export.test.ts', 'export shape'),
      SQL('productivity', 'productivity rows, owner-scoped'),
    ],
    owed: ['export → fresh browser → restore, asserted on content'],
    synthetic: false,
  },

  // ── ai ────────────────────────────────────────────────────────────────────
  {
    id: 'J-AI-01',
    title: 'Ask the assistant: sources shown, injection refused, kill switch stops it',
    domain: 'ai',
    roles: [...ENROLLED, 'faculty'],
    priority: 'P0',
    cf: 'CF-05',
    gate: 'staging',
    layers: ['ai', 'security', 'unit'],
    run: ['npx vitest run src/ai/injection.test.ts', 'npm run eval:model-quality', 'npm run drill:killswitch'],
    evidence: [
      APP('src/ai/injection.test.ts', 'injection guards, deterministic'),
      APP('src/ai/injection.live.test.ts', 'red-team against the model in use'),
      APP('src/ai/modelquality.live.test.ts', 'the model-quality evaluation set'),
      APP('scripts/killswitch-drill.mjs', 'the kill switch drill'),
      SQL('intelligence-policy', 'per-school AI policy'),
    ],
    owed: ['a filed model-quality run', 'a release gate wired to the score'],
    synthetic: false,
  },
  {
    id: 'J-AI-02',
    title: 'Set a course AI policy; the assistant obeys it for that course',
    domain: 'ai',
    roles: ['faculty', 'teaching_assistant', 'student'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['ai', 'rls'],
    run: ['npx vitest run server/institution/intelligence-course-policy.test.ts', 'supabase/check.sh approved-source-policy-scope'],
    evidence: [
      APP('server/institution/intelligence-course-policy.test.ts', 'course policy at the gateway'),
      SQL('approved-source-policy-scope', 'approved-source scope per course'),
    ],
    owed: ['course policy asserted at the model call in a browser journey, not only at the gateway'],
    synthetic: false,
  },
  {
    id: 'J-AI-03',
    title: 'A consequential AI suggestion needs a person; the person can override',
    domain: 'ai',
    roles: ['academic_advisor', 'faculty', 'university_admin'],
    priority: 'P0',
    gate: 'tenant-launch',
    layers: ['ai', 'rls', 'security'],
    run: ['supabase/check.sh human-overrides'],
    evidence: [SQL('human-overrides', 'human override recorded; AI cannot act alone on a held class')],
    owed: ['a browser journey for the review queue'],
    synthetic: false,
  },

  // ── campus ────────────────────────────────────────────────────────────────
  {
    id: 'J-CAM-01',
    title: 'Order a meal; give or use a shared swipe; staff work the queue',
    domain: 'campus',
    roles: ['student', 'undergraduate_student', 'dining_staff'],
    priority: 'P2',
    gate: 'tenant-launch',
    layers: ['rls', 'load'],
    run: ['supabase/check.sh dining'],
    evidence: [SQL('dining', 'queue scope; staff never see a balance or who gave a swipe')],
    owed: ['browser journey', 'payment processor reconciliation'],
    synthetic: false,
  },
  {
    id: 'J-CAM-02',
    title: 'Find a space, a housing assignment, a person, a place on the map',
    domain: 'campus',
    roles: ['student', 'undergraduate_student', 'residence_life_staff', 'resident_assistant'],
    priority: 'P2',
    gate: 'tenant-launch',
    layers: ['rls', 'contract'],
    run: ['supabase/check.sh space-availability', 'npx vitest run server/institution/housing.test.ts'],
    evidence: [
      SQL('space-availability', 'space availability by scope'),
      APP('server/institution/housing.test.ts', 'housing at the gateway; no roommate detail'),
    ],
    owed: ['freshness service-level objective for campus feeds'],
    synthetic: false,
  },
  {
    id: 'J-CAM-03',
    title: 'Run a club or a team: members, events, officers, compliance',
    domain: 'campus',
    roles: [
      'organization_member',
      'organization_officer',
      'organization_admin',
      'athletic_academic_support',
      'athletics_compliance_officer',
    ],
    priority: 'P2',
    gate: 'tenant-launch',
    layers: ['rls', 'contract'],
    run: ['supabase/check.sh organizations', 'npx vitest run server/institution/clubs.test.ts'],
    evidence: [
      SQL('organizations', 'organization roles and what each may read'),
      APP('server/institution/clubs.test.ts', 'clubs at the gateway'),
      APP('server/institution/athletics.test.ts', 'athletics at the gateway; shared-only reads'),
    ],
    owed: ['browser journey for officers and members', 'compliance officer acceptance'],
    synthetic: false,
  },
  {
    id: 'J-CAM-04',
    title: 'An office publishes an action or event to the students it reaches',
    domain: 'campus',
    roles: [
      'career_center_staff',
      'study_abroad_advisor',
      'international_student_advisor',
      'veterans_certifying_official',
      'financial_aid_officer',
      'student_accounts_officer',
      'counseling_liaison',
      'department_admin',
    ],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'security'],
    run: ['supabase/check.sh officeactions'],
    evidence: [SQL('officeactions', 'publish scope; no group below the cohort floor is reported')],
    owed: ['a browser journey for the publishing desk', 'content-freshness objective'],
    synthetic: false,
  },

  // ── community ─────────────────────────────────────────────────────────────
  {
    id: 'J-COM-01',
    title: 'Report content; moderate; escalate to two reviewers; appeal',
    domain: 'community',
    roles: ['student', 'moderator', 'trust_safety_reviewer', 'trust_safety_senior', 'community_manager'],
    priority: 'P0',
    gate: 'tenant-launch',
    layers: ['rls', 'component', 'security'],
    run: ['supabase/check.sh reports', 'supabase/check.sh moderation-audit', 'supabase/check.sh community'],
    evidence: [
      SQL('reports', 'a report reaches the right queue and no other'),
      SQL('moderation-audit', 'every action audited'),
      SQL('community', 'community cases and severity'),
    ],
    owed: ['a staffed queue and an answered escalation drill'],
    synthetic: false,
  },
  {
    id: 'J-COM-02',
    title: 'Join a members-only course room, message, react, leave',
    domain: 'community',
    roles: [...ENROLLED],
    priority: 'P0',
    gate: 'tenant-launch',
    layers: ['rls', 'security'],
    run: ['supabase/check.sh rooms', 'supabase/check.sh school-membership', 'supabase/check.sh classmates'],
    evidence: [
      SQL('rooms', 'rooms, messages, reactions by membership'),
      SQL('school-membership', 'membership enforcement'),
      SQL('classmates', 'classmates visibility'),
    ],
    owed: ['no school is switched on, so the evidence is not filed (release gate G2)'],
    synthetic: false,
  },

  // ── family ────────────────────────────────────────────────────────────────
  {
    id: 'J-FAM-01',
    title: 'Invite a guardian, choose what is shared, guardian views, student revokes',
    domain: 'family',
    roles: ['student', 'dual_enrollment_student', 'high_school_counselor'],
    actors: ['guardian'],
    priority: 'P0',
    gate: 'tenant-launch',
    layers: ['rls', 'security', 'component'],
    run: ['supabase/check.sh family', 'supabase/check.sh familyshare', 'supabase/check.sh k12-guardians', 'supabase/check.sh minimum-age'],
    evidence: [
      SQL('family', 'a guardian reads only what was shared'),
      SQL('familyinvites', 'invite and acceptance'),
      SQL('familyshare', 'granular share and revoke'),
      SQL('k12-guardians', 'age-dependent guardian policy'),
      SQL('minimum-age', 'minimum-age rules'),
    ],
    owed: ['browser journey for guardian and student on two devices', 'counsel review of age and relationship policy'],
    synthetic: false,
  },

  // ── finance ───────────────────────────────────────────────────────────────
  {
    id: 'J-FIN-01',
    title: 'Buy, change, cancel and refund a paid plan',
    domain: 'finance',
    roles: ['student', 'undergraduate_student', 'graduate_student', 'alumni', 'finance_operator', 'customer_success'],
    priority: 'P0',
    cf: 'CF-10',
    gate: 'staging',
    layers: ['rls', 'contract', 'security'],
    run: ['supabase/check.sh commercial'],
    evidence: [
      SQL('commercial', 'entitlements and the signed, idempotent webhook effects'),
      APP('src/lib/salecopy.test.ts', 'the copy, the price and the checkout agree'),
    ],
    owed: ['live charges are off pending approval', 'refund and dispute events change nothing yet', 'finance reconciliation'],
    synthetic: false,
  },
  {
    id: 'J-FIN-02',
    title: 'See a bill, choose a payment plan, pay, get a receipt',
    domain: 'finance',
    roles: ['student', 'undergraduate_student', 'graduate_student', 'student_accounts_officer', 'billing_contact'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'contract', 'unit'],
    run: ['supabase/check.sh student-accounts', 'supabase/check.sh student-payment-plans', 'supabase/check.sh financial-retention'],
    evidence: [
      SQL('student-accounts', 'charges visible to the owner and the office'),
      SQL('student-payment-plans', 'plan lifecycle'),
      SQL('financial-retention', 'financial records outlive deletion lawfully'),
    ],
    owed: ['off until a finance owner and specialist controls exist', 'processor and ledger reconciliation'],
    synthetic: false,
  },
  {
    id: 'J-FIN-03',
    title: 'The institution is billed: plan, usage, invoice, dispute',
    domain: 'finance',
    roles: ['billing_contact', 'finance_operator', 'account_executive', 'university_admin'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'contract'],
    run: ['supabase/check.sh tenant-plan', 'supabase/check.sh commercial-automation'],
    evidence: [
      SQL('tenant-plan', 'tenant plan and entitlement'),
      SQL('commercial-automation', 'automated commercial steps'),
    ],
    owed: ['a signed order form and the counsel-reviewed agreement'],
    synthetic: false,
  },

  // ── career ────────────────────────────────────────────────────────────────
  {
    id: 'J-CAR-01',
    title: 'A verified opportunity is published; a student applies; the employer sees only the application',
    domain: 'career',
    roles: [
      'student',
      'undergraduate_student',
      'graduate_student',
      'employer',
      'scholarship_provider',
      'career_coach',
      'career_center_staff',
    ],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'contract'],
    run: ['supabase/check.sh listings', 'supabase/check.sh referrals', 'npx vitest run server/institution/career.test.ts'],
    evidence: [
      SQL('listings', 'listing publish and moderation'),
      SQL('referrals', 'referral scope'),
      APP('server/institution/career.test.ts', 'career at the gateway'),
    ],
    owed: ['browser journey for an applicant and a poster'],
    synthetic: false,
  },
  {
    id: 'J-CAR-02',
    title: 'Keep a lifelong profile; offer mentoring; stay reachable only by consent',
    domain: 'career',
    roles: ['alumni'],
    priority: 'P2',
    gate: 'tenant-launch',
    layers: ['rls'],
    run: ['supabase/check.sh grants'],
    evidence: [SQL('grants', 'an alumnus reads no current-student data')],
    owed: ['an alumni-specific suite', 'portable record export after offboarding'],
    synthetic: false,
  },

  // ── marketplace ───────────────────────────────────────────────────────────
  {
    id: 'J-MKT-01',
    title: 'A partner onboards, lists an offer, a moderator approves it',
    domain: 'marketplace',
    roles: ['marketplace_partner', 'research_partner', 'business_admin', 'moderator'],
    priority: 'P2',
    gate: 'tenant-launch',
    layers: ['rls', 'security'],
    run: ['supabase/check.sh listings'],
    evidence: [SQL('listings', 'listing publish and moderation')],
    owed: ['orders, fulfilment, disputes and payouts are not built; nothing may be marketed as live'],
    synthetic: false,
  },

  // ── administration ────────────────────────────────────────────────────────
  {
    id: 'J-ADM-01',
    title: 'Configure a tenant, move its ring, pull the kill switch',
    domain: 'administration',
    roles: ['university_admin', 'implementation_manager', 'platform_admin', 'portfolio_council'],
    priority: 'P0',
    cf: 'CF-08',
    gate: 'canary',
    layers: ['rls', 'e2e', 'security'],
    run: ['supabase/check.sh tenant-rollout', 'supabase/check.sh configuration-studio', 'npm run drill:killswitch'],
    evidence: [
      SQL('tenant-rollout', 'ring and rollout by tenant'),
      SQL('configuration-studio', 'configuration is versioned and second-person published'),
      SQL('feature_cohorts', 'release cohorts on flags'),
      APP('scripts/killswitch-drill.mjs', 'kill switch drill'),
    ],
    owed: ['target-tenant acceptance by a named customer role'],
    synthetic: false,
  },
  {
    id: 'J-ADM-02',
    title: 'Import a roster and migrate records; reconcile; roll back',
    domain: 'administration',
    roles: ['implementation_manager', 'university_staff', 'department_admin', 'data_steward'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'recovery'],
    run: ['supabase/check.sh roster-import', 'supabase/check.sh migration-center'],
    evidence: [
      SQL('roster-import', 'roster import is tenant-scoped and reversible'),
      SQL('migration-center', 'migration cases and verification'),
    ],
    owed: ['a parallel run against a real extract'],
    synthetic: false,
  },
  {
    id: 'J-ADM-03',
    title: 'A school leaves: inventory, two-sided approval, export, archive, purge window',
    domain: 'administration',
    roles: ['university_admin', 'data_steward', 'platform_admin', 'compliance_owner'],
    priority: 'P0',
    gate: 'tenant-launch',
    layers: ['rls', 'recovery', 'security'],
    run: ['supabase/check.sh school-offboarding', 'supabase/check.sh offboarding-grants'],
    evidence: [
      SQL('school-offboarding', 'cross-school and recovery cases'),
      SQL('offboarding-grants', 'access disabled at offboarding'),
      { path: 'docs/SCHOOL-OFFBOARDING.md', shows: 'the runbook' },
    ],
    owed: ['rehearsal by a second person', 'the purge is not built'],
    synthetic: false,
  },
  {
    id: 'J-ADM-04',
    title: 'Read governed, aggregate, suppressed analytics for a scope',
    domain: 'administration',
    roles: ['institutional_researcher', 'department_chair', 'dean', 'portfolio_council'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'security'],
    run: ['supabase/check.sh demand'],
    evidence: [SQL('demand', 'aggregate demand with a floor; no individual rows')],
    owed: ['a suppression test across every analytics view'],
    synthetic: false,
  },

  // ── support and trust ─────────────────────────────────────────────────────
  {
    id: 'J-SUP-01',
    title: 'Ask for help; share context with consent; get an answer; revoke',
    domain: 'support-trust',
    roles: ['student', 'undergraduate_student', 'support_agent', 'customer_success', 'incident_responder'],
    priority: 'P0',
    cf: 'CF-06',
    gate: 'staging',
    layers: ['rls', 'e2e', 'a11y'],
    run: ['supabase/check.sh support-access', 'supabase/check.sh support-tickets', 'supabase/check.sh help-requests'],
    evidence: [
      SQL('support-access', 'consented, aggregate-only, seven-day, revocable access'),
      SQL('support-tickets', 'tickets, off by default, targets by category'),
      SQL('help-requests', 'a request reaches the right responder'),
      APP('scripts/golden-path.mjs', 'the Guide and Support, signed out'),
    ],
    owed: ['a ticket does not yet attach a consented grant', 'a staffed queue and a named owner'],
    synthetic: false,
  },
  {
    id: 'J-SUP-02',
    title: 'Export or delete an account; holds and retention honoured',
    domain: 'support-trust',
    roles: ['student', 'data_steward', 'compliance_owner', 'trust_officer', 'alumni'],
    priority: 'P0',
    cf: 'CF-07',
    gate: 'staging',
    layers: ['rls', 'recovery', 'security'],
    run: ['supabase/check.sh deletion', 'supabase/check.sh legal-holds', 'supabase/check.sh retention-sweeps', 'npx vitest run src/lib/erasure.test.ts'],
    evidence: [
      SQL('deletion', 'deletion leaves no readable row'),
      SQL('legal-holds', 'a hold stops deletion'),
      SQL('retention-sweeps', 'sweeps respect holds'),
      SQL('audit-and-subject-requests', 'subject requests are logged'),
      APP('src/lib/erasure.test.ts', 'erasure at the library'),
    ],
    owed: ['the one scripted sign-up → export → delete run', 'a named answerer for rights requests'],
    synthetic: false,
  },
  {
    id: 'J-SUP-03',
    title: 'Publish the trust room; place and lift a legal hold',
    domain: 'support-trust',
    roles: ['trust_officer', 'compliance_owner', 'content_owner', 'data_steward'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['rls', 'security'],
    run: ['supabase/check.sh trust-room', 'supabase/check.sh legal-holds'],
    evidence: [SQL('trust-room', 'trust-room publication'), SQL('legal-holds', 'hold placement and release')],
    owed: ['no hold has ever been placed in production'],
    synthetic: false,
  },

  // ── integration ───────────────────────────────────────────────────────────
  {
    id: 'J-INT-01',
    title: 'Configure, approve, sync, reconcile, pause, replay a connector',
    domain: 'integration',
    roles: ['integration_admin', 'implementation_manager', 'university_admin', 'research_partner'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['contract', 'rls', 'security'],
    run: ['supabase/check.sh integration-control-plane', 'supabase/check.sh integration-quality', 'npx vitest run src/lib/integration/pipeline.test.ts'],
    evidence: [
      SQL('integration-control-plane', 'approval, pause, replay, audit; tenant A vs B'),
      SQL('integration-quality', 'reconciliation and duplicates'),
      SQL('integration-hardening', 'kill switches'),
      APP('src/lib/integration/quality.test.ts', 'reconciliation at the library'),
    ],
    owed: ['no real adapter: nothing has ever reconciled against a real source', 'provider-degraded run for every domain'],
    synthetic: false,
  },
  {
    id: 'J-INT-02',
    title: 'Import a calendar or learning-system schedule; freshness and source shown',
    domain: 'integration',
    roles: [...ENROLLED],
    priority: 'P1',
    gate: 'staging',
    layers: ['contract', 'unit', 'e2e'],
    run: ['npx vitest run src/lib/integration/quality.test.ts', 'npm run smoke:golden'],
    evidence: [
      APP('src/lib/integration/quality.test.ts', 'freshness decays and never improves'),
      SQL('calendar', 'imported events are owner-scoped'),
    ],
    owed: ['recorded-fixture adapters for the calendar providers', 'a failing-adapter run that leaves the native calendar working'],
    synthetic: false,
  },

  // ── operations ────────────────────────────────────────────────────────────
  {
    id: 'J-OPS-01',
    title: 'Release: smoke, alert, degrade or roll back, record the evidence',
    domain: 'operations',
    roles: ['platform_admin', 'incident_responder'],
    priority: 'P0',
    cf: 'CF-09',
    gate: 'production',
    layers: ['synthetic', 'recovery', 'e2e'],
    run: ['npm run smoke:production', 'npx vitest run src/lib/rollback.test.ts'],
    evidence: [
      { path: '.github/workflows/production-smoke.yml', shows: 'hourly probe of the deployed app and PostgREST' },
      APP('scripts/production-smoke.mjs', 'institutional production probe'),
      APP('src/lib/rollback.test.ts', 'runbook preconditions'),
    ],
    owed: ['a second operator', 'alert delivery history', 'an immutable release record per revision'],
    synthetic: true,
  },
  {
    id: 'J-OPS-02',
    title: 'Restore from backup into an isolated target and verify invariants',
    domain: 'operations',
    roles: ['platform_admin', 'incident_responder', 'data_steward'],
    priority: 'P0',
    gate: 'tenant-launch',
    layers: ['recovery'],
    run: ['supabase/restore.sh', 'supabase/rehearse.sh'],
    evidence: [
      { path: 'supabase/restore.sh', shows: 'logical dump, restore, six-way comparison, in CI' },
      { path: 'docs/evidence/restore/2026-09-30-logical-rehearsal.md', shows: 'the filed logical rehearsal' },
    ],
    owed: ['production has never been restored; no recovery time or point can be stated', 'gateway journal has no backup'],
    synthetic: false,
  },
  {
    id: 'J-OPS-03',
    title: 'Run a campaign; review it; report on it without student data',
    domain: 'operations',
    roles: ['account_executive', 'marketing_admin', 'marketing_analyst', 'campaign_reviewer', 'content_owner'],
    priority: 'P2',
    gate: 'production',
    layers: ['rls', 'security'],
    run: ['supabase/check.sh gtm'],
    evidence: [SQL('gtm', 'no student data in sales or marketing views')],
    owed: ['public-claims check wired to campaign approval'],
    synthetic: false,
  },
  {
    id: 'J-OPS-04',
    title: 'Respond to an incident: declare, contain, communicate, review',
    domain: 'operations',
    roles: ['incident_responder', 'support_agent', 'platform_admin', 'trust_safety_senior'],
    priority: 'P1',
    gate: 'tenant-launch',
    layers: ['recovery'],
    run: ['npx vitest run src/lib/governance/incident-comms.test.ts'],
    evidence: [APP('src/lib/governance/incident-comms.test.ts', 'incident notice content is held')],
    owed: ['a tabletop and a live exercise', 'a staffed rota'],
    synthetic: false,
  },
];

/** Every app role a journey names, once. */
export function rolesCovered(journeys: readonly Journey[] = JOURNEYS): Set<string> {
  return new Set(journeys.flatMap((j) => [...j.roles]));
}

/** How many journeys sit in each status, for the dashboard in docs/quality-system/06. */
export function summary(journeys: readonly Journey[] = JOURNEYS): Record<JourneyStatus, number> {
  const out: Record<JourneyStatus, number> = { automated: 0, partial: 0, owed: 0 };
  for (const j of journeys) out[statusOf(j)] += 1;
  return out;
}

const DOMAIN_NAMES: Record<Domain, string> = {
  identity: 'Identity and tenancy',
  academic: 'Academic core',
  learning: 'Learning',
  productivity: 'Productivity',
  ai: 'AI services',
  campus: 'Campus life',
  community: 'Community and trust',
  family: 'Family and guardian',
  finance: 'Finance',
  career: 'Career and lifelong',
  marketplace: 'Marketplace',
  administration: 'Administration',
  'support-trust': 'Support, safety and rights',
  integration: 'Integration',
  operations: 'Operations and commercial',
};

/** The one-line count at the head of docs/quality-system/02-JOURNEYS.md. */
export function summaryLine(journeys: readonly Journey[] = JOURNEYS): string {
  const counts = summary(journeys);
  const by = (p: Priority) => journeys.filter((j) => j.priority === p).length;
  return (
    `**${journeys.length} journeys · ${by('P0')} P0 · ${by('P1')} P1 · ${by('P2')} P2 · ` +
    `${counts.automated} \`automated\` · ${counts.partial} \`partial\` · ${counts.owed} \`owed\`.** ` +
    `${journeys.filter((j) => j.gate === 'tenant-launch').length} are gated at \`tenant-launch\`; ` +
    `${journeys.filter((j) => j.synthetic).length} are probed in production.`
  );
}

/** What each P0 journey is still owed: the work list. */
export function renderDebtTable(journeys: readonly Journey[] = JOURNEYS): string {
  const rows = journeys
    .filter((j) => j.priority === 'P0')
    .map((j) => `| \`${j.id}\` | ${j.title} | ${j.owed.join('; ') || 'nothing'} |`);
  return ['| ID | Journey | Owed before it can be called proved |', '| --- | --- | --- |', ...rows].join('\n');
}

/** One table per domain, in `DOMAINS` order. */
export function renderJourneyTables(journeys: readonly Journey[] = JOURNEYS): string {
  const out: string[] = [];
  for (const domain of DOMAINS) {
    const inDomain = journeys.filter((j) => j.domain === domain);
    if (inDomain.length === 0) continue;
    out.push(`### ${DOMAIN_NAMES[domain]}`, '');
    out.push('| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |');
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const j of inDomain) {
      const who = [...j.roles, ...(j.actors ?? []).map((a) => `${a} (not a role)`)];
      const shown = who.length > 5 ? `${who.slice(0, 4).join(', ')}, +${who.length - 4} more` : who.join(', ');
      out.push(
        `| \`${j.id}\` | ${j.title} | ${shown} | ${j.priority} | ${j.cf ?? '—'} | \`${j.gate}\` | ` +
          `${j.layers.join(', ')} | ${statusOf(j)} |`,
      );
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}
