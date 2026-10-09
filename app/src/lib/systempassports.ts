/**
 * The system-level contracts for Semester's twenty-five product domains.
 *
 * A passport is a planning and governance contract, not evidence that a
 * system is implemented, deployed, connected, institution-approved or live.
 * Capability-level truth continues to live in `rollout-capabilities.ts` and
 * `governance/capability-governance.ts`; these rows say how those capabilities
 * must be bounded when a system is built.
 */

export const SYSTEM_RELATIONSHIPS = ['native', 'connected', 'orchestrated', 'embedded', 'linked'] as const;
export type SystemRelationship = (typeof SYSTEM_RELATIONSHIPS)[number];

export const SYSTEM_IDS = [
  'identity', 'authorization', 'consent', 'student-profile', 'academic',
  'registration', 'degree', 'learning', 'grades', 'advising',
  'calendar-tasks', 'documents', 'finance', 'financial-aid', 'campus',
  'community', 'career', 'family', 'alumni', 'institution-admin',
  'integrations', 'ai-gateway', 'operations', 'company-os', 'developer-ecosystem',
] as const;

export type SystemId = (typeof SYSTEM_IDS)[number];
export type CapabilityId = `CAP-${string}`;

export interface OperationalContract {
  owner: string;
  serviceLevel: string;
  alerts: readonly string[];
  runbook: string;
  rollback: string;
  featureFlags: readonly string[];
}

export interface SystemPassport {
  id: SystemId;
  name: string;
  purpose: string;
  relationships: readonly SystemRelationship[];
  semesterOwns: readonly string[];
  externalAuthorities: readonly string[];
  authority: readonly string[];
  records: readonly string[];
  commands: readonly string[];
  events: readonly string[];
  integrations: readonly string[];
  workflows: readonly string[];
  screens: readonly string[];
  sourceRules: readonly string[];
  auditEvidence: readonly string[];
  tests: readonly string[];
  operations: OperationalContract;
  dependencies: readonly SystemId[];
  capabilityIds: readonly CapabilityId[];
  externalGates: readonly string[];
}

type PassportInput = Omit<SystemPassport, 'sourceRules' | 'tests' | 'operations'> & {
  sourceRules?: readonly string[];
  tests?: readonly string[];
  operations?: Partial<OperationalContract>;
};

const DEFAULT_SOURCE_RULES = [
  'Render authority and freshness independently; never collapse them into one color or status.',
  'Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.',
  'Preserve source references, observed time, version and correction history on every governed record.',
] as const;

const DEFAULT_TESTS = [
  'Unit and contract tests for commands, events and validation.',
  'Tenant, relationship, policy and least-privilege negative tests.',
  'Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.',
  'Keyboard, screen-reader, mobile and reduced-motion acceptance.',
] as const;

function passport(input: PassportInput): SystemPassport {
  return {
    ...input,
    sourceRules: input.sourceRules ?? DEFAULT_SOURCE_RULES,
    tests: input.tests ?? DEFAULT_TESTS,
    operations: {
      owner: input.operations?.owner ?? 'Unassigned; activation prohibited until named.',
      serviceLevel: input.operations?.serviceLevel ?? 'Define an SLO before tenant activation.',
      alerts: input.operations?.alerts ?? ['Policy refusal trend', 'Stale-source threshold', 'Workflow failure or reconciliation backlog'],
      runbook: input.operations?.runbook ?? `docs/runbooks/${input.id}.md (required before activation)`,
      rollback: input.operations?.rollback ?? 'Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.',
      featureFlags: input.operations?.featureFlags ?? [`system.${input.id}.enabled`],
    },
  };
}

export const SYSTEM_PASSPORTS: readonly SystemPassport[] = [
  passport({
    id: 'identity', name: 'Identity', purpose: 'Resolve a person, account, institution and active context without merging people by convenience identifiers.',
    relationships: ['native', 'connected'],
    semesterOwns: ['Semester account', 'session and device state', 'active tenant and role context', 'identity-resolution receipts'],
    externalAuthorities: ['Institution identity provider', 'institutional person and affiliation feeds'],
    authority: ['A person may view and recover their account.', 'Institution identity administrators may provision or suspend scoped affiliations.', 'No role may merge people without reviewed evidence and an audit receipt.'],
    records: ['person', 'person_alias', 'account', 'session', 'affiliation', 'active_context'],
    commands: ['resolve_identity', 'switch_context', 'link_identity', 'revoke_session'],
    events: ['identity.resolved', 'context.changed', 'affiliation.changed', 'session.revoked'],
    integrations: ['OIDC', 'SAML', 'SCIM', 'institution directory'],
    workflows: ['Account recovery', 'Identity link review', 'Institution context change', 'Deprovisioning'],
    screens: ['Sign in', 'Account and sessions', 'Workspace switcher', 'Recovery'],
    auditEvidence: ['Resolution inputs and decision', 'Provider and policy version', 'Context changes', 'Session and affiliation revocations'],
    dependencies: [], capabilityIds: ['CAP-010'],
    externalGates: ['Owned-domain identity configuration', 'Tenant mapping approval', 'Live SSO and deprovision acceptance'],
    operations: { owner: 'Identity and security', alerts: ['Sign-in failure spike', 'Ambiguous identity resolution', 'Deprovisioning failure'] },
  }),
  passport({
    id: 'authorization', name: 'Authorization and Access', purpose: 'Make every read, command and approval depend on explicit tenant, relationship, role, purpose and policy context.',
    relationships: ['native', 'connected'],
    semesterOwns: ['Policy decisions', 'capability grants', 'approval duties', 'permission receipts'],
    externalAuthorities: ['Institution HR and role feeds', 'institution policy owners'],
    authority: ['Policy owners publish versioned rules.', 'Administrators grant only delegable capabilities within their scope.', 'Subjects and auditors may inspect relevant decision receipts.'],
    records: ['role_grant', 'capability_grant', 'policy_version', 'policy_decision', 'approval_duty'],
    commands: ['evaluate_policy', 'grant_capability', 'revoke_capability', 'request_access'],
    events: ['access.allowed', 'access.denied', 'grant.issued', 'grant.revoked'],
    integrations: ['Identity', 'institution role feed', 'policy engine'],
    workflows: ['Role grant', 'Access request', 'Emergency elevation', 'Periodic access review'],
    screens: ['Access request', 'Role and scope administration', 'Decision trail', 'Access review'],
    auditEvidence: ['Actor, subject, tenant, purpose and resource', 'Policy version and reasons', 'Grant provenance and expiry', 'Approval separation'],
    dependencies: ['identity'], capabilityIds: ['CAP-014'],
    externalGates: ['Institution role mapping approval', 'RLS and policy negative-test evidence', 'Named approvers'],
    operations: { owner: 'Security and institutional administration', alerts: ['Cross-tenant denial', 'Policy evaluation failure', 'Expired grant still in use'] },
  }),
  passport({
    id: 'consent', name: 'Consent and Delegation', purpose: 'Let a person grant, inspect and revoke specific uses or disclosures with immediate, verifiable enforcement.',
    relationships: ['native', 'orchestrated'],
    semesterOwns: ['Consent and delegation scopes', 'history', 'revocation workflow', 'access receipts'],
    externalAuthorities: ['Institution consent policy', 'downstream processors enforcing delegated access'],
    authority: ['The data subject grants and revokes where law and policy allow.', 'Privacy staff resolve exceptional or legally constrained requests.', 'Delegates can use only named data, purpose and duration.'],
    records: ['consent', 'delegation', 'disclosure_receipt', 'revocation_task'],
    commands: ['grant_consent', 'issue_delegation', 'revoke_consent', 'export_consent_history'],
    events: ['consent.granted', 'delegation.used', 'consent.revoked', 'revocation.enforced'],
    integrations: ['Authorization', 'Family', 'AI gateway', 'connected providers'],
    workflows: ['Consent grant', 'Delegation acceptance', 'Revocation and downstream enforcement', 'Disclosure review'],
    screens: ['Privacy center', 'Sharing and delegation', 'Access history', 'Revocation receipt'],
    auditEvidence: ['Exact scope, purpose and expiry', 'Policy and disclosure basis', 'Every delegated read', 'Downstream revocation result'],
    dependencies: ['identity', 'authorization'], capabilityIds: ['CAP-015'],
    externalGates: ['Counsel-approved consent basis', 'Processor enforcement contract', 'Revocation race and duplicate-event testing'],
    operations: { owner: 'Privacy', alerts: ['Revocation enforcement delay', 'Disclosure outside scope', 'Expired delegation use'] },
  }),
  passport({
    id: 'student-profile', name: 'Student Profile', purpose: 'Hold student-controlled preferences and product context without replacing the institution student record.',
    relationships: ['native', 'connected'],
    semesterOwns: ['Display preferences', 'accessibility preferences', 'student-authored profile fields', 'product status overlays'],
    externalAuthorities: ['Official demographic, enrollment and student-status records'],
    authority: ['Students edit personal preferences and optional profile fields.', 'Institution-fed fields remain read-only and source-labelled.', 'Support may correct only through an audited process.'],
    records: ['profile', 'preference', 'accessibility_setting', 'student_status_overlay'],
    commands: ['update_profile', 'set_preference', 'request_correction', 'export_profile'],
    events: ['profile.updated', 'preference.changed', 'correction.requested'],
    integrations: ['Identity', 'Consent', 'institution student feed'],
    workflows: ['Profile update', 'Source correction request', 'Export and deletion'],
    screens: ['Profile', 'Settings', 'Accessibility', 'Data export'],
    auditEvidence: ['Changed fields and actor', 'Source authority per field', 'Correction disposition', 'Export/delete receipt'],
    dependencies: ['identity', 'consent'], capabilityIds: ['CAP-011', 'CAP-016', 'CAP-017'],
    externalGates: ['Approved field map and minimization', 'Retention and correction process'],
    operations: { owner: 'Student experience and privacy' },
  }),
  passport({
    id: 'academic', name: 'Academic', purpose: 'Provide a source-aware course and term experience while official catalog, section and transcript authority stays explicit.',
    relationships: ['native', 'connected', 'orchestrated', 'embedded', 'linked'],
    semesterOwns: ['Course workspace', 'student planning overlays', 'course-material organization', 'workflow projections'],
    externalAuthorities: ['Official catalog', 'SIS course and section record', 'LMS course authority', 'transcript authority'],
    authority: ['Students organize personal course context.', 'Faculty control instructor-owned course content.', 'Registrars control official catalog and academic records.'],
    records: ['course_workspace', 'term', 'course_projection', 'section_projection', 'academic_record_reference'],
    commands: ['create_workspace', 'import_course', 'update_personal_course', 'request_record_correction'],
    events: ['course.imported', 'course.updated', 'source.changed', 'record.correction_requested'],
    integrations: ['SIS', 'LMS', 'catalog', 'document service'],
    workflows: ['Course import', 'Course change review', 'Academic-record correction', 'Term rollover'],
    screens: ['Courses', 'Course detail', 'Term deadlines', 'School records'],
    auditEvidence: ['Source and mapping version', 'Faculty/student/registrar authority', 'Date and content changes', 'Official handoff'],
    dependencies: ['identity', 'authorization', 'integrations'], capabilityIds: ['CAP-020', 'CAP-022', 'CAP-023', 'CAP-024', 'CAP-045'],
    externalGates: ['Approved SIS/LMS/catalog sources', 'Course-membership authorization', 'Mapping and reconciliation evidence'],
    operations: { owner: 'Academic platform' },
  }),
  passport({
    id: 'registration', name: 'Registration', purpose: 'Evaluate readiness and coordinate bounded enrollment requests without claiming success before the authoritative SIS reconciles.',
    relationships: ['connected', 'orchestrated', 'embedded', 'linked'],
    semesterOwns: ['Readiness projection', 'proposed schedule', 'request workflow', 'receipts and reconciliation tasks'],
    externalAuthorities: ['SIS enrollment, holds, prerequisites, time tickets and seat state'],
    authority: ['Students prepare and confirm requests.', 'Advisors review permitted exceptions.', 'Registrars approve overrides and reconcile outcomes.', 'The SIS decides official enrollment.'],
    records: ['readiness_evaluation', 'registration_request', 'readiness_fact', 'override', 'registration_receipt'],
    commands: ['evaluate_readiness', 'submit_registration_request', 'approve_override', 'cancel_request', 'reconcile_enrollment'],
    events: ['readiness.evaluated', 'registration.submitted', 'override.decided', 'registration.reconciled'],
    integrations: ['SIS registration adapter', 'Degree', 'Academic', 'Advising'],
    workflows: ['Registration readiness', 'Enrollment request', 'Override', 'Cancellation', 'Reconciliation'],
    screens: ['Student readiness checklist', 'Schedule builder', 'Advisor review', 'Registrar queue', 'Receipt'],
    auditEvidence: ['Input facts and freshness', 'Policy decision', 'Approval separation', 'Idempotency key', 'SIS result and reconciliation'],
    dependencies: ['identity', 'authorization', 'academic', 'degree', 'integrations', 'operations'], capabilityIds: ['CAP-050'],
    externalGates: ['Approved SIS read adapter before pilot claims', 'Separate write authorization', 'Tenant UAT and rollback rehearsal'],
    operations: { owner: 'Registrar platform and integration operations', serviceLevel: 'Define readiness and registration-window SLOs with the pilot institution.', alerts: ['Stale readiness fact', 'SIS request uncertainty', 'Reconciliation backlog'] },
  }),
  passport({
    id: 'degree', name: 'Degree Planning', purpose: 'Support source-linked what-if planning without presenting a projection as an official degree audit.',
    relationships: ['native', 'connected', 'embedded', 'linked'],
    semesterOwns: ['What-if plans', 'requirement projections', 'student annotations', 'comparison history'],
    externalAuthorities: ['Official catalog year', 'degree-audit engine', 'registrar certification'],
    authority: ['Students edit plans.', 'Advisors comment within assigned relationships.', 'Registrars certify official requirements and exceptions.'],
    records: ['degree_plan', 'requirement_projection', 'catalog_reference', 'exception_reference'],
    commands: ['create_plan', 'compare_plan', 'request_review', 'import_requirements'],
    events: ['plan.changed', 'requirements.imported', 'review.requested'],
    integrations: ['Catalog', 'SIS', 'official degree audit'],
    workflows: ['Requirement import', 'What-if comparison', 'Advisor review', 'Official handoff'],
    screens: ['Degree plan', 'Graduation simulator', 'Requirement detail', 'Advisor review'],
    auditEvidence: ['Catalog and source version', 'Assumptions and unresolved mappings', 'Reviewer comments', 'Official handoff'],
    dependencies: ['academic', 'integrations'], capabilityIds: ['CAP-044'],
    externalGates: ['Registrar-certified requirement map', 'Catalog-year validation', 'Explicit non-certification copy'],
    operations: { owner: 'Academic records and advising' },
  }),
  passport({
    id: 'learning', name: 'Learning', purpose: 'Create student-controlled, source-grounded study materials and formative practice without taking final assessment authority.',
    relationships: ['native', 'connected'],
    semesterOwns: ['Study guides', 'notes', 'practice items', 'mastery reflections', 'reading progress'],
    externalAuthorities: ['Instructor course policy', 'official assignments and assessments', 'LMS source material'],
    authority: ['Students create and revise study assets.', 'Faculty set course and integrity policy.', 'AI output remains draft until student review.'],
    records: ['study_asset', 'source_reference', 'practice_attempt', 'mastery_note'],
    commands: ['create_study_guide', 'generate_practice', 'record_attempt', 'confirm_extraction'],
    events: ['study_asset.created', 'practice.completed', 'source.corrected', 'extraction.confirmed'],
    integrations: ['Academic', 'Documents', 'AI gateway', 'LMS'],
    workflows: ['Multi-file study-guide generation', 'Calendar extraction review', 'Practice and reflection', 'Source correction propagation'],
    screens: ['Study Studio', 'Source locker', 'Practice', 'Exam runway'],
    auditEvidence: ['Uploaded and connected sources', 'Extraction confidence and confirmation', 'AI model/policy version', 'Student corrections'],
    dependencies: ['academic', 'documents', 'ai-gateway'], capabilityIds: ['CAP-004', 'CAP-025', 'CAP-028', 'CAP-029', 'CAP-030', 'CAP-056'],
    externalGates: ['Course policy and source authorization', 'Model evaluation and kill switch', 'No autonomous submission or grading'],
    operations: { owner: 'Learning experience and AI governance' },
  }),
  passport({
    id: 'grades', name: 'Grades', purpose: 'Support drafts, review and controlled release while the institution retains official grade and transcript authority.',
    relationships: ['native', 'connected', 'orchestrated'],
    semesterOwns: ['Draft grade work', 'release workflow', 'student-view projection', 'reconciliation receipt'],
    externalAuthorities: ['Instructor final judgment', 'LMS gradebook where authoritative', 'SIS transcript system'],
    authority: ['Faculty draft and review grades.', 'Required approvers release a batch.', 'Students view only authorized released or clearly pending results.'],
    records: ['grade_draft', 'rubric_result', 'grade_batch', 'release_receipt'],
    commands: ['save_grade_draft', 'submit_grade_batch', 'approve_release', 'publish_grade', 'reconcile_grade'],
    events: ['grade.drafted', 'grade.submitted', 'grade.released', 'grade.reconciled'],
    integrations: ['LMS gradebook', 'SIS grade transfer', 'Academic'],
    workflows: ['Grade drafting', 'Second approval', 'Release', 'SIS sync and reconciliation'],
    screens: ['Faculty gradebook', 'Release preview', 'Approval queue', 'Student grade view'],
    auditEvidence: ['Rubric and source inputs', 'Human review', 'Release authority', 'Sync and reconciliation result'],
    dependencies: ['academic', 'authorization', 'integrations'], capabilityIds: ['CAP-009'],
    externalGates: ['Faculty and registrar approval of the workflow', 'Grade privacy and accommodation tests', 'Target LMS/SIS acceptance'],
    operations: { owner: 'Academic operations', alerts: ['Unauthorized release attempt', 'Grade sync failure', 'Reconciliation mismatch'] },
  }),
  passport({
    id: 'advising', name: 'Advising', purpose: 'Coordinate student-controlled agendas, appointments, referrals and support workflows without hidden risk scoring.',
    relationships: ['native', 'connected', 'orchestrated'],
    semesterOwns: ['Meeting agenda', 'student-visible plan', 'referral workflow', 'permitted caseload projection'],
    externalAuthorities: ['Institution advising record where required', 'assigned-advisor relationships', 'support-service disposition'],
    authority: ['Students control agenda inputs and visibility.', 'Assigned advisors act within relationship scope.', 'Support offices own their case outcomes.'],
    records: ['advisor_assignment', 'meeting_agenda', 'success_plan', 'referral'],
    commands: ['prepare_agenda', 'request_appointment', 'create_referral', 'close_referral'],
    events: ['agenda.shared', 'appointment.requested', 'referral.created', 'referral.closed'],
    integrations: ['Calendar', 'Academic', 'Campus services', 'institution advising system'],
    workflows: ['Meeting preparation', 'Appointment', 'Referral', 'Case escalation'],
    screens: ['Student agenda', 'Advisor workspace', 'Referral status', 'Support handoff'],
    auditEvidence: ['Relationship and purpose', 'Student-visible reason', 'Shared fields', 'Referral decisions and receipts'],
    dependencies: ['identity', 'authorization', 'academic', 'calendar-tasks'], capabilityIds: ['CAP-006', 'CAP-019'],
    externalGates: ['Approved advising relationship feed', 'No surveillance or hidden risk score', 'Human support ownership'],
    operations: { owner: 'Student success' },
  }),
  passport({
    id: 'calendar-tasks', name: 'Calendar and Tasks', purpose: 'Unify personal plans with source-aware imported dates while preserving correction, offline and confirmation boundaries.',
    relationships: ['native', 'connected', 'orchestrated'],
    semesterOwns: ['Personal calendar overlays', 'tasks', 'reminders', 'local drafts and sync queue'],
    externalAuthorities: ['LMS assignments', 'institution deadlines', 'connected calendar events'],
    authority: ['Students manage personal items.', 'Connected sources own imported facts.', 'External writes require preview and explicit confirmation.'],
    records: ['calendar_item', 'task', 'reminder', 'sync_intent', 'conflict'],
    commands: ['create_task', 'confirm_imported_date', 'preview_calendar_write', 'confirm_calendar_write'],
    events: ['task.changed', 'date.confirmed', 'calendar_write.requested', 'calendar_write.reconciled'],
    integrations: ['Google Calendar', 'Microsoft Calendar', 'LMS', 'Academic'],
    workflows: ['Date extraction review', 'Reminder delivery', 'External write preview and confirmation', 'Offline reconciliation'],
    screens: ['Today', 'Calendar', 'Task detail', 'Week ahead', 'Behind plan'],
    auditEvidence: ['Original source and extracted value', 'Student confirmation or correction', 'External-write diff', 'Delivery and reconciliation state'],
    dependencies: ['identity', 'academic', 'integrations'], capabilityIds: ['CAP-001', 'CAP-002', 'CAP-003', 'CAP-005', 'CAP-007', 'CAP-008', 'CAP-018', 'CAP-021'],
    externalGates: ['Provider-scoped authorization', 'Write preview and idempotency', 'Honest offline and delivery status'],
    operations: { owner: 'Academic experience' },
  }),
  passport({
    id: 'documents', name: 'Documents and Sources', purpose: 'Preserve originals, editable work, citations, extraction history, exports and recovery with explicit source lineage.',
    relationships: ['native', 'connected'],
    semesterOwns: ['Student-created files and notes', 'extraction outputs', 'source references', 'exports and recoverable trash'],
    externalAuthorities: ['Original institution retention systems where required', 'connected file providers'],
    authority: ['Students control their files and exports.', 'Collaborators act only through explicit shares.', 'Retention or legal holds override deletion only with visible authority.'],
    records: ['file_object', 'document', 'source_reference', 'version', 'share', 'export_job'],
    commands: ['upload_file', 'extract_document', 'create_version', 'share_file', 'export_file', 'delete_file'],
    events: ['file.uploaded', 'extraction.completed', 'version.created', 'file.shared', 'file.deleted'],
    integrations: ['Object storage', 'Google Drive', 'Microsoft files', 'AI gateway'],
    workflows: ['Upload and scan', 'Extraction review', 'Sharing', 'Export', 'Trash and permanent deletion'],
    screens: ['Files and notes', 'Document editor', 'Source detail', 'Version history', 'Export'],
    auditEvidence: ['Original hash and classification', 'Extraction/model version', 'Share scope', 'Export and deletion receipts'],
    dependencies: ['identity', 'authorization', 'consent'], capabilityIds: ['CAP-031', 'CAP-032', 'CAP-033', 'CAP-034', 'CAP-035', 'CAP-036', 'CAP-037', 'CAP-038', 'CAP-039', 'CAP-040'],
    externalGates: ['Malware and content scanning', 'Retention and legal-hold policy', 'Provider and export acceptance'],
    operations: { owner: 'Workspace platform and privacy' },
  }),
  passport({
    id: 'finance', name: 'Finance and Billing', purpose: 'Explain charges, plans and requests while regulated payment rails and the institutional ledger remain authoritative.',
    relationships: ['connected', 'orchestrated', 'embedded', 'linked'],
    semesterOwns: ['Billing display projection', 'planning assumptions', 'request workflow', 'receipts'],
    externalAuthorities: ['Institution ledger', 'payment processor', 'bursar decisions'],
    authority: ['Students and authorized payers view permitted balances.', 'Finance staff approve adjustments and payment plans.', 'Processors execute regulated settlement.'],
    records: ['ledger_projection', 'charge_reference', 'payment_plan_request', 'transaction_receipt'],
    commands: ['refresh_balance', 'request_payment_plan', 'preview_payment', 'submit_payment_handoff', 'reconcile_ledger'],
    events: ['balance.refreshed', 'payment_plan.requested', 'payment.handed_off', 'ledger.reconciled'],
    integrations: ['Bursar system', 'payment processor', 'Family'],
    workflows: ['Balance review', 'Payment-plan request', 'Payment handoff', 'Refund or adjustment approval', 'Reconciliation'],
    screens: ['Money', 'Charge detail', 'Payment-plan request', 'Payer view', 'Receipt'],
    auditEvidence: ['Ledger source/version', 'Payer authority', 'Previewed amount', 'Processor reference', 'Reconciliation result'],
    dependencies: ['identity', 'authorization', 'family', 'integrations'], capabilityIds: ['CAP-046'],
    externalGates: ['Finance-owner approval', 'PCI-scoped processor design', 'Concurrency, idempotency and reconciliation testing'],
    operations: { owner: 'Finance operations', alerts: ['Ledger mismatch', 'Duplicate or uncertain transaction', 'Stale balance at action time'] },
  }),
  passport({
    id: 'financial-aid', name: 'Financial Aid', purpose: 'Present a source-aware student view and queue without calculating or deciding official aid.',
    relationships: ['connected', 'orchestrated', 'embedded', 'linked'],
    semesterOwns: ['Student-facing projection', 'document checklist', 'question and review workflow'],
    externalAuthorities: ['Financial-aid system of record', 'authorized aid officers', 'federal and institutional rules'],
    authority: ['Students view and supply requested material.', 'Aid officers decide awards and verification.', 'Semester never estimates an award as official.'],
    records: ['aid_projection', 'requirement_reference', 'document_request', 'review_task'],
    commands: ['refresh_aid_status', 'submit_document_reference', 'request_review'],
    events: ['aid_status.refreshed', 'document.submitted', 'review.requested'],
    integrations: ['Financial-aid system', 'Documents', 'Finance'],
    workflows: ['Requirement checklist', 'Document handoff', 'Officer review', 'Status reconciliation'],
    screens: ['Aid overview', 'Requirement detail', 'Document handoff', 'Officer queue'],
    auditEvidence: ['Source/version and retrieval time', 'Document scope', 'Officer decision reference', 'Student-facing status changes'],
    dependencies: ['finance', 'documents', 'integrations'], capabilityIds: [],
    externalGates: ['Aid-office approval', 'Regulatory and counsel review', 'No award prediction or autonomous decision'],
    operations: { owner: 'Financial-aid operations' },
  }),
  passport({
    id: 'campus', name: 'Campus Services', purpose: 'Discover and prepare bounded campus-service actions without absorbing each service system of record.',
    relationships: ['native', 'connected', 'orchestrated', 'embedded', 'linked'],
    semesterOwns: ['Service directory', 'personal plans and preferences', 'request projections', 'safe handoffs'],
    externalAuthorities: ['Housing, dining, facilities, athletics, maps and service providers'],
    authority: ['Students manage personal plans.', 'Service staff decide official eligibility and fulfillment.', 'Actions use the owning service workflow.'],
    records: ['service', 'place', 'event_reference', 'service_request', 'preference'],
    commands: ['find_service', 'prepare_request', 'submit_handoff', 'cancel_local_plan'],
    events: ['service.viewed', 'request.prepared', 'handoff.completed'],
    integrations: ['Campus card', 'housing', 'maps', 'facilities', 'athletics'],
    workflows: ['Service discovery', 'Request preparation', 'Official handoff', 'Issue escalation'],
    screens: ['Campus services', 'Meal plan', 'Housing', 'Maps', 'Athletics'],
    auditEvidence: ['Service source and status', 'Scope of disclosed data', 'Action preview', 'Handoff result'],
    dependencies: ['identity', 'authorization', 'integrations'], capabilityIds: ['CAP-042', 'CAP-043', 'CAP-047', 'CAP-048', 'CAP-049'],
    externalGates: ['Service-owner agreement', 'Approved adapter or trusted link', 'No sample-data live claim'],
    operations: { owner: 'Campus experience and partner operations' },
  }),
  passport({
    id: 'community', name: 'Community and Communication', purpose: 'Support groups, events and communication with membership, moderation, safety and delivery truth.',
    relationships: ['native', 'connected'],
    semesterOwns: ['Group workspace', 'event planning', 'moderation workflow', 'message delivery projection'],
    externalAuthorities: ['Institution membership sources', 'approved mail, meeting and messaging providers'],
    authority: ['Members communicate within verified groups.', 'Moderators act under published rules.', 'Students control optional participation and reporting.'],
    records: ['community', 'membership', 'event', 'conversation', 'moderation_case'],
    commands: ['join_community', 'create_event', 'send_message', 'report_content', 'moderate_content'],
    events: ['membership.changed', 'event.published', 'message.delivered', 'content.reported', 'moderation.decided'],
    integrations: ['Institution group feed', 'mail', 'video', 'messaging'],
    workflows: ['Membership verification', 'Event publication', 'Message delivery', 'Report and moderation', 'Appeal'],
    screens: ['Clubs and activities', 'Group work', 'Email', 'Chat', 'Video call'],
    auditEvidence: ['Membership proof', 'Delivery status', 'Moderation reasons', 'Appeal and safety actions'],
    dependencies: ['identity', 'authorization', 'consent', 'integrations'], capabilityIds: ['CAP-026', 'CAP-051', 'CAP-057', 'CAP-058', 'CAP-059', 'CAP-060'],
    externalGates: ['Verified membership source', 'Moderation and safety staffing', 'Approved communication provider'],
    operations: { owner: 'Community trust and safety', alerts: ['Safety escalation', 'Provider delivery failure', 'Moderation SLA breach'] },
  }),
  passport({
    id: 'career', name: 'Career', purpose: 'Maintain student-controlled evidence and application planning with explicit consent and no invented eligibility or outcomes.',
    relationships: ['native', 'connected', 'orchestrated', 'linked'],
    semesterOwns: ['Career profile', 'confirmed skills', 'application plans', 'portfolio shares'],
    externalAuthorities: ['Employer ATS', 'career-center verification', 'credential issuers'],
    authority: ['Students confirm and share their evidence.', 'Institution staff verify only within authorized scope.', 'Employers decide applications externally.'],
    records: ['experience', 'skill', 'artifact', 'application_plan', 'portfolio_share'],
    commands: ['add_evidence', 'confirm_skill', 'request_verification', 'share_portfolio', 'track_application'],
    events: ['evidence.added', 'skill.confirmed', 'verification.requested', 'portfolio.shared'],
    integrations: ['Career center', 'credential provider', 'employer ATS links'],
    workflows: ['Evidence confirmation', 'Verification request', 'Portfolio sharing', 'Application planning'],
    screens: ['Career', 'Opportunities', 'Applications', 'People and letters', 'Pathway'],
    auditEvidence: ['Evidence source', 'Student confirmation', 'Consent and share expiry', 'Verification disposition'],
    dependencies: ['identity', 'consent', 'documents'], capabilityIds: ['CAP-052', 'CAP-053', 'CAP-054', 'CAP-055'],
    externalGates: ['Career-center scope', 'Employer sharing consent', 'No automated eligibility or submission'],
    operations: { owner: 'Career platform' },
  }),
  passport({
    id: 'family', name: 'Family and Supporters', purpose: 'Provide time-bounded, category-specific delegated access chosen by the student.',
    relationships: ['native', 'connected', 'orchestrated'],
    semesterOwns: ['Invitation', 'delegated categories and expiry', 'access history', 'revocation receipt'],
    externalAuthorities: ['Institution payer or supporter relationship where required', 'student consent'],
    authority: ['Students grant and revoke access.', 'Supporters use only accepted scopes.', 'Institution staff resolve verified relationship exceptions.'],
    records: ['supporter', 'family_invitation', 'family_grant', 'family_access_event'],
    commands: ['invite_supporter', 'accept_invitation', 'grant_family_access', 'revoke_family_access'],
    events: ['supporter.invited', 'family_access.granted', 'family_access.used', 'family_access.revoked'],
    integrations: ['Consent', 'Identity', 'Finance'],
    workflows: ['Invitation and verification', 'Grant acceptance', 'Scoped access', 'Immediate revocation'],
    screens: ['Family sharing', 'Supporter view', 'Access history', 'Revocation receipt'],
    auditEvidence: ['Verified recipient', 'Exact categories and expiry', 'Every disclosure', 'Revocation enforcement'],
    dependencies: ['identity', 'authorization', 'consent'], capabilityIds: ['CAP-041'],
    externalGates: ['Institution and counsel approval', 'Relationship verification', 'Revocation and disclosure negative tests'],
    operations: { owner: 'Privacy and institutional services', alerts: ['Revoked access attempt', 'Expired grant use', 'Disclosure outside category'] },
  }),
  passport({
    id: 'alumni', name: 'Alumni', purpose: 'Preserve portable, student-controlled records and engagement preferences after institutional affiliation changes.',
    relationships: ['native', 'connected', 'linked'],
    semesterOwns: ['Portable profile', 'exported artifacts', 'engagement preferences', 'alumni context'],
    externalAuthorities: ['Advancement CRM', 'credential issuers', 'institution alumni status'],
    authority: ['Alumni control their portable content and preferences.', 'Institutions attest alumni status and official credentials.', 'Advancement communications require lawful preference handling.'],
    records: ['alumni_profile', 'portable_artifact', 'engagement_preference', 'credential_reference'],
    commands: ['transition_to_alumni', 'export_portfolio', 'set_engagement_preference', 'disconnect_institution'],
    events: ['alumni_context.created', 'portfolio.exported', 'preference.changed', 'institution.disconnected'],
    integrations: ['Career', 'Documents', 'advancement CRM', 'credential wallet'],
    workflows: ['Affiliation transition', 'Portable export', 'Credential refresh', 'Communication preference'],
    screens: ['Alumni home', 'Portable profile', 'Credentials', 'Data connections'],
    auditEvidence: ['Transition basis', 'Portable-data selection', 'Credential source', 'Preference and disconnect history'],
    dependencies: ['identity', 'student-profile', 'career', 'documents'], capabilityIds: ['CAP-053'],
    externalGates: ['Alumni-status feed', 'Advancement consent and preference contract', 'Offboarding and retention approval'],
    operations: { owner: 'Lifecycle and career platform' },
  }),
  passport({
    id: 'institution-admin', name: 'Institution Administration', purpose: 'Manage tenant policy, configuration, integrations and release evidence without granting ambient access to student content.',
    relationships: ['native', 'connected', 'orchestrated'],
    semesterOwns: ['Tenant configuration', 'policy assignments', 'activation evidence', 'integration health projection'],
    externalAuthorities: ['Institution governance, contracts and accountable approvers'],
    authority: ['Institution administrators configure within delegated scope.', 'Independent approvers authorize high-risk activation.', 'Operators see metadata, not student content, unless purpose and policy allow.'],
    records: ['tenant_config', 'policy_assignment', 'activation_record', 'release_approval'],
    commands: ['update_tenant_config', 'request_activation', 'approve_activation', 'suspend_capability'],
    events: ['tenant_config.changed', 'activation.requested', 'activation.decided', 'capability.suspended'],
    integrations: ['Authorization', 'Integrations', 'Operations', 'release evidence'],
    workflows: ['Configuration change', 'Capability activation', 'Access review', 'Tenant offboarding'],
    screens: ['Institution console', 'Configuration Studio', 'Approvals', 'Integration health', 'Release evidence'],
    auditEvidence: ['Before/after configuration', 'Approvers and separation of duties', 'Evidence versions', 'Activation and suspension receipt'],
    dependencies: ['identity', 'authorization', 'integrations', 'operations'], capabilityIds: ['CAP-012', 'CAP-013'],
    externalGates: ['Executed tenant agreement', 'Named accountable owners', 'Tenant UAT and signed activation'],
    operations: { owner: 'Institution platform and implementation' },
  }),
  passport({
    id: 'integrations', name: 'Integrations', purpose: 'Connect external authorities through tenant-scoped, versioned mappings with freshness, retries and reconciliation.',
    relationships: ['connected', 'orchestrated', 'embedded', 'linked'],
    semesterOwns: ['Connector configuration references', 'mapping versions', 'sync state', 'reconciliation tasks'],
    externalAuthorities: ['SIS, LMS, identity, calendar, file, finance and campus providers'],
    authority: ['Tenant administrators approve scopes.', 'Integration operators manage health without unrestricted record access.', 'Source systems retain declared authority.'],
    records: ['connection', 'credential_reference', 'mapping_version', 'sync_cursor', 'reconciliation_task'],
    commands: ['connect_provider', 'rotate_credential', 'run_sync', 'retry_delivery', 'reconcile_source'],
    events: ['connection.changed', 'sync.started', 'sync.failed', 'source.stale', 'reconciliation.completed'],
    integrations: ['All approved external providers through connector passports'],
    workflows: ['Connector setup', 'Credential rotation', 'Pull/push sync', 'Failure recovery', 'Reconciliation'],
    screens: ['Connected accounts', 'Integration center', 'Mapping review', 'Operations queue'],
    auditEvidence: ['Tenant and scopes', 'Credential reference only', 'Mapping and adapter versions', 'Counts, failures and reconciliation'],
    dependencies: ['identity', 'authorization', 'operations'], capabilityIds: ['CAP-013'],
    externalGates: ['Provider agreement and credentials', 'Sandbox contract tests', 'Payload redaction and incident runbook'],
    operations: { owner: 'Integration operations', alerts: ['Credential failure', 'Freshness threshold breach', 'Dead-letter growth', 'Reconciliation mismatch'] },
  }),
  passport({
    id: 'ai-gateway', name: 'AI Gateway', purpose: 'Authorize retrieval and model use, preserve source proof and keep all consequential decisions with accountable people.',
    relationships: ['native', 'connected', 'orchestrated'],
    semesterOwns: ['Policy evaluation', 'authorized retrieval', 'model routing', 'output provenance', 'spend and refusal receipts'],
    externalAuthorities: ['Approved model providers', 'course and institution policy', 'source-system access decisions'],
    authority: ['Users request assistance within purpose and consent.', 'Policy owners approve models and use cases.', 'AI may draft or explain but may not approve or execute consequential actions.'],
    records: ['ai_request', 'retrieval_receipt', 'model_route', 'ai_output', 'evaluation_record'],
    commands: ['authorize_ai_request', 'retrieve_sources', 'route_model', 'record_feedback', 'disable_provider'],
    events: ['ai_request.allowed', 'ai_request.refused', 'model.routed', 'output.created', 'provider.disabled'],
    integrations: ['Approved model providers', 'Documents', 'Academic', 'Consent'],
    workflows: ['Request authorization', 'Source retrieval', 'Model routing and fallback', 'Human review', 'Provider incident'],
    screens: ['Semester Tutor', 'AI source details', 'Policy administration', 'Evaluation and spend'],
    auditEvidence: ['Purpose, consent and policy version', 'Source references and classification', 'Model/provider/version', 'Refusal and human review'],
    dependencies: ['identity', 'authorization', 'consent', 'documents', 'operations'], capabilityIds: ['CAP-027'],
    externalGates: ['Approved provider and data terms', 'Evaluation threshold and red-team evidence', 'Kill switch and spend limits'],
    operations: { owner: 'AI governance and platform engineering', alerts: ['Kill-switch failure', 'Policy bypass attempt', 'Provider incident', 'Spend threshold'] },
  }),
  passport({
    id: 'operations', name: 'Operations', purpose: 'Route incidents, exceptions, approvals and reconciliation through bounded queues with ownership and receipts.',
    relationships: ['native', 'connected', 'orchestrated'],
    semesterOwns: ['Queue items', 'ownership and SLA', 'incident state', 'decision trail', 'release evidence index'],
    externalAuthorities: ['Paging, ticketing and provider status systems where configured'],
    authority: ['Operators act only on assigned, purpose-limited work.', 'Approvers remain distinct where policy requires.', 'Sensitive content is minimized or redacted by default.'],
    records: ['queue_item', 'incident', 'escalation', 'decision', 'release_evidence'],
    commands: ['claim_queue_item', 'escalate_item', 'record_decision', 'resolve_incident', 'request_release_approval'],
    events: ['queue_item.created', 'queue_item.escalated', 'incident.declared', 'decision.recorded', 'incident.resolved'],
    integrations: ['Outbox', 'notification engine', 'paging', 'ticketing', 'all domain workflows'],
    workflows: ['Exception handling', 'Incident command', 'Approval', 'Reconciliation', 'Release decision'],
    screens: ['Operations inbox', 'Incident command', 'Approval queue', 'Dead letters', 'Release control'],
    auditEvidence: ['Source workflow and reason', 'Owner and SLA history', 'Decision authority', 'Receipt and resolution evidence'],
    dependencies: ['identity', 'authorization'], capabilityIds: ['CAP-002', 'CAP-014'],
    externalGates: ['Staffed rota and escalation tree', 'Exercised incident and rollback runbooks', 'Content-minimization review'],
    operations: { owner: 'Operations and SRE', serviceLevel: 'Queue-specific SLOs and incident severities are required before activation.', alerts: ['Unowned P0/P1 item', 'SLA breach', 'Dead-letter growth', 'Incident communication gap'] },
  }),
  passport({
    id: 'company-os', name: 'Company OS', purpose: 'Run Semester company work on shared governed primitives while keeping company, institution and student data boundaries distinct.',
    relationships: ['native', 'connected', 'orchestrated', 'linked'],
    semesterOwns: ['Internal pipeline and customer-success projections', 'implementation projects', 'decision records', 'internal metrics definitions'],
    externalAuthorities: ['Accounting, banking, payroll, legal, CRM and contract systems initially'],
    authority: ['Company staff act within named seats and least privilege.', 'Finance, legal and security approvals remain separated.', 'Institution and student records are unavailable without a scoped operational purpose.'],
    records: ['account', 'opportunity', 'implementation_project', 'vendor', 'contract_reference', 'company_metric'],
    commands: ['update_pipeline', 'create_implementation_project', 'request_contract_approval', 'review_vendor'],
    events: ['opportunity.changed', 'implementation.started', 'contract.approval_requested', 'vendor.reviewed'],
    integrations: ['CRM', 'accounting', 'contract management', 'support', 'analytics'],
    workflows: ['Sales handoff', 'Customer implementation', 'Contract approval', 'Vendor review', 'Investor reporting'],
    screens: ['Company command center', 'Pipeline', 'Customer success', 'Contracts', 'Vendor management'],
    auditEvidence: ['Seat and purpose', 'Source-system references', 'Approval chain', 'Metric definition/version'],
    dependencies: ['identity', 'authorization', 'operations'], capabilityIds: [],
    externalGates: ['Named company seats', 'Approved source systems and contracts', 'Separate tenant/data boundary verification'],
    operations: { owner: 'Company operations' },
  }),
  passport({
    id: 'developer-ecosystem', name: 'Developer Ecosystem', purpose: 'Expose bounded APIs, webhooks and partner tools without bypassing Semester policy, tenancy or evidence requirements.',
    relationships: ['native', 'connected'],
    semesterOwns: ['API client identities', 'scopes', 'webhook subscriptions', 'sandbox state', 'partner review records'],
    externalAuthorities: ['Partner applications and infrastructure'],
    authority: ['Tenant administrators approve installations and scopes.', 'Developers use only issued credentials and documented contracts.', 'Semester security can suspend a client or webhook.'],
    records: ['api_client', 'api_scope', 'webhook_subscription', 'partner_review', 'sandbox_tenant'],
    commands: ['create_api_client', 'rotate_client_secret', 'subscribe_webhook', 'approve_partner', 'suspend_client'],
    events: ['api_client.created', 'credential.rotated', 'webhook.delivered', 'partner.approved', 'client.suspended'],
    integrations: ['API gateway', 'Outbox', 'developer portal', 'partner systems'],
    workflows: ['Developer onboarding', 'Credential rotation', 'Webhook delivery and replay', 'Partner review'],
    screens: ['Developer portal', 'API credentials', 'Webhook inspector', 'Partner review', 'Sandbox'],
    auditEvidence: ['Tenant, client and scopes', 'Credential rotation without secret logging', 'Webhook attempts and signatures', 'Partner approval'],
    dependencies: ['identity', 'authorization', 'integrations', 'operations'], capabilityIds: [],
    externalGates: ['Public API security review', 'Rate limits and abuse response', 'Partner terms and review process'],
    operations: { owner: 'Platform engineering and security', alerts: ['Authentication abuse', 'Webhook failure rate', 'Scope escalation attempt'] },
  }),
] as const;

const nonEmpty = (values: readonly string[]): boolean => values.length > 0 && values.every((value) => value.trim().length > 0);

/** Returns every contract defect so CI can report a useful batch, not only the first one. */
export function validateSystemPassports(passports: readonly SystemPassport[] = SYSTEM_PASSPORTS): string[] {
  const errors: string[] = [];
  const ids = new Set(passports.map((item) => item.id));
  if (passports.length !== SYSTEM_IDS.length) errors.push(`expected ${SYSTEM_IDS.length} passports, got ${passports.length}`);
  for (const id of SYSTEM_IDS) if (!ids.has(id)) errors.push(`missing system: ${id}`);
  if (ids.size !== passports.length) errors.push('duplicate system id');

  for (const item of passports) {
    const requiredLists: [string, readonly string[]][] = [
      ['relationships', item.relationships], ['semesterOwns', item.semesterOwns], ['externalAuthorities', item.externalAuthorities],
      ['authority', item.authority], ['records', item.records], ['commands', item.commands], ['events', item.events],
      ['integrations', item.integrations], ['workflows', item.workflows], ['screens', item.screens], ['sourceRules', item.sourceRules],
      ['auditEvidence', item.auditEvidence], ['tests', item.tests], ['externalGates', item.externalGates],
      ['alerts', item.operations.alerts], ['featureFlags', item.operations.featureFlags],
    ];
    if (!item.name.trim() || !item.purpose.trim()) errors.push(`${item.id}: missing name or purpose`);
    for (const [field, values] of requiredLists) if (!nonEmpty(values)) errors.push(`${item.id}: missing ${field}`);
    for (const relationship of item.relationships) if (!SYSTEM_RELATIONSHIPS.includes(relationship)) errors.push(`${item.id}: unknown relationship ${relationship}`);
    for (const dependency of item.dependencies) {
      if (dependency === item.id) errors.push(`${item.id}: self dependency`);
      if (!ids.has(dependency)) errors.push(`${item.id}: unknown dependency ${dependency}`);
    }
    const operational = [item.operations.owner, item.operations.serviceLevel, item.operations.runbook, item.operations.rollback];
    if (operational.some((value) => !value.trim())) errors.push(`${item.id}: incomplete operations contract`);
  }
  return errors;
}
