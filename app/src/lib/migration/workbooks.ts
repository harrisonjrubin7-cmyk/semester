/**
 * The migration workbooks: one per kind of data, each saying what to bring,
 * how to tell it arrived *correctly*, and what to watch on the days that matter.
 *
 * A workbook is data, not prose, so three things can be tested rather than
 * hoped for: that every workbook has a check in every evidence class (none
 * can be count-only), that every check names a primitive in `checks.ts` that
 * produces its class, and that the pages under `docs/migration/workbooks/`
 * are exactly what this renders (`workbooks.test.ts` writes them with
 * `MIGRATION_DOCS=write`).
 *
 * What a workbook does *not* hold: the institution's own field names,
 * system names or business rules. Those are filled in per institution during
 * inventory and mapping (`docs/migration/02`, `03`). A workbook is the part
 * that is true of every institution, which is why it can be reused.
 */
import type { ApprovalArea } from './center';
import { DOMAIN_OWNER } from './signoff.ts';
import type { DataDomain, EvidenceClass, Severity } from './types.ts';

export type Primitive =
  | 'countParity' | 'keyParity' | 'valueParity' | 'referentialIntegrity'
  | 'historyPreserved' | 'temporalContinuity' | 'permissionParity' | 'aggregateParity' | 'outcomeParity';

/** Which primitives may stand behind which class. A check cannot claim a class its primitive does not produce. */
export const PRIMITIVE_CLASS: Readonly<Record<Primitive, EvidenceClass>> = {
  countParity: 'count',
  keyParity: 'key',
  valueParity: 'semantic',
  referentialIntegrity: 'relationship',
  historyPreserved: 'history',
  temporalContinuity: 'history',
  permissionParity: 'permission',
  aggregateParity: 'outcome',
  outcomeParity: 'outcome',
};

export interface WorkbookCheck {
  id: string;
  evidenceClass: EvidenceClass;
  severity: Severity;
  primitive: Primitive;
  /** What is compared, in plain words, for the institution's data steward. */
  what: string;
}

export interface WorkbookEntity {
  name: string;
  /** What identifies one of these in the source. Never a display name. */
  naturalKey: string;
  /** How much of the past must arrive. */
  history: 'full' | 'summary' | 'none';
  sensitivity: 'internal' | 'confidential' | 'restricted';
}

export interface Workbook {
  domain: DataDomain;
  title: string;
  /** The institution approver who signs this domain's gates. */
  owner: ApprovalArea;
  /** The sentence that says what "migrated" means for this data. */
  done: string;
  entities: readonly WorkbookEntity[];
  checks: readonly WorkbookCheck[];
  /** What goes wrong in this domain that a count will not show. */
  traps: readonly string[];
  /** The business results Semester must recompute, not copy. */
  outcomes: readonly string[];
  /** Calendar events the parallel run must include, or it has not been tested. */
  parallelEvents: readonly string[];
}

const k = (id: string, evidenceClass: EvidenceClass, severity: Severity, primitive: Primitive, what: string): WorkbookCheck => ({ id, evidenceClass, severity, primitive, what });
const e = (name: string, naturalKey: string, history: WorkbookEntity['history'], sensitivity: WorkbookEntity['sensitivity']): WorkbookEntity => ({ name, naturalKey, history, sensitivity });

export const WORKBOOKS: readonly Workbook[] = [
  {
    domain: 'identity',
    title: 'Identity',
    owner: DOMAIN_OWNER.identity,
    done: 'Every person who can sign in today can sign in as themselves, to the same things, and nobody else can.',
    entities: [
      e('person', 'institutional person id (not email, not name)', 'summary', 'restricted'),
      e('account / credential link', 'identity-provider subject + person id', 'summary', 'restricted'),
      e('role and group membership', 'person + group + effective dates', 'full', 'confidential'),
      e('alias (former name, former email)', 'person + alias + valid-from', 'full', 'restricted'),
    ],
    checks: [
      k('identity.count.persons', 'count', 'low', 'countParity', 'Persons by type (student, faculty, staff, alumnus, guest) against the source after declared exclusions'),
      k('identity.key.person_crosswalk', 'key', 'critical', 'keyParity', 'Every source person has exactly one Semester person; none without a source; no two people merged'),
      k('identity.semantic.name_and_status', 'semantic', 'high', 'valueParity', 'Legal name, preferred name, status code and privacy flags after the code table, including FERPA-style directory suppression'),
      k('identity.relationship.membership_targets', 'relationship', 'high', 'referentialIntegrity', 'Every role and group membership lands on a real person and a real group, and the right one'),
      k('identity.history.role_timeline', 'history', 'high', 'temporalContinuity', 'Role and status timelines keep their overlaps and gaps (a person who was student then staff is not both, and not neither)'),
      k('identity.history.aliases', 'history', 'medium', 'historyPreserved', 'Former names and emails keep their original dates so old records still resolve to the person'),
      k('identity.permission.effective_roles', 'permission', 'critical', 'permissionParity', 'Effective roles after group mapping equal the source\'s; no person gains administrator or advisor reach'),
      k('identity.outcome.sign_in_resolution', 'outcome', 'critical', 'outcomeParity', 'A sample of real sign-ins (SSO assertion in, person out) resolves to the same person the legacy system resolved'),
    ],
    traps: [
      'Email is reused: a graduate\'s address is reissued to a new student, and matching on it merges two people.',
      'A person with two source ids (admissions id, then student id) becomes two people, each with half a transcript.',
      'Suppression flags are optional fields in the source; a dropped flag publishes a student who had opted out.',
      'Group-to-role mapping is the largest silent escalation path; a broad "staff" group mapped to a role with advisor reach.',
    ],
    outcomes: ['Sign-in resolves to the same person', 'Effective role set per person', 'Directory visibility per person'],
    parallelEvents: ['term_start_sign_in_peak', 'role_change_batch'],
  },
  {
    domain: 'academic_records',
    title: 'Academic records',
    owner: DOMAIN_OWNER.academic_records,
    done: 'The transcript, standing and degree progress of every student recompute to what the registrar already certifies, and no past grade has changed.',
    entities: [
      e('term', 'term code', 'none', 'internal'),
      e('program of study (declared, with effective dates)', 'person + program + effective-from', 'full', 'confidential'),
      e('course result (grade, credits, repeat/forgiveness flags)', 'person + term + course + section', 'full', 'restricted'),
      e('transfer and test credit', 'person + source institution + course + award date', 'full', 'restricted'),
      e('academic standing and honours', 'person + term + standing code', 'full', 'restricted'),
      e('degree award', 'person + program + conferral date', 'full', 'restricted'),
    ],
    checks: [
      k('academic_records.count.results', 'count', 'low', 'countParity', 'Course results by term against the source'),
      k('academic_records.key.results', 'key', 'critical', 'keyParity', 'Each (person, term, course, section) result exists once'),
      k('academic_records.semantic.grades', 'semantic', 'critical', 'valueParity', 'Grade, grade points, credits attempted/earned and repeat flags after the grade-scale table; "W", "I", "P" are not collapsed'),
      k('academic_records.relationship.result_to_section', 'relationship', 'high', 'referentialIntegrity', 'Each result points at the section and term it was earned in, not just any section of that course'),
      k('academic_records.history.grade_changes', 'history', 'critical', 'historyPreserved', 'Grade change history keeps original dates, approvers and reasons; nothing says "changed by migration"'),
      k('academic_records.history.program_timeline', 'history', 'high', 'temporalContinuity', 'Program changes keep their effective dates with no new overlap or gap'),
      k('academic_records.permission.record_access', 'permission', 'critical', 'permissionParity', 'Who may read or change a transcript: student, advisor, registrar staff, faculty of record; no widening'),
      k('academic_records.outcome.gpa', 'outcome', 'critical', 'outcomeParity', 'Term and cumulative GPA recomputed in Semester from migrated results equals the registrar\'s figure for every student'),
      k('academic_records.outcome.degree_audit', 'outcome', 'critical', 'outcomeParity', 'Remaining requirements and degree-eligibility recomputed equal the legacy audit for a stratified sample plus every graduating student'),
    ],
    traps: [
      'Grade replacement and forgiveness rules change cumulative GPA while every row still matches.',
      'Catalog-year rules: a student audits under the catalog they entered, not the current one.',
      'Grades changed after posting are stored as the latest value; the audit trail is a separate table nobody extracted.',
      'In-progress terms migrate as final; a midterm grade becomes a transcript line.',
      'Legal and FERPA reading of who may see a record is for counsel and the registrar, not for the mapping.',
    ],
    outcomes: ['Term and cumulative GPA', 'Academic standing', 'Remaining degree requirements', 'Degree-conferral eligibility'],
    parallelEvents: ['grade_posting', 'term_close', 'degree_conferral_review'],
  },
  {
    domain: 'courses',
    title: 'Courses and catalog',
    owner: DOMAIN_OWNER.courses,
    done: 'Every catalog entry and scheduled section students can see or register for is the one the registrar published, with the same rules attached.',
    entities: [
      e('catalog entry', 'subject + number (+ catalog year)', 'full', 'internal'),
      e('section', 'term + course + section', 'summary', 'internal'),
      e('meeting pattern and room', 'section + days + start + end + room', 'summary', 'internal'),
      e('prerequisite / corequisite / restriction rule', 'course + rule id', 'full', 'internal'),
      e('instructor assignment', 'section + person + role', 'summary', 'internal'),
    ],
    checks: [
      k('courses.count.sections', 'count', 'low', 'countParity', 'Catalog entries and sections by term'),
      k('courses.key.sections', 'key', 'high', 'keyParity', 'No section lost or duplicated, including cross-listed and combined sections'),
      k('courses.semantic.schedule', 'semantic', 'high', 'valueParity', 'Credit hours, meeting days/times in the campus time zone, delivery mode, capacity and waitlist size'),
      k('courses.relationship.rules_and_instructors', 'relationship', 'high', 'referentialIntegrity', 'Prerequisites point at courses that exist in the right catalog year; instructors are real people with that role'),
      k('courses.history.catalog_years', 'history', 'medium', 'historyPreserved', 'Past catalog versions retained so old audits still resolve'),
      k('courses.history.effective_rules', 'history', 'medium', 'temporalContinuity', 'Rule effective-date ranges keep their shape'),
      k('courses.permission.edit_rights', 'permission', 'high', 'permissionParity', 'Who may edit a section, set capacity or override a prerequisite'),
      k('courses.outcome.seat_availability', 'outcome', 'high', 'aggregateParity', 'Seats taken and open per section equal the source at the same instant'),
    ],
    traps: [
      'Times stored without a zone become shifted by the migration host\'s zone, off by an hour twice a year.',
      'Cross-listed sections count their seats twice or lose the second listing.',
      'A prerequisite expressed as free text is migrated as free text and enforced by nobody.',
    ],
    outcomes: ['Seats open per section', 'Prerequisite-satisfied for sample students', 'Schedule as a student sees it'],
    parallelEvents: ['schedule_publish', 'capacity_change_batch'],
  },
  {
    domain: 'learning_content',
    title: 'Learning content',
    owner: DOMAIN_OWNER.learning_content,
    done: 'A faculty member opens last term\'s course and finds their materials, structure, assessments and grades as they left them, with the same students seeing the same things.',
    entities: [
      e('course site / shell', 'LMS course id + term', 'summary', 'internal'),
      e('content item (page, file, link, module)', 'course + item id + version', 'summary', 'internal'),
      e('assignment and assessment (including question banks)', 'course + assessment id', 'full', 'confidential'),
      e('submission and feedback', 'assessment + person + attempt', 'full', 'restricted'),
      e('gradebook entry', 'course + person + gradable item', 'full', 'restricted'),
      e('discussion and announcement', 'course + post id', 'summary', 'confidential'),
    ],
    checks: [
      k('learning_content.count.items', 'count', 'low', 'countParity', 'Items by type per course'),
      k('learning_content.key.items', 'key', 'high', 'keyParity', 'Every item in scope exists once; files are matched by content digest, not name'),
      k('learning_content.semantic.assessment_settings', 'semantic', 'high', 'valueParity', 'Points, weighting, due and availability dates (with zone), attempt limits, time limits, accommodations extensions'),
      k('learning_content.relationship.structure', 'relationship', 'high', 'referentialIntegrity', 'Items sit in the right module and course; embedded links and file references resolve; grade columns point at their assessments'),
      k('learning_content.history.submissions', 'history', 'critical', 'historyPreserved', 'Submissions keep original timestamps, attempt order and feedback authorship (late/on-time must survive)'),
      k('learning_content.permission.visibility', 'permission', 'critical', 'permissionParity', 'Draft vs published, section restrictions, per-student releases, instructor/TA/auditor roles; no unpublished item visible, no grade visible early'),
      k('learning_content.outcome.course_grade', 'outcome', 'critical', 'outcomeParity', 'Course total recomputed from migrated gradebook entries and weights equals the source\'s final grade for every student in sampled courses'),
      k('learning_content.outcome.render', 'outcome', 'medium', 'outcomeParity', 'A sampled item renders with the same content hash of its visible text, and media plays (accessibility alternatives retained)'),
    ],
    traps: [
      'Weights and dropped-lowest rules live in settings; items match and the final grade is wrong.',
      'Draft and hidden content migrates as published.',
      'Question-bank randomisation and attempt rules are dropped, turning a supervised exam into an open one.',
      'Alt text, captions and transcripts are stored as separate attachments and not carried.',
      'Copyright and licence status of third-party content is not ours to decide; counsel and the library decide what may be moved.',
    ],
    outcomes: ['Course grade per student', 'Visible-to-student set per assessment', 'Submission timeliness'],
    parallelEvents: ['assignment_due_cycle', 'grade_release', 'exam_window'],
  },
  {
    domain: 'enrollments',
    title: 'Enrollments',
    owner: DOMAIN_OWNER.enrollments,
    done: 'Every student is in exactly the sections the registrar says they are, with the same status, holds and registration eligibility.',
    entities: [
      e('enrollment (status, credits, grade mode)', 'person + term + course + section', 'full', 'restricted'),
      e('waitlist position', 'person + section + position + added-at', 'full', 'confidential'),
      e('registration hold and eligibility', 'person + hold type + effective dates', 'full', 'restricted'),
      e('registration window / appointment', 'term + audience + window', 'summary', 'internal'),
    ],
    checks: [
      k('enrollments.count.enrollments', 'count', 'low', 'countParity', 'Enrollments by term and status'),
      k('enrollments.key.enrollments', 'key', 'critical', 'keyParity', 'One enrollment per person per section; no student enrolled twice or lost'),
      k('enrollments.semantic.status', 'semantic', 'high', 'valueParity', 'Status (enrolled, waitlisted, withdrawn, audit), grade mode, credits and add/drop dates after code table'),
      k('enrollments.relationship.section_and_person', 'relationship', 'critical', 'referentialIntegrity', 'Each enrollment references a real person and the right section in the right term'),
      k('enrollments.history.add_drop', 'history', 'high', 'historyPreserved', 'Add/drop/withdraw events keep their dates (they decide tuition refunds and "W" vs "drop")'),
      k('enrollments.history.hold_timeline', 'history', 'high', 'temporalContinuity', 'Holds keep their start/end so a released hold is not re-imposed and an active one is not lost'),
      k('enrollments.permission.registration_eligibility', 'permission', 'critical', 'permissionParity', 'Who may register in which window; overrides and permission numbers'),
      k('enrollments.outcome.load_and_capacity', 'outcome', 'high', 'aggregateParity', 'Credit load per student and enrolment per section equal the source; no section over capacity that was not'),
    ],
    traps: [
      'A waitlist is ordered; counting its rows ignores that the order is the product.',
      'Withdrawn rows are filtered out as "inactive" and the transcript loses its Ws.',
      'Holds migrate without end dates and block registration for students who were cleared.',
    ],
    outcomes: ['Enrolled credits per student', 'Seats per section', 'Registration eligibility per student', 'Waitlist order'],
    parallelEvents: ['registration_window_open', 'add_drop_deadline', 'census_date'],
  },
  {
    domain: 'finance',
    title: 'Finance (student accounts)',
    owner: DOMAIN_OWNER.finance,
    done: 'Every student account balance, to the cent, is what the bursar already carries, every charge and payment still has its date and source, and nobody is charged or refunded twice.',
    entities: [
      e('account', 'person + account type', 'summary', 'restricted'),
      e('charge and credit (tuition, fees, adjustments)', 'transaction id', 'full', 'restricted'),
      e('payment and refund', 'transaction id + processor reference', 'full', 'restricted'),
      e('financial-aid award and disbursement', 'person + award year + fund + disbursement id', 'full', 'restricted'),
      e('payment plan', 'person + plan + schedule', 'full', 'restricted'),
      e('hold arising from balance', 'person + hold type + effective dates', 'full', 'restricted'),
    ],
    checks: [
      k('finance.count.transactions', 'count', 'low', 'countParity', 'Transactions by type and period'),
      k('finance.key.transactions', 'key', 'critical', 'keyParity', 'Each ledger transaction once; a re-run never doubles a charge'),
      k('finance.semantic.amounts', 'semantic', 'critical', 'valueParity', 'Amount in integer minor units, sign (charge vs credit), currency, detail code, posting vs effective date'),
      k('finance.relationship.transaction_to_account', 'relationship', 'critical', 'referentialIntegrity', 'Every transaction lands on the right account and term; refunds point at the payment they reverse'),
      k('finance.history.ledger_order', 'history', 'critical', 'historyPreserved', 'Ledger order and original posting dates and actors preserved; adjustments are not collapsed into balances'),
      k('finance.history.plan_schedule', 'history', 'high', 'temporalContinuity', 'Payment plan installments and aid disbursements keep their date structure'),
      k('finance.permission.account_access', 'permission', 'critical', 'permissionParity', 'Who may see an account: the student, authorised payers, bursar staff; no guardian access that was not granted'),
      k('finance.outcome.balance_by_account', 'outcome', 'critical', 'aggregateParity', 'Balance per account recomputed from the migrated ledger equals the bursar\'s, exactly (tolerance zero)'),
      k('finance.outcome.control_totals', 'outcome', 'critical', 'aggregateParity', 'Control totals per fund and period tie to the general ledger; aid disbursed equals aid awarded less cancellations'),
    ],
    traps: [
      'Floating-point sums report pennies of drift that is arithmetic, and hide real ones.',
      'Pending authorisations migrate as settled payments.',
      'Refund-to-original-method rules require the processor reference, which sits outside the SIS.',
      'Tax and reporting forms depend on posting date, not effective date; the two are swapped.',
      'Payment card data is not migrated; tokens and processor accounts are handled by the processor and by counsel on PCI scope, not by this team.',
    ],
    outcomes: ['Balance per account', 'Total by fund and period', 'Aid disbursed vs awarded', 'Balance-based holds'],
    parallelEvents: ['billing_run', 'payment_posting_cycle', 'aid_disbursement', 'refund_run', 'term_close'],
  },
  {
    domain: 'family',
    title: 'Family and guardian relationships',
    owner: DOMAIN_OWNER.family,
    done: 'Each guardian or authorised contact can see exactly what the student and the institution\'s policy have consented to, and nothing more, on the first day.',
    entities: [
      e('relationship (guardian, parent, authorised payer, emergency contact)', 'student + related person + type', 'full', 'restricted'),
      e('consent and release (what may be shared, with whom, until when)', 'student + related person + scope + dates', 'full', 'restricted'),
      e('contact method', 'person + method + verified-at', 'summary', 'restricted'),
      e('age and majority status', 'person + effective date', 'full', 'restricted'),
    ],
    checks: [
      k('family.count.relationships', 'count', 'low', 'countParity', 'Relationships by type'),
      k('family.key.relationships', 'key', 'high', 'keyParity', 'Each (student, related person, type) once; a guardian shared by siblings is one person'),
      k('family.semantic.scope_and_dates', 'semantic', 'critical', 'valueParity', 'Consent scope, start and expiry, revocation, and whether the release was given by the student or an authorised proxy'),
      k('family.relationship.targets', 'relationship', 'critical', 'referentialIntegrity', 'Every relationship joins two real people, in the right direction'),
      k('family.history.consent_trail', 'history', 'critical', 'historyPreserved', 'Consent grants and revocations keep original time and actor; a revocation is never dropped'),
      k('family.history.access_windows', 'history', 'high', 'temporalContinuity', 'Release windows keep their shape; none silently extended or left open-ended'),
      k('family.permission.guardian_visibility', 'permission', 'critical', 'permissionParity', 'For every guardian: the set of things visible equals the consented set. Widening is a stop-the-line failure'),
      k('family.outcome.visible_to_guardian', 'outcome', 'critical', 'outcomeParity', 'For sampled guardians (and every one with a revoked or expired release) the rendered view equals the permitted view'),
    ],
    traps: [
      'Legacy portals gave parents blanket access; migrating that as "consent" creates consent nobody gave.',
      'A student who has reached majority keeps a minor\'s release record that no longer applies.',
      'Custody and court orders are free text in notes; the restriction is lost with the notes.',
      'What counts as valid consent or a valid proxy, by jurisdiction and policy, is a legal question for qualified counsel.',
    ],
    outcomes: ['Visible set per guardian', 'Revoked-access set stays empty', 'Notification recipients per student'],
    parallelEvents: ['term_start', 'consent_revocation_batch'],
  },
  {
    domain: 'campus_services',
    title: 'Campus services',
    owner: DOMAIN_OWNER.campus_services,
    done: 'Housing, dining, events, athletics, advising and support requests continue without a student having to re-apply, re-book or re-explain.',
    entities: [
      e('housing application and assignment', 'person + term + assignment', 'full', 'restricted'),
      e('meal plan and dining balance', 'person + plan + term', 'summary', 'confidential'),
      e('event, RSVP and organisation membership', 'event id / organisation + person', 'summary', 'internal'),
      e('appointment and advising note', 'appointment id / person + advisor + date', 'full', 'restricted'),
      e('support or service request', 'ticket id', 'full', 'confidential'),
      e('accommodation record', 'person + accommodation + effective dates', 'full', 'restricted'),
    ],
    checks: [
      k('campus_services.count.records', 'count', 'low', 'countParity', 'Records by service'),
      k('campus_services.key.records', 'key', 'high', 'keyParity', 'No booking, assignment or request lost or duplicated'),
      k('campus_services.semantic.times_and_places', 'semantic', 'high', 'valueParity', 'Dates and times in campus zone, room/bed identifiers, plan codes, status'),
      k('campus_services.relationship.targets', 'relationship', 'high', 'referentialIntegrity', 'Assignments reference real rooms and people; appointments reference real advisors'),
      k('campus_services.history.service_trail', 'history', 'high', 'historyPreserved', 'Advising notes and request threads keep authorship and dates'),
      k('campus_services.history.assignments', 'history', 'medium', 'temporalContinuity', 'Housing and plan effective dates keep their shape'),
      k('campus_services.permission.sensitive_notes', 'permission', 'critical', 'permissionParity', 'Advising, counselling-adjacent, disability and conduct records visible only to the roles that could see them; no widening to general staff'),
      k('campus_services.outcome.occupancy_and_balance', 'outcome', 'high', 'aggregateParity', 'Occupancy per building, dining balances and event headcount equal the source'),
    ],
    traps: [
      'Accommodation records are among the most sensitive; widening them is critical even if the count is exact.',
      'Dining balances are stored value: a rounding or sign error is a financial one.',
      'Conduct and counselling records have their own legal regimes; whether they migrate at all is a decision for counsel and the data owner.',
    ],
    outcomes: ['Occupancy per building', 'Dining balance per student', 'Upcoming appointments per student', 'Open requests per owner'],
    parallelEvents: ['move_in', 'event_peak', 'housing_selection'],
  },
  {
    domain: 'career',
    title: 'Career',
    owner: DOMAIN_OWNER.career,
    done: 'A student or alumnus keeps their applications, employer relationships, experience records and verified achievements, and employers see only what was shared with them.',
    entities: [
      e('career profile and experience', 'person + record id', 'summary', 'confidential'),
      e('application and offer', 'person + posting + application id', 'full', 'confidential'),
      e('employer and posting', 'employer id / posting id', 'summary', 'internal'),
      e('career appointment and note', 'appointment id', 'full', 'confidential'),
      e('verified credential or achievement', 'person + credential + issuer + issued-at', 'full', 'confidential'),
      e('alumni record', 'person + graduation + program', 'full', 'confidential'),
    ],
    checks: [
      k('career.count.records', 'count', 'low', 'countParity', 'Applications, postings and credentials by type'),
      k('career.key.applications', 'key', 'high', 'keyParity', 'Each application once; employers matched across spelling and merger'),
      k('career.semantic.status_and_dates', 'semantic', 'medium', 'valueParity', 'Application stage, offer status, dates, outcome codes'),
      k('career.relationship.targets', 'relationship', 'high', 'referentialIntegrity', 'Applications reference live postings, postings reference employers'),
      k('career.history.pipeline', 'history', 'medium', 'historyPreserved', 'Stage history of each application keeps original dates'),
      k('career.history.credential_validity', 'history', 'high', 'temporalContinuity', 'Credential issue/expiry ranges keep their shape'),
      k('career.permission.sharing', 'permission', 'critical', 'permissionParity', 'What each employer or recruiter can see equals what the student shared; nothing shared by default'),
      k('career.outcome.verified_achievements', 'outcome', 'high', 'outcomeParity', 'Each credential still verifies against its issuer after migration; placement figures recompute to the published ones'),
    ],
    traps: [
      'Student-shared and institution-held are one table; migrating it as one gives employers the institution\'s notes.',
      'Placement statistics are published externally; recomputation differences are reputational and sometimes reportable.',
      'Alumni consent to be contacted is a separate record from the academic one.',
    ],
    outcomes: ['Applications per student by stage', 'Verified-credential set', 'Employer-visible set per student', 'Published placement figures'],
    parallelEvents: ['career_fair', 'recruiting_cycle_close'],
  },
  {
    domain: 'documents',
    title: 'Documents',
    owner: DOMAIN_OWNER.documents,
    done: 'Every document in scope is present byte-for-byte, attached to the right person or record, readable only by who could read it, with its retention clock intact.',
    entities: [
      e('document (file with metadata)', 'content digest + record it belongs to', 'summary', 'restricted'),
      e('document attachment link', 'document + record + role', 'summary', 'restricted'),
      e('retention and hold status', 'document + schedule + hold', 'full', 'restricted'),
      e('signature or approval on a document', 'document + signer + signed-at', 'full', 'restricted'),
    ],
    checks: [
      k('documents.count.documents', 'count', 'low', 'countParity', 'Documents by type'),
      k('documents.key.digests', 'key', 'critical', 'keyParity', 'Each source file\'s SHA-256 appears exactly once on the target; none missing, none substituted'),
      k('documents.semantic.metadata', 'semantic', 'high', 'valueParity', 'Document type, effective date, language, and media type after code table; no filename-as-identity'),
      k('documents.relationship.attachment_targets', 'relationship', 'critical', 'referentialIntegrity', 'Each document is attached to the right person or record; no document on a different student'),
      k('documents.history.signatures', 'history', 'critical', 'historyPreserved', 'Signatures and approvals keep signer, time and the digest they covered'),
      k('documents.history.retention_clock', 'history', 'high', 'temporalContinuity', 'Retention start, schedule and legal-hold intervals keep their shape; a hold is never lost'),
      k('documents.permission.read_access', 'permission', 'critical', 'permissionParity', 'Who can open each document class equals the source\'s'),
      k('documents.outcome.retrieval', 'outcome', 'high', 'outcomeParity', 'A sample of documents opens and its digest equals the source\'s; a destruction run computes the same due set as the legacy schedule'),
    ],
    traps: [
      'Re-encoding or OCR "improves" a file and breaks its digest and its signature validity.',
      'Retention starts at the migration date and resets every clock.',
      'A legal hold is a flag on the old system\'s record and has nowhere to go; the documents become deletable.',
      'Retention periods and legal-hold duties are the institution\'s records schedule and counsel\'s, never defaulted here.',
    ],
    outcomes: ['Digest equality per document', 'Attachment target per document', 'Destruction-due set', 'Hold set'],
    parallelEvents: ['retention_run', 'records_request'],
  },
];

export const WORKBOOK_BY_DOMAIN: Readonly<Record<DataDomain, Workbook>> = Object.fromEntries(WORKBOOKS.map((w) => [w.domain, w])) as Record<DataDomain, Workbook>;
