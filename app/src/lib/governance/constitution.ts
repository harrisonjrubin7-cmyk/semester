/**
 * The platform constitution and capability map.
 *
 * Semester has covered every product domain a university runs on. What is left
 * is not another module; it is keeping the ones there coherent. The rule this
 * file holds is the frame's own: every capability belongs to one of eight
 * primitives, and a proposed feature that strengthens none of them is
 * deferred, merged or rejected.
 *
 * Four briefs are held here, each as data a test can check against the tree:
 *
 *   - the eight primitives and the twelve questions a feature answers before
 *     work starts (`PRIMITIVES`, `ADMISSION`);
 *   - the priority order P0–P5 (`PRIORITIES`);
 *   - every capability the last four briefs named, marked with what the tree
 *     holds (`CAPABILITIES`), so "we should build X" starts from "X is
 *     absent / partial, and this is the file";
 *   - the departments and roles a university operating system eventually
 *     serves, each with the line it does not cross (`DEPARTMENTS`, `ROLES`).
 *
 * Same three rules as `maturity.ts`: a row that claims to exist cites a file
 * and the file exists; an absent one cites nothing and says what would close
 * it; the counts are stated in the test, so a change either way is a line in
 * a diff.
 *
 * Nothing here reads the network, the database or the clock.
 */

export const PRIMITIVE_IDS = [
  'identity-tenancy',
  'permission-consent-authority',
  'data-provenance',
  'policy-rules',
  'action-workflow',
  'integration-gateway',
  'trust-evidence',
  'experience-accessibility',
] as const;
export type PrimitiveId = (typeof PRIMITIVE_IDS)[number];

export interface Primitive {
  id: PrimitiveId;
  name: string;
  /** The one shared system Semester should have. */
  one: string;
  /** A file where it lives today. */
  home: string;
}

export const PRIMITIVES: readonly Primitive[] = [
  { id: 'identity-tenancy', name: 'Identity and tenancy', one: 'Who the actor is and which tenant boundary applies', home: 'packages/institution/src/identity.ts' },
  { id: 'permission-consent-authority', name: 'Permission, consent, and authority', one: 'Who may read, write, approve, share, export, or revoke for a stated purpose', home: 'app/src/lib/privacy.ts' },
  { id: 'data-provenance', name: 'Canonical data and provenance', one: 'What a record means, where it came from, how fresh it is, and how it is corrected', home: 'app/src/lib/provenance.ts' },
  { id: 'policy-rules', name: 'Policy and rules', one: 'Versioned institutional, course, contractual, and product constraints', home: 'packages/institution/src/policy.ts' },
  { id: 'action-workflow', name: 'Action and workflow', one: 'Draft, review, confirmation, execution, receipt, recovery, and reconciliation', home: 'app/src/lib/actions.ts' },
  { id: 'integration-gateway', name: 'Integration gateway', one: 'Bounded external-system contracts, health, idempotency, fallback, and revocation', home: 'app/server/institution/gateway.ts' },
  { id: 'trust-evidence', name: 'Trust and evidence', one: 'Audit events, controls, evidence, claims, incidents, and approvals', home: 'app/src/lib/ops/evidence.ts' },
  { id: 'experience-accessibility', name: 'Experience and accessibility', one: 'Coherent interaction patterns, accessible alternatives, errors, degraded behavior, and support routes', home: 'app/src/lib/accessmode.ts' },
];

/** Asked and answered before work starts on any feature, workflow, screen, integration or system. */
export const ADMISSION: readonly string[] = [
  'What student, faculty, staff or institution problem does this solve?',
  'Which of the eight primitives does it strengthen?',
  'What is the source of truth?',
  'What data is needed, and what is the minimum necessary amount?',
  'Who can read, write, share, export or delete it?',
  'What policy and consent rules apply?',
  'How does it work with keyboard, screen readers, mobile, low bandwidth and reduced motion?',
  'What does it do when a dependency fails or data is stale?',
  'What is the fallback or official handoff?',
  'What is the success metric?',
  'Who owns support, security, privacy, accessibility and operations?',
  'How can it be audited, exported, migrated, rolled back or retired?',
];

export const PRIORITY_IDS = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'] as const;
export type PriorityId = (typeof PRIORITY_IDS)[number];

export const PRIORITIES: Record<PriorityId, string> = {
  P0: 'Make the core platform safe, persistent, accessible and observable',
  P1: 'Complete the student Action Center, Path, Plan, Learning and Support loops',
  P2: 'Complete the faculty, advisor and institution operating workflows',
  P3: 'Complete integration, migration, trust and procurement systems',
  P4: 'Complete native LMS/SIS replacement modules through controlled parallel runs',
  P5: 'Expand into credentials, federation, marketplace, global, K–12, alumni and life',
};

/** The twelve approved operating rules, each with a boundary that already exists. */
export const PRINCIPLES: readonly { id: string; name: string; principle: string; heldBy: string }[] = [
  { id: 'student-control', name: 'Student control', principle: 'Students control personal plans, drafts, sharing, and exports.', heldBy: 'app/src/lib/advisor-shares.ts' },
  { id: 'institutional-authority', name: 'Institutional authority', principle: 'Official institutional systems remain authoritative unless an institution explicitly approves Semester for a bounded workflow.', heldBy: 'docs/DOMAIN-REPLACEMENT-REGISTER.md' },
  { id: 'provenance', name: 'Provenance', principle: 'Meaningful facts carry source, provenance, freshness, and correction paths.', heldBy: 'app/src/lib/provenance.ts' },
  { id: 'high-impact-actions', name: 'High-impact actions', principle: 'High-impact actions are explained, previewed, confirmed, and audited.', heldBy: 'app/src/lib/actions.ts' },
  { id: 'ai', name: 'AI', principle: 'AI cites authorized sources, follows institutional and course policy, and does not silently make high-impact decisions.', heldBy: 'app/src/lib/source.ts' },
  { id: 'least-privilege', name: 'Least privilege', principle: 'No person, integration, or agent receives unrestricted student-data access by default.', heldBy: 'app/src/lib/privacy.ts' },
  { id: 'tenancy-purpose', name: 'Tenancy and purpose', principle: 'Tenant data is isolated and sensitive requests are purpose-bound.', heldBy: 'app/server/institution/gateway.ts' },
  { id: 'accessibility', name: 'Accessibility', principle: 'Accessibility is a release criterion.', heldBy: 'docs/DEFINITION-OF-DONE.md' },
  { id: 'failure-recovery', name: 'Failure recovery', principle: 'Failures preserve data, expose honest status, and retain an official or human fallback.', heldBy: 'app/src/lib/statusnotice.ts' },
  { id: 'public-claims', name: 'Public claims', principle: 'Public claims cannot exceed verified maturity and current evidence.', heldBy: 'app/src/lib/ops/claims.ts' },
  { id: 'tenant-activation', name: 'Tenant activation', principle: 'Tenant activation requires the applicable policy, approval, data map, support ownership, monitoring, and rollback path.', heldBy: 'app/src/lib/governance/config-tiers.ts' },
  { id: 'smallest-safe-solution', name: 'Smallest safe solution', principle: 'Semester builds the smallest safe solution that improves a defined student decision or institutional workflow.', heldBy: 'docs/DO-NOT-BUILD.md' },
];

export type CapabilityStatus = 'partial' | 'absent';
export type Source = 'journeys' | 'institutional' | 'operating' | 'departments';

export interface Capability {
  id: string;
  title: string;
  source: Source;
  primitive: PrimitiveId;
  priority: PriorityId;
  status: CapabilityStatus;
  /** A file that holds part of it. Null exactly when absent. */
  evidence: string | null;
  /** What exists, and what would close the gap. */
  note: string;
}

const C = (id: string, source: Source, primitive: PrimitiveId, priority: PriorityId, status: CapabilityStatus, title: string, evidence: string | null, note: string): Capability => ({
  id, title, source, primitive, priority, status, evidence, note,
});

export const CAPABILITIES: readonly Capability[] = [
  // Learner-journey brief
  C('J-01', 'journeys', 'action-workflow', 'P1', 'partial', 'Universal learner journey engine', 'app/src/lib/pathway.ts', 'Life stages and milestone templates exist; no goal → decision → support → evidence → reflection chain, and no flow for major exploration, recovery, research, graduate school or alumni.'),
  C('J-02', 'journeys', 'experience-accessibility', 'P1', 'partial', 'Life-event model', 'app/src/lib/lifeevents.ts', 'Twelve events with no field to type in, drawn on Behind behind VITE_ME_LIFE_EVENTS (off by default): optional adjustments, help routes that seed Help with nothing filled in, a plan that clears after four weeks with one follow-up. Kept on the device only, sent nowhere. Not on Today, and Behind shows it only once a term is imported.'),
  C('J-03', 'journeys', 'action-workflow', 'P2', 'absent', 'Student-success playbook system', null, 'No institution-configurable playbook object; `institution-ops.ts` defines metrics and `CampaignManager.tsx` sends, neither is a playbook.'),
  C('J-04', 'journeys', 'experience-accessibility', 'P1', 'partial', 'Continuous feedback and “You said, we changed”', 'app/src/lib/momentfeedback.ts', 'Two of eight moments are asked (an AI answer that has a source, a help request just sent) behind VITE_ME_MOMENT_FEEDBACK (off by default), with a daily cap, a gap, a way out and an off switch; What’s new shows the log (empty) and the controls. Answers stay on the device: no collection path to a school exists, so no aggregate is shown to anyone. Six moments are declared and not asked.'),
  C('J-05', 'journeys', 'experience-accessibility', 'P5', 'partial', 'Learning-community infrastructure', 'app/src/community/circles.ts', 'Rules and schema are strong (opt-in, capped, ended, no popularity, no open DMs); circles are not persisted and have no screen.'),
  C('J-06', 'journeys', 'data-provenance', 'P5', 'partial', 'Academic portfolio and showcase', 'app/src/lib/career-evidence.ts', 'Confirmed skills, artifacts, résumé versions; no reflection step, no limited-share link, no per-item visibility column.'),
  C('J-07', 'journeys', 'experience-accessibility', 'P2', 'partial', 'Relationship map (My Network)', 'app/src/lib/mentors.ts', 'Career contacts with permission state and follow-up, mentors, advisor meetings; no unified view, and DO-NOT-BUILD rule 1 forbids a new root.'),
  C('J-08', 'journeys', 'data-provenance', 'P5', 'absent', 'Credential verification network', null, 'CREDENTIAL-WALLET.md is a design; no issuer model, revocation state, share model, QR verify page or schema registry.'),
  C('J-09', 'journeys', 'data-provenance', 'P3', 'absent', 'Content and knowledge strategy (layers and metadata)', null, 'Trust labels exist (`source.ts`, `where.ts`); no owner, licence, authority, expiry or locale metadata on content.'),
  C('J-10', 'journeys', 'trust-evidence', 'P3', 'partial', 'Institution benchmarking framework', 'app/src/lib/cohortfloor.test.ts', 'The small-cohort floor holds in app and database; no opt-in cross-institution benchmark exists, and none may rank publicly.'),
  C('J-11', 'journeys', 'experience-accessibility', 'P5', 'partial', 'Platform localization and cultural adaptation', 'app/src/lib/locale.ts', 'Date, time and number formats and RTL detection; no message catalogue, no `dir`, no terminology mapping, one data region.'),
  C('J-12', 'journeys', 'trust-evidence', 'P1', 'partial', 'AI transparency receipt', 'app/src/intelligence/Disclosure.tsx', 'Per-answer disclosure is built; no persisted per-interaction receipt with source versions and permissions used.'),
  C('J-13', 'journeys', 'permission-consent-authority', 'P0', 'partial', 'Education privacy UX (Privacy Center)', 'app/src/lib/mecontrols.ts', 'Fifteen Me controls and a Privacy screen; not yet one “what Semester knows” center, and no student view of who viewed a profile.'),
  C('J-14', 'journeys', 'trust-evidence', 'P3', 'partial', 'Ethical revenue and marketplace controls', 'app/src/lib/gtm/sponsor.ts', 'The sponsorship gate is built and tested; no per-item why/who/paid/data/hide card, and no marketplace.'),
  C('J-15', 'journeys', 'trust-evidence', 'P3', 'partial', 'Public ethics and accountability report', 'app/src/lib/standard.ts', 'The Semester Standard is public; the annual report is owed until a year has passed.'),
  // Institutional-intelligence brief
  C('I-01', 'institutional', 'data-provenance', 'P2', 'partial', 'Institutional memory system', 'app/src/lib/ops/operatingsystem.ts', 'A 60-row document register with owners and review dates; no versioned policies, catalog-year snapshots or “what changed” timeline.'),
  C('I-02', 'institutional', 'data-provenance', 'P2', 'partial', 'Decision provenance', 'app/src/lib/provenance.ts', 'Domain records carry decided_by and rationale; no generic model with authority, policy version, evidence and appeal path.'),
  C('I-03', 'institutional', 'action-workflow', 'P5', 'absent', 'Education workflow marketplace', null, 'Workflow state machines exist in `packages/institution`; no installable workflow package.'),
  C('I-04', 'institutional', 'action-workflow', 'P1', 'partial', 'Explainability by default beyond AI', 'app/src/lib/actions.ts', 'Actions, screens, policy denials and notifications each explain; three shapes, no shared contract, no “why can I do this”.'),
  C('I-05', 'institutional', 'policy-rules', 'P3', 'absent', 'Semantic policy and regulation engine', null, 'No clause extraction or version diff; `policysim.ts` simulates flag and retention changes only.'),
  C('I-06', 'institutional', 'permission-consent-authority', 'P2', 'partial', 'Cross-role simulation', 'app/src/components/institutional/RoleWorkspace.tsx', 'A sandbox preview with fixtures behind a build flag; production has no view-as by design.'),
  C('I-07', 'institutional', 'action-workflow', 'P3', 'absent', 'Workflow digital twin', null, 'Mapping simulation exists (`integration/simulate.ts`); no trigger → policy → role → notification → outcome model.'),
  C('I-08', 'institutional', 'trust-evidence', 'P0', 'partial', 'Platform observability graph', 'app/src/lib/statusnotice.ts', 'Incidents name affected screens by hand; no service → dependency → workflow → cohort model.'),
  C('I-09', 'institutional', 'experience-accessibility', 'P1', 'partial', 'Adaptive interface engine', 'app/src/lib/accessmode.ts', 'Device, preference and role adaptation exist and are never inferred; term phase and workflow are thin, and no one engine joins them.'),
  C('I-10', 'institutional', 'experience-accessibility', 'P5', 'partial', 'Product localization and terminology engine', 'app/src/lib/vocabulary.ts', 'Semester’s own terms are owned; the per-institution dictionary (course / module / paper) is planned only.'),
  C('I-11', 'institutional', 'action-workflow', 'P0', 'partial', 'Minimum-necessary automation framework', 'packages/institution/src/automation.ts', 'The seven-rung ladder is in the gateway contract and the commit path asks it, with its grounds, before it claims an action; eight features declare a rung in `automationrungs.ts`. Browser features other than the help request do not call it, and no action pipeline yet names who decides.'),
  C('I-12', 'institutional', 'policy-rules', 'P0', 'partial', 'Architecture simplification program', 'app/src/donotbuild.test.ts', 'Roots, notifiers, the locale formatter and the definer register are guarded mechanically; there is no general reuse-the-primitive guard.'),
  // Operating functions
  C('O-01', 'operating', 'trust-evidence', 'P3', 'absent', 'Accreditation and program review', null, 'Maturity area `accreditation` lists the controls; no outcomes mapping, curriculum map or evidence repository.'),
  C('O-02', 'operating', 'trust-evidence', 'P3', 'absent', 'Institutional research and survey operations', null, 'No survey builder, cohort selection or fatigue control; the cohort floor is the only part in place.'),
  C('O-03', 'operating', 'action-workflow', 'P3', 'partial', 'Campus events and space operations', 'app/src/screens/Activities.tsx', 'Campus activities exist; no RSVP/waitlist, room requests or capacity controls.'),
  C('O-04', 'operating', 'action-workflow', 'P3', 'partial', 'Student organizations and leadership', 'app/src/screens/Activities.tsx', 'Activities and a leadership record exist; no officer roles, transition checklist or budget handoff.'),
  C('O-05', 'operating', 'experience-accessibility', 'P3', 'partial', 'Institutional communications and crisis readiness', 'app/src/lib/statusnotice.ts', 'Status notices and an announcements screen; no audience targeting, acknowledgement or communication audit log.'),
  C('O-06', 'operating', 'data-provenance', 'P3', 'partial', 'Course materials and affordability', 'app/src/screens/Costs.tsx', 'A cost screen exists; no required-materials list, OER identification or library-reserve links.'),
  C('O-07', 'operating', 'integration-gateway', 'P3', 'absent', 'Data warehouse and institutional BI integration', null, 'No connectors, data catalog or query audit log; the trust dashboard is aggregate-only.'),
  C('O-08', 'operating', 'integration-gateway', 'P5', 'absent', 'Mobile ID and physical campus integration', null, 'Not built, and any build is bounded: no location tracking and no access-log browsing as a student feature.'),
  C('O-09', 'operating', 'action-workflow', 'P0', 'partial', 'Disaster and academic disruption planning', 'app/src/lib/governance/maturity.ts', 'Maturity area `disaster` lists the controls and offline study exists; no closure, modality-change or deadline-adjustment workflow.'),
  C('O-10', 'operating', 'data-provenance', 'P2', 'partial', 'Documentation and knowledge management', 'app/src/lib/ops/operatingsystem.ts', 'A document register with owners and review dates; no SOP library, versioned forms or staff onboarding.'),
];

/** A department, the boundary it is held to, and the primitive that serves it first. */
export interface Department {
  name: string;
  boundary: string;
}

export const DEPARTMENTS: readonly Department[] = [
  { name: 'Registrar', boundary: 'Remains authoritative for transcript, enrollment and degree conferral until formally replaced' },
  { name: 'Admissions / enrollment', boundary: 'Admissions decisions and official application records remain governed workflows' },
  { name: 'Financial aid', boundary: 'Do not calculate awards or expose detailed aid data without authorization' },
  { name: 'Student accounts / bursar', boundary: 'Do not operate the official ledger or store payment credentials' },
  { name: 'Housing / residence life', boundary: 'Avoid contracts, room assignments, incident case records and location data by default' },
  { name: 'Dining / campus card', boundary: 'Do not store purchase history or card credentials' },
  { name: 'Library', boundary: 'Licensed research content requires approved library integration' },
  { name: 'Disability / accessibility office', boundary: 'No diagnosis storage or broad faculty access' },
  { name: 'Counseling / wellbeing', boundary: 'No therapy notes, diagnoses or clinical case management' },
  { name: 'Title IX / conduct', boundary: 'Never build generic case management without specialist legal governance' },
  { name: 'Campus safety / emergency', boundary: 'Do not replace emergency systems or expose sensitive incident data early' },
  { name: 'International student office', boundary: 'No immigration advice or sensitive case files without specialized authority' },
  { name: 'Veterans / military services', boundary: 'Do not determine benefits eligibility' },
  { name: 'Athletics', boundary: 'No health or injury data, effort scoring or eligibility decisions' },
  { name: 'Student employment', boundary: 'Payroll and employment records remain HR-owned' },
  { name: 'Career services', boundary: 'No employer access without explicit student opt-in' },
  { name: 'Alumni / advancement', boundary: 'Strictly separate donor and advancement data from student academic records' },
  { name: 'Research administration', boundary: 'IRB, grants, contracts and compliance remain authorized specialist functions' },
  { name: 'Procurement', boundary: 'Procurement owns contract authority' },
  { name: 'Legal / compliance', boundary: 'Legal decisions and case files remain restricted' },
  { name: 'Institutional research', boundary: 'No small-cohort or individual surveillance analytics' },
  { name: 'Communications / marketing', boundary: 'Separate institutional communications from product marketing' },
  { name: 'Advancement / foundation', boundary: 'Separate from student data and respect fundraising law' },
  { name: 'Facilities / transportation', boundary: 'No real-time location tracking by default' },
  { name: 'IT / security', boundary: 'IT retains infrastructure and security authority' },
  { name: 'Human resources', boundary: 'Payroll, employment files and benefits remain HR-owned' },
  { name: 'Faculty senate / curriculum committees', boundary: 'Formal academic governance remains institution-controlled' },
  { name: 'Institutional effectiveness / accreditation', boundary: 'Preserve audit trails and approved evidence sources' },
  { name: 'Continuing education', boundary: 'Separate commercial and continuing-ed rules and credential requirements' },
  { name: 'Bookstore / OER office', boundary: 'Purchasing stays in official commerce systems' },
  { name: 'Community engagement', boundary: 'Student consent and safety requirements apply' },
  { name: 'Parent / family programs', boundary: 'Never default to education-record access' },
  { name: 'K–12 district operations', boundary: 'Separate COPPA/FERPA/state student-privacy product mode' },
];

/** What every role is defined by before it is allowed to exist. */
export const ROLE_FIELDS: readonly string[] = [
  'Scope',
  'Capabilities',
  'Data it can read',
  'Data it can never read',
  'Actions it can take',
  'Approval requirements',
  'Consent requirements',
  'Expiry',
  'Audit requirements',
  'Support and training needs',
];

export const ROLES: Record<string, readonly string[]> = {
  Learners: ['Student', 'Prospective student', 'Applicant', 'Admitted student', 'Transfer student', 'Dual-enrollment student', 'Graduate student', 'Returning student', 'Alumni', 'Lifelong learner'],
  Teaching: ['Faculty', 'Co-instructor', 'Teaching assistant', 'Instructional designer', 'Department chair', 'Program director', 'Dean'],
  Support: ['Academic advisor', 'Success coach', 'Tutor', 'Writing-center staff', 'Library staff', 'Career coach', 'Peer mentor', 'Orientation leader'],
  Offices: ['Registrar', 'Curriculum analyst', 'Financial-aid officer', 'Bursar staff', 'Housing staff', 'Dining staff', 'International advisor', 'Veterans certifying official', 'Athletics compliance officer', 'Disability services officer', 'Research administrator'],
  Governance: ['Institutional researcher', 'Institution administrator', 'IT administrator', 'Security officer', 'Privacy officer', 'Accessibility lead', 'Procurement officer', 'Legal counsel', 'Communications officer', 'Alumni/advancement officer'],
  Outside: ['Parent/guardian', 'Employer', 'Mentor', 'Community partner', 'Credential issuer', 'Integration partner', 'Vendor', 'Auditor', 'Accreditor', 'Government/regulatory reviewer'],
};

/** The fourteen operating areas Semester ends up containing. */
export const OPERATING_AREAS: readonly string[] = [
  'Academic Core',
  'Learning & Assessment',
  'Planning & Registration',
  'Advising & Support',
  'Campus Life',
  'Career & Lifelong Learning',
  'Identity & Credentials',
  'Finance & Affordability Navigation',
  'Communications & Community',
  'Research & Accreditation',
  'Institutional Operations',
  'Data, Trust & Governance',
  'Integration & Migration',
  'K–12 / Family / Alumni Extensions',
];

export function coverage(rows: readonly Capability[] = CAPABILITIES): { partial: number; absent: number } {
  return { partial: rows.filter((r) => r.status === 'partial').length, absent: rows.filter((r) => r.status === 'absent').length };
}

/** Rows per primitive, so the map shows where the weight is. */
export function byPrimitive(rows: readonly Capability[] = CAPABILITIES): Record<PrimitiveId, Capability[]> {
  const out = Object.fromEntries(PRIMITIVE_IDS.map((p) => [p, [] as Capability[]])) as Record<PrimitiveId, Capability[]>;
  for (const r of rows) out[r.primitive].push(r);
  return out;
}

export const roleCount = (): number => Object.values(ROLES).reduce((n, g) => n + g.length, 0);
