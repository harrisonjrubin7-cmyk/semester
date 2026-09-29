/**
 * The Role Launch Register: every role the database can grant, and how far each
 * one has come towards being switched on for a customer.
 *
 * `docs/ROLE-LAUNCH-REGISTER.md` is the prose half and is regenerated from this
 * file by `rolelaunch.test.ts`. The brief it answers asked for one row per role
 * and capability, with a user interface, provisioning, a positive and negative
 * test, an audit event, a runbook and training — and a role enabled only once
 * every row for it is complete.
 *
 * So a role's state is never written down here. `stateOf()` derives it from the
 * evidence, rung by rung, and the ladder is cumulative: a role with a screen but
 * no way to be granted is `modeled`, not `usable`, because a screen nobody can
 * be given is not a workflow anybody can complete. The rungs a role satisfies
 * out of order are still reported (`rungs()`), since they are work already done.
 *
 * The list of roles is not this file's to choose either. It is the rows of
 * `public.app_roles`, and the capabilities each role holds are the rows of
 * `public.role_capabilities`; the test reads both out of the migrations and
 * fails if this file names a role the database does not, or misses one it does.
 *
 * The finding, as of `5bc0330`, was that nothing assigns an app role:
 * `role_grants` was written by the service key and by nothing else, so every
 * role was `modeled`. Since `20260929110000_console_approvals_and_break_glass.sql`
 * there is one provisioning path, and only one: the operations console's
 * `role-grant` duty. A request names the person, the role, the scope and the
 * expiry; the security seat approves it; `console_act()` writes the mandatory
 * audit event and only then the grant, and fails closed if the event cannot be
 * written (`supabase/console-approvals.check.sql`). No SSO claim and no SCIM
 * group assigns an app role, and the test still asserts that from the code: a
 * second writer of `role_grants` turns it red and says which paragraph to
 * rewrite. Every role therefore reaches `provisionable` through the same path,
 * and the register's right-hand column counts what each holds beyond it.
 */

export const ROLE_STATES = [
  'defined',
  'modeled',
  'provisionable',
  'usable',
  'secure',
  'supportable',
  'launch-approved',
] as const;

export type RoleState = (typeof ROLE_STATES)[number];

/** What each rung means, in the brief's words. */
export const STATE_MEANING: Record<RoleState, string> = {
  defined: 'Role, purpose, scope, and boundaries documented',
  modeled: 'Role/capability/scope exists in authorization model',
  provisionable: 'Admin/SCIM/SSO/manual workflow can assign and revoke it',
  usable: 'Role-specific screens and workflow are implemented',
  secure: 'Positive and negative authorization tests pass',
  supportable: 'Training, runbook, audit trail, support routing, and recovery exist',
  'launch-approved': 'All required role acceptance criteria and sign-offs pass',
};

export type RoleCategory =
  | 'learner'
  | 'academic'
  | 'campus-office'
  | 'institution-admin'
  | 'platform'
  | 'external'
  | 'organization'
  | 'commercial';

export const CATEGORY_TITLE: Record<RoleCategory, string> = {
  learner: 'Student and learner roles',
  academic: 'Academic and support roles',
  'campus-office': 'Campus offices',
  'institution-admin': 'Institutional administration',
  platform: 'Semester platform operations',
  external: 'External and partner roles',
  organization: 'Student organizations',
  commercial: 'Semester commercial team',
};

/**
 * The boundary an internal role may not cross.
 *
 * No Semester-internal role inherits access to a student's records because it
 * is internal: a support agent sees a ticket, an incident responder sees a
 * switch, and neither sees a plan, a grade or an accommodation. The blueprint
 * states it as a principle; here it is two lists and a test. `OPERATIONS_ONLY`
 * is everything a `platform` or `commercial` role may hold, and
 * `STUDENT_RECORD` is every capability that reaches one student's own records.
 * `rolelaunch.test.ts` reads the matrix out of the migrations and refuses, in
 * both directions, a grant that puts one of the second list on a role of the
 * first kind — or a capability on such a role that neither list has heard of,
 * which is how a new grant gets looked at before it is inherited.
 */
export const OPERATIONS_ONLY: readonly string[] = [
  'console:operate',
  'approval:decide',
  'breakglass:request',
  'beta:manage',
  'beta:triage',
  'platform:configure',
  'support:ticket',
  'incident:communicate',
  'killswitch:engage',
  'moderation:action',
  'report:read',
  'review:moderate',
  'opportunity:moderate',
  'community:review',
  'community:review_senior',
  'community:escalation_agreements',
  'community:manage',
  'account:manage',
  'success:manage',
  'billing:operate',
  'compliance:manage',
  'content:manage',
  'campaign:manage',
  'campaign:report',
  'campaign:review',
  'trust:publish',
];

export const STUDENT_RECORD: readonly string[] = [
  'mentee:read',
  'help_request:respond',
  'accommodation:verify',
  'skill:verify',
  'support:read',
  'data_request:handle',
  'talent:search',
  'lti:launch',
  'audit:read',
  'outcomes:read',
  'demand:read',
  // Every enrollment at a school, and the registrar's overrides of one
  // student's checks (20260929300000_registration_transaction.sql).
  'registration:administer',
];

/** The categories whose roles are Semester's own people rather than a school's. */
export const INTERNAL_CATEGORIES: readonly RoleCategory[] = ['platform', 'commercial'];

/** A repository file and what it shows for this role. */
export interface RoleEvidence {
  path: string;
  shows: string;
}

export interface RoleRow {
  /** A row of `public.app_roles`, exactly. */
  role: string;
  category: RoleCategory;
  /** What the role must be able to do. */
  mayDo: string;
  /** What it must never reach. */
  mustNever: string;
  /** How a person is given and relieved of it. Empty while only the service key can. */
  provisioning: RoleEvidence[];
  /** Runbook for when the role's workflow fails. */
  runbook: RoleEvidence[];
  /** Training or quick-start material written for the role. */
  training: RoleEvidence[];
  /** Filled only by the launch council, and never before its seats are held. */
  approved: false;
}

/**
 * The screen through which a capability is exercised, where one exists. A role
 * has an interface when any capability it holds has one here — or, for a
 * learner, when it is the student application itself.
 */
export const SCREENS: Readonly<Record<string, RoleEvidence>> = {
  'help_request:respond': { path: 'app/src/components/HelpInbox.tsx', shows: 'the staff help inbox: open, reply, move a request' },
  'report:read': { path: 'app/src/screens/Moderation.tsx', shows: 'the report queue a moderator works' },
  'moderation:action': { path: 'app/src/screens/Moderation.tsx', shows: 'report actions, audited' },
  'opportunity:publish': { path: 'app/src/components/ListingDesk.tsx', shows: 'the desk an office uses to publish a verified listing' },
  'opportunity:moderate': { path: 'app/src/components/ListingDesk.tsx', shows: 'listing moderation for holders of opportunity:moderate' },
  'campaign:manage': { path: 'app/src/components/institutional/CampaignManager.tsx', shows: 'the campaign manager screen (switched off)' },
  'campaign:review': { path: 'app/src/components/institutional/CampaignManager.tsx', shows: 'campaign review in the same screen' },
  'campaign:report': { path: 'app/src/components/institutional/CampaignManager.tsx', shows: 'campaign reporting in the same screen' },
  'integration:view': { path: 'app/src/components/institutional/IntegrationDashboard.tsx', shows: 'connector health, history and conflicts' },
  'tenant:configure': { path: 'app/src/components/institutional/ControlPlane.tsx', shows: 'the tenant control plane' },
  'community:review': { path: 'app/src/components/community/Escalation.tsx', shows: 'two-reviewer escalation of a community case' },
};

const STUDENT_APP: RoleEvidence = { path: 'app/src/screens/Today.tsx', shows: 'the student application, entered at Today' };
const STUDENT_GUIDE: RoleEvidence = { path: 'docs/launch/STUDENT-QUICK-START.md', shows: 'student quick start' };
const FIRST_DAY: RoleEvidence = { path: 'docs/launch/FIRST-DAY-CHECKLISTS.md', shows: 'first-day checklist for this audience' };
const FACULTY_GUIDE: RoleEvidence = { path: 'docs/FACULTY-ENABLEMENT.md', shows: 'faculty enablement' };
const MODERATION_SOP: RoleEvidence = { path: 'docs/CAMPUS-MODERATION-SOP.md', shows: 'moderation standard operating procedure' };
const ESCALATION: RoleEvidence = { path: 'docs/CAMPUS-ESCALATION-POLICY.md', shows: 'escalation policy' };
const INTEGRATION_RUNBOOK: RoleEvidence = { path: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md', shows: 'integration operator runbook' };
const SUPPORT_PLAYBOOK: RoleEvidence = { path: 'docs/market-readiness/SUPPORT_PLAYBOOK.md', shows: 'support playbook' };
const CRISIS: RoleEvidence = { path: 'docs/CRISIS-RESPONSE-RUNBOOK.md', shows: 'crisis and incident response' };
const SSO_ONBOARDING: RoleEvidence = { path: 'docs/SSO-TENANT-ONBOARDING.md', shows: 'tenant SSO onboarding' };
const VOLUNTEERS: RoleEvidence = { path: 'docs/VOLUNTEER-MODERATOR-PROGRAM.md', shows: 'volunteer moderator training' };

type Seed = Omit<RoleRow, 'provisioning' | 'runbook' | 'training' | 'approved'> &
  Partial<Pick<RoleRow, 'runbook' | 'training'>>;

/**
 * The one provisioning path. It serves every role the same way — a request, an
 * approval by somebody other than the requester, an audit event that must be
 * written first — so every row cites it, and `rolelaunch.test.ts` asserts that
 * nothing else writes `role_grants`.
 */
export const CONSOLE_PROVISIONING: readonly RoleEvidence[] = [
  { path: 'supabase/migrations/20260929110000_console_approvals_and_break_glass.sql', shows: 'console_act(): the role-grant duty writes role_grants after its audit event, and fails closed without it' },
  { path: 'supabase/console-approvals.check.sql', shows: 'self-approval refused; the grant exists only after the audit row; nothing written when the audit writer cannot insert' },
  { path: 'app/src/screens/Console.tsx', shows: 'the Approvals view: request, decide, act' },
];

function row(seed: Seed): RoleRow {
  return { runbook: [], training: [], ...seed, provisioning: [...CONSOLE_PROVISIONING], approved: false };
}

export const ROLES: readonly RoleRow[] = [
  // ── learners ──────────────────────────────────────────────────────────────
  row({ role: 'prospective_student', category: 'learner', mayDo: 'Explore public programs, career paths, readiness tools, estimated cost/plan tools', mustNever: 'Institutional records, other users’ data' }),
  row({ role: 'student', category: 'learner', mayDo: 'Plan, study, search, create work, connect accounts, manage privacy, selectively share', mustNever: 'Other students’ private records, unauthorized institutional data', training: [STUDENT_GUIDE, FIRST_DAY] }),
  row({ role: 'undergraduate_student', category: 'learner', mayDo: 'Everything a student may, scoped to an undergraduate program', mustNever: 'Other students’ private records, unauthorized institutional data', training: [STUDENT_GUIDE] }),
  row({ role: 'graduate_student', category: 'learner', mayDo: 'Manage graduate milestones, funding and work planning, course/research workflows', mustNever: 'Other students’ records', training: [STUDENT_GUIDE] }),
  row({ role: 'admitted_student', category: 'learner', mayDo: 'Complete pre-arrival actions, first-term planning, orientation actions, accepted mentor workflow', mustNever: 'Current-student restricted data unless enrolled/authorized' }),
  row({ role: 'transfer_student', category: 'learner', mayDo: 'Prepare transfer evaluation request, view approved articulation rules, use estimates', mustNever: 'Self-verify transfer credit or approve equivalencies' }),
  row({ role: 'dual_enrollment_student', category: 'learner', mayDo: 'Use authorized planning and shared workflows with required guardian protections', mustNever: 'Unconsented sharing or general student network features' }),
  row({ role: 'alumni', category: 'learner', mayDo: 'Maintain selected profile, mentoring offer, alumni tools', mustNever: 'Current student data absent explicit contact/consent' }),

  // ── academic and support ─────────────────────────────────────────────────
  row({ role: 'faculty', category: 'academic', mayDo: 'Build/manage course content, define course AI policy, teach, assess, grade, give feedback', mustNever: 'Private student plans, diagnoses, unrelated records', training: [FACULTY_GUIDE, FIRST_DAY] }),
  row({ role: 'teaching_assistant', category: 'academic', mayDo: 'Perform delegated, course-scoped grading/support duties', mustNever: 'Unapproved grade controls or unrelated course/student data', training: [FACULTY_GUIDE] }),
  row({ role: 'academic_advisor', category: 'academic', mayDo: 'View only student-shared plans/agendas and authorized follow-up', mustNever: 'Private study activity, health, billing, or unrestricted browsing', training: [FIRST_DAY] }),
  row({ role: 'tutor', category: 'academic', mayDo: 'Manage assigned tutoring/session workflow and student-consented context', mustNever: 'Grades, private plans, unrelated student records' }),
  row({ role: 'learning_center_staff', category: 'academic', mayDo: 'Publish resources, manage tutoring availability/sessions where authorized', mustNever: 'Grades or broad private student data' }),
  row({ role: 'career_coach', category: 'academic', mayDo: 'Verify skills, publish opportunities and answer help requests for students who asked', mustNever: 'Grades, private plans, or students who have not asked' }),
  row({ role: 'peer_mentor', category: 'academic', mayDo: 'See onboarding-checklist progress of students who accepted them, within one cohort', mustNever: 'Any student before that student accepts the mentor' }),
  row({ role: 'orientation_leader', category: 'academic', mayDo: 'See onboarding-checklist progress of students who accepted them, within one cohort', mustNever: 'Academic or private records of the cohort' }),

  // ── campus offices ───────────────────────────────────────────────────────
  row({ role: 'disability_services_officer', category: 'campus-office', mayDo: 'Issue/revoke functional accommodation passport', mustNever: 'Diagnoses in Semester; unrestricted academic records' }),
  row({ role: 'registrar', category: 'campus-office', mayDo: 'Publish catalog, requirements, windows, approved articulation decisions, institutional actions', mustNever: 'Individual private plans, AI memory, unrestricted student browsing' }),
  row({ role: 'department_chair', category: 'campus-office', mayDo: 'View allowed aggregate demand/outcomes for scope', mustNever: 'Individual records' }),
  row({ role: 'dean', category: 'campus-office', mayDo: 'View allowed school-level aggregates and decisions', mustNever: 'Individual records without explicit authorization' }),
  row({ role: 'institutional_researcher', category: 'campus-office', mayDo: 'View governed, aggregate, suppressed analytics', mustNever: 'Individual student records' }),
  row({ role: 'financial_aid_officer', category: 'campus-office', mayDo: 'Publish limited official actions/checklists', mustNever: 'Student plans/cost scenarios unless specifically authorized' }),
  row({ role: 'student_accounts_officer', category: 'campus-office', mayDo: 'Publish limited billing/action prompts', mustNever: 'Student cost plans or payment details' }),
  row({ role: 'international_student_advisor', category: 'campus-office', mayDo: 'Publish compliance actions under approved scope', mustNever: 'Private student segments beyond approved source/need' }),
  row({ role: 'veterans_certifying_official', category: 'campus-office', mayDo: 'Publish certification actions under approved scope', mustNever: 'Private plans or unrelated data' }),
  row({ role: 'dining_staff', category: 'campus-office', mayDo: 'Work one school’s mobile-order queue, pause a location, read the shared-swipe pool as totals (dining:operate)', mustNever: 'A student’s balance or plan, or who gave or used a shared swipe' }),
  row({ role: 'residence_life_staff', category: 'campus-office', mayDo: 'Publish residence/action information under scope', mustNever: 'Roommate detail, precise location, academic records' }),
  row({ role: 'resident_assistant', category: 'campus-office', mayDo: 'Publish approved resource/event information', mustNever: 'Resident academic or private data' }),
  row({ role: 'counseling_liaison', category: 'campus-office', mayDo: 'Publish resource-only actions', mustNever: 'Student records or private wellbeing data' }),
  row({ role: 'athletics_compliance_officer', category: 'campus-office', mayDo: 'Publish approved compliance actions', mustNever: 'Health, injury, private study behavior, motivation inference' }),
  row({ role: 'career_center_staff', category: 'campus-office', mayDo: 'Publish career-office actions and events to the students they reach (D-048)', mustNever: 'Individual private plans, grades, or who acted on an action below a group of ten' }),
  row({ role: 'disability_services_staff', category: 'campus-office', mayDo: 'Publish disability-services resources and events (D-048)', mustNever: 'Accommodation records, health information, or which student opened a resource' }),
  row({ role: 'study_abroad_advisor', category: 'campus-office', mayDo: 'Publish study-abroad actions, deadlines and events (D-048)', mustNever: 'A student’s own study-abroad plan unless the student shares it' }),
  row({ role: 'first_year_staff', category: 'campus-office', mayDo: 'Publish first-year actions and events to the students they reach (D-048)', mustNever: 'Individual private plans or study activity' }),
  row({ role: 'athletic_academic_support', category: 'campus-office', mayDo: 'Read only what an athlete chose to share with them, while the share is live (D-039)', mustNever: 'Grades, NIL, hours logs, health, finances, location, or any share once revoked or expired' }),

  // ── institutional administration ─────────────────────────────────────────
  row({ role: 'university_admin', category: 'institution-admin', mayDo: 'Configure tenant, modules, branding, approved sources, policy, aggregate dashboards', mustNever: 'Unrestricted education-record browsing', training: [FIRST_DAY, SSO_ONBOARDING] }),
  row({ role: 'department_admin', category: 'institution-admin', mayDo: 'Manage approved department content and scoped configuration', mustNever: 'Other department/tenant records' }),
  row({ role: 'university_staff', category: 'institution-admin', mayDo: 'Perform only an explicitly granted, scoped duty', mustNever: 'Implicit global authority' }),
  row({ role: 'integration_admin', category: 'institution-admin', mayDo: 'Configure integrations, security policy, audit/access processes', mustNever: 'Student content unless separately authorized and audited', runbook: [INTEGRATION_RUNBOOK] }),
  row({ role: 'implementation_manager', category: 'institution-admin', mayDo: 'Configure sandbox tenant and launch setup', mustNever: 'Broad production student-data access', training: [SSO_ONBOARDING] }),
  row({ role: 'data_steward', category: 'institution-admin', mayDo: 'Process data requests under strict workflow', mustNever: 'AI memories and student plans absent required authority' }),
  row({ role: 'portfolio_council', category: 'institution-admin', mayDo: 'Decide governance items put to the council', mustNever: 'Any individual student record' }),

  // ── Semester platform ────────────────────────────────────────────────────
  row({ role: 'platform_admin', category: 'platform', mayDo: 'Maintain platform operations under least privilege and audit', mustNever: 'Automatic access to all application data' }),
  row({ role: 'support_agent', category: 'platform', mayDo: 'Handle support tickets and approved support-access sessions', mustNever: 'Student data without live student-created grant', runbook: [SUPPORT_PLAYBOOK] }),
  row({ role: 'incident_responder', category: 'platform', mayDo: 'Engage a kill switch and communicate an incident', mustNever: 'Student data beyond what the incident requires', runbook: [CRISIS] }),
  row({ role: 'moderator', category: 'platform', mayDo: 'Moderate reviews/opportunities, with author access strictly audited', mustNever: 'Unrelated private student data', runbook: [MODERATION_SOP], training: [VOLUNTEERS] }),
  row({ role: 'trust_safety_reviewer', category: 'platform', mayDo: 'Review community cases and propose actions for a second reviewer', mustNever: 'Private student data outside the case', runbook: [MODERATION_SOP, ESCALATION], training: [VOLUNTEERS] }),
  row({ role: 'trust_safety_senior', category: 'platform', mayDo: 'Approve or refuse escalations and hold escalation agreements', mustNever: 'Private student data outside the case', runbook: [MODERATION_SOP, ESCALATION] }),
  row({ role: 'community_manager', category: 'platform', mayDo: 'Manage community spaces and their rules', mustNever: 'Private student data or case content without review rights', runbook: [MODERATION_SOP] }),

  // ── external and partner ─────────────────────────────────────────────────
  row({ role: 'employer', category: 'external', mayDo: 'Search only opted-in, unexpired talent profiles; publish opportunities if approved', mustNever: 'Non-opted-in profiles, grades, plans, student records' }),
  row({ role: 'scholarship_provider', category: 'external', mayDo: 'Publish/maintain own approved listing', mustNever: 'Student education records' }),
  row({ role: 'marketplace_partner', category: 'external', mayDo: 'Publish approved deals/housing listings', mustNever: 'Student data absent authorized interaction' }),
  row({ role: 'transfer_partner_admin', category: 'external', mayDo: 'Propose equivalencies within partner scope', mustNever: 'Approve own proposals or inspect student records' }),
  row({ role: 'high_school_counselor', category: 'external', mayDo: 'Use public/consented dual-enrollment workflow only', mustNever: 'Student institutional record by default' }),
  row({ role: 'research_partner', category: 'external', mayDo: 'View only approved aggregate outcomes meeting suppression thresholds', mustNever: 'Individual student-level records' }),
  row({ role: 'business_admin', category: 'external', mayDo: 'Nothing yet: the role exists and holds no capability', mustNever: 'Any student record' }),

  // ── student organizations ────────────────────────────────────────────────
  row({ role: 'organization_member', category: 'organization', mayDo: 'Read one organization’s member information, files and meetings', mustNever: 'Other organizations, or members’ academic records' }),
  row({ role: 'organization_officer', category: 'organization', mayDo: 'Create and run one organization’s events', mustNever: 'Admitting or removing members; other organizations' }),
  row({ role: 'organization_admin', category: 'organization', mayDo: 'Manage one organization’s profile, members, applications and events', mustNever: 'Other organizations, or members’ academic records' }),

  // ── Semester commercial ──────────────────────────────────────────────────
  row({ role: 'account_executive', category: 'commercial', mayDo: 'Manage a prospect account and send its procurement room', mustNever: 'Any student data', training: [{ path: 'docs/gtm/EXECUTION-PLAN.md', shows: 'GTM execution plan' }] }),
  row({ role: 'trust_officer', category: 'commercial', mayDo: 'Publish documents to the trust room', mustNever: 'Any student data', runbook: [{ path: 'docs/trust/README.md', shows: 'the trust package and how it is maintained' }] }),
  row({ role: 'marketing_admin', category: 'commercial', mayDo: 'Manage and report on campaigns', mustNever: 'Any student data; sending a campaign nobody reviewed' }),
  row({ role: 'marketing_analyst', category: 'commercial', mayDo: 'Read campaign reports', mustNever: 'Editing or sending campaigns; any student data' }),
  row({ role: 'campaign_reviewer', category: 'commercial', mayDo: 'Review a campaign before it is sent', mustNever: 'Authoring the campaign they review' }),
  row({ role: 'finance_operator', category: 'commercial', mayDo: 'Read every billing account, subscription, invoice, contract and dunning case', mustNever: 'Account health; writing a price, invoice or payment through the API; any student data', runbook: [{ path: 'docs/COMMERCIAL-CORE.md', shows: 'the commercial core, billing flow and dunning' }] }),
  row({ role: 'customer_success', category: 'commercial', mayDo: 'Read implementation projects, success plans, QBRs, renewals and account health', mustNever: 'Any student data; outreach from a health snapshot nobody reviewed', runbook: [{ path: 'docs/COMMERCIAL-CORE.md', shows: 'the commercial core, delivery records and account health' }] }),
  row({ role: 'compliance_owner', category: 'commercial', mayDo: 'Read and maintain the control register, evidence index and public claims register', mustNever: 'Activating a claim with no control, owner and review date; any student data' }),
  row({ role: 'content_owner', category: 'commercial', mayDo: 'Read and maintain the content register and CTA routing table', mustNever: 'Publishing content with no owner, review date or source; any student data' }),
  row({ role: 'billing_contact', category: 'institution-admin', mayDo: 'Read one school’s contracts, invoices, subscriptions and renewal dates', mustNever: 'The school’s configuration, implementation records or any student data' }),
];

/**
 * Roles the brief names that are deliberately not app roles, and where each
 * one's access lives instead. Listed so the register cannot be read as having
 * forgotten them.
 */
export const NOT_APP_ROLES: readonly { brief: string; instead: string }[] = [
  { brief: 'Parent/supporter', instead: 'A family grant the student issues and can revoke (`accept_family_grant`, 20260921161500_roles.sql), not a role anybody holds over a student.' },
  { brief: 'Institution admin', instead: '`university_admin`.' },
  { brief: 'IT/security', instead: 'Split between `integration_admin` and `university_admin`; there is no single IT role.' },
  { brief: 'Alumni mentor', instead: '`alumni` offering mentoring, seen through `peer_mentor` only after a student accepts.' },
];

/** The facts `stateOf` needs that only the repository can supply. */
export interface RoleFacts {
  /** Capabilities this role holds in `public.role_capabilities`. */
  capabilities: readonly string[];
  /** SQL checks that name the role — the authorization tests that exercise it. */
  checks: readonly string[];
  /** Whether it is a row of `public.app_roles`. */
  modeled: boolean;
}

export function interfaceOf(role: RoleRow, facts: RoleFacts): RoleEvidence[] {
  const screens = facts.capabilities.map((c) => SCREENS[c]).filter((s): s is RoleEvidence => Boolean(s));
  const own = role.category === 'learner' && ['student', 'undergraduate_student', 'graduate_student'].includes(role.role) ? [STUDENT_APP] : [];
  const seen = new Set<string>();
  return [...own, ...screens].filter((s) => (seen.has(s.path) ? false : (seen.add(s.path), true)));
}

/** Every rung, satisfied or not, independent of the ones below it. */
export function rungs(role: RoleRow, facts: RoleFacts): Record<RoleState, boolean> {
  return {
    defined: role.mayDo.trim().length > 0 && role.mustNever.trim().length > 0,
    modeled: facts.modeled,
    provisionable: role.provisioning.length > 0,
    usable: interfaceOf(role, facts).length > 0,
    secure: facts.checks.length > 0,
    supportable: role.runbook.length > 0 && role.training.length > 0,
    'launch-approved': role.approved,
  };
}

/** The highest rung reached with every rung below it also reached. */
export function stateOf(role: RoleRow, facts: RoleFacts): RoleState | 'undefined' {
  const have = rungs(role, facts);
  let reached: RoleState | 'undefined' = 'undefined';
  for (const state of ROLE_STATES) {
    if (!have[state]) break;
    reached = state;
  }
  return reached;
}
